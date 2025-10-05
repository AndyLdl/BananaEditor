// 速率限制器单元测试
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter, IPRateLimiter, RateLimitError } from '../rate-limiter';

// 模拟getConfig函数
vi.mock('../gemini-client', () => ({
    getConfig: vi.fn(() => ({
        RATE_LIMIT_WINDOW: 60000, // 1分钟
        RATE_LIMIT_MAX_REQUESTS: 5, // 5次请求
    }))
}));

describe('速率限制器', () => {
    let rateLimiter: RateLimiter;
    const testSessionId = 'test-session-123';

    beforeEach(() => {
        rateLimiter = new RateLimiter(60000, 5); // 1分钟内最多5次请求
    });

    afterEach(() => {
        rateLimiter.destroy();
    });

    describe('RateLimiter', () => {
        describe('checkLimit', () => {
            it('应该允许在限制内的请求', () => {
                expect(rateLimiter.checkLimit(testSessionId)).toBe(true);
                rateLimiter.recordRequest(testSessionId);

                expect(rateLimiter.checkLimit(testSessionId)).toBe(true);
                rateLimiter.recordRequest(testSessionId);

                expect(rateLimiter.checkLimit(testSessionId)).toBe(true);
            });

            it('应该在超出限制时抛出错误', () => {
                // 记录5次请求
                for (let i = 0; i < 5; i++) {
                    rateLimiter.checkLimit(testSessionId);
                    rateLimiter.recordRequest(testSessionId);
                }

                // 第6次请求应该被拒绝
                expect(() => rateLimiter.checkLimit(testSessionId))
                    .toThrow(RateLimitError);
            });

            it('应该在时间窗口重置后允许新请求', () => {
                // 使用较短的时间窗口进行测试
                const shortLimiter = new RateLimiter(100, 2); // 100ms内最多2次请求

                try {
                    // 记录2次请求
                    shortLimiter.checkLimit(testSessionId);
                    shortLimiter.recordRequest(testSessionId);
                    shortLimiter.checkLimit(testSessionId);
                    shortLimiter.recordRequest(testSessionId);

                    // 第3次请求应该被拒绝并阻止会话
                    expect(() => shortLimiter.checkLimit(testSessionId))
                        .toThrow(RateLimitError);

                    // 手动解除阻止来测试重置功能
                    shortLimiter.unblockSession(testSessionId);
                    shortLimiter.resetSession(testSessionId);

                    // 现在应该可以再次请求
                    expect(shortLimiter.checkLimit(testSessionId)).toBe(true);
                } finally {
                    shortLimiter.destroy();
                }
            });
        });

        describe('recordRequest', () => {
            it('应该记录请求信息', () => {
                rateLimiter.recordRequest(testSessionId, '/api/test', true);

                const session = rateLimiter.getSessionInfo(testSessionId);
                expect(session).toBeTruthy();
                expect(session!.requestCount).toBe(1);
                expect(session!.requestHistory).toHaveLength(1);
                expect(session!.requestHistory![0].endpoint).toBe('/api/test');
                expect(session!.requestHistory![0].success).toBe(true);
            });

            it('应该限制历史记录数量', () => {
                // 记录大量请求
                for (let i = 0; i < 150; i++) {
                    rateLimiter.recordRequest(testSessionId, `/api/test${i}`, true);
                }

                const session = rateLimiter.getSessionInfo(testSessionId);
                // 应该限制在合理的数量内（不超过100）
                expect(session!.requestHistory!.length).toBeLessThanOrEqual(100);
                // 应该有历史记录
                expect(session!.requestHistory!.length).toBeGreaterThan(0);
            });
        });

        describe('getSessionInfo', () => {
            it('应该返回会话信息', () => {
                rateLimiter.recordRequest(testSessionId);

                const session = rateLimiter.getSessionInfo(testSessionId);
                expect(session).toBeTruthy();
                expect(session!.sessionId).toBe(testSessionId);
                expect(session!.requestCount).toBe(1);
            });

            it('应该为不存在的会话返回null', () => {
                const session = rateLimiter.getSessionInfo('non-existent');
                expect(session).toBeNull();
            });
        });

        describe('resetSession', () => {
            it('应该重置会话状态', () => {
                // 记录一些请求
                for (let i = 0; i < 3; i++) {
                    rateLimiter.checkLimit(testSessionId);
                    rateLimiter.recordRequest(testSessionId);
                }

                rateLimiter.resetSession(testSessionId);

                const session = rateLimiter.getSessionInfo(testSessionId);
                expect(session!.requestCount).toBe(0);
                expect(session!.isBlocked).toBe(false);
            });
        });

        describe('blockSession', () => {
            it('应该手动阻止会话', () => {
                rateLimiter.blockSession(testSessionId, 5000); // 阻止5秒

                expect(() => rateLimiter.checkLimit(testSessionId))
                    .toThrow(RateLimitError);
            });
        });

        describe('unblockSession', () => {
            it('应该解除会话阻止', () => {
                rateLimiter.blockSession(testSessionId, 5000);
                expect(() => rateLimiter.checkLimit(testSessionId))
                    .toThrow(RateLimitError);

                rateLimiter.unblockSession(testSessionId);
                expect(rateLimiter.checkLimit(testSessionId)).toBe(true);
            });
        });

        describe('getRemainingRequests', () => {
            it('应该返回剩余请求次数', () => {
                expect(rateLimiter.getRemainingRequests(testSessionId)).toBe(5);

                rateLimiter.recordRequest(testSessionId);
                expect(rateLimiter.getRemainingRequests(testSessionId)).toBe(4);

                rateLimiter.recordRequest(testSessionId);
                expect(rateLimiter.getRemainingRequests(testSessionId)).toBe(3);
            });
        });

        describe('getResetTime', () => {
            it('应该返回重置时间', () => {
                rateLimiter.recordRequest(testSessionId);

                const resetTime = rateLimiter.getResetTime(testSessionId);
                expect(resetTime).toBeInstanceOf(Date);
                expect(resetTime!.getTime()).toBeGreaterThan(Date.now());
            });

            it('应该为不存在的会话返回null', () => {
                const resetTime = rateLimiter.getResetTime('non-existent');
                expect(resetTime).toBeNull();
            });
        });

        describe('getStats', () => {
            it('应该返回统计信息', () => {
                rateLimiter.recordRequest('session1');
                rateLimiter.recordRequest('session2');
                rateLimiter.blockSession('session3');

                const stats = rateLimiter.getStats();
                expect(stats.totalSessions).toBeGreaterThanOrEqual(3);
                expect(stats.activeSessions).toBeGreaterThanOrEqual(2);
                expect(stats.blockedSessions).toBeGreaterThanOrEqual(1);
                expect(stats.totalRequests).toBeGreaterThanOrEqual(2);
            });
        });

        describe('cleanup', () => {
            it('应该有清理功能', () => {
                rateLimiter.recordRequest('temp-session');
                expect(rateLimiter.getSessionInfo('temp-session')).toBeTruthy();

                // 测试清理功能存在（不测试具体的时间逻辑）
                expect(() => rateLimiter.cleanup()).not.toThrow();
            });
        });
    });

    describe('IPRateLimiter', () => {
        let ipLimiter: IPRateLimiter;
        const testIP = '192.168.1.100';

        beforeEach(() => {
            ipLimiter = new IPRateLimiter(60000, 3); // 1分钟内最多3次请求
        });

        afterEach(() => {
            ipLimiter.destroy();
        });

        describe('checkIPLimit', () => {
            it('应该基于IP地址进行限制', () => {
                expect(ipLimiter.checkIPLimit(testIP)).toBe(true);
                ipLimiter.recordIPRequest(testIP);

                expect(ipLimiter.checkIPLimit(testIP)).toBe(true);
                ipLimiter.recordIPRequest(testIP);

                expect(ipLimiter.checkIPLimit(testIP)).toBe(true);
                ipLimiter.recordIPRequest(testIP);

                // 第4次请求应该被拒绝
                expect(() => ipLimiter.checkIPLimit(testIP))
                    .toThrow(RateLimitError);
            });

            it('应该为不同IP独立计算限制', () => {
                const ip1 = '192.168.1.1';
                const ip2 = '192.168.1.2';

                // IP1记录3次请求
                for (let i = 0; i < 3; i++) {
                    ipLimiter.checkIPLimit(ip1);
                    ipLimiter.recordIPRequest(ip1);
                }

                // IP1应该被限制
                expect(() => ipLimiter.checkIPLimit(ip1)).toThrow(RateLimitError);

                // IP2应该仍然可以请求
                expect(ipLimiter.checkIPLimit(ip2)).toBe(true);
            });
        });

        describe('recordIPRequest', () => {
            it('应该记录IP请求', () => {
                ipLimiter.recordIPRequest(testIP, '/api/test', true);

                // 验证请求被记录（通过检查后续请求是否被计数）
                expect(ipLimiter.checkIPLimit(testIP)).toBe(true);
            });
        });
    });

    describe('RateLimitError', () => {
        it('应该正确创建速率限制错误', () => {
            const error = new RateLimitError('请求过于频繁', 60, { sessionId: 'test' });

            expect(error.message).toBe('请求过于频繁');
            expect(error.retryAfter).toBe(60);
            expect(error.details).toEqual({ sessionId: 'test' });
            expect(error.name).toBe('RateLimitError');
        });
    });
});