// 安全工具函数 - 完整实现
import type { SecurityMiddleware } from '../types/ai-editor';
import { validateImageContent as imageValidateContent } from './image-processor';
import { defaultRateLimiter } from './rate-limiter';

// 安全错误类
export class SecurityError extends Error {
    constructor(message: string, public code: string, public details?: any) {
        super(message);
        this.name = 'SecurityError';
    }
}

// 敏感词列表（可以从配置文件或数据库加载）
const SENSITIVE_WORDS = [
    '暴力', '血腥', '色情', '政治', '恐怖', '仇恨', '歧视',
    'violence', 'bloody', 'porn', 'political', 'terror', 'hate', 'discrimination'
];

// 提示词内容过滤 - 完整实现
export function sanitizePrompt(prompt: string): string {
    if (!prompt || typeof prompt !== 'string') {
        throw new SecurityError('无效的提示词输入', 'INVALID_PROMPT');
    }

    // 基础清理
    let sanitized = prompt
        .trim()
        .replace(/[<>]/g, '') // 移除HTML标签字符
        .replace(/javascript:/gi, '') // 移除JavaScript协议
        .replace(/data:/gi, '') // 移除data协议
        .replace(/vbscript:/gi, '') // 移除VBScript协议
        .replace(/on\w+\s*=/gi, '') // 移除事件处理器
        .replace(/\0/g, ''); // 移除空字符

    // 长度限制
    if (sanitized.length > 2000) {
        sanitized = sanitized.substring(0, 2000);
    }

    // 检查敏感词
    const lowerPrompt = sanitized.toLowerCase();
    for (const word of SENSITIVE_WORDS) {
        if (lowerPrompt.includes(word.toLowerCase())) {
            throw new SecurityError(
                `提示词包含敏感内容: ${word}`,
                'SENSITIVE_CONTENT',
                { word, prompt: sanitized }
            );
        }
    }

    return sanitized;
}

// 文件类型验证
export function validateFileType(file: File): boolean {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    return allowedTypes.includes(file.type);
}

// 生成会话ID
export function generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 检查文件大小
export function validateFileSize(file: File, maxSize: number = 10485760): boolean {
    return file.size <= maxSize;
}

// IP地址验证和提取
export function extractClientIP(request: Request): string {
    // 尝试从各种头部获取真实IP
    const headers = request.headers;

    const xForwardedFor = headers.get('x-forwarded-for');
    if (xForwardedFor) {
        return xForwardedFor.split(',')[0].trim();
    }

    const xRealIP = headers.get('x-real-ip');
    if (xRealIP) {
        return xRealIP;
    }

    const cfConnectingIP = headers.get('cf-connecting-ip');
    if (cfConnectingIP) {
        return cfConnectingIP;
    }

    // 如果都没有，返回默认值
    return 'unknown';
}

// 验证请求来源
export function validateOrigin(request: Request, allowedOrigins: string[] = []): boolean {
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');

    if (!origin && !referer) {
        // 允许没有origin的请求（如直接访问）
        return true;
    }

    if (allowedOrigins.length === 0) {
        // 如果没有配置允许的来源，允许所有
        return true;
    }

    const requestOrigin = origin || (referer ? new URL(referer).origin : '');
    return allowedOrigins.includes(requestOrigin);
}

// 输入验证函数
export function validateInput(input: any, rules: {
    required?: boolean;
    type?: 'string' | 'number' | 'boolean' | 'object';
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
}): boolean {
    if (rules.required && (input === undefined || input === null)) {
        throw new SecurityError('必填字段不能为空', 'REQUIRED_FIELD_MISSING');
    }

    if (input === undefined || input === null) {
        return true; // 非必填字段可以为空
    }

    if (rules.type && typeof input !== rules.type) {
        throw new SecurityError(
            `字段类型错误，期望 ${rules.type}，实际 ${typeof input}`,
            'INVALID_TYPE'
        );
    }

    if (rules.type === 'string') {
        const str = input as string;

        if (rules.minLength && str.length < rules.minLength) {
            throw new SecurityError(
                `字符串长度不足，最小长度 ${rules.minLength}`,
                'STRING_TOO_SHORT'
            );
        }

        if (rules.maxLength && str.length > rules.maxLength) {
            throw new SecurityError(
                `字符串长度超限，最大长度 ${rules.maxLength}`,
                'STRING_TOO_LONG'
            );
        }

        if (rules.pattern && !rules.pattern.test(str)) {
            throw new SecurityError(
                '字符串格式不符合要求',
                'INVALID_FORMAT'
            );
        }
    }

    return true;
}

// CSRF令牌生成和验证
export class CSRFProtection {
    private static tokens = new Map<string, { token: string; expires: number }>();

    static generateToken(sessionId: string): string {
        const token = `csrf_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
        const expires = Date.now() + 3600000; // 1小时过期

        this.tokens.set(sessionId, { token, expires });
        return token;
    }

    static validateToken(sessionId: string, token: string): boolean {
        const stored = this.tokens.get(sessionId);
        if (!stored) {
            return false;
        }

        if (Date.now() > stored.expires) {
            this.tokens.delete(sessionId);
            return false;
        }

        return stored.token === token;
    }

    static cleanup(): void {
        const now = Date.now();
        for (const [sessionId, data] of this.tokens.entries()) {
            if (now > data.expires) {
                this.tokens.delete(sessionId);
            }
        }
    }
}

// 安全中间件实现 - 完整版本
export class SecurityMiddlewareImpl implements SecurityMiddleware {
    private allowedOrigins: string[];

    constructor(allowedOrigins: string[] = []) {
        this.allowedOrigins = allowedOrigins;
    }

    validateFileType(file: File): boolean {
        return validateFileType(file);
    }

    sanitizePrompt(prompt: string): string {
        return sanitizePrompt(prompt);
    }

    checkRateLimit(sessionId: string): boolean {
        return defaultRateLimiter.checkLimit(sessionId);
    }

    async validateImageContent(buffer: Buffer): Promise<boolean> {
        try {
            await imageValidateContent(buffer);
            return true;
        } catch (error) {
            throw new SecurityError(
                '图片内容验证失败',
                'IMAGE_VALIDATION_FAILED',
                error
            );
        }
    }

    // 验证请求安全性
    validateRequest(request: Request): {
        sessionId: string;
        clientIP: string;
        isValid: boolean;
    } {
        const clientIP = extractClientIP(request);
        const sessionId = request.headers.get('x-session-id') || generateSessionId();

        // 验证来源
        if (!validateOrigin(request, this.allowedOrigins)) {
            throw new SecurityError('请求来源不被允许', 'INVALID_ORIGIN');
        }

        // 检查速率限制
        if (!this.checkRateLimit(sessionId)) {
            throw new SecurityError('请求频率超出限制', 'RATE_LIMITED');
        }

        return {
            sessionId,
            clientIP,
            isValid: true
        };
    }

    // 验证API请求体
    validateAPIRequest(body: any, schema: Record<string, any>): boolean {
        for (const [field, rules] of Object.entries(schema)) {
            validateInput(body[field], rules);
        }
        return true;
    }
}

// 默认安全中间件实例
export const defaultSecurityMiddleware = new SecurityMiddlewareImpl();

// 安全头部设置
export function setSecurityHeaders(response: Response): Response {
    const headers = new Headers(response.headers);

    // 防止XSS攻击
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('X-XSS-Protection', '1; mode=block');

    // 内容安全策略
    headers.set('Content-Security-Policy',
        "default-src 'self'; img-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");

    // 防止信息泄露
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // HSTS (如果使用HTTPS)
    if (response.url && response.url.startsWith('https://')) {
        headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
    });
}

// 日志记录函数
export function logSecurityEvent(event: {
    type: 'RATE_LIMITED' | 'INVALID_ORIGIN' | 'SENSITIVE_CONTENT' | 'VALIDATION_FAILED';
    sessionId: string;
    clientIP: string;
    details?: any;
    timestamp?: Date;
}): void {
    const logEntry = {
        ...event,
        timestamp: event.timestamp || new Date(),
    };

    // 在生产环境中，这里应该写入日志文件或发送到日志服务
    console.warn('Security Event:', JSON.stringify(logEntry, null, 2));
}