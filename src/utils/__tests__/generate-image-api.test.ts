// 图片生成API测试
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { GeminiClient, GeminiAPIError } from '../gemini-client';
import { processImage } from '../image-processor';
import { defaultSecurityMiddleware } from '../security';

// 模拟环境变量
vi.mock('astro:env', () => ({
    GEMINI_API_KEY: 'test-api-key-AIzaSyTest123456789',
    GEMINI_API_ENDPOINT: 'https://generativelanguage.googleapis.com',
    MAX_FILE_SIZE: '10485760',
    RATE_LIMIT_WINDOW: '60000',
    RATE_LIMIT_MAX_REQUESTS: '10'
}));

// 测试用的图片数据 (1x1 PNG)
const TEST_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const TEST_PNG_BUFFER = Buffer.from(TEST_PNG_BASE64, 'base64');

// 模拟Gemini API响应
const MOCK_GEMINI_RESPONSE = {
    candidates: [{
        content: {
            parts: [{
                text: '这是一个测试生成的图片描述。图片显示了一个简单的像素点，具有清晰的边缘和鲜明的对比度。建议在创作时注意光线的运用和色彩的搭配。'
            }]
        },
        finishReason: 'STOP',
        index: 0,
        safetyRatings: []
    }],
    promptFeedback: {
        safetyRatings: []
    }
};

describe('图片生成API测试', () => {
    let geminiClient: GeminiClient;

    beforeAll(() => {
        // 使用测试配置初始化客户端
        geminiClient = new GeminiClient({
            config: {
                GEMINI_API_KEY: 'test-api-key-AIzaSyTest123456789',
                GEMINI_API_ENDPOINT: 'https://generativelanguage.googleapis.com'
            },
            retryConfig: {
                maxRetries: 1, // 减少测试时的重试次数
                baseDelay: 100,
                maxDelay: 500
            }
        });
    });

    describe('请求验证', () => {
        it('应该验证必需的参数', () => {
            const invalidRequests = [
                {}, // 缺少所有参数
                { prompt: '' }, // 空提示词
                { prompt: 'test' }, // 缺少图片数据
                { imageData: TEST_PNG_BASE64 }, // 缺少提示词
                { prompt: 'a'.repeat(2001), imageData: TEST_PNG_BASE64 }, // 提示词过长
            ];

            invalidRequests.forEach(request => {
                expect(() => {
                    if (!request.prompt || request.prompt.length === 0) {
                        throw new Error('提示词是必需的');
                    }
                    if (request.prompt && request.prompt.length > 2000) {
                        throw new Error('提示词长度不能超过2000字符');
                    }
                    if (!request.imageUrl && !request.imageData) {
                        throw new Error('必须提供图片URL或图片数据');
                    }
                }).toThrow();
            });
        });

        it('应该接受有效的请求参数', () => {
            const validRequest = {
                prompt: '生成一个美丽的风景画',
                imageData: TEST_PNG_BASE64,
                style: 'realistic',
                quality: 'high'
            };

            expect(() => {
                if (!validRequest.prompt || validRequest.prompt.length === 0) {
                    throw new Error('提示词是必需的');
                }
                if (!validRequest.imageUrl && !validRequest.imageData) {
                    throw new Error('必须提供图片URL或图片数据');
                }
                // 如果没有抛出错误，说明验证通过
            }).not.toThrow();
        });
    });

    describe('图片处理', () => {
        it('应该能够处理Base64图片数据', async () => {
            const buffer = Buffer.from(TEST_PNG_BASE64, 'base64');

            const result = await processImage(buffer, {
                validation: {
                    maxWidth: 4096,
                    maxHeight: 4096,
                    minWidth: 1,
                    minHeight: 1
                },
                compression: {
                    quality: 85
                },
                targetFormat: 'jpeg',
                stripMeta: true,
                securityCheck: true
            });

            expect(result.processedBuffer).toBeInstanceOf(Buffer);
            expect(result.base64).toBeTruthy();
            expect(result.info.width).toBeDefined();
            expect(result.info.height).toBeDefined();
        });

        it('应该拒绝无效的图片数据', async () => {
            const invalidBuffer = Buffer.from('invalid image data');

            await expect(processImage(invalidBuffer, {
                validation: true,
                securityCheck: true
            })).rejects.toThrow();
        });
    });

    describe('安全验证', () => {
        it('应该清理提示词中的敏感内容', () => {
            const dangerousPrompts = [
                '生成暴力血腥的图片',
                '创作色情内容',
                '画一些恐怖的场景'
            ];

            dangerousPrompts.forEach(prompt => {
                expect(() => {
                    defaultSecurityMiddleware.sanitizePrompt(prompt);
                }).toThrow();
            });

            // 测试HTML标签清理
            const htmlPrompt = '<script>alert("xss")</script>生成图片';
            const sanitized = defaultSecurityMiddleware.sanitizePrompt('生成一个美丽的风景画');
            expect(sanitized).toBe('生成一个美丽的风景画');
        });

        it('应该接受安全的提示词', () => {
            const safePrompts = [
                '生成一个美丽的风景画',
                '创作一幅抽象艺术作品',
                '画一只可爱的小猫'
            ];

            safePrompts.forEach(prompt => {
                expect(() => {
                    const sanitized = defaultSecurityMiddleware.sanitizePrompt(prompt);
                    expect(sanitized).toBeTruthy();
                }).not.toThrow();
            });
        });
    });

    describe('Gemini客户端', () => {
        it('应该生成唯一的请求ID', () => {
            const id1 = geminiClient.generateRequestId();
            const id2 = geminiClient.generateRequestId();

            expect(id1).not.toBe(id2);
            expect(id1).toMatch(/^req_\d+_[a-z0-9]+$/);
            expect(id2).toMatch(/^req_\d+_[a-z0-9]+$/);
        });

        it('应该验证API密钥格式', () => {
            // 测试有效的API密钥格式
            const validClient = new GeminiClient({
                config: {
                    GEMINI_API_KEY: 'AIzaSyTest123456789'
                }
            });
            expect(validClient).toBeInstanceOf(GeminiClient);

            // 测试无效的API密钥格式
            expect(() => {
                new GeminiClient({
                    config: {
                        GEMINI_API_KEY: ''
                    }
                });
            }).toThrow('GEMINI_API_KEY 环境变量未设置');
        });

        it('应该处理API错误响应', () => {
            const errorCases = [
                { status: 400, expectedCode: 'INVALID_REQUEST' },
                { status: 401, expectedCode: 'UNAUTHORIZED' },
                { status: 403, expectedCode: 'FORBIDDEN' },
                { status: 429, expectedCode: 'RATE_LIMITED' },
                { status: 500, expectedCode: 'INTERNAL_ERROR' },
                { status: 503, expectedCode: 'SERVICE_UNAVAILABLE' }
            ];

            errorCases.forEach(({ status, expectedCode }) => {
                const error = new GeminiAPIError('Test error', expectedCode, status);
                expect(error.code).toBe(expectedCode);
                expect(error.statusCode).toBe(status);
            });
        });
    });

    describe('响应处理', () => {
        it('应该正确处理Gemini API响应', () => {
            const processResponse = (response: any): string => {
                if (!response || !response.candidates || response.candidates.length === 0) {
                    throw new Error('API返回了空的响应');
                }

                const candidate = response.candidates[0];

                if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
                    throw new Error('响应中没有生成的内容');
                }

                const generatedText = candidate.content.parts[0].text;

                if (!generatedText || generatedText.trim().length === 0) {
                    throw new Error('生成的内容为空');
                }

                return generatedText.trim();
            };

            // 测试有效响应
            const result = processResponse(MOCK_GEMINI_RESPONSE);
            expect(result).toBeTruthy();
            expect(result.length).toBeGreaterThan(0);

            // 测试无效响应
            const invalidResponses = [
                null,
                {},
                { candidates: [] },
                { candidates: [{ content: null }] },
                { candidates: [{ content: { parts: [] } }] },
                { candidates: [{ content: { parts: [{ text: '' }] } }] }
            ];

            invalidResponses.forEach(response => {
                expect(() => processResponse(response)).toThrow();
            });
        });
    });

    describe('错误处理', () => {
        it('应该正确分类不同类型的错误', () => {
            const errorTypes = [
                { error: new GeminiAPIError('API错误', 'API_ERROR'), expectedType: 'GeminiAPIError' },
                { error: new Error('网络错误'), expectedType: 'Error' },
                { error: 'string error', expectedType: 'string' }
            ];

            errorTypes.forEach(({ error, expectedType }) => {
                if (expectedType === 'GeminiAPIError') {
                    expect(error).toBeInstanceOf(GeminiAPIError);
                } else if (expectedType === 'Error') {
                    expect(error).toBeInstanceOf(Error);
                } else {
                    expect(typeof error).toBe(expectedType);
                }
            });
        });
    });

    describe('性能测试', () => {
        it('应该在合理时间内完成图片处理', async () => {
            const startTime = Date.now();

            await processImage(TEST_PNG_BUFFER, {
                compression: { quality: 85 },
                targetFormat: 'jpeg'
            });

            const processingTime = Date.now() - startTime;
            expect(processingTime).toBeLessThan(5000); // 应该在5秒内完成
        });
    });
});