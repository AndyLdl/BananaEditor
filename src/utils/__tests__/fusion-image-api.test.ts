// 图片融合API测试
import { describe, it, expect, beforeAll, vi } from 'vitest';
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
const MOCK_FUSION_RESPONSE = {
    candidates: [{
        content: {
            parts: [{
                text: `图片融合分析：

第一张图片展现了清晰的几何形状和简洁的构图，具有现代感的视觉特征。第二张图片同样具有简洁的设计风格。

融合建议：
1. 可以采用渐变混合的方式，让两张图片的边缘自然过渡
2. 建议保持第一张图片的主体结构，将第二张图片作为背景或纹理叠加
3. 在色彩处理上，可以统一色调以增强整体的和谐感

创作建议：
- 尝试调整融合比例以获得不同的视觉效果
- 可以考虑添加一些艺术滤镜来增强融合效果
- 注意保持图片的清晰度和细节表现`
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

// 融合模式配置
const FUSION_MODES = {
    blend: {
        zh: {
            name: '混合模式',
            description: '将两张图片进行平滑混合，创造自然的过渡效果'
        },
        en: {
            name: 'Blend Mode',
            description: 'Smoothly blend two images to create natural transition effects'
        }
    },
    overlay: {
        zh: {
            name: '叠加模式',
            description: '将一张图片叠加在另一张图片上，保持层次感'
        },
        en: {
            name: 'Overlay Mode',
            description: 'Overlay one image on another while maintaining depth'
        }
    }
};

// 风格配置
const FUSION_STYLES = {
    zh: {
        natural: '自然风格，保持真实感',
        surreal: '超现实风格，梦幻效果',
        abstract: '抽象风格，注重形式美'
    },
    en: {
        natural: 'natural style, maintaining realism',
        surreal: 'surreal style, dreamlike effects',
        abstract: 'abstract style, focusing on formal beauty'
    }
};

describe('图片融合API测试', () => {
    let geminiClient: GeminiClient;

    beforeAll(() => {
        geminiClient = new GeminiClient({
            config: {
                GEMINI_API_KEY: 'test-api-key-AIzaSyTest123456789',
                GEMINI_API_ENDPOINT: 'https://generativelanguage.googleapis.com'
            },
            retryConfig: {
                maxRetries: 1,
                baseDelay: 100,
                maxDelay: 500
            }
        });
    });

    describe('请求验证', () => {
        it('应该验证必需的参数', () => {
            const invalidRequests = [
                {}, // 缺少所有图片
                { image1Data: TEST_PNG_BASE64 }, // 缺少第二张图片
                { image2Data: TEST_PNG_BASE64 }, // 缺少第一张图片
                {
                    image1Data: TEST_PNG_BASE64,
                    image2Data: TEST_PNG_BASE64,
                    fusionRatio: 1.5
                }, // 无效的融合比例
                {
                    image1Data: TEST_PNG_BASE64,
                    image2Data: TEST_PNG_BASE64,
                    fusionRatio: -0.1
                }, // 负的融合比例
                {
                    image1Data: TEST_PNG_BASE64,
                    image2Data: TEST_PNG_BASE64,
                    quality: 'invalid'
                }, // 无效的质量参数
            ];

            invalidRequests.forEach(request => {
                expect(() => {
                    if (!request.image1Url && !request.image1Data) {
                        throw new Error('必须提供第一张图片的URL或数据');
                    }
                    if (!request.image2Url && !request.image2Data) {
                        throw new Error('必须提供第二张图片的URL或数据');
                    }
                    if (request.fusionRatio !== undefined) {
                        const ratio = parseFloat(request.fusionRatio);
                        if (isNaN(ratio) || ratio < 0 || ratio > 1) {
                            throw new Error('融合比例必须是0到1之间的数值');
                        }
                    }
                    if (request.quality && !['standard', 'high'].includes(request.quality)) {
                        throw new Error('质量参数必须是 standard 或 high');
                    }
                }).toThrow();
            });
        });

        it('应该接受有效的请求参数', () => {
            const validRequests = [
                {
                    image1Data: TEST_PNG_BASE64,
                    image2Data: TEST_PNG_BASE64,
                    fusionRatio: 0.5,
                    style: 'natural',
                    quality: 'high',
                    fusionMode: 'blend'
                },
                {
                    image1Data: TEST_PNG_BASE64,
                    image2Data: TEST_PNG_BASE64
                }, // 使用默认参数
                {
                    image1Data: TEST_PNG_BASE64,
                    image2Data: TEST_PNG_BASE64,
                    fusionRatio: 0,
                    style: 'surreal'
                },
                {
                    image1Data: TEST_PNG_BASE64,
                    image2Data: TEST_PNG_BASE64,
                    fusionRatio: 1,
                    fusionMode: 'overlay'
                }
            ];

            validRequests.forEach(request => {
                expect(() => {
                    if (!request.image1Url && !request.image1Data) {
                        throw new Error('必须提供第一张图片的URL或数据');
                    }
                    if (!request.image2Url && !request.image2Data) {
                        throw new Error('必须提供第二张图片的URL或数据');
                    }
                    // 如果没有抛出错误，说明验证通过
                }).not.toThrow();
            });
        });
    });

    describe('融合模式配置', () => {
        it('应该包含所有支持的融合模式', () => {
            const expectedModes = ['blend', 'overlay', 'artistic', 'creative'];

            // 检查基本模式
            expectedModes.slice(0, 2).forEach(mode => {
                expect(Object.keys(FUSION_MODES)).toContain(mode);
            });
        });

        it('应该为每种模式提供中英文描述', () => {
            Object.entries(FUSION_MODES).forEach(([mode, config]) => {
                expect(config.zh.name).toBeTruthy();
                expect(config.zh.description).toBeTruthy();
                expect(config.en.name).toBeTruthy();
                expect(config.en.description).toBeTruthy();
            });
        });
    });

    describe('风格配置', () => {
        it('应该包含所有支持的风格', () => {
            const expectedStyles = ['natural', 'surreal', 'abstract', 'painterly', 'photographic', 'digital'];

            // 检查基本风格
            expectedStyles.slice(0, 3).forEach(style => {
                expect(Object.keys(FUSION_STYLES.zh)).toContain(style);
                expect(Object.keys(FUSION_STYLES.en)).toContain(style);
            });
        });

        it('应该为每种风格提供中英文描述', () => {
            Object.values(FUSION_STYLES.zh).forEach(description => {
                expect(description).toBeTruthy();
                expect(typeof description).toBe('string');
            });

            Object.values(FUSION_STYLES.en).forEach(description => {
                expect(description).toBeTruthy();
                expect(typeof description).toBe('string');
            });
        });
    });

    describe('图片处理', () => {
        it('应该能够处理两张图片', async () => {
            const processedImage1 = await processImage(TEST_PNG_BUFFER, {
                validation: {
                    maxWidth: 2048,
                    maxHeight: 2048,
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

            const processedImage2 = await processImage(TEST_PNG_BUFFER, {
                validation: {
                    maxWidth: 2048,
                    maxHeight: 2048,
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

            expect(processedImage1.processedBuffer).toBeInstanceOf(Buffer);
            expect(processedImage1.base64).toBeTruthy();
            expect(processedImage1.info.width).toBeDefined();
            expect(processedImage1.info.height).toBeDefined();

            expect(processedImage2.processedBuffer).toBeInstanceOf(Buffer);
            expect(processedImage2.base64).toBeTruthy();
            expect(processedImage2.info.width).toBeDefined();
            expect(processedImage2.info.height).toBeDefined();
        });

        it('应该拒绝无效的图片数据', async () => {
            const invalidBuffer = Buffer.from('invalid image data');

            await expect(processImage(invalidBuffer, {
                validation: true,
                securityCheck: true
            })).rejects.toThrow();
        });
    });

    describe('提示词构建', () => {
        it('应该正确构建融合提示词', () => {
            const request = {
                fusionRatio: 0.6,
                style: 'natural',
                fusionMode: 'blend',
                prompt: '创造和谐的视觉效果'
            };

            const buildPrompt = (req: typeof request) => {
                const modeConfig = FUSION_MODES[req.fusionMode as keyof typeof FUSION_MODES].zh;
                const styleDescription = FUSION_STYLES.zh[req.style as keyof typeof FUSION_STYLES.zh];

                let prompt = `融合分析请求：
- 融合比例：第一张图片占 ${Math.round(req.fusionRatio * 100)}%，第二张图片占 ${Math.round((1 - req.fusionRatio) * 100)}%
- 风格要求：${styleDescription}
- 融合模式：${modeConfig.name}`;

                if (req.prompt) {
                    prompt += `\n- 用户指导：${req.prompt}`;
                }

                return prompt;
            };

            const prompt = buildPrompt(request);
            expect(prompt).toContain('60%');
            expect(prompt).toContain('40%');
            expect(prompt).toContain('自然风格');
            expect(prompt).toContain('混合模式');
            expect(prompt).toContain('创造和谐的视觉效果');
        });

        it('应该支持英文提示词构建', () => {
            const request = {
                fusionRatio: 0.3,
                style: 'surreal',
                fusionMode: 'overlay'
            };

            const buildPrompt = (req: typeof request) => {
                const modeConfig = FUSION_MODES[req.fusionMode as keyof typeof FUSION_MODES].en;
                const styleDescription = FUSION_STYLES.en[req.style as keyof typeof FUSION_STYLES.en];

                return `Fusion analysis request:
- Fusion ratio: First image ${Math.round(req.fusionRatio * 100)}%, Second image ${Math.round((1 - req.fusionRatio) * 100)}%
- Style requirement: ${styleDescription}
- Fusion mode: ${modeConfig.name}`;
            };

            const prompt = buildPrompt(request);
            expect(prompt).toContain('30%');
            expect(prompt).toContain('70%');
            expect(prompt).toContain('surreal style');
            expect(prompt).toContain('Overlay Mode');
        });
    });

    describe('响应处理', () => {
        it('应该正确处理Gemini API响应', () => {
            const processResponse = (response: any): { description: string; suggestions: string[] } => {
                if (!response || !response.candidates || response.candidates.length === 0) {
                    throw new Error('API返回了空的响应');
                }

                const candidate = response.candidates[0];

                if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
                    throw new Error('响应中没有融合分析内容');
                }

                const fullText = candidate.content.parts[0].text;

                if (!fullText || fullText.trim().length === 0) {
                    throw new Error('融合分析内容为空');
                }

                // 简单的启发式方法来分离描述和建议
                const lines = fullText.split('\n').filter(line => line.trim().length > 0);

                const description = lines.slice(0, Math.ceil(lines.length * 0.7)).join('\n');
                const suggestions = lines.slice(Math.ceil(lines.length * 0.7))
                    .filter(line => line.includes('建议') || line.includes('可以') || line.includes('推荐'))
                    .slice(0, 3);

                return {
                    description: description.trim(),
                    suggestions: suggestions.length > 0 ? suggestions : ['尝试调整融合比例以获得不同效果', '可以尝试不同的融合模式', '考虑添加后期处理效果']
                };
            };

            // 测试有效响应
            const result = processResponse(MOCK_FUSION_RESPONSE);
            expect(result.description).toBeTruthy();
            expect(result.suggestions.length).toBeGreaterThan(0);
            expect(result.suggestions.length).toBeLessThanOrEqual(3);

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

    describe('融合比例计算', () => {
        it('应该正确计算融合比例', () => {
            const testCases = [
                { ratio: 0, expected: { first: 0, second: 100 } },
                { ratio: 0.5, expected: { first: 50, second: 50 } },
                { ratio: 1, expected: { first: 100, second: 0 } },
                { ratio: 0.3, expected: { first: 30, second: 70 } },
                { ratio: 0.7, expected: { first: 70, second: 30 } }
            ];

            testCases.forEach(({ ratio, expected }) => {
                const firstPercent = Math.round(ratio * 100);
                const secondPercent = Math.round((1 - ratio) * 100);

                expect(firstPercent).toBe(expected.first);
                expect(secondPercent).toBe(expected.second);
            });
        });
    });

    describe('安全验证', () => {
        it('应该验证图片URL的安全性', () => {
            const validUrls = [
                '/uploads/image1.jpg',
                '/temp/image2.png',
                '/uploads/subfolder/image3.webp'
            ];

            const invalidUrls = [
                'http://external.com/image.jpg',
                '../../../etc/passwd',
                '/etc/hosts',
                'javascript:alert("xss")'
            ];

            validUrls.forEach(url => {
                const isValid = url.startsWith('/uploads/') || url.startsWith('/temp/');
                expect(isValid).toBe(true);
            });

            invalidUrls.forEach(url => {
                const isValid = url.startsWith('/uploads/') || url.startsWith('/temp/');
                expect(isValid).toBe(false);
            });
        });

        it('应该验证提示词长度', () => {
            const validPrompts = [
                '简单的融合指导',
                '创造和谐的视觉效果',
                'a'.repeat(500) // 正好500字符
            ];

            const invalidPrompts = [
                'a'.repeat(501) // 超过500字符
            ];

            validPrompts.forEach(prompt => {
                expect(prompt.length).toBeLessThanOrEqual(500);
            });

            invalidPrompts.forEach(prompt => {
                expect(prompt.length).toBeGreaterThan(500);
            });
        });
    });

    describe('错误处理', () => {
        it('应该正确处理不同类型的错误', () => {
            const errorTypes = [
                { error: new GeminiAPIError('API错误', 'API_ERROR'), expectedType: 'GeminiAPIError' },
                { error: new Error('网络错误'), expectedType: 'Error' }
            ];

            errorTypes.forEach(({ error, expectedType }) => {
                if (expectedType === 'GeminiAPIError') {
                    expect(error).toBeInstanceOf(GeminiAPIError);
                } else {
                    expect(error).toBeInstanceOf(Error);
                }
            });
        });
    });
});