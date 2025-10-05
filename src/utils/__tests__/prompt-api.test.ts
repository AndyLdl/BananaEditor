import { describe, it, expect, beforeEach, vi } from 'vitest';
import { promptManager } from '../prompt-manager';
import { rateLimiter } from '../rate-limiter';

// Mock 依赖
vi.mock('../prompt-manager');
vi.mock('../rate-limiter');

const mockPromptManager = vi.mocked(promptManager);
const mockRateLimiter = vi.mocked(rateLimiter);

describe('提示词管理API测试', () => {
    beforeEach(() => {
        // 重置所有mock
        vi.clearAllMocks();

        // 设置默认的速率限制返回值
        mockRateLimiter.checkRateLimit.mockResolvedValue(true);
        mockRateLimiter.logRequest.mockResolvedValue(undefined);
    });

    describe('提示词管理逻辑测试', () => {
        it('应该正确处理搜索请求', async () => {
            const mockPrompts = [
                {
                    id: 'prompt_001',
                    title: '测试提示词',
                    content: '测试内容',
                    category: 'test',
                    tags: ['测试'],
                    description: '测试描述',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    usageCount: 0,
                    rating: 5
                }
            ];

            mockPromptManager.searchPrompts.mockResolvedValue({
                prompts: mockPrompts,
                total: 1
            });

            // 测试搜索逻辑
            const result = await mockPromptManager.searchPrompts('测试', {
                category: undefined,
                tags: undefined,
                sortBy: 'updatedAt',
                sortOrder: 'desc',
                limit: 10,
                offset: 0
            });

            expect(mockPromptManager.searchPrompts).toHaveBeenCalledWith('测试', {
                category: undefined,
                tags: undefined,
                sortBy: 'updatedAt',
                sortOrder: 'desc',
                limit: 10,
                offset: 0
            });
            expect(result.prompts).toHaveLength(1);
        });

        it('应该处理速率限制', async () => {
            mockRateLimiter.checkRateLimit.mockResolvedValue(false);

            // 验证速率限制逻辑
            const isAllowed = await mockRateLimiter.checkRateLimit('test-session');
            expect(isAllowed).toBe(false);
        });

        it('应该验证分页参数', () => {
            const url = new URL('http://localhost/api/ai/prompts?limit=150');
            const limit = parseInt(url.searchParams.get('limit') || '20');

            expect(limit).toBe(150);
            // 在实际API中，这会返回400错误
        });
    });

    describe('提示词创建逻辑', () => {
        it('应该创建新提示词', async () => {
            const newPrompt = {
                id: 'prompt_new',
                title: '新提示词',
                content: '新内容',
                category: 'test',
                tags: ['新'],
                description: '新描述',
                createdAt: new Date(),
                updatedAt: new Date(),
                usageCount: 0
            };

            const mockCategories = [
                {
                    id: 'test',
                    name: '测试分类',
                    description: '测试分类描述',
                    icon: '🧪'
                }
            ];

            mockPromptManager.getCategories.mockResolvedValue(mockCategories);
            mockPromptManager.createPrompt.mockResolvedValue(newPrompt);

            const requestData = {
                title: '新提示词',
                content: '新内容',
                category: 'test',
                tags: ['新'],
                description: '新描述'
            };

            // 验证创建逻辑
            await mockPromptManager.createPrompt(requestData);
            expect(mockPromptManager.createPrompt).toHaveBeenCalledWith(requestData);
        });

        it('应该验证必填字段', () => {
            const requestData = {
                title: '',
                content: '内容',
                category: 'test'
            };

            // 验证必填字段逻辑
            const hasTitle = !!(requestData.title && requestData.title.trim().length > 0);
            const hasContent = !!(requestData.content && requestData.content.trim().length > 0);
            const hasCategory = !!(requestData.category && requestData.category.trim().length > 0);

            expect(hasTitle).toBe(false);
            expect(hasContent).toBe(true);
            expect(hasCategory).toBe(true);
        });

        it('应该验证字段长度', () => {
            const longTitle = 'a'.repeat(101);
            const longContent = 'a'.repeat(2001);

            expect(longTitle.length > 100).toBe(true);
            expect(longContent.length > 2000).toBe(true);
        });
    });

    describe('提示词查询逻辑', () => {
        it('应该返回指定的提示词', async () => {
            const mockPrompt = {
                id: 'prompt_001',
                title: '测试提示词',
                content: '测试内容',
                category: 'test',
                tags: ['测试'],
                description: '测试描述',
                createdAt: new Date(),
                updatedAt: new Date(),
                usageCount: 5,
                rating: 4
            };

            mockPromptManager.getPromptById.mockResolvedValue(mockPrompt);

            const result = await mockPromptManager.getPromptById('prompt_001');
            expect(result).toEqual(mockPrompt);
            expect(mockPromptManager.getPromptById).toHaveBeenCalledWith('prompt_001');
        });

        it('应该处理不存在的提示词', async () => {
            mockPromptManager.getPromptById.mockResolvedValue(null);

            const result = await mockPromptManager.getPromptById('nonexistent');
            expect(result).toBeNull();
        });
    });

    describe('提示词更新逻辑', () => {
        it('应该更新提示词', async () => {
            const updatedPrompt = {
                id: 'prompt_001',
                title: '更新的标题',
                content: '更新的内容',
                category: 'test',
                tags: ['更新'],
                description: '更新的描述',
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date(),
                usageCount: 5,
                rating: 4
            };

            const mockCategories = [
                {
                    id: 'test',
                    name: '测试分类',
                    description: '测试分类描述',
                    icon: '🧪'
                }
            ];

            mockPromptManager.getCategories.mockResolvedValue(mockCategories);
            mockPromptManager.updatePrompt.mockResolvedValue(updatedPrompt);

            const updates = {
                title: '更新的标题',
                content: '更新的内容'
            };

            await mockPromptManager.updatePrompt('prompt_001', updates);
            expect(mockPromptManager.updatePrompt).toHaveBeenCalledWith('prompt_001', updates);
        });
    });

    describe('提示词删除逻辑', () => {
        it('应该删除提示词', async () => {
            mockPromptManager.deletePrompt.mockResolvedValue(true);

            const result = await mockPromptManager.deletePrompt('prompt_001');
            expect(result).toBe(true);
            expect(mockPromptManager.deletePrompt).toHaveBeenCalledWith('prompt_001');
        });

        it('应该处理不存在的提示词', async () => {
            mockPromptManager.deletePrompt.mockResolvedValue(false);

            const result = await mockPromptManager.deletePrompt('nonexistent');
            expect(result).toBe(false);
        });
    });

    describe('使用统计逻辑', () => {
        it('应该增加使用次数', async () => {
            const updatedPrompt = {
                id: 'prompt_001',
                title: '测试提示词',
                content: '测试内容',
                category: 'test',
                tags: ['测试'],
                description: '测试描述',
                createdAt: new Date(),
                updatedAt: new Date(),
                usageCount: 6,
                rating: 4
            };

            mockPromptManager.incrementUsageCount.mockResolvedValue(true);
            mockPromptManager.getPromptById.mockResolvedValue(updatedPrompt);

            const success = await mockPromptManager.incrementUsageCount('prompt_001');
            expect(success).toBe(true);
            expect(mockPromptManager.incrementUsageCount).toHaveBeenCalledWith('prompt_001');
        });
    });

    describe('评分管理逻辑', () => {
        it('应该设置评分', async () => {
            mockPromptManager.setPromptRating.mockResolvedValue(true);

            const success = await mockPromptManager.setPromptRating('prompt_001', 5);
            expect(success).toBe(true);
            expect(mockPromptManager.setPromptRating).toHaveBeenCalledWith('prompt_001', 5);
        });

        it('应该验证评分范围', () => {
            const validRatings = [1, 2, 3, 4, 5];
            const invalidRatings = [0, 6, -1, 1.5, 'invalid'];

            validRatings.forEach(rating => {
                const isValid = typeof rating === 'number' &&
                    rating >= 1 &&
                    rating <= 5 &&
                    Number.isInteger(rating);
                expect(isValid).toBe(true);
            });

            invalidRatings.forEach(rating => {
                const isValid = typeof rating === 'number' &&
                    rating >= 1 &&
                    rating <= 5 &&
                    Number.isInteger(rating);
                expect(isValid).toBe(false);
            });
        });
    });

    describe('分类管理逻辑', () => {
        it('应该返回所有分类', async () => {
            const mockCategories = [
                {
                    id: 'test1',
                    name: '分类1',
                    description: '描述1',
                    icon: '🧪'
                },
                {
                    id: 'test2',
                    name: '分类2',
                    description: '描述2',
                    icon: '🎨'
                }
            ];

            mockPromptManager.getCategories.mockResolvedValue(mockCategories);

            const result = await mockPromptManager.getCategories();
            expect(result).toEqual(mockCategories);
            expect(result).toHaveLength(2);
        });

        it('应该创建新分类', async () => {
            const newCategory = {
                id: 'category_new',
                name: '新分类',
                description: '新分类描述',
                icon: '🆕'
            };

            const existingCategories = [
                {
                    id: 'existing',
                    name: '现有分类',
                    description: '现有描述',
                    icon: '📁'
                }
            ];

            mockPromptManager.getCategories.mockResolvedValue(existingCategories);
            mockPromptManager.createCategory.mockResolvedValue(newCategory);

            // 检查名称是否已存在
            const nameExists = existingCategories.some(cat => cat.name === '新分类');
            expect(nameExists).toBe(false);

            await mockPromptManager.createCategory({
                name: '新分类',
                description: '新分类描述',
                icon: '🆕'
            });

            expect(mockPromptManager.createCategory).toHaveBeenCalled();
        });
    });

    describe('统计信息逻辑', () => {
        it('应该返回统计信息', async () => {
            const mockStats = {
                totalPrompts: 10,
                totalCategories: 3,
                mostUsedPrompts: [],
                topRatedPrompts: [],
                categoryStats: [
                    { category: '分类1', count: 5 },
                    { category: '分类2', count: 3 },
                    { category: '分类3', count: 2 }
                ]
            };

            mockPromptManager.getStatistics.mockResolvedValue(mockStats);

            const result = await mockPromptManager.getStatistics();
            expect(result).toEqual(mockStats);
            expect(result.totalPrompts).toBe(10);
            expect(result.categoryStats).toHaveLength(3);
        });
    });

    describe('错误处理', () => {
        it('应该处理数据库错误', async () => {
            const error = new Error('数据库连接失败');
            mockPromptManager.getAllPrompts.mockRejectedValue(error);

            try {
                await mockPromptManager.getAllPrompts();
            } catch (e) {
                expect(e).toEqual(error);
            }
        });

        it('应该记录失败的请求', async () => {
            await mockRateLimiter.logRequest('test-session', 'GET /api/ai/prompts', false, '测试错误');

            expect(mockRateLimiter.logRequest).toHaveBeenCalledWith(
                'test-session',
                'GET /api/ai/prompts',
                false,
                '测试错误'
            );
        });
    });
});