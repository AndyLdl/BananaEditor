// BananaEditor图片生成API路由
// 专为BananaEditor设计的图片生成服务
// 现在支持 Google Cloud Functions + Vertex AI

import type { APIRoute } from 'astro';
import { GeminiClient, GeminiAPIError } from '../../../utils/gemini-client';
import { processImage, ImageProcessingError } from '../../../utils/image-processor';
import { defaultSecurityMiddleware, SecurityError, setSecurityHeaders, logSecurityEvent } from '../../../utils/security';
import { defaultEnhancedSecurity } from '../../../utils/enhanced-security';
import { withErrorHandling } from '../../../utils/error-handler';
import { defaultNetworkRetry } from '../../../utils/network-retry';
import { defaultErrorLogger } from '../../../utils/error-logger';
import { UPLOAD_CONFIG } from '../../../config/upload';
import { promises as fs } from 'fs';
import path from 'path';

// BananaEditor图片生成请求接口
interface BananaGenerateRequest {
    prompt: string;
    image?: File | string; // 可以是文件或base64字符串
    style?: string;
    quality?: 'standard' | 'high' | 'ultra';
    creativity?: number; // 0-100
    colorTone?: string;
    aspectRatio?: string;
    outputFormat?: 'jpeg' | 'png' | 'webp';
}

// BananaEditor图片生成响应接口
interface BananaGenerateResponse {
    success: boolean;
    data?: {
        imageUrl: string;
        thumbnailUrl?: string;
        generatedPrompt?: string;
        metadata: {
            requestId: string;
            processingTime: number;
            model: string;
            style: string;
            quality: string;
            dimensions: {
                width: number;
                height: number;
            };
            fileSize: number;
            format: string;
        };
        suggestions?: string[];
    };
    error?: {
        code: string;
        message: string;
        details?: any;
    };
}

// 验证BananaEditor请求参数
async function validateBananaGenerateRequest(formData: FormData): Promise<BananaGenerateRequest> {
    const errors: string[] = [];

    // 获取提示词
    const prompt = formData.get('prompt') as string;
    if (!prompt || typeof prompt !== 'string') {
        errors.push('提示词是必需的');
    } else if (prompt.trim().length === 0) {
        errors.push('提示词不能为空');
    } else if (prompt.length > 2000) {
        errors.push('提示词长度不能超过2000字符');
    }

    // 获取图片文件（可选）
    const imageFile = formData.get('image') as File;
    let imageData: File | string | undefined;

    if (imageFile && imageFile.size > 0) {
        // 使用增强的文件验证
        try {
            await defaultEnhancedSecurity.validateFileUpload(imageFile);
        } catch (error) {
            if (error instanceof SecurityError) {
                errors.push(error.message);
            } else {
                errors.push('文件验证失败');
            }
        }

        imageData = imageFile;
    }

    // 验证可选参数
    const quality = formData.get('quality') as string;
    if (quality && !['standard', 'high', 'ultra'].includes(quality)) {
        errors.push('质量参数必须是 standard、high 或 ultra');
    }

    const creativity = formData.get('creativity') as string;
    if (creativity) {
        const creativityNum = parseInt(creativity);
        if (isNaN(creativityNum) || creativityNum < 0 || creativityNum > 100) {
            errors.push('创意程度必须是0-100之间的数字');
        }
    }

    if (errors.length > 0) {
        throw new SecurityError(
            `BananaEditor请求参数验证失败: ${errors.join(', ')}`,
            'INVALID_BANANA_REQUEST_PARAMS',
            { errors }
        );
    }

    return {
        prompt: prompt.trim(),
        image: imageData,
        style: (formData.get('style') as string) || 'creative',
        quality: (quality as any) || 'standard',
        creativity: creativity ? parseInt(creativity) : 50,
        colorTone: (formData.get('colorTone') as string) || '',
        aspectRatio: (formData.get('aspectRatio') as string) || '1:1',
        outputFormat: ((formData.get('outputFormat') as string) || 'jpeg') as any
    };
}

// 构建BananaEditor专用的增强提示词
function buildBananaPrompt(request: BananaGenerateRequest): string {
    let enhancedPrompt = `使用nano banana AI技术，${request.prompt}`;

    // 添加风格指导
    if (request.style && request.style !== 'creative') {
        const styleMap: Record<string, string> = {
            'realistic': '采用写实摄影风格，注重细节和真实感',
            'artistic': '采用艺术绘画风格，富有创意和表现力',
            'cartoon': '采用卡通动漫风格，色彩鲜艳可爱',
            'watercolor': '采用水彩画风格，柔和渐变的色调',
            'oil-painting': '采用油画风格，厚重的笔触和丰富的质感',
            'sketch': '采用素描风格，线条清晰简洁',
            'digital-art': '采用数字艺术风格，现代感强烈'
        };

        if (styleMap[request.style]) {
            enhancedPrompt += `，${styleMap[request.style]}`;
        }
    }

    // 添加色调指导
    if (request.colorTone) {
        const colorMap: Record<string, string> = {
            'warm': '使用暖色调，营造温馨舒适的氛围',
            'cool': '使用冷色调，营造清新宁静的感觉',
            'vibrant': '使用鲜艳明亮的色彩，充满活力',
            'muted': '使用柔和低饱和度的色彩，优雅内敛',
            'monochrome': '使用单色调或黑白效果，突出形式美感'
        };

        if (colorMap[request.colorTone]) {
            enhancedPrompt += `，${colorMap[request.colorTone]}`;
        }
    }

    // 添加质量要求
    const qualityMap: Record<string, string> = {
        'standard': '标准质量',
        'high': '高质量，4K分辨率，细节丰富',
        'ultra': '超高质量，8K分辨率，极致细节，专业级别'
    };

    enhancedPrompt += `，${qualityMap[request.quality]}`;

    // 添加创意程度指导
    if (request.creativity <= 30) {
        enhancedPrompt += '，保持保守稳重的创作风格';
    } else if (request.creativity >= 70) {
        enhancedPrompt += '，采用大胆创新的创作风格，富有想象力';
    } else {
        enhancedPrompt += '，平衡创新与实用性';
    }

    // 添加BananaEditor品牌特色
    enhancedPrompt += '。请确保结果体现nano banana AI的专业品质和创新精神。';

    return enhancedPrompt;
}

// 处理图片文件并转换为base64
async function processImageFile(imageFile: File): Promise<string> {
    try {
        // 读取文件数据
        const arrayBuffer = await imageFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 处理和验证图片
        const processedResult = await processImage(buffer, {
            validation: {
                maxWidth: 4096,
                maxHeight: 4096,
                minWidth: 32,
                minHeight: 32
            },
            compression: {
                quality: 90,
                width: 1024,
                height: 1024
            },
            targetFormat: 'jpeg',
            stripMeta: true,
            securityCheck: true
        });

        return processedResult.base64;

    } catch (error) {
        throw new ImageProcessingError(
            `处理上传图片失败: ${error instanceof Error ? error.message : '未知错误'}`,
            'BANANA_IMAGE_PROCESSING_FAILED'
        );
    }
}

// 保存生成的图片到临时目录
async function saveGeneratedImage(imageData: string, format: string, requestId: string): Promise<{ url: string, thumbnailUrl: string, fileSize: number, dimensions: { width: number, height: number } }> {
    try {
        // 确保临时目录存在
        await fs.mkdir(UPLOAD_CONFIG.TEMP_DIR, { recursive: true });

        // 生成文件名
        const timestamp = Date.now();
        const filename = `banana-generated-${requestId}-${timestamp}.${format}`;
        const thumbnailFilename = `banana-thumb-${requestId}-${timestamp}.${format}`;

        const filePath = path.join(UPLOAD_CONFIG.TEMP_DIR, filename);
        const thumbnailPath = path.join(UPLOAD_CONFIG.TEMP_DIR, thumbnailFilename);

        // 解码base64图片数据
        const buffer = Buffer.from(imageData, 'base64');

        // 保存原图
        await fs.writeFile(filePath, buffer);

        // 生成缩略图
        const thumbnailResult = await processImage(buffer, {
            compression: {
                quality: 80,
                width: 300,
                height: 300
            },
            targetFormat: format as any
        });

        await fs.writeFile(thumbnailPath, Buffer.from(thumbnailResult.base64, 'base64'));

        // 获取图片尺寸信息
        const imageInfo = await processImage(buffer, {
            validation: { maxWidth: 10000, maxHeight: 10000 }
        });

        return {
            url: `/temp/${filename}`,
            thumbnailUrl: `/temp/${thumbnailFilename}`,
            fileSize: buffer.length,
            dimensions: {
                width: imageInfo.width || 0,
                height: imageInfo.height || 0
            }
        };

    } catch (error) {
        throw new Error(`保存生成图片失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
}

// 生成创作建议
function generateSuggestions(prompt: string, style: string): string[] {
    const suggestions = [
        `尝试在"${style}"风格基础上添加更多细节描述`,
        '可以指定具体的光线效果，如"柔和的自然光"或"戏剧性的侧光"',
        '考虑添加情感色彩，如"温馨"、"神秘"或"活力四射"',
        '尝试指定画面构图，如"特写"、"全景"或"对称构图"'
    ];

    // 根据提示词内容提供个性化建议
    if (prompt.includes('人物') || prompt.includes('人')) {
        suggestions.push('对于人物图片，可以描述表情、姿态和服装细节');
    }

    if (prompt.includes('风景') || prompt.includes('景色')) {
        suggestions.push('风景图片可以指定时间（如日出、黄昏）和天气条件');
    }

    if (prompt.includes('动物')) {
        suggestions.push('动物图片可以描述动作状态和环境背景');
    }

    return suggestions.slice(0, 3); // 返回前3个建议
}

// 云函数代理处理函数
const handleCloudFunctionProxy: APIRoute = async ({ request }) => {
    const startTime = Date.now();
    let sessionId = '';
    let clientIP = '';
    let requestId = '';

    try {
        // 1. 增强安全验证
        const securityCheck = await defaultEnhancedSecurity.validateAPIRequest(request);
        sessionId = securityCheck.sessionId;
        clientIP = securityCheck.clientIP;

        requestId = `proxy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // 2. 获取Firebase云函数 URL
        const firebaseFunctionUrl = import.meta.env.FIREBASE_FUNCTION_URL ||
            import.meta.env.CLOUD_FUNCTION_URL;

        if (firebaseFunctionUrl) {
            console.log(`代理请求到Firebase云函数: ${firebaseFunctionUrl}`);

            // 3. 转发请求到Firebase云函数
            const response = await fetch(firebaseFunctionUrl, {
                method: request.method,
                headers: {
                    ...Object.fromEntries(request.headers.entries()),
                    'X-Forwarded-For': clientIP,
                    'X-Session-ID': sessionId,
                    'X-Request-ID': requestId
                },
                body: request.body
            });

            // 4. 转发响应
            const responseData = await response.json();
            const processingTime = Date.now() - startTime;

            console.log(`Firebase云函数代理请求 ${requestId} 完成，耗时 ${processingTime}ms`);

            return new Response(JSON.stringify(responseData), {
                status: response.status,
                headers: {
                    'Content-Type': 'application/json',
                    ...setSecurityHeaders(new Response()).headers
                }
            });
        } else {
            console.log('Firebase云函数 URL 未配置，使用本地处理');
            // 如果没有配置Firebase云函数 URL，回退到本地处理
            return await handleBananaGenerateLocal({ request });
        }

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error(`Firebase云函数代理请求失败 (${requestId}):`, error);

        // 如果Firebase云函数调用失败，回退到本地处理
        console.log('Firebase云函数调用失败，回退到本地处理');
        return await handleBananaGenerateLocal({ request });
    }
};

// 本地处理函数（原有逻辑）
const handleBananaGenerateLocal: APIRoute = async ({ request }) => {
    const startTime = Date.now();
    let sessionId = '';
    let clientIP = '';
    let requestId = '';

    try {
        // 1. 增强安全验证
        const securityCheck = await defaultEnhancedSecurity.validateAPIRequest(request);
        sessionId = securityCheck.sessionId;
        clientIP = securityCheck.clientIP;

        // 2. 解析FormData
        const formData = await request.formData();

        // 3. 验证请求参数
        const validatedRequest = await validateBananaGenerateRequest(formData);

        // 4. 增强提示词验证和清理
        const sanitizedPrompt = await defaultEnhancedSecurity.validatePromptContent(validatedRequest.prompt);

        // 5. 初始化Gemini客户端
        const geminiClient = new GeminiClient();
        requestId = geminiClient.generateRequestId();

        // 6. 构建BananaEditor专用提示词
        const enhancedPrompt = buildBananaPrompt({
            ...validatedRequest,
            prompt: sanitizedPrompt
        });

        console.log(`BananaEditor生成请求 ${requestId} 开始处理`);
        console.log(`增强提示词: ${enhancedPrompt}`);

        let geminiResponse: any;

        // 7. 根据是否有参考图片选择不同的API调用方式
        if (validatedRequest.image) {
            // 有参考图片的情况
            const imageBase64 = await processImageFile(validatedRequest.image as File);

            geminiResponse = await defaultNetworkRetry.executeWithRetry(
                () => geminiClient.generateImage(
                    imageBase64,
                    enhancedPrompt,
                    {
                        model: 'gemini-pro-vision',
                        quality: validatedRequest.quality
                    }
                ),
                {
                    operationName: 'banana-generate-with-image',
                    requestId,
                    sessionId
                }
            );
        } else {
            // 纯文本生成的情况
            geminiResponse = await defaultNetworkRetry.executeWithRetry(
                () => geminiClient.generateText(
                    enhancedPrompt,
                    {
                        model: 'gemini-pro',
                        temperature: validatedRequest.creativity / 100,
                        maxTokens: 1000
                    }
                ),
                {
                    operationName: 'banana-generate-text-only',
                    requestId,
                    sessionId
                }
            );
        }

        // 8. 处理API响应
        if (!geminiResponse || !geminiResponse.candidates || geminiResponse.candidates.length === 0) {
            throw new GeminiAPIError('API返回了空的响应', 'EMPTY_RESPONSE');
        }

        const candidate = geminiResponse.candidates[0];
        if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
            throw new GeminiAPIError('响应中没有生成的内容', 'NO_CONTENT');
        }

        const generatedText = candidate.content.parts[0].text?.trim();
        if (!generatedText) {
            throw new GeminiAPIError('生成的内容为空', 'EMPTY_CONTENT');
        }

        // 9. 模拟图片生成（实际项目中这里应该调用真正的图片生成API）
        // 这里我们创建一个占位符图片URL
        const mockImageData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='; // 1x1透明PNG

        const imageResult = await saveGeneratedImage(
            mockImageData,
            validatedRequest.outputFormat,
            requestId
        );

        // 10. 生成创作建议
        const suggestions = generateSuggestions(sanitizedPrompt, validatedRequest.style);

        // 11. 计算处理时间
        const processingTime = Date.now() - startTime;

        // 12. 构建成功响应
        const responseData: BananaGenerateResponse = {
            success: true,
            data: {
                imageUrl: imageResult.url,
                thumbnailUrl: imageResult.thumbnailUrl,
                generatedPrompt: generatedText,
                metadata: {
                    requestId,
                    processingTime,
                    model: validatedRequest.image ? 'gemini-pro-vision' : 'gemini-pro',
                    style: validatedRequest.style,
                    quality: validatedRequest.quality,
                    dimensions: imageResult.dimensions,
                    fileSize: imageResult.fileSize,
                    format: validatedRequest.outputFormat
                },
                suggestions
            }
        };

        console.log(`BananaEditor生成请求 ${requestId} 完成，耗时 ${processingTime}ms`);

        const response = new Response(JSON.stringify(responseData), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

        return setSecurityHeaders(response);

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error(`BananaEditor生成请求失败 (${requestId}):`, error);

        // 记录错误日志
        await defaultErrorLogger.logError({
            id: `banana_err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
            endpoint: '/api/banana-editor/generate',
            method: 'POST',
            userAgent: request.headers.get('user-agent') || undefined,
            timestamp: new Date(),
            processingTime,
            details: {
                error: error.message,
                service: 'BananaEditor'
            }
        });

        // 记录安全事件
        if (error instanceof SecurityError) {
            logSecurityEvent({
                type: 'BANANA_VALIDATION_FAILED',
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
        let errorResponse: BananaGenerateResponse;
        let statusCode = 500;

        if (error instanceof GeminiAPIError) {
            errorResponse = {
                success: false,
                error: {
                    code: error.code,
                    message: `nano banana AI服务暂时不可用: ${error.message}`
                }
            };
        } else if (error instanceof ImageProcessingError) {
            errorResponse = {
                success: false,
                error: {
                    code: error.code,
                    message: `图片处理失败: ${error.message}`
                }
            };
        } else if (error instanceof SecurityError) {
            statusCode = error.code === 'RATE_LIMITED' ? 429 : 400;
            errorResponse = {
                success: false,
                error: {
                    code: error.code,
                    message: error.message
                }
            };
        } else {
            errorResponse = {
                success: false,
                error: {
                    code: 'BANANA_GENERATION_FAILED',
                    message: 'BananaEditor图片生成失败，请稍后重试'
                }
            };
        }

        const response = new Response(JSON.stringify(errorResponse), {
            status: statusCode,
            headers: { 'Content-Type': 'application/json' }
        });

        return setSecurityHeaders(response);
    }
};

// 获取BananaEditor服务信息的GET接口
const handleGetBananaInfo: APIRoute = async ({ request }) => {
    try {
        // 安全验证
        const securityCheck = defaultSecurityMiddleware.validateRequest(request);

        const response = new Response(JSON.stringify({
            success: true,
            data: {
                service: 'BananaEditor AI图片生成',
                version: '1.0.0',
                endpoint: '/api/banana-editor/generate',
                methods: ['POST'],
                description: '基于nano banana AI技术的专业图片生成服务',
                features: [
                    '智能提示词增强',
                    '多种艺术风格支持',
                    '可调节创意程度',
                    '色调偏好控制',
                    '高质量图片输出',
                    '创作建议生成'
                ],
                supportedFormats: ['image/jpeg', 'image/png', 'image/webp'],
                maxImageSize: '10MB',
                qualities: ['standard', 'high', 'ultra'],
                styles: [
                    'creative', 'realistic', 'artistic', 'cartoon',
                    'watercolor', 'oil-painting', 'sketch', 'digital-art'
                ],
                colorTones: ['warm', 'cool', 'vibrant', 'muted', 'monochrome'],
                outputFormats: ['jpeg', 'png', 'webp']
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

        return setSecurityHeaders(response);

    } catch (error) {
        console.error('获取BananaEditor API信息失败:', error);

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
                code: 'GET_BANANA_INFO_FAILED',
                message: '获取BananaEditor API信息失败'
            }
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

// 导出API路由 - 现在支持云函数代理
export const POST: APIRoute = withErrorHandling(handleCloudFunctionProxy);
export const GET: APIRoute = withErrorHandling(handleGetBananaInfo);