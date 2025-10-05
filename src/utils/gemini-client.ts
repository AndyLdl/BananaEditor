// Gemini API客户端 - 完整实现
import type { EnvironmentConfig, ErrorResponse } from '../types/ai-editor';

// 重试配置接口
interface RetryConfig {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
}

// API错误类型
export class GeminiAPIError extends Error {
    constructor(
        message: string,
        public code: string,
        public statusCode?: number,
        public details?: any
    ) {
        super(message);
        this.name = 'GeminiAPIError';
    }
}

// 环境配置获取函数
export function getConfig(): EnvironmentConfig {
    return {
        GEMINI_API_KEY: import.meta.env.GEMINI_API_KEY || '',
        GEMINI_API_ENDPOINT: import.meta.env.GEMINI_API_ENDPOINT || 'https://generativelanguage.googleapis.com',
        MAX_FILE_SIZE: parseInt(import.meta.env.MAX_FILE_SIZE || '10485760'),
        RATE_LIMIT_WINDOW: parseInt(import.meta.env.RATE_LIMIT_WINDOW || '60000'),
        RATE_LIMIT_MAX_REQUESTS: parseInt(import.meta.env.RATE_LIMIT_MAX_REQUESTS || '10'),
    };
}

// Gemini API客户端类
export class GeminiClient {
    private apiKey: string;
    private endpoint: string;
    private retryConfig: RetryConfig;

    constructor(options?: {
        retryConfig?: Partial<RetryConfig>;
        config?: Partial<EnvironmentConfig>;
    }) {
        const config = options?.config ? { ...getConfig(), ...options.config } : getConfig();
        this.apiKey = config.GEMINI_API_KEY;
        this.endpoint = config.GEMINI_API_ENDPOINT;

        // 设置重试配置
        this.retryConfig = {
            maxRetries: 3,
            baseDelay: 1000,
            maxDelay: 10000,
            ...options?.retryConfig
        };

        if (!this.apiKey) {
            throw new Error('GEMINI_API_KEY 环境变量未设置');
        }
    }

    // 生成请求ID
    generateRequestId(): string {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // 计算重试延迟时间（指数退避）
    private calculateDelay(attempt: number): number {
        const delay = this.retryConfig.baseDelay * Math.pow(2, attempt);
        return Math.min(delay, this.retryConfig.maxDelay);
    }

    // 延迟函数
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 验证API密钥格式
    private validateApiKey(): boolean {
        return this.apiKey.length > 0 && this.apiKey.startsWith('AIza');
    }

    // 构建请求头
    private buildHeaders(contentType: string = 'application/json'): Record<string, string> {
        return {
            'Content-Type': contentType,
            'x-goog-api-key': this.apiKey,
            'User-Agent': 'AI-Image-Editor/1.0'
        };
    }

    // 处理API响应
    private async handleResponse(response: Response): Promise<any> {
        const contentType = response.headers.get('content-type');

        let responseData: any;
        if (contentType && contentType.includes('application/json')) {
            responseData = await response.json();
        } else {
            responseData = await response.text();
        }

        if (!response.ok) {
            const errorCode = this.mapStatusCodeToErrorCode(response.status);
            const errorMessage = this.extractErrorMessage(responseData);

            throw new GeminiAPIError(
                errorMessage,
                errorCode,
                response.status,
                responseData
            );
        }

        return responseData;
    }

    // 映射HTTP状态码到错误代码
    private mapStatusCodeToErrorCode(statusCode: number): string {
        switch (statusCode) {
            case 400:
                return 'INVALID_REQUEST';
            case 401:
                return 'UNAUTHORIZED';
            case 403:
                return 'FORBIDDEN';
            case 404:
                return 'NOT_FOUND';
            case 429:
                return 'RATE_LIMITED';
            case 500:
                return 'INTERNAL_ERROR';
            case 503:
                return 'SERVICE_UNAVAILABLE';
            default:
                return 'UNKNOWN_ERROR';
        }
    }

    // 提取错误消息
    private extractErrorMessage(responseData: any): string {
        if (typeof responseData === 'string') {
            return responseData;
        }

        if (responseData?.error?.message) {
            return responseData.error.message;
        }

        if (responseData?.message) {
            return responseData.message;
        }

        return '未知的API错误';
    }

    // 判断错误是否可重试
    private isRetryableError(error: GeminiAPIError): boolean {
        const retryableCodes = ['RATE_LIMITED', 'SERVICE_UNAVAILABLE', 'INTERNAL_ERROR'];
        return retryableCodes.includes(error.code) ||
            (error.statusCode && error.statusCode >= 500);
    }

    // 带重试机制的API调用
    async callAPI(endpoint: string, data: any, options?: {
        method?: string;
        contentType?: string;
        timeout?: number;
    }): Promise<any> {
        if (!this.validateApiKey()) {
            throw new GeminiAPIError('无效的API密钥格式', 'INVALID_API_KEY');
        }

        const {
            method = 'POST',
            contentType = 'application/json',
            timeout = 30000
        } = options || {};

        const url = `${this.endpoint}${endpoint}`;
        const headers = this.buildHeaders(contentType);

        let lastError: GeminiAPIError | null = null;

        for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
            try {
                // 如果不是第一次尝试，添加延迟
                if (attempt > 0) {
                    const delayMs = this.calculateDelay(attempt - 1);
                    console.log(`重试第 ${attempt} 次，延迟 ${delayMs}ms`);
                    await this.delay(delayMs);
                }

                // 创建AbortController用于超时控制
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                const requestOptions: RequestInit = {
                    method,
                    headers,
                    signal: controller.signal
                };

                // 添加请求体（如果不是GET请求）
                if (method !== 'GET' && data) {
                    if (contentType === 'application/json') {
                        requestOptions.body = JSON.stringify(data);
                    } else {
                        requestOptions.body = data;
                    }
                }

                const response = await fetch(url, requestOptions);
                clearTimeout(timeoutId);

                return await this.handleResponse(response);

            } catch (error) {
                if (error instanceof GeminiAPIError) {
                    lastError = error;

                    // 如果错误不可重试或已达到最大重试次数，直接抛出
                    if (!this.isRetryableError(error) || attempt === this.retryConfig.maxRetries) {
                        throw error;
                    }
                } else if (error instanceof Error) {
                    // 处理网络错误、超时等
                    const networkError = new GeminiAPIError(
                        `网络请求失败: ${error.message}`,
                        'NETWORK_ERROR',
                        undefined,
                        error
                    );

                    lastError = networkError;

                    // 网络错误通常可以重试
                    if (attempt === this.retryConfig.maxRetries) {
                        throw networkError;
                    }
                } else {
                    // 未知错误
                    const unknownError = new GeminiAPIError(
                        '未知错误',
                        'UNKNOWN_ERROR',
                        undefined,
                        error
                    );
                    throw unknownError;
                }
            }
        }

        // 如果所有重试都失败了，抛出最后一个错误
        throw lastError || new GeminiAPIError('所有重试都失败了', 'MAX_RETRIES_EXCEEDED');
    }

    // 图片生成API调用
    async generateImage(imageData: string, prompt: string, options?: {
        model?: string;
        quality?: string;
    }): Promise<any> {
        const { model = 'gemini-pro-vision', quality = 'standard' } = options || {};

        const requestData = {
            contents: [{
                parts: [
                    {
                        text: prompt
                    },
                    {
                        inline_data: {
                            mime_type: 'image/jpeg',
                            data: imageData
                        }
                    }
                ]
            }],
            generationConfig: {
                temperature: 0.7,
                topK: 32,
                topP: 1,
                maxOutputTokens: 4096,
            }
        };

        return await this.callAPI(`/v1/models/${model}:generateContent`, requestData);
    }

    // 提示词优化API调用
    async optimizePrompt(originalPrompt: string, options?: {
        style?: string;
        language?: string;
        model?: string;
    }): Promise<any> {
        const {
            style = 'creative',
            language = 'zh',
            model = 'gemini-pro'
        } = options || {};

        const systemPrompt = language === 'zh'
            ? `你是一个专业的AI绘画提示词优化专家。请将用户提供的简单描述优化成详细、专业的AI绘画提示词。优化后的提示词应该：
1. 包含具体的视觉细节
2. 添加艺术风格描述
3. 包含光线、构图等技术要素
4. 保持原意的同时增强表现力
请直接返回优化后的提示词，不需要额外解释。`
            : `You are a professional AI art prompt optimizer. Please optimize the user's simple description into detailed, professional AI art prompts. The optimized prompt should:
1. Include specific visual details
2. Add artistic style descriptions
3. Include technical elements like lighting and composition
4. Enhance expressiveness while maintaining the original meaning
Please return the optimized prompt directly without additional explanations.`;

        const requestData = {
            contents: [{
                parts: [{
                    text: `${systemPrompt}\n\n原始提示词: ${originalPrompt}\n风格要求: ${style}`
                }]
            }],
            generationConfig: {
                temperature: 0.8,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 2048,
            }
        };

        return await this.callAPI(`/v1/models/${model}:generateContent`, requestData);
    }

    // 健康检查
    async healthCheck(): Promise<boolean> {
        try {
            const response = await this.callAPI('/v1/models', null, {
                method: 'GET',
                timeout: 5000
            });
            return response && response.models && Array.isArray(response.models);
        } catch (error) {
            console.error('Gemini API健康检查失败:', error);
            return false;
        }
    }

    // 获取可用模型列表
    async getAvailableModels(): Promise<string[]> {
        try {
            const response = await this.callAPI('/v1/models', null, { method: 'GET' });
            return response.models?.map((model: any) => model.name) || [];
        } catch (error) {
            console.error('获取模型列表失败:', error);
            return [];
        }
    }
}