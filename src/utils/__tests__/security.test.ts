// 安全工具单元测试
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    sanitizePrompt,
    validateFileType,
    generateSessionId,
    validateFileSize,
    extractClientIP,
    validateOrigin,
    validateInput,
    CSRFProtection,
    SecurityMiddlewareImpl,
    setSecurityHeaders,
    logSecurityEvent,
    SecurityError
} from '../security';

// 模拟依赖
vi.mock('../image-processor', () => ({
    validateImageContent: vi.fn().mockResolvedValue(true)
}));

vi.mock('../rate-limiter', () => ({
    defaultRateLimiter: {
        checkLimit: vi.fn().mockReturnValue(true)
    }
}));

describe('安全工具', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('sanitizePrompt', () => {
        it('应该清理基本的HTML标签', () => {
            const input = '<script>alert("xss")</script>测试提示词';
            const result = sanitizePrompt(input);
            expect(result).toBe('scriptalert("xss")/script测试提示词');
        });

        it('应该移除危险的协议', () => {
            const input = 'javascript:alert("xss") 测试提示词';
            const result = sanitizePrompt(input);
            expect(result).toBe('alert("xss") 测试提示词');
        });

        it('应该限制长度', () => {
            const input = 'a'.repeat(3000);
            const result = sanitizePrompt(input);
            expect(result.length).toBe(2000);
        });

        it('应该检测敏感词', () => {
            expect(() => sanitizePrompt('这是一个暴力的内容')).toThrow(SecurityError);
            expect(() => sanitizePrompt('This contains violence')).toThrow(SecurityError);
        });

        it('应该处理无效输入', () => {
            expect(() => sanitizePrompt('')).toThrow(SecurityError);
            expect(() => sanitizePrompt(null as any)).toThrow(SecurityError);
            expect(() => sanitizePrompt(undefined as any)).toThrow(SecurityError);
        });
    });

    describe('validateFileType', () => {
        it('应该验证支持的文件类型', () => {
            const jpegFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
            const pngFile = new File([''], 'test.png', { type: 'image/png' });
            const webpFile = new File([''], 'test.webp', { type: 'image/webp' });

            expect(validateFileType(jpegFile)).toBe(true);
            expect(validateFileType(pngFile)).toBe(true);
            expect(validateFileType(webpFile)).toBe(true);
        });

        it('应该拒绝不支持的文件类型', () => {
            const gifFile = new File([''], 'test.gif', { type: 'image/gif' });
            expect(validateFileType(gifFile)).toBe(false);
        });
    });

    describe('generateSessionId', () => {
        it('应该生成唯一的会话ID', () => {
            const id1 = generateSessionId();
            const id2 = generateSessionId();

            expect(id1).toMatch(/^session_\d+_[a-z0-9]+$/);
            expect(id2).toMatch(/^session_\d+_[a-z0-9]+$/);
            expect(id1).not.toBe(id2);
        });
    });

    describe('validateFileSize', () => {
        it('应该验证文件大小', () => {
            const smallFile = new File(['a'.repeat(1000)], 'small.txt');
            const largeFile = new File(['a'.repeat(20000000)], 'large.txt');

            expect(validateFileSize(smallFile)).toBe(true);
            expect(validateFileSize(largeFile)).toBe(false);
        });

        it('应该支持自定义大小限制', () => {
            const file = new File(['a'.repeat(2000)], 'test.txt');

            expect(validateFileSize(file, 1000)).toBe(false);
            expect(validateFileSize(file, 3000)).toBe(true);
        });
    });

    describe('extractClientIP', () => {
        it('应该从X-Forwarded-For头部提取IP', () => {
            const request = new Request('http://example.com', {
                headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' }
            });

            expect(extractClientIP(request)).toBe('192.168.1.1');
        });

        it('应该从X-Real-IP头部提取IP', () => {
            const request = new Request('http://example.com', {
                headers: { 'x-real-ip': '192.168.1.2' }
            });

            expect(extractClientIP(request)).toBe('192.168.1.2');
        });

        it('应该处理没有IP头部的情况', () => {
            const request = new Request('http://example.com');
            expect(extractClientIP(request)).toBe('unknown');
        });
    });

    describe('validateOrigin', () => {
        it('应该允许配置的来源', () => {
            const request = new Request('http://example.com', {
                headers: { 'origin': 'https://allowed.com' }
            });

            const result = validateOrigin(request, ['https://allowed.com']);
            expect(result).toBe(true);
        });

        it('应该拒绝未配置的来源', () => {
            const request = new Request('http://example.com', {
                headers: { 'origin': 'https://malicious.com' }
            });

            const result = validateOrigin(request, ['https://allowed.com']);
            expect(result).toBe(false);
        });

        it('应该允许没有origin的请求', () => {
            const request = new Request('http://example.com');
            const result = validateOrigin(request, ['https://allowed.com']);
            expect(result).toBe(true);
        });
    });

    describe('validateInput', () => {
        it('应该验证必填字段', () => {
            expect(() => validateInput(undefined, { required: true }))
                .toThrow('必填字段不能为空');

            expect(() => validateInput(null, { required: true }))
                .toThrow('必填字段不能为空');

            expect(validateInput('test', { required: true })).toBe(true);
        });

        it('应该验证字段类型', () => {
            expect(() => validateInput('string', { type: 'number' }))
                .toThrow('字段类型错误');

            expect(validateInput(123, { type: 'number' })).toBe(true);
        });

        it('应该验证字符串长度', () => {
            expect(() => validateInput('ab', { type: 'string', minLength: 3 }))
                .toThrow('字符串长度不足');

            expect(() => validateInput('abcdef', { type: 'string', maxLength: 3 }))
                .toThrow('字符串长度超限');

            expect(validateInput('abc', { type: 'string', minLength: 2, maxLength: 5 }))
                .toBe(true);
        });

        it('应该验证字符串格式', () => {
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            expect(() => validateInput('invalid-email', { type: 'string', pattern: emailPattern }))
                .toThrow('字符串格式不符合要求');

            expect(validateInput('test@example.com', { type: 'string', pattern: emailPattern }))
                .toBe(true);
        });
    });

    describe('CSRFProtection', () => {
        afterEach(() => {
            // 清理测试数据
            CSRFProtection.cleanup();
        });

        it('应该生成和验证CSRF令牌', () => {
            const sessionId = 'test-session';
            const token = CSRFProtection.generateToken(sessionId);

            expect(typeof token).toBe('string');
            expect(token).toMatch(/^csrf_\d+_[a-z0-9]+$/);
            expect(CSRFProtection.validateToken(sessionId, token)).toBe(true);
        });

        it('应该拒绝无效的令牌', () => {
            const sessionId = 'test-session';
            CSRFProtection.generateToken(sessionId);

            expect(CSRFProtection.validateToken(sessionId, 'invalid-token')).toBe(false);
            expect(CSRFProtection.validateToken('wrong-session', 'any-token')).toBe(false);
        });
    });

    describe('SecurityMiddlewareImpl', () => {
        let middleware: SecurityMiddlewareImpl;

        beforeEach(() => {
            middleware = new SecurityMiddlewareImpl(['https://allowed.com']);
        });

        it('应该验证请求', () => {
            const request = new Request('http://example.com', {
                headers: {
                    'origin': 'https://allowed.com',
                    'x-session-id': 'test-session'
                }
            });

            const result = middleware.validateRequest(request);
            expect(result.isValid).toBe(true);
            expect(result.sessionId).toBe('test-session');
        });

        it('应该拒绝无效来源的请求', () => {
            const request = new Request('http://example.com', {
                headers: { 'origin': 'https://malicious.com' }
            });

            expect(() => middleware.validateRequest(request))
                .toThrow('请求来源不被允许');
        });

        it('应该验证API请求体', () => {
            const body = {
                prompt: 'test prompt',
                quality: 'high'
            };

            const schema = {
                prompt: { required: true, type: 'string' as const, minLength: 1 },
                quality: { type: 'string' as const }
            };

            expect(middleware.validateAPIRequest(body, schema)).toBe(true);
        });
    });

    describe('setSecurityHeaders', () => {
        it('应该设置安全头部', () => {
            const originalResponse = new Response('test');
            const secureResponse = setSecurityHeaders(originalResponse);

            expect(secureResponse.headers.get('X-Content-Type-Options')).toBe('nosniff');
            expect(secureResponse.headers.get('X-Frame-Options')).toBe('DENY');
            expect(secureResponse.headers.get('X-XSS-Protection')).toBe('1; mode=block');
            expect(secureResponse.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
        });
    });

    describe('logSecurityEvent', () => {
        it('应该记录安全事件', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

            logSecurityEvent({
                type: 'RATE_LIMITED',
                sessionId: 'test-session',
                clientIP: '192.168.1.1',
                details: { reason: 'too many requests' }
            });

            expect(consoleSpy).toHaveBeenCalledWith(
                'Security Event:',
                expect.stringContaining('RATE_LIMITED')
            );

            consoleSpy.mockRestore();
        });
    });

    describe('SecurityError', () => {
        it('应该正确创建安全错误', () => {
            const error = new SecurityError('测试错误', 'TEST_ERROR', { detail: 'test' });

            expect(error.message).toBe('测试错误');
            expect(error.code).toBe('TEST_ERROR');
            expect(error.details).toEqual({ detail: 'test' });
            expect(error.name).toBe('SecurityError');
        });
    });
});