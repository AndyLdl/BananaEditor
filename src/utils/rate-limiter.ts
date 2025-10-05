// 速率限制器 - 完整实现
import type { UserSession } from '../types/ai-editor';
import { getConfig } from './gemini-client';

// 内存存储的会话数据 (生产环境应使用Redis等)
const sessions = new Map<string, UserSession>();

// 速率限制错误类
export class RateLimitError extends Error {
    constructor(
        message: string,
        public retryAfter: number,
        public details?: any
    ) {
        super(message);
        this.name = 'RateLimitError';
    }
}

// 请求记录接口
export interface RequestRecord {
    timestamp: number;
    endpoint: string;
    success: boolean;
}

// 速率限制器类 - 完整实现
export class RateLimiter {
    private windowMs: number;
    private maxRequests: number;
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor(windowMs?: number, maxRequests?: number) {
        const config = getConfig();
        this.windowMs = windowMs || config.RATE_LIMIT_WINDOW;
        this.maxRequests = maxRequests || config.RATE_LIMIT_MAX_REQUESTS;

        // 启动定期清理
        this.startCleanup();
    }

    // 检查是否超出速率限制
    checkLimit(sessionId: string): boolean {
        const now = Date.now();
        const session = this.getOrCreateSession(sessionId);

        // 检查是否被阻止
        if (session.isBlocked && session.blockUntil && now < session.blockUntil.getTime()) {
            const retryAfter = Math.ceil((session.blockUntil.getTime() - now) / 1000);
            throw new RateLimitError(
                `会话被临时阻止，请在 ${retryAfter} 秒后重试`,
                retryAfter,
                { sessionId, blockUntil: session.blockUntil }
            );
        }

        // 清除过期的阻止状态
        if (session.isBlocked && session.blockUntil && now >= session.blockUntil.getTime()) {
            session.isBlocked = false;
            session.blockUntil = undefined;
            session.requestCount = 0;
        }

        // 检查时间窗口内的请求数量
        const windowStart = now - this.windowMs;
        if (session.lastRequestTime.getTime() < windowStart) {
            // 重置计数器
            session.requestCount = 0;
        }

        // 检查是否超出限制
        if (session.requestCount >= this.maxRequests) {
            // 阻止会话
            session.isBlocked = true;
            session.blockUntil = new Date(now + this.windowMs);

            const retryAfter = Math.ceil(this.windowMs / 1000);
            throw new RateLimitError(
                `请求频率超出限制，每 ${this.windowMs / 1000} 秒最多 ${this.maxRequests} 次请求`,
                retryAfter,
                { sessionId, requestCount: session.requestCount, maxRequests: this.maxRequests }
            );
        }

        return true;
    }

    // 记录请求
    recordRequest(sessionId: string, endpoint: string = 'unknown', success: boolean = true): void {
        const session = this.getOrCreateSession(sessionId);

        session.requestCount++;
        session.lastRequestTime = new Date();

        // 记录请求历史（可选，用于分析）
        if (!session.requestHistory) {
            session.requestHistory = [];
        }

        session.requestHistory.push({
            timestamp: Date.now(),
            endpoint,
            success
        });

        // 限制历史记录数量
        if (session.requestHistory.length > 100) {
            session.requestHistory = session.requestHistory.slice(-50);
        }
    }

    // 获取或创建会话
    private getOrCreateSession(sessionId: string): UserSession & { requestHistory?: RequestRecord[] } {
        let session = sessions.get(sessionId);

        if (!session) {
            session = {
                sessionId,
                requestCount: 0,
                lastRequestTime: new Date(),
                isBlocked: false,
                requestHistory: []
            };
            sessions.set(sessionId, session);
        }

        return session as UserSession & { requestHistory?: RequestRecord[] };
    }

    // 获取会话信息
    getSessionInfo(sessionId: string): UserSession | null {
        return sessions.get(sessionId) || null;
    }

    // 重置会话
    resetSession(sessionId: string): void {
        const session = sessions.get(sessionId);
        if (session) {
            session.requestCount = 0;
            session.isBlocked = false;
            session.blockUntil = undefined;
            session.lastRequestTime = new Date();
        }
    }

    // 手动阻止会话
    blockSession(sessionId: string, durationMs: number = this.windowMs): void {
        const session = this.getOrCreateSession(sessionId);
        session.isBlocked = true;
        session.blockUntil = new Date(Date.now() + durationMs);
    }

    // 解除会话阻止
    unblockSession(sessionId: string): void {
        const session = sessions.get(sessionId);
        if (session) {
            session.isBlocked = false;
            session.blockUntil = undefined;
        }
    }

    // 获取剩余请求次数
    getRemainingRequests(sessionId: string): number {
        const session = sessions.get(sessionId);
        if (!session) {
            return this.maxRequests;
        }

        const now = Date.now();
        const windowStart = now - this.windowMs;

        // 如果上次请求在窗口外，重置计数
        if (session.lastRequestTime.getTime() < windowStart) {
            return this.maxRequests;
        }

        return Math.max(0, this.maxRequests - session.requestCount);
    }

    // 获取重置时间
    getResetTime(sessionId: string): Date | null {
        const session = sessions.get(sessionId);
        if (!session) {
            return null;
        }

        return new Date(session.lastRequestTime.getTime() + this.windowMs);
    }

    // 清理过期会话
    cleanup(): void {
        const now = Date.now();
        const expireTime = now - (this.windowMs * 2); // 保留2个窗口期的数据

        for (const [sessionId, session] of sessions.entries()) {
            // 清理长时间未活动的会话
            if (session.lastRequestTime.getTime() < expireTime) {
                sessions.delete(sessionId);
                continue;
            }

            // 清理过期的阻止状态
            if (session.isBlocked && session.blockUntil && now >= session.blockUntil.getTime()) {
                session.isBlocked = false;
                session.blockUntil = undefined;
            }
        }
    }

    // 启动定期清理
    private startCleanup(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        // 每5分钟清理一次
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 5 * 60 * 1000);
    }

    // 停止清理
    stopCleanup(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    // 获取统计信息
    getStats(): {
        totalSessions: number;
        activeSessions: number;
        blockedSessions: number;
        totalRequests: number;
    } {
        const now = Date.now();
        const activeThreshold = now - this.windowMs;

        let activeSessions = 0;
        let blockedSessions = 0;
        let totalRequests = 0;

        for (const session of sessions.values()) {
            totalRequests += session.requestCount;

            if (session.lastRequestTime.getTime() > activeThreshold) {
                activeSessions++;
            }

            if (session.isBlocked) {
                blockedSessions++;
            }
        }

        return {
            totalSessions: sessions.size,
            activeSessions,
            blockedSessions,
            totalRequests
        };
    }

    // 销毁速率限制器
    destroy(): void {
        this.stopCleanup();
        sessions.clear();
    }
}

// IP级别的速率限制器
export class IPRateLimiter extends RateLimiter {
    private ipSessions = new Map<string, string>(); // IP -> sessionId映射

    checkIPLimit(clientIP: string): boolean {
        // 为IP创建或获取会话ID
        let sessionId = this.ipSessions.get(clientIP);
        if (!sessionId) {
            sessionId = `ip_${clientIP}_${Date.now()}`;
            this.ipSessions.set(clientIP, sessionId);
        }

        return this.checkLimit(sessionId);
    }

    recordIPRequest(clientIP: string, endpoint: string = 'unknown', success: boolean = true): void {
        const sessionId = this.ipSessions.get(clientIP);
        if (sessionId) {
            this.recordRequest(sessionId, endpoint, success);
        }
    }

    cleanup(): void {
        super.cleanup();

        // 清理IP映射
        const now = Date.now();
        const expireTime = now - (this.windowMs * 2);

        for (const [ip, sessionId] of this.ipSessions.entries()) {
            const session = sessions.get(sessionId);
            if (!session || session.lastRequestTime.getTime() < expireTime) {
                this.ipSessions.delete(ip);
            }
        }
    }
}

// 默认速率限制器实例
export const defaultRateLimiter = new RateLimiter();
export const defaultIPRateLimiter = new IPRateLimiter();

// API兼容的速率限制器接口
export const rateLimiter = {
    async checkRateLimit(sessionId: string): Promise<boolean> {
        try {
            return defaultRateLimiter.checkLimit(sessionId);
        } catch (error) {
            if (error instanceof RateLimitError) {
                return false;
            }
            throw error;
        }
    },

    async logRequest(sessionId: string, endpoint: string, success: boolean, error?: string): Promise<void> {
        defaultRateLimiter.recordRequest(sessionId, endpoint, success);
    }
};