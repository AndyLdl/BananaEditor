// 图片融合API路由
import type { APIRoute } from 'astro';
import { GeminiClient, GeminiAPIError } from '../../../utils/gemini-client';
import { processImage, ImageProcessingError } from '../../../utils/image-processor';
import { defaultSecurityMiddleware, SecurityError, setSecurityHeaders, logSecurityEvent } from '../../../utils/security';
import { UPLOAD_CONFIG } from '../../../config/upload';
import { promises as fs } from 'fs';
import path from 'path';

// 图片融合请求接口
interface FusionImageRequest {
    image1Url?: string;
    image1Data?: string; // Base64编码的图片数据
    image2Url?: string;
    image2Data?: string; // Base64编码的图片数据
    fusionRatio?: number; // 0-1之间，表示第一张图片的权重
    style?: string;
    quality?: 'standard' | 'high';
    model?: string;
    fusionMode?: 'blend' | 'overlay' | 'artistic' | 'creative';
    prompt?: string; // 可选的融合指导提示词
}

// 图片融合响应接口
interface FusionImageResponse {
    success: boolean;
    data?: {
        fusionDescription: string;
        fusionSuggestions: string[];
        image1Info: {
            width: number;
            height: number;
            size: number;
        };
        image2Info: {
            width: number;
            height: number;
            size: number;
        };
        fusionParameters: {
            ratio: number;
            style: string;
            mode: string;
        };
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

// 融合模式配置
const FUSION_MODES = {
    blend: {
        zh: {
            name: '混合模式',
            description: '将两张图片进行平滑混合，创造自然的过渡效果',
            prompt: '请分析这两张图片的特征，并描述如何将它们进行自然的混合融合，创造出和谐统一的视觉效果。'
        },
        en: {
            name: 'Blend Mode',
            description: 'Smoothly blend two images to create natural transition effects',
            prompt: 'Please analyze the characteristics of these two images and describe how to naturally blend them together to create a harmonious and unified visual effect.'
        }
    },
    overlay: {
        zh: {
            name: '叠加模式',
            description: '将一张图片叠加在另一张图片上，保持层次感',
            prompt: '请分析这两张图片，描述如何将它们进行叠加处理，保持图像的层次感和深度。'
        },
        en: {
            name: 'Overlay Mode',
            description: 'Overlay one image on another while maintaining depth',
            prompt: 'Please analyze these two images and describe how to overlay them while maintaining the sense of depth and layering.'
        }
    },
    artistic: {
        zh: {
            name: '艺术模式',
            description: '以艺术化的方式融合图片，强调创意表达',
            prompt: '请以艺术创作的角度分析这两张图片，描述如何将它们融合成一幅富有创意和艺术感的作品。'
        },
        en: {
            name: 'Artistic Mode',
            description: 'Fuse images in an artistic way, emphasizing creative expression',
            prompt: 'Please analyze these two images from an artistic perspective and describe how to fuse them into a creative and artistic work.'
        }
    },
    creative: {
        zh: {
            name: '创意模式',
            description: '突破常规的创意融合，产生意想不到的效果',
            prompt: '请发挥创意想象，分析这两张图片的元素，描述如何将它们以创新的方式融合，产生独特而令人惊喜的视觉效果。'
        },
        en: {
            name: 'Creative Mode',
            description: 'Unconventional creative fusion for unexpected effects',
            prompt: 'Please use creative imagination to analyze the elements of these two images and describe how to fuse them in innovative ways to create unique and surprising visual effects.'
        }
    }
};

// 风格配置
const FUSION_STYLES = {
    zh: {
        natural: '自然风格，保持真实感',
        surreal: '超现实风格，梦幻效果',
        abstract: '抽象风格，注重形式美',
        painterly: '绘画风格，艺术化处理',
        photographic: '摄影风格，写实效果',
        digital: '数字艺术风格，现代感强'
    },
    en: {
        natural: 'natural style, maintaining realism',
        surreal: 'surreal style, dreamlike effects',
        abstract: 'abstract style, focusing on formal beauty',
        painterly: 'painterly style, artistic treatment',
        photographic: 'photographic style, realistic effects',
        digital: 'digital art style, modern feel'
    }
};

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

// 验证请求参数
function validateFusionRequest(body: any): FusionImageRequest {
    const errors: string[] = [];

    // 验证第一张图片
    if (!body.image1Url && !body.image1Data) {
        errors.push('必须提供第一张图片的URL或数据');
    }

    // 验证第二张图片
    if (!body.image2Url && !body.image2Data) {
        errors.push('必须提供第二张图片的URL或数据');
    }

    // 验证融合比例
    if (body.fusionRatio !== undefined) {
        const ratio = parseFloat(body.fusionRatio);
        if (isNaN(ratio) || ratio < 0 || ratio > 1) {
            errors.push('融合比例必须是0到1之间的数值');
        }
    }

    // 验证质量参数
    if (body.quality && !['standard', 'high'].includes(body.quality)) {
        errors.push('质量参数必须是 standard 或 high');
    }

    // 验证融合模式
    if (body.fusionMode && !Object.keys(FUSION_MODES).includes(body.fusionMode)) {
        errors.push(`融合模式必须是以下之一: ${Object.keys(FUSION_MODES).join(', ')}`);
    }

    // 验证风格参数
    if (body.style && !Object.keys(FUSION_STYLES.zh).includes(body.style)) {
        errors.push(`风格参数必须是以下之一: ${Object.keys(FUSION_STYLES.zh).join(', ')}`);
    }

    // 验证提示词长度
    if (body.prompt && body.prompt.length > 500) {
        errors.push('提示词长度不能超过500字符');
    }

    if (errors.length > 0) {
        throw new SecurityError(
            `请求参数验证失败: ${errors.join(', ')}`,
            'INVALID_REQUEST_PARAMS',
            { errors }
        );
    }

    return {
        image1Url: body.image1Url,
        image1Data: body.image1Data,
        image2Url: body.image2Url,
        image2Data: body.image2Data,
        fusionRatio: body.fusionRatio !== undefined ? parseFloat(body.fusionRatio) : 0.5,
        style: body.style || 'natural',
        quality: body.quality || 'standard',
        model: body.model || 'gemini-pro-vision',
        fusionMode: body.fusionMode || 'blend',
        prompt: body.prompt
    };
}

// 构建融合分析提示词
function buildFusionPrompt(request: FusionImageRequest, language: string = 'zh'): string {
    const modeConfig = FUSION_MODES[request.fusionMode as keyof typeof FUSION_MODES][language as keyof typeof FUSION_MODES[keyof typeof FUSION_MODES]];
    const styleDescription = FUSION_STYLES[language as keyof typeof FUSION_STYLES][request.style as keyof typeof FUSION_STYLES[keyof typeof FUSION_STYLES]];

    let prompt = modeConfig.prompt;

    if (language === 'zh') {
        prompt += `\n\n融合参数：
- 融合比例：第一张图片占 ${Math.round(request.fusionRatio * 100)}%，第二张图片占 ${Math.round((1 - request.fusionRatio) * 100)}%
- 风格要求：${styleDescription}
- 融合模式：${modeConfig.name}`;

        if (request.prompt) {
            prompt += `\n- 用户指导：${request.prompt}`;
        }

        prompt += '\n\n请详细分析这两张图片的视觉特征、色彩搭配、构图元素，并描述如何按照上述要求进行融合处理，最后给出具体的创作建议。';
    } else {
        prompt += `\n\nFusion parameters:
- Fusion ratio: First image ${Math.round(request.fusionRatio * 100)}%, Second image ${Math.round((1 - request.fusionRatio) * 100)}%
- Style requirement: ${styleDescription}
- Fusion mode: ${modeConfig.name}`;

        if (request.prompt) {
            prompt += `\n- User guidance: ${request.prompt}`;
        }

        prompt += '\n\nPlease analyze the visual characteristics, color schemes, and compositional elements of these two images in detail, describe how to fuse them according to the above requirements, and provide specific creative suggestions.';
    }

    return prompt;
}

// 处理Gemini API响应
function processFusionResponse(response: any): { description: string; suggestions: string[] } {
    try {
        if (!response || !response.candidates || response.candidates.length === 0) {
            throw new Error('API返回了空的响应');
        }

        const candidate = response.candidates[0];

        if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
            throw new Error('响应中没有融合分析内容');
        }

        const fullText = candidate.content.parts[0].text;

        if (!fullText || fullText.trim().length === 0) {
            throw new Error('融合分析内容为空');
        }

        // 尝试从响应中提取描述和建议
        const lines = fullText.split('\n').filter(line => line.trim().length > 0);

        // 简单的启发式方法来分离描述和建议
        const description = lines.slice(0, Math.ceil(lines.length * 0.7)).join('\n');
        const suggestions = lines.slice(Math.ceil(lines.length * 0.7))
            .filter(line => line.includes('建议') || line.includes('可以') || line.includes('推荐') ||
                line.includes('suggest') || line.includes('recommend') || line.includes('consider'))
            .slice(0, 3); // 最多3个建议

        return {
            description: description.trim(),
            suggestions: suggestions.length > 0 ? suggestions : ['尝试调整融合比例以获得不同效果', '可以尝试不同的融合模式', '考虑添加后期处理效果']
        };

    } catch (error) {
        throw new Error(`处理API响应失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
}

export const POST: APIRoute = async ({ request }) => {
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
        const validatedRequest = validateFusionRequest(body);

        // 4. 初始化Gemini客户端
        const geminiClient = new GeminiClient();
        requestId = geminiClient.generateRequestId();

        // 5. 获取第一张图片数据
        let image1Buffer: Buffer;
        if (validatedRequest.image1Url) {
            image1Buffer = await loadImageFromUrl(validatedRequest.image1Url);
        } else if (validatedRequest.image1Data) {
            try {
                image1Buffer = Buffer.from(validatedRequest.image1Data, 'base64');
            } catch (error) {
                throw new SecurityError('第一张图片的Base64数据格式无效', 'INVALID_IMAGE1_DATA');
            }
        } else {
            throw new SecurityError('未提供第一张图片的有效数据', 'NO_IMAGE1_DATA');
        }

        // 6. 获取第二张图片数据
        let image2Buffer: Buffer;
        if (validatedRequest.image2Url) {
            image2Buffer = await loadImageFromUrl(validatedRequest.image2Url);
        } else if (validatedRequest.image2Data) {
            try {
                image2Buffer = Buffer.from(validatedRequest.image2Data, 'base64');
            } catch (error) {
                throw new SecurityError('第二张图片的Base64数据格式无效', 'INVALID_IMAGE2_DATA');
            }
        } else {
            throw new SecurityError('未提供第二张图片的有效数据', 'NO_IMAGE2_DATA');
        }

        // 7. 处理和验证第一张图片
        const processedImage1 = await processImage(image1Buffer, {
            validation: {
                maxWidth: 2048,
                maxHeight: 2048,
                minWidth: 32,
                minHeight: 32
            },
            compression: {
                quality: validatedRequest.quality === 'high' ? 95 : 85,
                width: validatedRequest.quality === 'high' ? undefined : 1024,
                height: validatedRequest.quality === 'high' ? undefined : 1024
            },
            targetFormat: 'jpeg',
            stripMeta: true,
            securityCheck: true
        });

        // 8. 处理和验证第二张图片
        const processedImage2 = await processImage(image2Buffer, {
            validation: {
                maxWidth: 2048,
                maxHeight: 2048,
                minWidth: 32,
                minHeight: 32
            },
            compression: {
                quality: validatedRequest.quality === 'high' ? 95 : 85,
                width: validatedRequest.quality === 'high' ? undefined : 1024,
                height: validatedRequest.quality === 'high' ? undefined : 1024
            },
            targetFormat: 'jpeg',
            stripMeta: true,
            securityCheck: true
        });

        // 9. 构建融合分析提示词
        const fusionPrompt = buildFusionPrompt(validatedRequest, 'zh');

        // 10. 调用Gemini API进行融合分析
        console.log(`开始图片融合分析请求 ${requestId}`);

        // 由于Gemini API目前不直接支持图片融合，我们使用图片分析来提供融合建议
        const analysisPrompt = `${fusionPrompt}\n\n请分析这两张图片并提供详细的融合建议。`;

        const geminiResponse = await geminiClient.generateImage(
            processedImage1.base64,
            analysisPrompt,
            {
                model: validatedRequest.model,
                quality: validatedRequest.quality
            }
        );

        // 11. 处理API响应
        const { description, suggestions } = processFusionResponse(geminiResponse);

        // 12. 计算处理时间
        const processingTime = Date.now() - startTime;

        // 13. 构建成功响应
        const responseData: FusionImageResponse = {
            success: true,
            data: {
                fusionDescription: description,
                fusionSuggestions: suggestions,
                image1Info: {
                    width: processedImage1.info.width || 0,
                    height: processedImage1.info.height || 0,
                    size: processedImage1.processedBuffer.length
                },
                image2Info: {
                    width: processedImage2.info.width || 0,
                    height: processedImage2.info.height || 0,
                    size: processedImage2.processedBuffer.length
                },
                fusionParameters: {
                    ratio: validatedRequest.fusionRatio,
                    style: validatedRequest.style,
                    mode: validatedRequest.fusionMode
                },
                requestId,
                processingTime,
                model: validatedRequest.model || 'gemini-pro-vision'
            }
        };

        console.log(`图片融合分析请求 ${requestId} 完成，耗时 ${processingTime}ms`);

        const response = new Response(JSON.stringify(responseData), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

        return setSecurityHeaders(response);

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error(`图片融合请求失败 (${requestId}):`, error);

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
        let errorResponse: FusionImageResponse;

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
                    code: 'FUSION_FAILED',
                    message: '图片融合分析失败，请稍后重试'
                }
            };
        }

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

// 获取融合配置信息的GET接口
export const GET: APIRoute = async ({ request, url }) => {
    try {
        // 安全验证
        const securityCheck = defaultSecurityMiddleware.validateRequest(request);

        const language = url.searchParams.get('language') || 'zh';

        if (!['zh', 'en'].includes(language)) {
            return new Response(JSON.stringify({
                success: false,
                error: {
                    code: 'INVALID_LANGUAGE',
                    message: '不支持的语言参数'
                }
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const fusionModes = Object.fromEntries(
            Object.entries(FUSION_MODES).map(([key, value]) => [
                key,
                value[language as keyof typeof value]
            ])
        );

        const fusionStyles = FUSION_STYLES[language as keyof typeof FUSION_STYLES];

        const response = new Response(JSON.stringify({
            success: true,
            data: {
                endpoint: '/api/ai/fusion-image',
                methods: ['POST', 'GET'],
                description: language === 'zh' ? 'AI图片融合分析服务' : 'AI image fusion analysis service',
                supportedLanguages: ['zh', 'en'],
                fusionModes,
                fusionStyles,
                qualityOptions: ['standard', 'high'],
                fusionRatioRange: [0, 1],
                maxImageSize: '10MB',
                maxPromptLength: 500,
                models: ['gemini-pro-vision']
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

        return setSecurityHeaders(response);

    } catch (error) {
        console.error('获取融合配置失败:', error);

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
                code: 'GET_CONFIG_FAILED',
                message: '获取融合配置失败'
            }
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};