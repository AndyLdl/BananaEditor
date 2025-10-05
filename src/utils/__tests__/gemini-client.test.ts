// Gemini API客户端单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 模拟fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// 模拟getConfig函数
vi.mock('../gemini-client', async () => {
    const actual = await vi.importActual('../gemini-client') as any;
    return {
        ...actual,
        getConfig: vi.fn(() => ({
            GEMINI_API_KEY: 'AIzaTest123456789',
            GEMINI_API_ENDPOINT: 'https://generativelanguage.googleapis.com',
            MAX_FILE_SIZE: 10485760,
            RATE_LIMIT_WINDOW: 60000,
            RATE_LIMIT_MAX_REQUESTS: 10,
        }))
    };
});

import { GeminiClient, GeminiAPIError } from '../gemini-client';

describe('GeminiClient', () => {
    let client: GeminiClient;

    beforeEach(() => {
        vi.clearAllMocks();
        client = new GeminiClient({
            config: {
                GEMINI_API_KEY: 'AIzaTest123456789',
                GEMINI_API_ENDPOINT: 'https://generativelanguage.googleapis.com',
                MAX_FILE_SIZE: 10485760,
                RATE_LIMIT_WINDOW: 60000,
                RATE_LIMIT_MAX_REQUESTS: 10,
            }
        });
    });

    describe('构造函数', () => {
        it('应该正确初始化客户端', () => {
            expect(client).toBeInstanceOf(GeminiClient);
        });
    });

    describe('generateRequestId', () => {
        it('应该生成唯一的请求ID', () => {
            const id1 = client.generateRequestId();
            const id2 = client.generateRequestId();

            expect(id1).toMatch(/^req_\d+_[a-z0-9]+$/);
            expect(id2).toMatch(/^req_\d+_[a-z0-9]+$/);
            expect(id1).not.toBe(id2);
        });
    });

    describe('callAPI', () => {
        it('应该成功调用API并返回响应', async () => {
            const mockResponse = { success: true, data: 'test' };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
                headers: new Map([['content-type', 'application/json']]),
            });

            const result = await client.callAPI('/test', { test: 'data' });

            expect(result).toEqual(mockResponse);
            expect(mockFetch).toHaveBeenCalledWith(
                'https://generativelanguage.googleapis.com/test',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                        'x-goog-api-key': 'AIzaTest123456789',
                    }),
                    body: JSON.stringify({ test: 'data' }),
                })
            );
        });

        it('应该处理API错误响应', async () => {
            const errorResponse = { error: { message: 'API错误' } };
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                json: async () => errorResponse,
                headers: new Map([['content-type', 'application/json']]),
            });

            await expect(client.callAPI('/test', { test: 'data' }))
                .rejects.toThrow(GeminiAPIError);
        });

        it('应该支持GET请求', async () => {
            const mockResponse = { data: 'test' };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
                headers: new Map([['content-type', 'application/json']]),
            });

            const result = await client.callAPI('/test', null, { method: 'GET' });

            expect(result).toEqual(mockResponse);
            expect(mockFetch).toHaveBeenCalledWith(
                'https://generativelanguage.googleapis.com/test',
                expect.objectContaining({
                    method: 'GET',
                    headers: expect.objectContaining({
                        'x-goog-api-key': 'AIzaTest123456789',
                    }),
                })
            );
        });
    });

    describe('healthCheck', () => {
        it('应该在API正常时返回true', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ models: [{ name: 'gemini-pro' }] }),
                headers: new Map([['content-type', 'application/json']]),
            });

            const result = await client.healthCheck();
            expect(result).toBe(true);
        });

        it('应该在API异常时返回false', async () => {
            mockFetch.mockRejectedValueOnce(new Error('连接失败'));

            const result = await client.healthCheck();
            expect(result).toBe(false);
        });
    });
});

describe('GeminiAPIError', () => {
    it('应该正确创建错误实例', () => {
        const error = new GeminiAPIError('测试错误', 'TEST_ERROR', 400, { detail: 'test' });

        expect(error.message).toBe('测试错误');
        expect(error.code).toBe('TEST_ERROR');
        expect(error.statusCode).toBe(400);
        expect(error.details).toEqual({ detail: 'test' });
        expect(error.name).toBe('GeminiAPIError');
    });
});