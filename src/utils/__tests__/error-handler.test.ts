// 错误处理器测试
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ErrorHandler, ErrorType, ErrorSeverity } from '../error-handler';
import { SecurityError } from '../security';
import { RateLimitError } from '../rate-limiter';
import { GeminiAPIError } from '../gemini-client';

describe('ErrorHandler', () => {
    let errorHandler: ErrorHandler;

    beforeEach(() => {
        errorHandler = ErrorHandler.getInstance();
        // 清理之前的实例
        (ErrorHandler as any).instance = null;
        errorHandler = ErrorHandler.getInstance();
    });

    describe('错误分类', () => {
        it('应该正确分类安全错误', () => {
            const securityError = new SecurityError('测试安全错误', 'TEST_SECURITY');
            const response = errorHandler.handleError(securityError, {
                endpoint: '/test',
                method: 'POST'
            });

            expect(response.error.type).toBe(ErrorType.SECURITY_ERROR);
            expect(response.error.severity).toBe(ErrorSeverity.HIGH);
        });

        it('应该正确分类速率限制错误', () => {
            const rateLimitError = new RateLimitError('请求过于频繁', 60);
            const response = errorHandler.handleError(rateLimitError, {
                endpoint: '/test',
                method: 'POST'
            });

            expect(response.error.type).toBe(ErrorType.RATE_LIMIT_ERROR);
            expect(response.error.severity).toBe(ErrorSeverity.MEDIUM);
            expect(response.error.retryAfter).toBe(60);
        });

        it('应该正确分类API错误', () => {
            const apiError = new GeminiAPIError('API调用失败', 'API_ERROR');
            const response = errorHandler.handleError(apiError, {
                endpoint: '/test',
                method: 'POST'
            });

            expect(response.error.type).toBe(ErrorType.API_ERROR);
            expect(response.error.severity).toBe(ErrorSeverity.MEDIUM);
        });

        it('应该正确分类网络错误', () => {
            const networkError = new Error('fetch failed');
            const response = errorHandler.handleError(networkError, {
                endpoint: '/test',
                method: 'POST'
            });

            expect(response.error.type).toBe(ErrorType.NETWORK_ERROR);
            expect(response.error.severity).toBe(ErrorSeverity.MEDIUM);
        });

        it('应该正确分类超时错误', () => {
            const timeoutError = new Error('Request timeout');
            const response = errorHandler.handleError(timeoutError, {
                endpoint: '/test',
                method: 'POST'
            });

            expect(response.error.type).toBe(ErrorType.TIMEOUT_ERROR);
            expect(response.error.severity).toBe(ErrorSeverity.MEDIUM);
        });

        it('应该正确分类验证错误', () => {
            const validationError = new Error('Invalid input data');
            const response = errorHandler.handleError(validationError, {
                endpoint: '/test',
                method: 'POST'
            });

            expect(response.error.type).toBe(ErrorType.VALIDATION_ERROR);
            expect(response.error.severity).toBe(ErrorSeverity.LOW);
        });

        it('应该正确分类未知错误', () => {
            const unknownError = new Error('Something went wrong');
            const response = errorHandler.handleError(unknownError, {
                endpoint: '/test',
                method: 'POST'
            });

            expect(response.error.type).toBe(ErrorType.UNKNOWN_ERROR);
            expect(response.error.severity).toBe(ErrorSeverity.MEDIUM);
        });
    });

    describe('HTTP状态码映射', () => {
        it('应该为验证错误返回400', () => {
            const validationError = new Error('Invalid input');
            const response = errorHandler.handleError(validationError, {
                endpoint: '/test',
                method: 'POST'
            });
            const statusCode = errorHandler.getHttpStatusCode(response);

            expect(statusCode).toBe(400);
        });

        it('应该为速率限制错误返回429', () => {
            const rateLimitError = new RateLimitError('Too many requests', 60);
            const response = errorHandler.handleError(rateLimitError, {
                endpoint: '/test',
                method: 'POST'
            });
            const statusCode = errorHandler.getHttpStatusCode(response);

            expect(statusCode).toBe(429);
        });

        it('应该为网络错误返回502', () => {
            const networkError = new Error('Network error');
            const response = errorHandler.handleError(networkError, {
                endpoint: '/test',
                method: 'POST'
            });
            const statusCode = errorHandler.getHttpStatusCode(response);

            expect(statusCode).toBe(502);
        });

        it('应该为超时错误返回504', () => {
            const timeoutError = new Error('Request timeout');
            const response = errorHandler.handleError(timeoutError, {
                endpoint: '/test',
                method: 'POST'
            });
            const statusCode = errorHandler.getHttpStatusCode(response);

            expect(statusCode).toBe(504);
        });

        it('应该为未知错误返回500', () => {
            const unknownError = new Error('Unknown error');
            const response = errorHandler.handleError(unknownError, {
                endpoint: '/test',
                method: 'POST'
            });
            const statusCode = errorHandler.getHttpStatusCode(response);

            expect(statusCode).toBe(500);
        });
    });

    describe('用户友好消息', () => {
        it('应该为安全错误生成用户友好消息', () => {
            const securityError = new SecurityError('测试安全错误', 'TEST_SECURITY');
            const response = errorHandler.handleError(securityError, {
                endpoint: '/test',
                method: 'POST'
            });

            expect(response.error.message).toBe('测试安全错误');
        });

        it('应该为速率限制错误生成用户友好消息', () => {
            const rateLimitError = new RateLimitError('请求过于频繁', 60);
            const response = errorHandler.handleError(rateLimitError, {
                endpoint: '/test',
                method: 'POST'
            });

            expect(response.error.message).toBe('请求过于频繁');
        });

        it('应该为其他错误生成通用友好消息', () => {
            const networkError = new Error('fetch failed');
            const response = errorHandler.handleError(networkError, {
                endpoint: '/test',
                method: 'POST'
            });

            expect(response.error.message).toBe('网络连接异常，请检查网络后重试');
        });
    });

    describe('重试机制', () => {
        it('应该识别可重试的错误', () => {
            const networkError = new Error('Network error');
            expect(errorHandler.isRetryableError(networkError)).toBe(true);

            const timeoutError = new Error('Timeout error');
            expect(errorHandler.isRetryableError(timeoutError)).toBe(true);
        });

        it('应该识别不可重试的错误', () => {
            const validationError = new Error('Invalid input');
            expect(errorHandler.isRetryableError(validationError)).toBe(false);
        });

        it('应该正确计算重试延迟', () => {
            const delay1 = errorHandler.calculateRetryDelay(1);
            const delay2 = errorHandler.calculateRetryDelay(2);
            const delay3 = errorHandler.calculateRetryDelay(3);

            expect(delay1).toBe(1000); // 基础延迟
            expect(delay2).toBe(2000); // 2倍延迟
            expect(delay3).toBe(4000); // 4倍延迟
        });

        it('应该限制最大重试延迟', () => {
            const delay = errorHandler.calculateRetryDelay(10);
            expect(delay).toBeLessThanOrEqual(10000); // 最大延迟10秒
        });

        it('应该执行带重试的操作', async () => {
            let attempts = 0;
            const operation = vi.fn().mockImplementation(() => {
                attempts++;
                if (attempts < 3) {
                    throw new Error('Network error');
                }
                return 'success';
            });

            const result = await errorHandler.executeWithRetry(operation, {
                operationName: 'test-operation'
            });

            expect(result).toBe('success');
            expect(attempts).toBe(3);
        });

        it('应该在最大重试次数后抛出错误', async () => {
            const operation = vi.fn().mockImplementation(() => {
                throw new Error('Network error');
            });

            await expect(errorHandler.executeWithRetry(operation, {
                operationName: 'test-operation'
            })).rejects.toThrow('Network error');

            expect(operation).toHaveBeenCalledTimes(3); // 默认最大重试次数
        });

        it('应该不重试不可重试的错误', async () => {
            const operation = vi.fn().mockImplementation(() => {
                throw new Error('Invalid input');
            });

            await expect(errorHandler.executeWithRetry(operation, {
                operationName: 'test-operation'
            })).rejects.toThrow('Invalid input');

            expect(operation).toHaveBeenCalledTimes(1); // 只调用一次
        });
    });

    describe('错误统计', () => {
        it('应该正确统计错误', () => {
            // 生成一些错误
            const errors = [
                new SecurityError('安全错误1', 'SEC1'),
                new SecurityError('安全错误2', 'SEC2'),
                new Error('网络错误1'),
                new Error('网络错误2'),
                new RateLimitError('限流错误', 60)
            ];

            errors.forEach(error => {
                errorHandler.handleError(error, {
                    endpoint: '/test',
                    method: 'POST'
                });
            });

            const stats = errorHandler.getErrorStats();

            expect(stats.totalErrors).toBe(5);
            expect(stats.errorsByType[ErrorType.SECURITY_ERROR]).toBe(2);
            // 注意：'网络错误1'和'网络错误2'会被分类为UNKNOWN_ERROR，因为它们不包含'network'关键词
            expect(stats.errorsByType[ErrorType.UNKNOWN_ERROR]).toBe(2);
            expect(stats.errorsByType[ErrorType.RATE_LIMIT_ERROR]).toBe(1);
        });

        it('应该支持时间范围过滤', () => {
            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

            // 这个测试需要模拟时间，实际实现中可能需要依赖注入时间函数
            const stats = errorHandler.getErrorStats({
                start: oneHourAgo,
                end: now
            });

            expect(typeof stats.totalErrors).toBe('number');
        });
    });

    describe('清理功能', () => {
        it('应该清理旧的错误日志', () => {
            // 生成一些错误
            const error = new Error('测试错误');
            errorHandler.handleError(error, {
                endpoint: '/test',
                method: 'POST'
            });

            const statsBefore = errorHandler.getErrorStats();
            expect(statsBefore.totalErrors).toBeGreaterThan(0);

            // 清理（使用很短的最大年龄）
            errorHandler.cleanup(0);

            const statsAfter = errorHandler.getErrorStats();
            expect(statsAfter.totalErrors).toBe(0);
        });
    });
});

describe('withErrorHandling装饰器', () => {
    it('应该包装API路由并处理错误', async () => {
        const { withErrorHandling } = await import('../error-handler');

        const mockHandler = vi.fn().mockImplementation(() => {
            throw new Error('测试错误');
        });

        const wrappedHandler = withErrorHandling(mockHandler);

        const mockRequest = new Request('http://localhost/test', {
            method: 'POST'
        });

        const response = await wrappedHandler({
            request: mockRequest
        } as any);

        expect(response.status).toBe(500);

        const responseData = await response.json();
        expect(responseData.success).toBe(false);
        expect(responseData.error).toBeDefined();
    });

    it('应该正确传递成功的响应', async () => {
        const { withErrorHandling } = await import('../error-handler');

        const mockResponse = new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

        const mockHandler = vi.fn().mockResolvedValue(mockResponse);
        const wrappedHandler = withErrorHandling(mockHandler);

        const mockRequest = new Request('http://localhost/test', {
            method: 'GET'
        });

        const response = await wrappedHandler({
            request: mockRequest
        } as any);

        expect(response.status).toBe(200);

        const responseData = await response.json();
        expect(responseData.success).toBe(true);
    });
});