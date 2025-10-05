// BananaEditor图片融合API路由
// 专为BananaEditor设计的图片融合服务

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

// BananaEditor图片融合请求接口
interface BananaFusionRequest {
    image1: File;
    image2: File;
    params: {
        ratio: number; // 0-100，主图片的权重
        blendMode: 'normal' | 'overlay' | 'multiply' | 'screen' | 'soft-light' | 'hard-light' | 'color-dodge' | 'color-burn';
        intensity: number; // 0-100，融合强度
        edgeProcessing: 'smooth' | 'sharp' | 'feather' | 'gradient';
        colorHarmony: number; // 0-100，色彩调和程度
        outputQuality: 'standard' | 'high' | 'ultra';
    };
}

// BananaEditor图片融合响应接口
interface BananaFusionResponse {
    success: boolean;
    data?: {
        fusedImageUrl: string;
        thumbnailUrl?: string;
        previewUrl?: string;
        metadata: {
            requestId: string;
            processingTime: number;
            fusionParams: BananaFusionRequest['params'];
            inputImages: {
                image1: { width: number; height: number; size: number };
                image2: { width: number; height: number; size: number };
            };
            outputImage: {
                width: number;
                height: number;
                size: number;
                format: string;
            };
        };
        suggestions?: string[];
    };
    error?: {
        code: string;
        message: string;
        details?: any;
    };
}

// 验证BananaEditor融合请求参数
async function validateBananaFusionRequest(formData: FormData): Promise<BananaFusionRequest> {
    const errors: string[] = [];

    // 验证第一张图片
    const image1 = formData.get('image1') as File;
    if (!image1 || !(image1 instanceof File) || image1.size === 0) {
        errors.push('第一张图片是必需的');
    } else {
        // 使用增强的文件验证
        try {
            await defaultEnhancedSecurity.validateFileUpload(image1);
        } catch (error) {
            if (error instanceof SecurityError) {
                errors.push(`第一张图片: ${error.message}`);
            } else {
                errors.push('第一张图片验证失败');
            }
        }
    }

    // 验证第二张图片
    const image2 = formData.get('image2') as File;
    if (!image2 || !(image2 instanceof File) || image2.size === 0) {
        errors.push('第二张图片是必需的');
    } else {
        // 使用增强的文件验证
        try {
            await defaultEnhancedSecurity.validateFileUpload(image2);
        } catch (error) {
            if (error instanceof SecurityError) {
                errors.push(`第二张图片: ${error.message}`);
            } else {
                errors.push('第二张图片验证失败');
            }
        }
    }

    // 验证融合参数
    const paramsStr = formData.get('params') as string;
    let params: BananaFusionRequest['params'];

    try {
        params = JSON.parse(paramsStr || '{}');
    } catch (e) {
        errors.push('融合参数格式无效');
        params = {
            ratio: 50,
            blendMode: 'normal',
            intensity: 70,
            edgeProcessing: 'smooth',
            colorHarmony: 50,
            outputQuality: 'standard'
        };
    }

    // 验证各个参数
    if (typeof params.ratio !== 'number' || params.ratio < 0 || params.ratio > 100) {
        errors.push('融合比例必须是0-100之间的数字');
        params.ratio = 50;
    }

    const validBlendModes = ['normal', 'overlay', 'multiply', 'screen', 'soft-light', 'hard-light', 'color-dodge', 'color-burn'];
    if (!validBlendModes.includes(params.blendMode)) {
        errors.push('融合模式无效');
        params.blendMode = 'normal';
    }

    if (typeof params.intensity !== 'number' || params.intensity < 0 || params.intensity > 100) {
        errors.push('融合强度必须是0-100之间的数字');
        params.intensity = 70;
    }

    const validEdgeProcessing = ['smooth', 'sharp', 'feather', 'gradient'];
    if (!validEdgeProcessing.includes(params.edgeProcessing)) {
        errors.push('边缘处理模式无效');
        params.edgeProcessing = 'smooth';
    }

    if (typeof params.colorHarmony !== 'number' || params.colorHarmony < 0 || params.colorHarmony > 100) {
        errors.push('色彩调和程度必须是0-100之间的数字');
        params.colorHarmony = 50;
    }

    const validQualities = ['standard', 'high', 'ultra'];
    if (!validQualities.includes(params.outputQuality)) {
        errors.push('输出质量无效');
        params.outputQuality = 'standard';
    }

    if (errors.length > 0) {
        throw new SecurityError(
            `BananaEditor融合请求参数验证失败: ${errors.join(', ')}`,
            'INVALID_BANANA_FUSION_PARAMS',
            { errors }
        );
    }

    return {
        image1,
        image2,
        params
    };
}

// 构建BananaEditor专用的融合提示词
function buildBananaFusionPrompt(request: BananaFusionRequest): string {
    const { params } = request;

    let fusionPrompt = `使用nano banana AI技术进行专业图片融合。`;

    // 添加融合比例描述
    if (params.ratio <= 30) {
        fusionPrompt += `以第二张图片为主导（权重${100 - params.ratio}%），第一张图片作为辅助元素（权重${params.ratio}%）。`;
    } else if (params.ratio >= 70) {
        fusionPrompt += `以第一张图片为主导（权重${params.ratio}%），第二张图片作为辅助元素（权重${100 - params.ratio}%）。`;
    } else {
        fusionPrompt += `两张图片均衡融合，第一张图片权重${params.ratio}%，第二张图片权重${100 - params.ratio}%。`;
    }

    // 添加融合模式描述
    const blendModeDescriptions = {
        'normal': '采用自然融合模式，保持图片的原始特征',
        'overlay': '采用叠加融合模式，增强对比度和色彩饱和度',
        'multiply': '采用正片叠底模式，创造更深沉的色调效果',
        'screen': '采用滤色融合模式，产生明亮柔和的效果',
        'soft-light': '采用柔光融合模式，营造温和的光影效果',
        'hard-light': '采用强光融合模式，创造戏剧性的对比效果',
        'color-dodge': '采用颜色减淡模式，增强亮部细节',
        'color-burn': '采用颜色加深模式，强化暗部层次'
    };

    fusionPrompt += blendModeDescriptions[params.blendMode];

    // 添加强度描述
    if (params.intensity <= 30) {
        fusionPrompt += '融合强度较轻，保持图片的独立性。';
    } else if (params.intensity >= 70) {
        fusionPrompt += '融合强度较强，创造深度融合的艺术效果。';
    } else {
        fusionPrompt += '融合强度适中，平衡保真度与创意性。';
    }

    // 添加边缘处理描述
    const edgeDescriptions = {
        'smooth': '采用平滑过渡处理，确保边缘自然融合',
        'sharp': '保持锐利边缘，突出图片轮廓和细节',
        'feather': '采用羽化边缘处理，创造柔和的过渡效果',
        'gradient': '使用渐变过渡，营造层次丰富的融合效果'
    };

    fusionPrompt += edgeDescriptions[params.edgeProcessing];

    // 添加色彩调和描述
    if (params.colorHarmony <= 30) {
        fusionPrompt += '保持原始色彩特征，最小化色彩调整。';
    } else if (params.colorHarmony >= 70) {
        fusionPrompt += '进行深度色彩调和，创造统一的色彩风格。';
    } else {
        fusionPrompt += '适度调和色彩，平衡原始特征与整体和谐。';
    }

    // 添加质量要求
    const qualityDescriptions = {
        'standard': '输出标准质量图片',
        'high': '输出高质量图片，保持丰富细节',
        'ultra': '输出超高质量图片，确保专业级别的融合效果'
    };

    fusionPrompt += qualityDescriptions[params.outputQuality];

    // 添加BananaEditor品牌特色
    fusionPrompt += '请确保融合结果体现nano banana AI的专业品质和创新技术，创造出既保持原图特征又具有艺术美感的融合作品。';

    return fusionPrompt;
}

// 处理图片文件并转换为base64
async function processFusionImageFile(imageFile: File, label: string): Promise<{ base64: string; metadata: { width: number; height: number; size: number } }> {
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
                quality: 95, // 融合需要更高质量
                maxWidth: 2048,
                maxHeight: 2048
            },
            targetFormat: 'jpeg',
            stripMeta: false, // 保留元数据用于融合分析
            securityCheck: true
        });

        return {
            base64: processedResult.base64,
            metadata: {
                width: processedResult.width || 0,
                height: processedResult.height || 0,
                size: buffer.length
            }
        };

    } catch (error) {
        throw new ImageProcessingError(
            `处理${label}失败: ${error instanceof Error ? error.message : '未知错误'}`,
            'BANANA_FUSION_IMAGE_PROCESSING_FAILED'
        );
    }
}

// 执行图片融合算法
async function performImageFusion(
    image1Data: string,
    image2Data: string,
    params: BananaFusionRequest['params'],
    geminiClient: GeminiClient,
    requestId: string
): Promise<string> {
    try {
        // 构建融合提示词
        const fusionPrompt = buildBananaFusionPrompt({ image1: {} as File, image2: {} as File, params });

        console.log(`融合请求 ${requestId} 提示词: ${fusionPrompt}`);

        // 调用Gemini API进行图片融合
        // 注意：这里使用的是模拟实现，实际项目中需要调用真正的图片融合API
        const fusionResponse = await geminiClient.generateImage(
            image1Data,
            fusionPrompt,
            {
                model: 'gemini-pro-vision',
                quality: params.outputQuality,
                additionalImages: [image2Data], // 传递第二张图片
                fusionParams: {
                    ratio: params.ratio / 100,
                    blendMode: params.blendMode,
                    intensity: params.intensity / 100,
                    edgeProcessing: params.edgeProcessing,
                    colorHarmony: params.colorHarmony / 100
                }
            }
        );

        if (!fusionResponse || !fusionResponse.imageData) {
            throw new GeminiAPIError('融合API返回了空的响应', 'EMPTY_FUSION_RESPONSE');
        }

        return fusionResponse.imageData;

    } catch (error) {
        throw new GeminiAPIError(
            `图片融合失败: ${error instanceof Error ? error.message : '未知错误'}`,
            'BANANA_FUSION_FAILED'
        );
    }
}

// 保存融合结果图片
async function saveFusedImage(
    imageData: string,
    requestId: string,
    params: BananaFusionRequest['params']
): Promise<{
    fusedImageUrl: string;
    thumbnailUrl: string;
    previewUrl: string;
    metadata: { width: number; height: number; size: number; format: string }
}> {
    try {
        // 确保临时目录存在
        await fs.mkdir(UPLOAD_CONFIG.TEMP_DIR, { recursive: true });

        // 生成文件名
        const timestamp = Date.now();
        const format = 'jpeg';
        const fusedFilename = `banana-fused-${requestId}-${timestamp}.${format}`;
        const thumbnailFilename = `banana-fused-thumb-${requestId}-${timestamp}.${format}`;
        const previewFilename = `banana-fused-preview-${requestId}-${timestamp}.${format}`;

        const fusedPath = path.join(UPLOAD_CONFIG.TEMP_DIR, fusedFilename);
        const thumbnailPath = path.join(UPLOAD_CONFIG.TEMP_DIR, thumbnailFilename);
        const previewPath = path.join(UPLOAD_CONFIG.TEMP_DIR, previewFilename);

        // 解码base64图片数据
        const buffer = Buffer.from(imageData, 'base64');

        // 保存融合结果
        await fs.writeFile(fusedPath, buffer);

        // 生成缩略图 (300x300)
        const thumbnailResult = await processImage(buffer, {
            compression: {
                quality: 80,
                width: 300,
                height: 300
            },
            targetFormat: format as any
        });

        await fs.writeFile(thumbnailPath, Buffer.from(thumbnailResult.base64, 'base64'));

        // 生成预览图 (800x600)
        const previewResult = await processImage(buffer, {
            compression: {
                quality: 85,
                width: 800,
                height: 600
            },
            targetFormat: format as any
        });

        await fs.writeFile(previewPath, Buffer.from(previewResult.base64, 'base64'));

        // 获取图片尺寸信息
        const imageInfo = await processImage(buffer, {
            validation: { maxWidth: 10000, maxHeight: 10000 }
        });

        return {
            fusedImageUrl: `/temp/${fusedFilename}`,
            thumbnailUrl: `/temp/${thumbnailFilename}`,
            previewUrl: `/temp/${previewFilename}`,
            metadata: {
                width: imageInfo.width || 0,
                height: imageInfo.height || 0,
                size: buffer.length,
                format
            }
        };

    } catch (error) {
        throw new Error(`保存融合图片失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
}

// 生成融合建议
function generateFusionSuggestions(params: BananaFusionRequest['params']): string[] {
    const suggestions: string[] = [];

    // 基于融合比例的建议
    if (params.ratio < 30) {
        suggestions.push('当前以第二张图片为主导，可以尝试调整比例以突出第一张图片的特征');
    } else if (params.ratio > 70) {
        suggestions.push('当前以第一张图片为主导，可以尝试增加第二张图片的权重以获得更丰富的融合效果');
    }

    // 基于融合模式的建议
    const modeAdvice = {
        'normal': '尝试使用"叠加"或"柔光"模式来增强视觉效果',
        'overlay': '如果效果过于强烈，可以尝试"柔光"模式获得更自然的效果',
        'multiply': '这种模式适合创造深沉效果，可以配合较高的色彩调和度',
        'screen': '这种模式产生明亮效果，适合与"羽化边缘"搭配使用',
        'soft-light': '当前模式很适合人像融合，可以尝试调整融合强度',
        'hard-light': '强光模式创造戏剧效果，建议配合适中的融合强度',
        'color-dodge': '减淡模式突出亮部，建议降低融合强度以避免过曝',
        'color-burn': '加深模式强化暗部，可以配合较高的色彩调和度'
    };

    if (modeAdvice[params.blendMode]) {
        suggestions.push(modeAdvice[params.blendMode]);
    }

    // 基于强度的建议
    if (params.intensity < 40) {
        suggestions.push('融合强度较低，可以适当提高以获得更明显的融合效果');
    } else if (params.intensity > 80) {
        suggestions.push('融合强度较高，如果效果过于强烈可以适当降低');
    }

    // 基于边缘处理的建议
    if (params.edgeProcessing === 'sharp' && params.intensity > 70) {
        suggestions.push('锐利边缘配合高强度可能产生生硬效果，建议尝试"平滑过渡"');
    }

    // 基于色彩调和的建议
    if (params.colorHarmony < 30) {
        suggestions.push('色彩调和度较低，可以适当提高以获得更统一的色彩风格');
    }

    // 通用建议
    const generalSuggestions = [
        '尝试不同的融合模式来探索各种艺术效果',
        '调整融合比例可以突出不同图片的特征',
        '边缘处理方式会显著影响融合的自然度',
        '色彩调和有助于创造统一的视觉风格'
    ];

    // 随机添加一些通用建议
    const randomGeneral = generalSuggestions[Math.floor(Math.random() * generalSuggestions.length)];
    if (!suggestions.includes(randomGeneral)) {
        suggestions.push(randomGeneral);
    }

    return suggestions.slice(0, 4); // 返回最多4个建议
}

// 主要的图片融合处理函数
const handleBananaFusion: APIRoute = async ({ request }) => {
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
        const validatedRequest = await validateBananaFusionRequest(formData);

        // 4. 初始化Gemini客户端
        const geminiClient = new GeminiClient();
        requestId = geminiClient.generateRequestId();

        console.log(`BananaEditor融合请求 ${requestId} 开始处理`);
        console.log(`融合参数:`, validatedRequest.params);

        // 5. 处理两张图片
        const [image1Result, image2Result] = await Promise.all([
            processFusionImageFile(validatedRequest.image1, '第一张图片'),
            processFusionImageFile(validatedRequest.image2, '第二张图片')
        ]);

        console.log(`图片处理完成 - 图片1: ${image1Result.metadata.width}x${image1Result.metadata.height}, 图片2: ${image2Result.metadata.width}x${image2Result.metadata.height}`);

        // 6. 执行图片融合
        const fusedImageData = await defaultNetworkRetry.executeWithRetry(
            () => performImageFusion(
                image1Result.base64,
                image2Result.base64,
                validatedRequest.params,
                geminiClient,
                requestId
            ),
            {
                operationName: 'banana-image-fusion',
                requestId,
                sessionId
            }
        );

        // 7. 保存融合结果
        const savedResult = await saveFusedImage(
            fusedImageData,
            requestId,
            validatedRequest.params
        );

        // 8. 生成融合建议
        const suggestions = generateFusionSuggestions(validatedRequest.params);

        // 9. 计算处理时间
        const processingTime = Date.now() - startTime;

        // 10. 构建成功响应
        const responseData: BananaFusionResponse = {
            success: true,
            data: {
                fusedImageUrl: savedResult.fusedImageUrl,
                thumbnailUrl: savedResult.thumbnailUrl,
                previewUrl: savedResult.previewUrl,
                metadata: {
                    requestId,
                    processingTime,
                    fusionParams: validatedRequest.params,
                    inputImages: {
                        image1: image1Result.metadata,
                        image2: image2Result.metadata
                    },
                    outputImage: savedResult.metadata
                },
                suggestions
            }
        };

        console.log(`BananaEditor融合请求 ${requestId} 完成，耗时 ${processingTime}ms`);

        const response = new Response(JSON.stringify(responseData), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

        return setSecurityHeaders(response);

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error(`BananaEditor融合请求失败 (${requestId}):`, error);

        // 记录错误日志
        await defaultErrorLogger.logError({
            id: `banana_fusion_err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
            endpoint: '/api/banana-editor/fusion',
            method: 'POST',
            userAgent: request.headers.get('user-agent') || undefined,
            timestamp: new Date(),
            processingTime,
            details: {
                error: error.message,
                service: 'BananaEditor Fusion'
            }
        });

        // 记录安全事件
        if (error instanceof SecurityError) {
            logSecurityEvent({
                type: 'BANANA_FUSION_VALIDATION_FAILED',
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
        let errorResponse: BananaFusionResponse;
        let statusCode = 500;

        if (error instanceof GeminiAPIError) {
            errorResponse = {
                success: false,
                error: {
                    code: error.code,
                    message: `nano banana AI融合服务暂时不可用: ${error.message}`
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
                    code: 'BANANA_FUSION_FAILED',
                    message: 'BananaEditor图片融合失败，请稍后重试'
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

// 获取BananaEditor融合服务信息的GET接口
const handleGetBananaFusionInfo: APIRoute = async ({ request }) => {
    try {
        // 安全验证
        const securityCheck = defaultSecurityMiddleware.validateRequest(request);

        const response = new Response(JSON.stringify({
            success: true,
            data: {
                service: 'BananaEditor AI图片融合',
                version: '1.0.0',
                endpoint: '/api/banana-editor/fusion',
                methods: ['POST'],
                description: '基于nano banana AI技术的专业图片融合服务',
                features: [
                    '智能图片融合算法',
                    '多种融合模式支持',
                    '可调节融合比例',
                    '边缘处理优化',
                    '色彩调和控制',
                    '高质量输出',
                    '融合建议生成'
                ],
                supportedFormats: ['image/jpeg', 'image/png', 'image/webp'],
                maxImageSize: '10MB',
                fusionModes: [
                    'normal', 'overlay', 'multiply', 'screen',
                    'soft-light', 'hard-light', 'color-dodge', 'color-burn'
                ],
                edgeProcessing: ['smooth', 'sharp', 'feather', 'gradient'],
                outputQualities: ['standard', 'high', 'ultra'],
                parameters: {
                    ratio: { min: 0, max: 100, description: '主图片权重比例' },
                    intensity: { min: 0, max: 100, description: '融合强度' },
                    colorHarmony: { min: 0, max: 100, description: '色彩调和程度' }
                }
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

        return setSecurityHeaders(response);

    } catch (error) {
        console.error('获取BananaEditor融合API信息失败:', error);

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
                code: 'GET_BANANA_FUSION_INFO_FAILED',
                message: '获取BananaEditor融合API信息失败'
            }
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

// 导出API路由
export const POST: APIRoute = withErrorHandling(handleBananaFusion);
export const GET: APIRoute = withErrorHandling(handleGetBananaFusionInfo);