/**
 * 性能监控和指标收集系统
 * 收集API调用统计、性能指标和系统状态
 */

import { logger } from './logger';

export interface APIMetrics {
    endpoint: string;
    method: string;
    statusCode: number;
    responseTime: number;
    timestamp: Date;
    requestSize?: number;
    responseSize?: number;
    userId?: string;
    ip?: string;
    userAgent?: string;
}

export interface SystemMetrics {
    timestamp: Date;
    memory: {
        used: number;
        total: number;
        usage: number;
    };
    cpu: {
        usage: number;
    };
    requests: {
        total: number;
        success: number;
        error: number;
        avgResponseTime: number;
    };
    storage: {
        uploadFiles: number;
        tempFiles: number;
        totalSize: number;
    };
}

export interface ErrorMetrics {
    timestamp: Date;
    endpoint: string;
    method: string;
    statusCode: number;
    errorType: string;
    errorMessage: string;
    stack?: string;
    userId?: string;
    ip?: string;
    requestId?: string;
}

class MetricsCollector {
    private apiMetrics: APIMetrics[] = [];
    private errorMetrics: ErrorMetrics[] = [];
    private requestCounts = new Map<string, number>();
    private responseTimes: number[] = [];
    private maxMetricsHistory = 10000; // 保留最近10000条记录

    /**
     * 记录API调用指标
     */
    recordAPICall(metrics: APIMetrics): void {
        this.apiMetrics.push(metrics);

        // 更新请求计数
        const key = `${metrics.method}:${metrics.endpoint}`;
        this.requestCounts.set(key, (this.requestCounts.get(key) || 0) + 1);

        // 记录响应时间
        this.responseTimes.push(metrics.responseTime);

        // 限制历史记录数量
        if (this.apiMetrics.length > this.maxMetricsHistory) {
            this.apiMetrics = this.apiMetrics.slice(-this.maxMetricsHistory);
        }

        if (this.responseTimes.length > this.maxMetricsHistory) {
            this.responseTimes = this.responseTimes.slice(-this.maxMetricsHistory);
        }

        // 记录到日志
        logger.info('API调用', {
            endpoint: metrics.endpoint,
            method: metrics.method,
            statusCode: metrics.statusCode,
            responseTime: metrics.responseTime,
            ip: metrics.ip
        });
    }

    /**
     * 记录错误指标
     */
    recordError(error: ErrorMetrics): void {
        this.errorMetrics.push(error);

        // 限制历史记录数量
        if (this.errorMetrics.length > this.maxMetricsHistory) {
            this.errorMetrics = this.errorMetrics.slice(-this.maxMetricsHistory);
        }

        // 记录到错误日志
        logger.error('API错误', {
            endpoint: error.endpoint,
            method: error.method,
            statusCode: error.statusCode,
            errorType: error.errorType,
            errorMessage: error.errorMessage,
            ip: error.ip,
            requestId: error.requestId
        });
    }

    /**
     * 获取API统计信息
     */
    getAPIStats(timeRange?: { start: Date; end: Date }): {
        totalRequests: number;
        successRequests: number;
        errorRequests: number;
        avgResponseTime: number;
        endpointStats: Array<{
            endpoint: string;
            method: string;
            count: number;
            avgResponseTime: number;
            errorRate: number;
        }>;
    } {
        let filteredMetrics = this.apiMetrics;

        if (timeRange) {
            filteredMetrics = this.apiMetrics.filter(
                m => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
            );
        }

        const totalRequests = filteredMetrics.length;
        const successRequests = filteredMetrics.filter(m => m.statusCode < 400).length;
        const errorRequests = totalRequests - successRequests;

        const avgResponseTime = filteredMetrics.length > 0
            ? filteredMetrics.reduce((sum, m) => sum + m.responseTime, 0) / filteredMetrics.length
            : 0;

        // 按端点统计
        const endpointMap = new Map<string, {
            count: number;
            totalResponseTime: number;
            errors: number;
        }>();

        filteredMetrics.forEach(m => {
            const key = `${m.method}:${m.endpoint}`;
            const existing = endpointMap.get(key) || { count: 0, totalResponseTime: 0, errors: 0 };

            existing.count++;
            existing.totalResponseTime += m.responseTime;
            if (m.statusCode >= 400) {
                existing.errors++;
            }

            endpointMap.set(key, existing);
        });

        const endpointStats = Array.from(endpointMap.entries()).map(([key, stats]) => {
            const [method, endpoint] = key.split(':');
            return {
                endpoint,
                method,
                count: stats.count,
                avgResponseTime: stats.totalResponseTime / stats.count,
                errorRate: stats.errors / stats.count
            };
        });

        return {
            totalRequests,
            successRequests,
            errorRequests,
            avgResponseTime,
            endpointStats
        };
    }

    /**
     * 获取错误统计信息
     */
    getErrorStats(timeRange?: { start: Date; end: Date }): {
        totalErrors: number;
        errorsByType: Array<{ type: string; count: number }>;
        errorsByEndpoint: Array<{ endpoint: string; count: number }>;
        recentErrors: ErrorMetrics[];
    } {
        let filteredErrors = this.errorMetrics;

        if (timeRange) {
            filteredErrors = this.errorMetrics.filter(
                e => e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
            );
        }

        const totalErrors = filteredErrors.length;

        // 按错误类型统计
        const errorTypeMap = new Map<string, number>();
        filteredErrors.forEach(e => {
            errorTypeMap.set(e.errorType, (errorTypeMap.get(e.errorType) || 0) + 1);
        });

        const errorsByType = Array.from(errorTypeMap.entries()).map(([type, count]) => ({
            type,
            count
        }));

        // 按端点统计
        const endpointErrorMap = new Map<string, number>();
        filteredErrors.forEach(e => {
            endpointErrorMap.set(e.endpoint, (endpointErrorMap.get(e.endpoint) || 0) + 1);
        });

        const errorsByEndpoint = Array.from(endpointErrorMap.entries()).map(([endpoint, count]) => ({
            endpoint,
            count
        }));

        // 最近的错误（最多20条）
        const recentErrors = filteredErrors
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, 20);

        return {
            totalErrors,
            errorsByType,
            errorsByEndpoint,
            recentErrors
        };
    }

    /**
     * 获取系统指标
     */
    getSystemMetrics(): SystemMetrics {
        const memoryUsage = process.memoryUsage();
        const now = new Date();

        // 计算最近1小时的请求统计
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const recentMetrics = this.apiMetrics.filter(m => m.timestamp >= oneHourAgo);

        const totalRequests = recentMetrics.length;
        const successRequests = recentMetrics.filter(m => m.statusCode < 400).length;
        const errorRequests = totalRequests - successRequests;
        const avgResponseTime = recentMetrics.length > 0
            ? recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length
            : 0;

        return {
            timestamp: now,
            memory: {
                used: memoryUsage.heapUsed,
                total: memoryUsage.heapTotal,
                usage: memoryUsage.heapUsed / memoryUsage.heapTotal
            },
            cpu: {
                usage: process.cpuUsage().user / 1000000 // 转换为秒
            },
            requests: {
                total: totalRequests,
                success: successRequests,
                error: errorRequests,
                avgResponseTime
            },
            storage: {
                uploadFiles: 0, // 这些值需要从存储配置中获取
                tempFiles: 0,
                totalSize: 0
            }
        };
    }

    /**
     * 清理旧指标数据
     */
    cleanup(olderThan: Date): void {
        this.apiMetrics = this.apiMetrics.filter(m => m.timestamp >= olderThan);
        this.errorMetrics = this.errorMetrics.filter(e => e.timestamp >= olderThan);

        logger.info('指标数据清理完成', {
            remainingAPIMetrics: this.apiMetrics.length,
            remainingErrorMetrics: this.errorMetrics.length
        });
    }

    /**
     * 导出指标数据
     */
    exportMetrics(): {
        apiMetrics: APIMetrics[];
        errorMetrics: ErrorMetrics[];
        systemMetrics: SystemMetrics;
    } {
        return {
            apiMetrics: [...this.apiMetrics],
            errorMetrics: [...this.errorMetrics],
            systemMetrics: this.getSystemMetrics()
        };
    }
}

// 全局指标收集器实例
export const metricsCollector = new MetricsCollector();

/**
 * API性能监控中间件
 */
export function createMetricsMiddleware() {
    return async function metricsMiddleware(
        request: Request,
        next: () => Promise<Response>
    ): Promise<Response> {
        const startTime = Date.now();
        const url = new URL(request.url);
        const ip = request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            'unknown';
        const userAgent = request.headers.get('user-agent') || 'unknown';

        let response: Response;
        let error: Error | null = null;

        try {
            response = await next();
        } catch (err) {
            error = err as Error;
            response = new Response(JSON.stringify({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: '服务器内部错误'
                }
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const endTime = Date.now();
        const responseTime = endTime - startTime;

        // 记录API调用指标
        const apiMetrics: APIMetrics = {
            endpoint: url.pathname,
            method: request.method,
            statusCode: response.status,
            responseTime,
            timestamp: new Date(),
            ip,
            userAgent
        };

        metricsCollector.recordAPICall(apiMetrics);

        // 如果有错误，记录错误指标
        if (error || response.status >= 400) {
            const errorMetrics: ErrorMetrics = {
                timestamp: new Date(),
                endpoint: url.pathname,
                method: request.method,
                statusCode: response.status,
                errorType: error?.constructor.name || 'HTTPError',
                errorMessage: error?.message || `HTTP ${response.status}`,
                stack: error?.stack,
                ip
            };

            metricsCollector.recordError(errorMetrics);
        }

        return response;
    };
}

/**
 * 定期清理旧指标数据
 */
export function startMetricsCleanup(): NodeJS.Timeout {
    const cleanupInterval = 24 * 60 * 60 * 1000; // 24小时
    const retentionPeriod = 7 * 24 * 60 * 60 * 1000; // 7天

    return setInterval(() => {
        const cutoffDate = new Date(Date.now() - retentionPeriod);
        metricsCollector.cleanup(cutoffDate);
    }, cleanupInterval);
}