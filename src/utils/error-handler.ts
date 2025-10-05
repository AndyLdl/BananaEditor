// 全局错误处理机制
import type { APIRoute } from 'astro';
import { SecurityError } from './security';
import { RateLimitError } from './rate-limiter';
import { GeminiAPIError } from './gemini-client';
import { ImageProcessingError } from './image-processor';

// 错误类型枚举
export enum ErrorType {
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    SECURITY_ERROR = 'SECURITY_ERROR',
    RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
    API_ERROR = 'API_ERROR',
    PROCESSING_ERROR = 'PROCESSING_ERROR',
    NETWORK_ERROR = 'NETWORK_ERROR',
    TIMEOUT_ERROR = 'TIMEOUT_ERROR',
    UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// 错误严重级别
export enum ErrorSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

// 标准化错误响应接口
export interface StandardErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        type: ErrorType;
        severity: ErrorSeverity;
        timestamp: string;
        requestId?: string;
        retryAfter?: number;
        details?: any;
    };
}

// 错误日志接口
export interface ErrorLog {
    id: string;
    type: ErrorType;
    severity: ErrorSeverity;
    code: string;
    message: string;
    stack?: string;
    requestId?: string;
    sessionId?: string;
    clientIP?: string;
    endpoint: string;
    method: string;
    userAgent?: string;
    timestamp: Date;
    processingTime?: number;
    details?: any;
}

// 重试配置接口
export interface RetryConfig {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
    retryableErrors: string[];
}

// 默认重试配置
const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000, // 1秒
    maxDelay: 10000, // 10秒
    backoffMultiplier: 2,
    retryableErrors: [
        ErrorType.NETWORK_ERROR,
        ErrorType.TIMEOUT_ERROR,
        'API_RATE_LIMITED',
        'TEMPORARY_UNAVAILABLE'
    ]
};

// 错误处理器类
export class ErrorHandler {
    private static instance: ErrorHandler;
    private errorLogs: ErrorLog[] = [];
    private retryConfig: RetryConfig;

    private constructor(retryConfig?: Partial<RetryConfig>) {
        this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
    }

    // 获取单例实例
    static getInstance(retryConfig?: Partial<RetryConfig>): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler(retryConfig);
        }
        return ErrorHandler.instance;
    }

    // 分类错误类型
    private classifyError(error: Error): { type: ErrorType; severity: ErrorSeverity } {
        if (error instanceof SecurityError) {
            return {
                type: ErrorType.SECURITY_ERROR,
                severity: error.code === 'RATE_LIMITED' ? ErrorSeverity.MEDIUM : ErrorSeverity.HIGH
            };
        }

        if (error instanceof RateLimitError) {
            return {
                type: ErrorType.RATE_LIMIT_ERROR,
                severity: ErrorSeverity.MEDIUM
            };
        }

        if (error instanceof GeminiAPIError) {
            return {
                type: ErrorType.API_ERROR,
                severity: error.code === 'QUOTA_EXCEEDED' ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM
            };
        }

        if (error instanceof ImageProcessingError) {
            return {
                type: ErrorType.PROCESSING_ERROR,
                severity: ErrorSeverity.LOW
            };
        }

        // 网络相关错误
        if (error.message.toLowerCase().includes('fetch') ||
            error.message.toLowerCase().includes('network') ||
            error.message.toLowerCase().includes('connection')) {
            return {
                type: ErrorType.NETWORK_ERROR,
                severity: ErrorSeverity.MEDIUM
            };
        }

        // 超时错误
        if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
            return {
                type: ErrorType.TIMEOUT_ERROR,
                severity: ErrorSeverity.MEDIUM
            };
        }

        // 验证错误
        if (error.message.toLowerCase().includes('validation') ||
            error.message.toLowerCase().includes('invalid') ||
            error.message.toLowerCase().includes('input')) {
            return {
                type: ErrorType.VALIDATION_ERROR,
                severity: ErrorSeverity.LOW
            };
        }

        return {
            type: ErrorType.UNKNOWN_ERROR,
            severity: ErrorSeverity.MEDIUM
        };
    }

    // 生成用户友好的错误消息
    private generateUserFriendlyMessage(error: Error, type: ErrorType): string {
        const userMessages: Record<ErrorType, string> = {
            [ErrorType.VALIDATION_ERROR]: '输入数据格式不正确，请检查后重试',
            [ErrorType.SECURITY_ERROR]: '安全验证失败，请稍后重试',
            [ErrorType.RATE_LIMIT_ERROR]: '请求过于频繁，请稍后重试',
            [ErrorType.API_ERROR]: 'AI服务暂时不可用，请稍后重试',
            [ErrorType.PROCESSING_ERROR]: '处理请求时出现问题，请重试',
            [ErrorType.NETWORK_ERROR]: '网络连接异常，请检查网络后重试',
            [ErrorType.TIMEOUT_ERROR]: '请求超时，请稍后重试',
            [ErrorType.UNKNOWN_ERROR]: '服务暂时不可用，请稍后重试'
        };

        // 对于特定错误，使用原始消息
        if (error instanceof SecurityError || error instanceof RateLimitError) {
            return error.message;
        }

        return userMessages[type] || userMessages[ErrorType.UNKNOWN_ERROR];
    }

    // 记录错误日志
    private logError(errorLog: ErrorLog): void {
        // 添加到内存日志
        this.errorLogs.push(errorLog);

        // 限制内存中的日志数量
        if (this.errorLogs.length > 1000) {
            this.errorLogs = this.errorLogs.slice(-500);
        }

        // 根据严重级别决定日志输出方式
        const logMessage = `[${errorLog.severity.toUpperCase()}] ${errorLog.type}: ${errorLog.message}`;
        const logDetails = {
            id: errorLog.id,
            code: errorLog.code,
            endpoint: errorLog.endpoint,
            requestId: errorLog.requestId,
            sessionId: errorLog.sessionId,
            clientIP: errorLog.clientIP,
            processingTime: errorLog.processingTime,
            timestamp: errorLog.timestamp,
            details: errorLog.details
        };

        switch (errorLog.severity) {
            case ErrorSeverity.CRITICAL:
                console.error(logMessage, logDetails);
                // 在生产环境中，这里应该发送到监控系统
                break;
            case ErrorSeverity.HIGH:
                console.error(logMessage, logDetails);
                break;
            case ErrorSeverity.MEDIUM:
                console.warn(logMessage, logDetails);
                break;
            case ErrorSeverity.LOW:
                console.info(logMessage, logDetails);
                break;
        }

        // 在生产环境中，应该将日志发送到外部日志服务
        // 例如：发送到 Sentry、LogRocket、或自定义日志服务
    }

    // 处理错误并生成标准响应
    handleError(
        error: Error,
        context: {
            endpoint: string;
            method: string;
            requestId?: string;
            sessionId?: string;
            clientIP?: string;
            userAgent?: string;
            processingTime?: number;
            details?: any;
        }
    ): StandardErrorResponse {
        const { type, severity } = this.classifyError(error);
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const userFriendlyMessage = this.generateUserFriendlyMessage(error, type);

        // 创建错误日志
        const errorLog: ErrorLog = {
            id: errorId,
            type,
            severity,
            code: (error as any).code || 'UNKNOWN',
            message: error.message,
            stack: error.stack,
            requestId: context.requestId,
            sessionId: context.sessionId,
            clientIP: context.clientIP,
            endpoint: context.endpoint,
            method: context.method,
            userAgent: context.userAgent,
            timestamp: new Date(),
            processingTime: context.processingTime,
            details: context.details
        };

        // 记录错误日志
        this.logError(errorLog);

        // 构建标准错误响应
        const errorResponse: StandardErrorResponse = {
            success: false,
            error: {
                code: errorLog.code,
                message: userFriendlyMessage,
                type,
                severity,
                timestamp: errorLog.timestamp.toISOString(),
                requestId: context.requestId
            }
        };

        // 添加重试信息
        if (error instanceof RateLimitError) {
            errorResponse.error.retryAfter = error.retryAfter;
        }

        // 对于开发环境，添加详细信息
        if (process.env.NODE_ENV === 'development') {
            errorResponse.error.details = {
                originalMessage: error.message,
                stack: error.stack,
                ...context.details
            };
        }

        return errorResponse;
    }

    // 获取HTTP状态码
    getHttpStatusCode(errorResponse: StandardErrorResponse): number {
        const { type, code } = errorResponse.error;

        // 根据错误类型和代码确定状态码
        switch (type) {
            case ErrorType.VALIDATION_ERROR:
                return 400; // Bad Request
            case ErrorType.SECURITY_ERROR:
                return code === 'RATE_LIMITED' ? 429 : 403; // Too Many Requests or Forbidden
            case ErrorType.RATE_LIMIT_ERROR:
                return 429; // Too Many Requests
            case ErrorType.API_ERROR:
                return code === 'QUOTA_EXCEEDED' ? 429 : 502; // Too Many Requests or Bad Gateway
            case ErrorType.PROCESSING_ERROR:
                return 422; // Unprocessable Entity
            case ErrorType.NETWORK_ERROR:
                return 502; // Bad Gateway
            case ErrorType.TIMEOUT_ERROR:
                return 504; // Gateway Timeout
            case ErrorType.UNKNOWN_ERROR:
            default:
                return 500; // Internal Server Error
        }
    }

    // 检查错误是否可重试
    isRetryableError(error: Error): boolean {
        const { type } = this.classifyError(error);
        const errorCode = (error as any).code;

        // 检查错误类型是否可重试
        if (this.retryConfig.retryableErrors.includes(type)) {
            return true;
        }

        // 检查错误代码是否可重试
        if (errorCode && this.retryConfig.retryableErrors.includes(errorCode)) {
            return true;
        }

        // 检查错误消息中的关键词
        const retryableKeywords = ['network', 'timeout', 'connection', 'temporary'];
        const errorMessage = error.message.toLowerCase();
        return retryableKeywords.some(keyword => errorMessage.includes(keyword));
    }

    // 计算重试延迟
    calculateRetryDelay(attempt: number): number {
        const delay = this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1);
        return Math.min(delay, this.retryConfig.maxDelay);
    }

    // 执行带重试的操作
    async executeWithRetry<T>(
        operation: () => Promise<T>,
        context: {
            operationName: string;
            requestId?: string;
            sessionId?: string;
        }
    ): Promise<T> {
        let lastError: Error;

        for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error as Error;

                // 检查是否可重试
                if (!this.isRetryableError(lastError) || attempt === this.retryConfig.maxAttempts) {
                    throw lastError;
                }

                // 计算延迟时间
                const delay = this.calculateRetryDelay(attempt);

                console.warn(`操作 ${context.operationName} 第 ${attempt} 次尝试失败，${delay}ms 后重试:`, lastError.message);

                // 等待后重试
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw lastError!;
    }

    // 获取错误统计信息
    getErrorStats(timeRange?: { start: Date; end: Date }): {
        totalErrors: number;
        errorsByType: Record<ErrorType, number>;
        errorsBySeverity: Record<ErrorSeverity, number>;
        topErrors: Array<{ code: string; count: number; message: string }>;
    } {
        let filteredLogs = this.errorLogs;

        if (timeRange) {
            filteredLogs = this.errorLogs.filter(log =>
                log.timestamp >= timeRange.start && log.timestamp <= timeRange.end
            );
        }

        const errorsByType: Record<ErrorType, number> = {} as any;
        const errorsBySeverity: Record<ErrorSeverity, number> = {} as any;
        const errorCounts: Record<string, { count: number; message: string }> = {};

        for (const log of filteredLogs) {
            // 按类型统计
            errorsByType[log.type] = (errorsByType[log.type] || 0) + 1;

            // 按严重级别统计
            errorsBySeverity[log.severity] = (errorsBySeverity[log.severity] || 0) + 1;

            // 按错误代码统计
            if (!errorCounts[log.code]) {
                errorCounts[log.code] = { count: 0, message: log.message };
            }
            errorCounts[log.code].count++;
        }

        // 获取最常见的错误
        const topErrors = Object.entries(errorCounts)
            .map(([code, data]) => ({ code, count: data.count, message: data.message }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        return {
            totalErrors: filteredLogs.length,
            errorsByType,
            errorsBySeverity,
            topErrors
        };
    }

    // 清理旧的错误日志
    cleanup(maxAge: number = 24 * 60 * 60 * 1000): void {
        const cutoff = new Date(Date.now() - maxAge);
        this.errorLogs = this.errorLogs.filter(log => log.timestamp > cutoff);
    }
}

// 创建API路由错误处理装饰器
export function withErrorHandling(handler: APIRoute): APIRoute {
    return async (context) => {
        const startTime = Date.now();
        const errorHandler = ErrorHandler.getInstance();

        try {
            return await handler(context);
        } catch (error) {
            const processingTime = Date.now() - startTime;
            const request = context.request;

            // 提取请求信息
            const url = new URL(request.url);
            const requestContext = {
                endpoint: url.pathname,
                method: request.method,
                requestId: request.headers.get('x-request-id') || undefined,
                sessionId: request.headers.get('x-session-id') || undefined,
                clientIP: request.headers.get('x-forwarded-for') ||
                    request.headers.get('x-real-ip') ||
                    'unknown',
                userAgent: request.headers.get('user-agent') || undefined,
                processingTime
            };

            // 处理错误
            const errorResponse = errorHandler.handleError(error as Error, requestContext);
            const statusCode = errorHandler.getHttpStatusCode(errorResponse);

            return new Response(JSON.stringify(errorResponse), {
                status: statusCode,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Error-ID': errorResponse.error.code
                }
            });
        }
    };
}

// 导出默认错误处理器实例
export const defaultErrorHandler = ErrorHandler.getInstance();