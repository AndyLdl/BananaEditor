/**
 * 安全中间件
 * 处理HTTPS重定向、安全头设置、CORS等安全相关功能
 */

import type { APIRoute } from 'astro';
import { getSecurityConfig, setSecurityHeaders, getCORSHeaders, validateOrigin } from '../config/security';

/**
 * 安全中间件工厂函数
 */
export function createSecurityMiddleware() {
    const config = getSecurityConfig();

    return async function securityMiddleware(
        request: Request,
        next: () => Promise<Response>
    ): Promise<Response> {
        const url = new URL(request.url);
        const origin = request.headers.get('origin');

        // HTTPS重定向检查
        if (config.forceHttps && url.protocol === 'http:' && process.env.NODE_ENV === 'production') {
            const httpsUrl = url.toString().replace('http:', 'https:');
            return new Response(null, {
                status: 301,
                headers: {
                    'Location': httpsUrl
                }
            });
        }

        // 处理预检请求
        if (request.method === 'OPTIONS') {
            const corsHeaders = getCORSHeaders(origin, config);
            return new Response(null, {
                status: 200,
                headers: corsHeaders
            });
        }

        // 验证来源
        if (origin && !validateOrigin(origin, config)) {
            return new Response(JSON.stringify({
                success: false,
                error: {
                    code: 'INVALID_ORIGIN',
                    message: '请求来源不被允许'
                }
            }), {
                status: 403,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        // 执行下一个中间件或路由处理器
        let response = await next();

        // 设置安全头
        response = setSecurityHeaders(response, config);

        // 设置CORS头
        if (origin) {
            const corsHeaders = getCORSHeaders(origin, config);
            const headers = new Headers(response.headers);

            Object.entries(corsHeaders).forEach(([key, value]) => {
                headers.set(key, value);
            });

            response = new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers
            });
        }

        return response;
    };
}

/**
 * API路由安全包装器
 */
export function withSecurity(handler: APIRoute): APIRoute {
    const securityMiddleware = createSecurityMiddleware();

    return async (context) => {
        const { request } = context;

        return await securityMiddleware(request, async () => {
            return await handler(context);
        });
    };
}

/**
 * 请求验证中间件
 */
export function validateRequest(request: Request): { valid: boolean; error?: string } {
    const contentType = request.headers.get('content-type');
    const contentLength = request.headers.get('content-length');

    // 检查内容长度
    if (contentLength) {
        const length = parseInt(contentLength);
        const maxSize = parseInt(process.env.MAX_FILE_SIZE || '10485760');

        if (length > maxSize) {
            return {
                valid: false,
                error: `请求体大小超过限制 (${Math.round(maxSize / 1024 / 1024)}MB)`
            };
        }
    }

    // 检查内容类型（对于文件上传）
    if (request.method === 'POST' && contentType?.includes('multipart/form-data')) {
        // 多部分表单数据验证将在具体的处理函数中进行
        return { valid: true };
    }

    // 检查JSON请求
    if (request.method === 'POST' && contentType?.includes('application/json')) {
        return { valid: true };
    }

    // GET请求总是有效的
    if (request.method === 'GET') {
        return { valid: true };
    }

    return { valid: true };
}

/**
 * IP地址获取工具
 */
export function getClientIP(request: Request): string {
    // 检查代理头
    const xForwardedFor = request.headers.get('x-forwarded-for');
    if (xForwardedFor) {
        return xForwardedFor.split(',')[0].trim();
    }

    const xRealIP = request.headers.get('x-real-ip');
    if (xRealIP) {
        return xRealIP;
    }

    // 从URL中提取（在某些环境中可能可用）
    const url = new URL(request.url);
    return url.hostname;
}

/**
 * 用户代理验证
 */
export function validateUserAgent(request: Request): boolean {
    const userAgent = request.headers.get('user-agent');

    if (!userAgent) {
        return false;
    }

    // 检查是否为已知的恶意用户代理
    const maliciousPatterns = [
        /bot/i,
        /crawler/i,
        /spider/i,
        /scraper/i
    ];

    // 在生产环境中可能需要更严格的验证
    if (process.env.NODE_ENV === 'production') {
        return !maliciousPatterns.some(pattern => pattern.test(userAgent));
    }

    return true;
}

/**
 * 请求签名验证（可选）
 */
export function validateRequestSignature(request: Request, secret: string): boolean {
    const signature = request.headers.get('x-signature');

    if (!signature) {
        return false;
    }

    // 这里可以实现HMAC签名验证
    // 具体实现取决于你的签名算法
    return true;
}