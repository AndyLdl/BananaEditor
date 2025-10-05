// 提示词优化API路由
import type { APIRoute } from 'astro';
import { GeminiClient, GeminiAPIError } from '../../../utils/gemini-client';
import { defaultSecurityMiddleware, SecurityError, setSecurityHeaders, logSecurityEvent } from '../../../utils/security';

// 提示词优化请求接口
interface OptimizePromptRequest {
    originalPrompt: string;
    style?: string;
    language?: 'zh' | 'en';
    model?: string;
    enhancementLevel?: 'basic' | 'detailed' | 'professional';
}

// 提示词优化响应接口
interface OptimizePromptResponse {
    success: boolean;
    data?: {
        originalPrompt: string;
        optimizedPrompt: string;
        suggestions?: string[];
        enhancementLevel: string;
        style: string;
        language: string;
        requestId: string;
        processingTime: number;
        wordCount: {
            original: number;
            optimized: number;
        };
    };
    error?: {
        code: string;
        message: string;
        details?: any;
    };
}

// 预定义的风格模板
const STYLE_TEMPLATES = {
    zh: {
        realistic: '写实风格，注重细节和真实感',
        artistic: '艺术风格，富有创意和表现力',
        anime: '动漫风格，色彩鲜艳，线条清晰',
        abstract: '抽象风格，注重形式和色彩的表达',
        vintage: '复古风格，怀旧色调和质感',
        modern: '现代风格，简洁明快，时尚感强',
        fantasy: '奇幻风格，充满想象力和神秘感',
        minimalist: '极简风格，简洁纯净，突出主体'
    },
    en: {
        realistic: 'realistic style, focusing on details and authenticity',
        artistic: 'artistic style, creative and expressive',
        anime: 'anime style, vibrant colors and clear lines',
        abstract: 'abstract style, emphasizing form and color expression',
        vintage: 'vintage style, nostalgic tones and textures',
        modern: 'modern style, clean and fashionable',
        fantasy: 'fantasy style, imaginative and mysterious',
        minimalist: 'minimalist style, clean and pure, highlighting the subject'
    }
};

// 增强级别配置
const ENHANCEMENT_CONFIGS = {
    basic: {
        zh: {
            systemPrompt: `你是一个AI绘画提示词优化助手。请将用户的简单描述优化成更具体的提示词。
优化要求：
1. 保持原意不变
2. 添加基本的视觉细节
3. 简洁明了，不要过于复杂
4. 直接返回优化后的提示词，不需要解释`,
            maxTokens: 512
        },
        en: {
            systemPrompt: `You are an AI art prompt optimizer. Please optimize the user's simple description into more specific prompts.
Requirements:
1. Keep the original meaning
2. Add basic visual details
3. Keep it concise and clear
4. Return the optimized prompt directly without explanation`,
            maxTokens: 512
        }
    },
    detailed: {
        zh: {
            systemPrompt: `你是一个专业的AI绘画提示词优化专家。请将用户提供的描述优化成详细的AI绘画提示词。
优化要求：
1. 保持原意的同时丰富细节
2. 添加具体的视觉元素描述
3. 包含光线、色彩、构图等技术要素
4. 增强艺术表现力
5. 直接返回优化后的提示词`,
            maxTokens: 1024
        },
        en: {
            systemPrompt: `You are a professional AI art prompt optimizer. Please optimize the user's description into detailed AI art prompts.
Requirements:
1. Enrich details while maintaining original meaning
2. Add specific visual element descriptions
3. Include technical elements like lighting, color, and composition
4. Enhance artistic expression
5. Return the optimized prompt directly`,
            maxTokens: 1024
        }
    },
    professional: {
        zh: {
            systemPrompt: `你是一个顶级的AI绘画提示词专家。请将用户的描述优化成专业级的AI绘画提示词。
优化要求：
1. 深度理解用户意图并大幅增强表现力
2. 添加专业的艺术术语和技法描述
3. 包含详细的光影、材质、氛围描述
4. 考虑构图、色彩理论等专业要素
5. 提供多层次的视觉细节
6. 直接返回优化后的提示词`,
            maxTokens: 2048
        },
        en: {
            systemPrompt: `You are a top-tier AI art prompt expert. Please optimize the user's description into professional-grade AI art prompts.
Requirements:
1. Deeply understand user intent and greatly enhance expressiveness
2. Add professional art terminology and technique descriptions
3. Include detailed lighting, material, and atmosphere descriptions
4. Consider composition, color theory, and other professional elements
5. Provide multi-layered visual details
6. Return the optimized prompt directly`,
            maxTokens: 2048
        }
    }
};

// 验证请求参数
function validateOptimizeRequest(body: any): OptimizePromptRequest {
    const errors: string[] = [];

    // 验证原始提示词
    if (!body.originalPrompt || typeof body.originalPrompt !== 'string') {
        errors.push('原始提示词是必需的');
    } else if (body.originalPrompt.trim().length === 0) {
        errors.push('原始提示词不能为空');
    } else if (body.originalPrompt.length > 1000) {
        errors.push('原始提示词长度不能超过1000字符');
    }

    // 验证语言参数
    if (body.language && !['zh', 'en'].includes(body.language)) {
        errors.push('语言参数必须是 zh 或 en');
    }

    // 验证增强级别
    if (body.enhancementLevel && !['basic', 'detailed', 'professional'].includes(body.enhancementLevel)) {
        errors.push('增强级别必须是 basic、detailed 或 professional');
    }

    // 验证风格参数
    const language = body.language || 'zh';
    const availableStyles = Object.keys(STYLE_TEMPLATES[language as keyof typeof STYLE_TEMPLATES]);
    if (body.style && !availableStyles.includes(body.style)) {
        errors.push(`风格参数必须是以下之一: ${availableStyles.join(', ')}`);
    }

    if (errors.length > 0) {
        throw new SecurityError(
            `请求参数验证失败: ${errors.join(', ')}`,
            'INVALID_REQUEST_PARAMS',
            { errors }
        );
    }

    return {
        originalPrompt: body.originalPrompt.trim(),
        style: body.style || 'artistic',
        language: body.language || 'zh',
        model: body.model || 'gemini-pro',
        enhancementLevel: body.enhancementLevel || 'detailed'
    };
}

// 构建优化提示词
function buildOptimizationPrompt(request: OptimizePromptRequest): string {
    const { originalPrompt, style, language, enhancementLevel } = request;

    const config = ENHANCEMENT_CONFIGS[enhancementLevel][language];
    const styleDescription = STYLE_TEMPLATES[language][style as keyof typeof STYLE_TEMPLATES[typeof language]];

    const promptTemplate = language === 'zh'
        ? `${config.systemPrompt}

原始提示词: ${originalPrompt}
风格要求: ${styleDescription}

请优化上述提示词:`
        : `${config.systemPrompt}

Original prompt: ${originalPrompt}
Style requirement: ${styleDescription}

Please optimize the above prompt:`;

    return promptTemplate;
}

// 处理Gemini API响应
function processOptimizationResponse(response: any): string {
    try {
        if (!response || !response.candidates || response.candidates.length === 0) {
            throw new Error('API返回了空的响应');
        }

        const candidate = response.candidates[0];

        if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
            throw new Error('响应中没有优化的内容');
        }

        const optimizedText = candidate.content.parts[0].text;

        if (!optimizedText || optimizedText.trim().length === 0) {
            throw new Error('优化的内容为空');
        }

        return optimizedText.trim();

    } catch (error) {
        throw new Error(`处理API响应失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
}

// 生成优化建议
function generateSuggestions(originalPrompt: string, optimizedPrompt: string, language: string): string[] {
    const suggestions: string[] = [];

    if (language === 'zh') {
        suggestions.push('可以尝试添加更多的色彩描述');
        suggestions.push('考虑加入光线和阴影的细节');
        suggestions.push('可以指定具体的艺术风格或技法');

        if (originalPrompt.length < 50) {
            suggestions.push('原始提示词较短，可以添加更多细节描述');
        }

        if (!originalPrompt.includes('色彩') && !originalPrompt.includes('颜色')) {
            suggestions.push('可以添加色彩相关的描述');
        }

        if (!originalPrompt.includes('光') && !originalPrompt.includes('阴影')) {
            suggestions.push('可以添加光影效果的描述');
        }
    } else {
        suggestions.push('Try adding more color descriptions');
        suggestions.push('Consider including lighting and shadow details');
        suggestions.push('You can specify particular art styles or techniques');

        if (originalPrompt.length < 50) {
            suggestions.push('The original prompt is short, consider adding more details');
        }

        if (!originalPrompt.toLowerCase().includes('color') && !originalPrompt.toLowerCase().includes('light')) {
            suggestions.push('Consider adding color and lighting descriptions');
        }
    }

    return suggestions.slice(0, 3); // 返回最多3个建议
}

// 计算字数
function countWords(text: string, language: string): number {
    if (language === 'zh') {
        // 中文按字符数计算
        return text.replace(/\s/g, '').length;
    } else {
        // 英文按单词数计算
        return text.trim().split(/\s+/).length;
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
        const validatedRequest = validateOptimizeRequest(body);

        // 4. 清理原始提示词
        const sanitizedPrompt = defaultSecurityMiddleware.sanitizePrompt(validatedRequest.originalPrompt);

        // 5. 初始化Gemini客户端
        const geminiClient = new GeminiClient();
        requestId = geminiClient.generateRequestId();

        // 6. 构建优化提示词
        const optimizationPrompt = buildOptimizationPrompt({
            ...validatedRequest,
            originalPrompt: sanitizedPrompt
        });

        // 7. 调用Gemini API
        console.log(`开始提示词优化请求 ${requestId}`);
        const geminiResponse = await geminiClient.optimizePrompt(
            optimizationPrompt,
            {
                style: validatedRequest.style,
                language: validatedRequest.language,
                model: validatedRequest.model
            }
        );

        // 8. 处理API响应
        const optimizedPrompt = processOptimizationResponse(geminiResponse);

        // 9. 生成优化建议
        const suggestions = generateSuggestions(
            sanitizedPrompt,
            optimizedPrompt,
            validatedRequest.language
        );

        // 10. 计算字数
        const originalWordCount = countWords(sanitizedPrompt, validatedRequest.language);
        const optimizedWordCount = countWords(optimizedPrompt, validatedRequest.language);

        // 11. 计算处理时间
        const processingTime = Date.now() - startTime;

        // 12. 构建成功响应
        const responseData: OptimizePromptResponse = {
            success: true,
            data: {
                originalPrompt: sanitizedPrompt,
                optimizedPrompt,
                suggestions,
                enhancementLevel: validatedRequest.enhancementLevel,
                style: validatedRequest.style,
                language: validatedRequest.language,
                requestId,
                processingTime,
                wordCount: {
                    original: originalWordCount,
                    optimized: optimizedWordCount
                }
            }
        };

        console.log(`提示词优化请求 ${requestId} 完成，耗时 ${processingTime}ms`);

        const response = new Response(JSON.stringify(responseData), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

        return setSecurityHeaders(response);

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error(`提示词优化请求失败 (${requestId}):`, error);

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
        let errorResponse: OptimizePromptResponse;

        if (error instanceof GeminiAPIError) {
            errorResponse = {
                success: false,
                error: {
                    code: error.code,
                    message: `AI服务错误: ${error.message}`
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
                    code: 'OPTIMIZATION_FAILED',
                    message: '提示词优化失败，请稍后重试'
                }
            };
        }

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

// 获取可用风格和配置的GET接口
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

        const availableStyles = STYLE_TEMPLATES[language as keyof typeof STYLE_TEMPLATES];

        const response = new Response(JSON.stringify({
            success: true,
            data: {
                endpoint: '/api/ai/optimize-prompt',
                methods: ['POST', 'GET'],
                description: language === 'zh' ? 'AI提示词优化服务' : 'AI prompt optimization service',
                supportedLanguages: ['zh', 'en'],
                enhancementLevels: ['basic', 'detailed', 'professional'],
                availableStyles: Object.keys(availableStyles),
                styleDescriptions: availableStyles,
                maxPromptLength: 1000,
                models: ['gemini-pro']
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

        return setSecurityHeaders(response);

    } catch (error) {
        console.error('获取API配置失败:', error);

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
                message: '获取API配置失败'
            }
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};