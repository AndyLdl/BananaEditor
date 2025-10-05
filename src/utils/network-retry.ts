// 网络重试机制
import { defaultErrorHandler } from './error-handler';

// 网络错误类
export class NetworkError extends Error {
    constructor(
        message: string,
        public code: string,
        public statusCode?: number,
        public retryable: boolean = true
    ) {
        super(message);
        this.name = 'NetworkError';
    }
}

// 超时错误类
export class TimeoutError extends Error {
    constructor(message: string, public timeout: number) {
        super(message);
        this.name = 'TimeoutError';
    }
}

// 重试配置接口
export interface NetworkRetryConfig {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
    timeout: number;
    retryableStatusCodes: number[];
    retryableErrors: string[];
}

// 默认重试配置
const DEFAULT_NETWORK_CONFIG: NetworkRetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000, // 1秒
    maxDelay: 10000, // 10秒
    backoffMultiplier: 2,
    timeout: 30000, // 30秒
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    retryableErrors: [
        'ECONNRESET',
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ENOTFOUND',
        'EAI_AGAIN'
    ]
};

// 网络重试器类
export class NetworkRetry {
    private config: NetworkRetryConfig;

    constructor(config?: Partial<NetworkRetryConfig>) {
        this.config = { ...DEFAULT_NETWORK_CONFIG, ...config };
    }

    // 检查错误是否可重试
    private isRetryableError(error: Error, response?: Response): boolean {
        // 检查网络错误
        if (error instanceof NetworkError) {
            return error.retryable;
        }

        // 检查超时错误
        if (error instanceof TimeoutError) {
            return true;
        }

        // 检查HTTP状态码
        if (response && this.config.retryableStatusCodes.includes(response.status)) {
            return true;
        }

        // 检查错误代码
        const errorCode = (error as any).code;
        if (errorCode && this.config.retryableErrors.includes(errorCode)) {
            return true;
        }

        // 检查错误消息中的关键词
        const retryableKeywords = ['timeout', 'network', 'connection', 'reset', 'refused'];
        const errorMessage = error.message.toLowerCase();
        return retryableKeywords.some(keyword => errorMessage.includes(keyword));
    }

    // 计算重试延迟（指数退避 + 抖动）
    private calculateDelay(attempt: number): number {
        const exponentialDelay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1);
        const cappedDelay = Math.min(exponentialDelay, this.config.maxDelay);

        // 添加随机抖动（±25%）
        const jitter = cappedDelay * 0.25 * (Math.random() - 0.5);
        return Math.max(0, cappedDelay + jitter);
    }

    // 创建带超时的fetch请求
    private async fetchWithTimeout(
        url: string | URL | Request,
        options?: RequestInit
    ): Promise<Response> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);

            if ((error as any).name === 'AbortError') {
                throw new TimeoutError(
                    `请求超时 (${this.config.timeout}ms)`,
                    this.config.timeout
                );
            }

            // 转换为网络错误
            throw new NetworkError(
                `网络请求失败: ${error instanceof Error ? error.message : '未知错误'}`,
                (error as any).code || 'NETWORK_ERROR'
            );
        }
    }

    // 执行带重试的网络请求
    async fetchWithRetry(
        url: string | URL | Request,
        options?: RequestInit,
        context?: {
            operationName?: string;
            requestId?: string;
            sessionId?: string;
        }
    ): Promise<Response> {
        let lastError: Error;
        let lastResponse: Response | undefined;

        for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
            try {
                const response = await this.fetchWithTimeout(url, options);

                // 检查HTTP状态码
                if (!response.ok && this.config.retryableStatusCodes.includes(response.status)) {
                    lastResponse = response;
                    throw new NetworkError(
                        `HTTP错误 ${response.status}: ${response.statusText}`,
                        `HTTP_${response.status}`,
                        response.status
                    );
                }

                // 成功响应
                return response;

            } catch (error) {
                lastError = error as Error;

                // 检查是否可重试
                if (!this.isRetryableError(lastError, lastResponse) || attempt === this.config.maxAttempts) {
                    throw lastError;
                }

                // 计算延迟时间
                const delay = this.calculateDelay(attempt);

                console.warn(
                    `网络请求 ${context?.operationName || url} 第 ${attempt} 次尝试失败，${delay}ms 后重试:`,
                    lastError.message
                );

                // 等待后重试
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw lastError!;
    }

    // 执行带重试的异步操作
    async executeWithRetry<T>(
        operation: () => Promise<T>,
        context: {
            operationName: string;
            requestId?: string;
            sessionId?: string;
        }
    ): Promise<T> {
        return defaultErrorHandler.executeWithRetry(operation, context);
    }

    // 批量请求处理
    async batchRequest<T>(
        requests: Array<() => Promise<T>>,
        options?: {
            concurrency?: number;
            failFast?: boolean;
            context?: {
                operationName: string;
                requestId?: string;
                sessionId?: string;
            };
        }
    ): Promise<Array<{ success: boolean; data?: T; error?: Error }>> {
        const concurrency = options?.concurrency || 3;
        const failFast = options?.failFast || false;
        const results: Array<{ success: boolean; data?: T; error?: Error }> = [];

        // 分批处理请求
        for (let i = 0; i < requests.length; i += concurrency) {
            const batch = requests.slice(i, i + concurrency);

            const batchPromises = batch.map(async (request, index) => {
                try {
                    const data = await this.executeWithRetry(request, {
                        operationName: `${options?.context?.operationName || 'batch'}-${i + index}`,
                        requestId: options?.context?.requestId,
                        sessionId: options?.context?.sessionId
                    });
                    return { success: true, data };
                } catch (error) {
                    const result = { success: false, error: error as Error };

                    if (failFast) {
                        throw error;
                    }

                    return result;
                }
            });

            try {
                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);
            } catch (error) {
                if (failFast) {
                    throw error;
                }
            }
        }

        return results;
    }

    // 健康检查
    async healthCheck(
        url: string,
        options?: {
            timeout?: number;
            expectedStatus?: number;
            maxAttempts?: number;
        }
    ): Promise<{
        healthy: boolean;
        responseTime: number;
        status?: number;
        error?: string;
    }> {
        const startTime = Date.now();
        const timeout = options?.timeout || 5000;
        const expectedStatus = options?.expectedStatus || 200;
        const maxAttempts = options?.maxAttempts || 1;

        // 临时修改配置用于健康检查
        const originalConfig = { ...this.config };
        this.config.timeout = timeout;
        this.config.maxAttempts = maxAttempts;

        try {
            const response = await this.fetchWithRetry(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'AI-Editor-HealthCheck/1.0'
                }
            }, {
                operationName: 'health-check'
            });

            const responseTime = Date.now() - startTime;
            const healthy = response.status === expectedStatus;

            return {
                healthy,
                responseTime,
                status: response.status,
                error: healthy ? undefined : `期望状态码 ${expectedStatus}，实际 ${response.status}`
            };

        } catch (error) {
            const responseTime = Date.now() - startTime;
            return {
                healthy: false,
                responseTime,
                error: error instanceof Error ? error.message : '未知错误'
            };
        } finally {
            // 恢复原始配置
            this.config = originalConfig;
        }
    }

    // 更新配置
    updateConfig(config: Partial<NetworkRetryConfig>): void {
        this.config = { ...this.config, ...config };
    }

    // 获取当前配置
    getConfig(): NetworkRetryConfig {
        return { ...this.config };
    }
}

// 创建默认网络重试实例
export const defaultNetworkRetry = new NetworkRetry();

// 便捷的fetch函数
export async function fetchWithRetry(
    url: string | URL | Request,
    options?: RequestInit,
    retryConfig?: Partial<NetworkRetryConfig>
): Promise<Response> {
    const retry = retryConfig ? new NetworkRetry(retryConfig) : defaultNetworkRetry;
    return retry.fetchWithRetry(url, options);
}

// 便捷的JSON请求函数
export async function fetchJSON<T = any>(
    url: string | URL | Request,
    options?: RequestInit,
    retryConfig?: Partial<NetworkRetryConfig>
): Promise<T> {
    const response = await fetchWithRetry(url, options, retryConfig);

    if (!response.ok) {
        throw new NetworkError(
            `HTTP错误 ${response.status}: ${response.statusText}`,
            `HTTP_${response.status}`,
            response.status,
            false // HTTP错误通常不需要重试
        );
    }

    try {
        return await response.json();
    } catch (error) {
        throw new NetworkError(
            '响应JSON解析失败',
            'JSON_PARSE_ERROR',
            undefined,
            false
        );
    }
}

// 便捷的文本请求函数
export async function fetchText(
    url: string | URL | Request,
    options?: RequestInit,
    retryConfig?: Partial<NetworkRetryConfig>
): Promise<string> {
    const response = await fetchWithRetry(url, options, retryConfig);

    if (!response.ok) {
        throw new NetworkError(
            `HTTP错误 ${response.status}: ${response.statusText}`,
            `HTTP_${response.status}`,
            response.status,
            false
        );
    }

    try {
        return await response.text();
    } catch (error) {
        throw new NetworkError(
            '响应文本解析失败',
            'TEXT_PARSE_ERROR',
            undefined,
            false
        );
    }
}