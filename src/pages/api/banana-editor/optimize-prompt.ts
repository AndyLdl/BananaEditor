// BananaEditor提示词优化API路由
// 专为BananaEditor设计的提示词优化服务

import type { APIRoute } from 'astro';
import { GeminiClient, GeminiAPIError } from '../../../utils/gemini-client';
import { defaultSecurityMiddleware, SecurityError, setSecurityHeaders, logSecurityEvent } from '../../../utils/security';
import { defaultEnhancedSecurity } from '../../../utils/enhanced-security';
import { withErrorHandling } from '../../../utils/error-handler';
import { defaultNetworkRetry } from '../../../utils/network-retry';
import { defaultErrorLogger } from '../../../utils/error-logger';

// BananaEditor提示词优化请求接口
interface BananaOptimizeRequest {
    prompt: string;
    style?: string;
    language?: string;
    targetAudience?: string;
    optimizationLevel?: 'basic' | 'advanced' | 'creative';
}

// BananaEditor提示词优化响应接口
interface BananaOptimizeResponse {
    success: boolean;
    data?: {
        originalPrompt: string;
        optimizedPrompt: string;
        improvements: string[];
        suggestions: string[];
        metadata: {
            requestId: string;
            processingTime: number;
            optimizationLevel: string;
            language: string;
            wordCount: {
                original: number;
                optimized: number;
            };
        };
    };
    error?: {
        code: string;
        message: string;
        details?: any;
    };
}

// 验证提示词优化请求参数
function validateOptimizeRequest(body: any): BananaOptimizeRequest {
    const errors: string[] = [];

    // 验证提示词
    if (!body.prompt || typeof body.prompt !== 'string') {
        errors.push('提示词是必需的');
    } else if (body.prompt.trim().length === 0) {
        errors.push('提示词不能为空');
    } else if (body.prompt.length > 1000) {
        errors.push('提示词长度不能超过1000字符');
    } else if (body.prompt.trim().length < 5) {
        errors.push('提示词至少需要5个字符');
    }

    // 验证可选参数
    if (body.optimizationLevel && !['basic', 'advanced', 'creative'].includes(body.optimizationLevel)) {
        errors.push('优化级别必须是 basic、advanced 或 creative');
    }

    if (body.language && !['zh', 'en', 'auto'].includes(body.language)) {
        errors.push('语言参数必须是 zh、en 或 auto');
    }

    if (errors.length > 0) {
        throw new SecurityError(
            `BananaEditor提示词优化参数验证失败: ${errors.join(', ')}`,
            'INVALID_OPTIMIZE_PARAMS',
            { errors }
        );
    }

    return {
        prompt: body.prompt.trim(),
        style: body.style || 'creative',
        language: body.language || 'auto',
        targetAudience: body.targetAudience || 'general',
        optimizationLevel: body.optimizationLevel || 'advanced'
    };
}

// 构建提示词优化的系统提示
function buildOptimizationSystemPrompt(request: BananaOptimizeRequest): string {
    const levelInstructions = {
        basic: '进行基础的语法和表达优化，保持原意不变',
        advanced: '深度优化表达方式，增强描述的准确性和生动性，添加适当的技术术语',
        creative: '创造性地重构提示词，增加艺术性和想象力，同时保持核心意图'
    };

    const styleInstructions = {
        realistic: '优化为写实摄影风格的专业描述',
        artistic: '优化为艺术创作的表现性描述',
        cartoon: '优化为卡通动漫风格的生动描述',
        watercolor: '优化为水彩画风格的柔美描述',
        'oil-painting': '优化为油画风格的厚重质感描述',
        sketch: '优化为素描风格的线条美感描述',
        'digital-art': '优化为数字艺术的现代感描述',
        creative: '保持创意开放性，平衡各种风格元素'
    };

    let systemPrompt = `你是BananaEditor的专业提示词优化助手，使用nano banana AI技术为用户优化图片生成提示词。

优化目标：
1. ${levelInstructions[request.optimizationLevel]}
2. ${styleInstructions[request.style as keyof typeof styleInstructions] || styleInstructions.creative}
3. 确保优化后的提示词能够生成高质量的AI图片
4. 保持BananaEditor品牌的专业性和创新性

优化原则：
- 使用具体而生动的描述词汇
- 添加适当的技术参数（如光线、构图、色彩）
- 保持语言的流畅性和可读性
- 突出关键的视觉元素
- 避免模糊或矛盾的描述

请对以下提示词进行优化，并说明改进之处：`;

    if (request.language === 'zh') {
        systemPrompt += '\n\n请用中文回复。';
    } else if (request.language === 'en') {
        systemPrompt += '\n\nPlease reply in English.';
    } else {
        systemPrompt += '\n\n请根据原提示词的语言进行回复。';
    }

    return systemPrompt;
}

// 解析优化结果
function parseOptimizationResult(response: string, originalPrompt: string): {
    optimizedPrompt: string;
    improvements: string[];
    suggestions: string[];
} {
    try {
        // 尝试解析结构化响应
        const lines = response.split('\n').filter(line => line.trim());

        let optimizedPrompt = '';
        let improvements: string[] = [];
        let suggestions: string[] = [];

        let currentSection = '';

        for (const line of lines) {
            const trimmedLine = line.trim();

            if (trimmedLine.includes('优化后') || trimmedLine.includes('Optimized')) {
                currentSection = 'optimized';
                continue;
            } else if (trimmedLine.includes('改进') || trimmedLine.includes('Improvement')) {
                currentSection = 'improvements';
                continue;
            } else if (trimmedLine.includes('建议') || trimmedLine.includes('Suggestion')) {
                currentSection = 'suggestions';
                continue;
            }

            if (currentSection === 'optimized' && !optimizedPrompt) {
                // 提取优化后的提示词
                optimizedPrompt = trimmedLine.replace(/^[：:]\s*/, '');
            } else if (currentSection === 'improvements' && trimmedLine.startsWith('-')) {
                improvements.push(trimmedLine.substring(1).trim());
            } else if (currentSection === 'suggestions' && trimmedLine.startsWith('-')) {
                suggestions.push(trimmedLine.substring(1).trim());
            }
        }

        // 如果没有找到结构化内容，使用整个响应作为优化结果
        if (!optimizedPrompt) {
            optimizedPrompt = response.trim();
        }

        // 如果没有找到改进说明，生成默认的
        if (improvements.length === 0) {
            improvements = [
                '增强了描述的具体性和生动性',
                '添加了专业的视觉技术术语',
                '优化了语言表达的流畅性'
            ];
        }

        // 如果没有找到建议，生成默认的
        if (suggestions.length === 0) {
            suggestions = [
                '可以进一步指定光线和阴影效果',
                '考虑添加情感色彩和氛围描述',
                '尝试指定更具体的构图和视角'
            ];
        }

        return {
            optimizedPrompt,
            improvements,
            suggestions
        };

    } catch (error) {
        console.error('解析优化结果失败:', error);

        // 返回基本的优化结果
        return {
            optimizedPrompt: response.trim() || originalPrompt,
            improvements: ['AI优化了提示词的表达方式'],
            suggestions: ['可以尝试添加更多具体的视觉细节']
        };
    }
}

// 生成个性化建议
function generatePersonalizedSuggestions(originalPrompt: string, style: string): string[] {
    const suggestions: string[] = [];

    // 基于风格的建议
    const styleSpecificSuggestions: Record<string, string[]> = {
        realistic: [
            '添加具体的光线描述，如"自然光"、"工作室灯光"',
            '指定相机参数，如"浅景深"、"广角镜头"',
            '描述材质质感，如"光滑"、"粗糙"、"反光"'
        ],
        artistic: [
            '增加艺术流派描述，如"印象派"、"抽象主义"',
            '指定绘画媒介，如"油画"、"水彩"、"丙烯"',
            '添加情感表达，如"忧郁"、"欢快"、"神秘"'
        ],
        cartoon: [
            '指定卡通风格，如"迪士尼风格"、"日式动漫"',
            '添加色彩描述，如"鲜艳色彩"、"柔和色调"',
            '描述角色特征，如"大眼睛"、"夸张表情"'
        ]
    };

    if (styleSpecificSuggestions[style]) {
        suggestions.push(...styleSpecificSuggestions[style]);
    }

    // 基于内容的建议
    if (originalPrompt.includes('人物') || originalPrompt.includes('人')) {
        suggestions.push('可以描述人物的表情、姿态和服装细节');
    }

    if (originalPrompt.includes('风景') || originalPrompt.includes('景色')) {
        suggestions.push('可以指定时间（如日出、黄昏）和天气条件');
    }

    if (originalPrompt.includes('建筑')) {
        suggestions.push('可以描述建筑风格和周围环境');
    }

    // 通用建议
    suggestions.push(
        '尝试使用更具体的形容词替代通用词汇',
        '考虑添加构图描述，如"特写"、"全景"、"对称"',
        '可以指定色彩搭配和整体氛围'
    );

    // 返回前5个建议
    return suggestions.slice(0, 5);
}

// 主要的提示词优化处理函数
const handleBananaOptimize: APIRoute = async ({ request }) => {
    const startTime = Date.now();
    let sessionId = '';
    let clientIP = '';
    let requestId = '';

    try {
        // 1. 增强安全验证
        const securityCheck = await defaultEnhancedSecurity.validateAPIRequest(request);
        sessionId = securityCheck.sessionId;
        clientIP = securityCheck.clientIP;

        // 2. 解析请求体
        const body = await request.json();

        // 3. 验证请求参数
        const validatedRequest = validateOptimizeRequest(body);

        // 4. 增强提示词验证和清理
        const sanitizedPrompt = await defaultEnhancedSecurity.validatePromptContent(validatedRequest.prompt);

        // 5. 初始化Gemini客户端
        const geminiClient = new GeminiClient();
        requestId = geminiClient.generateRequestId();

        // 6. 构建优化系统提示
        const systemPrompt = buildOptimizationSystemPrompt(validatedRequest);
        const fullPrompt = `${systemPrompt}\n\n原始提示词：${sanitizedPrompt}`;

        console.log(`BananaEditor提示词优化请求 ${requestId} 开始处理`);

        // 7. 调用Gemini API进行优化
        const geminiResponse = await defaultNetworkRetry.executeWithRetry(
            () => geminiClient.optimizePrompt(
                sanitizedPrompt,
                {
                    style: validatedRequest.style,
                    language: validatedRequest.language,
                    model: 'gemini-pro'
                }
            ),
            {
                operationName: 'banana-optimize-prompt',
                requestId,
                sessionId
            }
        );

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

        // 9. 解析优化结果
        const optimizationResult = parseOptimizationResult(generatedText, sanitizedPrompt);

        // 10. 生成个性化建议
        const personalizedSuggestions = generatePersonalizedSuggestions(
            sanitizedPrompt,
            validatedRequest.style
        );

        // 11. 计算处理时间
        const processingTime = Date.now() - startTime;

        // 12. 构建成功响应
        const responseData: BananaOptimizeResponse = {
            success: true,
            data: {
                originalPrompt: sanitizedPrompt,
                optimizedPrompt: optimizationResult.optimizedPrompt,
                improvements: optimizationResult.improvements,
                suggestions: [...optimizationResult.suggestions, ...personalizedSuggestions].slice(0, 6),
                metadata: {
                    requestId,
                    processingTime,
                    optimizationLevel: validatedRequest.optimizationLevel,
                    language: validatedRequest.language,
                    wordCount: {
                        original: sanitizedPrompt.split(/\s+/).length,
                        optimized: optimizationResult.optimizedPrompt.split(/\s+/).length
                    }
                }
            }
        };

        console.log(`BananaEditor提示词优化请求 ${requestId} 完成，耗时 ${processingTime}ms`);

        const response = new Response(JSON.stringify(responseData), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

        return setSecurityHeaders(response);

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error(`BananaEditor提示词优化请求失败 (${requestId}):`, error);

        // 记录错误日志
        await defaultErrorLogger.logError({
            id: `banana_opt_err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: error instanceof SecurityError ? 'SECURITY_ERROR' :
                error instanceof GeminiAPIError ? 'API_ERROR' : 'UNKNOWN_ERROR',
            severity: error instanceof SecurityError && error.code === 'RATE_LIMITED' ? 'medium' : 'high',
            code: (error as any).code || 'UNKNOWN',
            message: error.message,
            stack: error.stack,
            requestId,
            sessionId,
            clientIP,
            endpoint: '/api/banana-editor/optimize-prompt',
            method: 'POST',
            userAgent: request.headers.get('user-agent') || undefined,
            timestamp: new Date(),
            processingTime,
            details: {
                error: error.message,
                service: 'BananaEditor-Optimize'
            }
        });

        // 记录安全事件
        if (error instanceof SecurityError) {
            logSecurityEvent({
                type: 'BANANA_OPTIMIZE_VALIDATION_FAILED',
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
        let errorResponse: BananaOptimizeResponse;
        let statusCode = 500;

        if (error instanceof GeminiAPIError) {
            errorResponse = {
                success: false,
                error: {
                    code: error.code,
                    message: `nano banana AI优化服务暂时不可用: ${error.message}`
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
                    code: 'BANANA_OPTIMIZE_FAILED',
                    message: 'BananaEditor提示词优化失败，请稍后重试'
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

// 获取优化服务信息的GET接口
const handleGetOptimizeInfo: APIRoute = async ({ request }) => {
    try {
        // 安全验证
        const securityCheck = defaultSecurityMiddleware.validateRequest(request);

        const response = new Response(JSON.stringify({
            success: true,
            data: {
                service: 'BananaEditor提示词优化',
                version: '1.0.0',
                endpoint: '/api/banana-editor/optimize-prompt',
                methods: ['POST'],
                description: '基于nano banana AI技术的智能提示词优化服务',
                features: [
                    '多级别优化（基础/高级/创意）',
                    '风格化优化建议',
                    '多语言支持',
                    '个性化改进建议',
                    '实时优化反馈'
                ],
                optimizationLevels: [
                    { level: 'basic', description: '基础语法和表达优化' },
                    { level: 'advanced', description: '深度优化，增强准确性和生动性' },
                    { level: 'creative', description: '创造性重构，增加艺术性' }
                ],
                supportedLanguages: ['zh', 'en', 'auto'],
                maxPromptLength: 1000,
                minPromptLength: 5
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

        return setSecurityHeaders(response);

    } catch (error) {
        console.error('获取BananaEditor优化API信息失败:', error);

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
                code: 'GET_OPTIMIZE_INFO_FAILED',
                message: '获取BananaEditor优化API信息失败'
            }
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

// 导出API路由
export const POST: APIRoute = withErrorHandling(handleBananaOptimize);
export const GET: APIRoute = withErrorHandling(handleGetOptimizeInfo);