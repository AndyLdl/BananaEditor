/**
 * 生产环境安全配置
 * 提供HTTPS、安全头、CORS等安全相关配置
 */

export interface SecurityConfig {
    forceHttps: boolean;
    hstsMaxAge: number;
    cspEnabled: boolean;
    xFrameOptions: string;
    xContentTypeOptions: string;
    allowedOrigins: string[];
    corsCredentials: boolean;
    secureCookies: boolean;
}

/**
 * 获取安全配置
 */
export function getSecurityConfig(): SecurityConfig {
    return {
        forceHttps: process.env.FORCE_HTTPS === 'true',
        hstsMaxAge: parseInt(process.env.HSTS_MAX_AGE || '31536000'),
        cspEnabled: process.env.CSP_ENABLED === 'true',
        xFrameOptions: process.env.X_FRAME_OPTIONS || 'DENY',
        xContentTypeOptions: process.env.X_CONTENT_TYPE_OPTIONS || 'nosniff',
        allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [],
        corsCredentials: process.env.CORS_CREDENTIALS === 'true',
        secureCookies: process.env.SECURE_COOKIES === 'true'
    };
}

/**
 * 生成内容安全策略 (CSP) 头
 */
export function generateCSPHeader(): string {
    const cspDirectives = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: https:",
        "connect-src 'self' https://generativelanguage.googleapis.com",
        "media-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests"
    ];

    return cspDirectives.join('; ');
}

/**
 * 设置安全响应头
 */
export function setSecurityHeaders(response: Response, config: SecurityConfig): Response {
    const headers = new Headers(response.headers);

    // HSTS头 (仅在HTTPS下设置)
    if (config.forceHttps) {
        headers.set('Strict-Transport-Security', `max-age=${config.hstsMaxAge}; includeSubDomains; preload`);
    }

    // 内容安全策略
    if (config.cspEnabled) {
        headers.set('Content-Security-Policy', generateCSPHeader());
    }

    // 防止点击劫持
    headers.set('X-Frame-Options', config.xFrameOptions);

    // 防止MIME类型嗅探
    headers.set('X-Content-Type-Options', config.xContentTypeOptions);

    // XSS保护
    headers.set('X-XSS-Protection', '1; mode=block');

    // 引用策略
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // 权限策略
    headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
    });
}

/**
 * CORS配置
 */
export function getCORSHeaders(origin: string | null, config: SecurityConfig): Record<string, string> {
    const headers: Record<string, string> = {};

    // 检查来源是否被允许
    if (origin && config.allowedOrigins.includes(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
    } else if (config.allowedOrigins.includes('*')) {
        headers['Access-Control-Allow-Origin'] = '*';
    }

    // 设置允许的方法
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';

    // 设置允许的头
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';

    // 是否允许凭据
    if (config.corsCredentials) {
        headers['Access-Control-Allow-Credentials'] = 'true';
    }

    // 预检请求缓存时间
    headers['Access-Control-Max-Age'] = '86400';

    return headers;
}

/**
 * 验证请求来源
 */
export function validateOrigin(origin: string | null, config: SecurityConfig): boolean {
    if (!origin) return false;

    return config.allowedOrigins.includes(origin) || config.allowedOrigins.includes('*');
}

/**
 * 生成安全的会话ID
 */
export function generateSecureSessionId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const randomArray = new Uint8Array(32);
    crypto.getRandomValues(randomArray);

    for (let i = 0; i < randomArray.length; i++) {
        result += chars[randomArray[i] % chars.length];
    }

    return result;
}