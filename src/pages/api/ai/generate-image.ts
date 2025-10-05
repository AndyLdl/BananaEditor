// 图片生成API路由
import type { APIRoute } from 'astro';
import { GeminiClient, GeminiAPIError } from '../../../utils/gemini-client';
import { processImage, ImageProcessingError } from '../../../utils/image-processor';
import { defaultSecurityMiddleware, SecurityError, setSecurityHeaders, logSecurityEvent } from '../../../utils/security';
import { withErrorHandling } from '../../../utils/error-handler';
import { defaultNetworkRetry } from '../../../utils/network-retry';
import { defaultErrorLogger } from '../../../utils/error-logger';
import { UPLOAD_CONFIG } from '../../../config/upload';
import { promises as fs } from 'fs';
import path from 'path';

// 图片生成请求接口
interface GenerateImageRequest {
    imageUrl?: string;
    imageData?: string; // Base64编码的图片数据
    prompt: string;
    style?: string;
    quality?: 'standard' | 'high';
    model?: string;
}

// 图片生成响应接口
interface GenerateImageResponse {
    success: boolean;
    data?: {
        generatedText: string;
        imageUrl?: string;
        requestId: string;
        processingTime: number;
        model: string;
    };
    error?: {
        code: string;
        message: string;
        details?: any;
    };
}

// 从URL加载图片
async function loadImageFromUrl(imageUrl: string): Promise<Buffer> {
    try {
        // 验证URL格式
        const url = new URL(imageUrl);

        // 只允许本地上传的图片
        if (!imageUrl.startsWith('/uploads/') && !imageUrl.startsWith('/temp/')) {
            throw new Error('只允许使用已上传的图片');
        }

        // 构建完整的文件路径
        let filePath: string;
        if (imageUrl.startsWith('/uploads/')) {
            const filename = path.basename(imageUrl);
            filePath = path.join(UPLOAD_CONFIG.UPLOAD_DIR, filename);
        } else if (imageUrl.startsWith('/temp/')) {
            const filename = path.basename(imageUrl);
            filePath = path.join(UPLOAD_CONFIG.TEMP_DIR, filename);
        } else {
            throw new Error('无效的图片URL');
        }

        // 安全检查：防止路径遍历
        const resolvedPath = path.resolve(filePath);
        const uploadDir = path.resolve(UPLOAD_CONFIG.UPLOAD_DIR);
        const tempDir = path.resolve(UPLOAD_CONFIG.TEMP_DIR);

        if (!resolvedPath.startsWith(uploadDir) && !resolvedPath.startsWith(tempDir)) {
            throw new Error('无效的文件路径');
        }

        // 读取文件
        const buffer = await fs.readFile(filePath);
        return buffer;

    } catch (error) {
        throw new Error(`加载图片失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
}

// 处理Gemini API响应
function processGeminiResponse(response: any): string {
    try {
        if (!response || !response.candidates || response.candidates.length === 0) {
            throw new Error('API返回了空的响应');
        }

        const candidate = response.candidates[0];

        if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
            throw new Error('响应中没有生成的内容');
        }

        const generatedText = candidate.content.parts[0].text;

        if (!generatedText || generatedText.trim().length === 0) {
            throw new Error('生成的内容为空');
        }

        return generatedText.trim();

    } catch (error) {
        throw new Error(`处理API响应失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
}

// 验证请求参数
function validateGenerateRequest(body: any): GenerateImageRequest {
    const errors: string[] = [];

    // 验证提示词
    if (!body.prompt || typeof body.prompt !== 'string') {
        errors.push('提示词是必需的');
    } else if (body.prompt.trim().length === 0) {
        errors.push('提示词不能为空');
    } else if (body.prompt.length > 2000) {
        errors.push('提示词长度不能超过2000字符');
    }

    // 验证图片数据
    if (!body.imageUrl && !body.imageData) {
        errors.push('必须提供图片URL或图片数据');
    }

    if (body.imageUrl && body.imageData) {
        errors.push('不能同时提供图片URL和图片数据');
    }

    // 验证可选参数
    if (body.quality && !['standard', 'high'].includes(body.quality)) {
        errors.push('质量参数必须是 standard 或 high');
    }

    if (errors.length > 0) {
        throw new SecurityError(
            `请求参数验证失败: ${errors.join(', ')}`,
            'INVALID_REQUEST_PARAMS',
            { errors }
        );
    }

    return {
        imageUrl: body.imageUrl,
        imageData: body.imageData,
        prompt: body.prompt.trim(),
        style: body.style || 'creative',
        quality: body.quality || 'standard',
        model: body.model || 'gemini-pro-vision'
    };
}

const handleGenerateImage: APIRoute = async ({ request }) => {
    const startTime = Date.now();
    let sessionId = '';
    let clientIP = '';
    let requestId = '';

    try {
        // 1. 安全验证
        const securityCheck = defaultSecurityMiddleware.validateRequest(request);
        sessionId = securityCheck.sessionId;
        clientIP = securityCheck.clientIP;

        // 2. 解析请求体
        const body = await request.json();

        // 3. 验证请求参数
        const validatedRequest = validateGenerateRequest(body);

        // 4. 清理提示词
        const sanitizedPrompt = defaultSecurityMiddleware.sanitizePrompt(validatedRequest.prompt);

        // 5. 初始化Gemini客户端
        const geminiClient = new GeminiClient();
        requestId = geminiClient.generateRequestId();

        // 6. 获取图片数据
        let imageBuffer: Buffer;
        let imageBase64: string;

        if (validatedRequest.imageUrl) {
            // 从URL加载图片
            imageBuffer = await loadImageFromUrl(validatedRequest.imageUrl);
        } else if (validatedRequest.imageData) {
            // 从Base64数据解码图片
            try {
                imageBuffer = Buffer.from(validatedRequest.imageData, 'base64');
            } catch (error) {
                throw new SecurityError(
                    'Base64图片数据格式无效',
                    'INVALID_IMAGE_DATA'
                );
            }
        } else {
            throw new SecurityError(
                '未提供有效的图片数据',
                'NO_IMAGE_DATA'
            );
        }

        // 7. 处理和验证图片
        const processedResult = await processImage(imageBuffer, {
            validation: {
                maxWidth: 4096,
                maxHeight: 4096,
                minWidth: 32,
                minHeight: 32
            },
            compression: {
                quality: validatedRequest.quality === 'high' ? 95 : 85,
                width: validatedRequest.quality === 'high' ? undefined : 1024,
                height: validatedRequest.quality === 'high' ? undefined : 1024
            },
            targetFormat: 'jpeg', // Gemini API推荐使用JPEG
            stripMeta: true,
            securityCheck: true
        });

        imageBase64 = processedResult.base64;

        // 8. 构建增强的提示词
        const enhancedPrompt = `基于提供的图片，${sanitizedPrompt}。请生成详细的图片描述和创作建议。风格要求：${validatedRequest.style}`;

        // 9. 调用Gemini API（带重试机制）
        console.log(`开始图片生成请求 ${requestId}`);
        const geminiResponse = await defaultNetworkRetry.executeWithRetry(
            () => geminiClient.generateImage(
                imageBase64,
                enhancedPrompt,
                {
                    model: validatedRequest.model,
                    quality: validatedRequest.quality
                }
            ),
            {
                operationName: 'gemini-generate-image',
                requestId,
                sessionId
            }
        );

        // 10. 处理API响应
        const generatedText = processGeminiResponse(geminiResponse);

        // 11. 计算处理时间
        const processingTime = Date.now() - startTime;

        // 12. 构建成功响应
        const responseData: GenerateImageResponse = {
            success: true,
            data: {
                generatedText,
                requestId,
                processingTime,
                model: validatedRequest.model || 'gemini-pro-vision'
            }
        };

        console.log(`图片生成请求 ${requestId} 完成，耗时 ${processingTime}ms`);

        const response = new Response(JSON.stringify(responseData), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

        return setSecurityHeaders(response);

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error(`图片生成请求失败 (${requestId}):`, error);

        // 记录错误日志
        await defaultErrorLogger.logError({
            id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: error instanceof SecurityError ? 'SECURITY_ERROR' :
                error instanceof GeminiAPIError ? 'API_ERROR' :
                    error instanceof ImageProcessingError ? 'PROCESSING_ERROR' : 'UNKNOWN_ERROR',
            severity: error instanceof SecurityError && error.code === 'RATE_LIMITED' ? 'medium' : 'high',
            code: (error as any).code || 'UNKNOWN',
            message: error.message,
            stack: error.stack,
            requestId,
            sessionId,
            clientIP,
            endpoint: '/api/ai/generate-image',
            method: 'POST',
            userAgent: request.headers.get('user-agent') || undefined,
            timestamp: new Date(),
            processingTime,
            details: { error: error.message }
        });

        // 记录安全事件
        if (error instanceof SecurityError) {
            logSecurityEvent({
                type: 'VALIDATION_FAILED',
                sessionId,
                clientIP,
                details: {
                    error: error.message,
                    code: error.code,
                    requestId,
                    processingTime
                }
            });
        }

        // 处理不同类型的错误
        let errorResponse: GenerateImageResponse;

        if (error instanceof GeminiAPIError) {
            errorResponse = {
                success: false,
                error: {
                    code: error.code,
                    message: `AI服务错误: ${error.message}`
                }
            };
        } else if (error instanceof ImageProcessingError) {
            errorResponse = {
                success: false,
                error: {
                    code: error.code,
                    message: `图片处理错误: ${error.message}`
                }
            };
        } else if (error instanceof SecurityError) {
            const statusCode = error.code === 'RATE_LIMITED' ? 429 : 400;
            errorResponse = {
                success: false,
                error: {
                    code: error.code,
                    message: error.message
                }
            };

            return new Response(JSON.stringify(errorResponse), {
                status: statusCode,
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            // 通用错误处理
            errorResponse = {
                success: false,
                error: {
                    code: 'GENERATION_FAILED',
                    message: '图片生成失败，请稍后重试'
                }
            };
        }

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

// 使用错误处理装饰器包装API路由
export const POST: APIRoute = withErrorHandling(handleGenerateImage);

// 获取生成历史记录的GET接口（可选功能）
const handleGetInfo: APIRoute = async ({ request, url }) => {
    try {
        // 安全验证
        const securityCheck = defaultSecurityMiddleware.validateRequest(request);

        // 这里可以实现获取用户的生成历史记录
        // 目前返回基本的API信息
        const response = new Response(JSON.stringify({
            success: true,
            data: {
                endpoint: '/api/ai/generate-image',
                methods: ['POST'],
                description: 'AI图片生成服务',
                supportedFormats: ['image/jpeg', 'image/png', 'image/webp'],
                maxImageSize: '10MB',
                models: ['gemini-pro-vision'],
                qualities: ['standard', 'high']
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

        return setSecurityHeaders(response);

    } catch (error) {
        console.error('获取API信息失败:', error);

        if (error instanceof SecurityError) {
            const statusCode = error.code === 'RATE_LIMITED' ? 429 : 403;
            return new Response(JSON.stringify({
                success: false,
                error: {
                    code: error.code,
                    message: error.message
                }
            }), {
                status: statusCode,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({
            success: false,
            error: {
                code: 'GET_INFO_FAILED',
                message: '获取API信息失败'
            }
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export const GET: APIRoute = withErrorHandling(handleGetInfo);