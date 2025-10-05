import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { PromptManager } from '../prompt-manager';
import { CreatePromptRequest, PromptItem, PromptCategory } from '../../types/ai-editor';

// Mock fs模块
vi.mock('fs/promises');
const mockFs = vi.mocked(fs);

describe('PromptManager', () => {
    let promptManager: PromptManager;
    let mockData: any;

    beforeEach(() => {
        // 重置单例实例
        (PromptManager as any).instance = null;
        promptManager = PromptManager.getInstance();

        // 模拟数据
        mockData = {
            categories: [
                {
                    id: 'portrait',
                    name: '人物肖像',
                    description: '人物肖像相关的提示词',
                    icon: '👤'
                },
                {
                    id: 'landscape',
                    name: '风景自然',
                    description: '风景和自然场景的提示词',
                    icon: '🌄'
                }
            ],
            prompts: [
                {
                    id: 'prompt_001',
                    title: '专业肖像摄影',
                    content: 'professional portrait photography, studio lighting',
                    category: 'portrait',
                    tags: ['专业', '肖像', '摄影'],
                    description: '适合生成专业级别的人物肖像照片',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z',
                    usageCount: 5,
                    rating: 5
                },
                {
                    id: 'prompt_002',
                    title: '梦幻风景',
                    content: 'dreamy landscape, soft pastel colors',
                    category: 'landscape',
                    tags: ['梦幻', '风景', '柔和'],
                    description: '创造梦幻般的自然风景画面',
                    createdAt: '2024-01-02T00:00:00.000Z',
                    updatedAt: '2024-01-02T00:00:00.000Z',
                    usageCount: 3,
                    rating: 4
                }
            ]
        };

        // 设置fs.readFile的默认返回值
        mockFs.readFile.mockResolvedValue(JSON.stringify(mockData));
        mockFs.writeFile.mockResolvedValue(undefined);
        mockFs.mkdir.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('单例模式', () => {
        it('应该返回同一个实例', () => {
            const instance1 = PromptManager.getInstance();
            const instance2 = PromptManager.getInstance();
            expect(instance1).toBe(instance2);
        });
    });

    describe('数据加载', () => {
        it('应该正确加载提示词数据', async () => {
            const prompts = await promptManager.getAllPrompts();
            expect(prompts).toHaveLength(2);
            expect(prompts[0].title).toBe('专业肖像摄影');
            expect(prompts[0].createdAt).toBeInstanceOf(Date);
        });

        it('应该正确加载分类数据', async () => {
            const categories = await promptManager.getCategories();
            expect(categories).toHaveLength(2);
            expect(categories[0].name).toBe('人物肖像');
        });

        it('当文件不存在时应该返回空数据', async () => {
            mockFs.readFile.mockRejectedValue(new Error('文件不存在'));

            const prompts = await promptManager.getAllPrompts();
            const categories = await promptManager.getCategories();

            expect(prompts).toHaveLength(0);
            expect(categories).toHaveLength(0);
        });
    });

    describe('提示词查询', () => {
        it('应该根据ID获取提示词', async () => {
            const prompt = await promptManager.getPromptById('prompt_001');
            expect(prompt).not.toBeNull();
            expect(prompt?.title).toBe('专业肖像摄影');
        });

        it('当ID不存在时应该返回null', async () => {
            const prompt = await promptManager.getPromptById('nonexistent');
            expect(prompt).toBeNull();
        });

        it('应该根据分类获取提示词', async () => {
            const prompts = await promptManager.getPromptsByCategory('portrait');
            expect(prompts).toHaveLength(1);
            expect(prompts[0].title).toBe('专业肖像摄影');
        });
    });

    describe('提示词搜索', () => {
        it('应该根据标题搜索提示词', async () => {
            const result = await promptManager.searchPrompts('专业');
            expect(result.prompts).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(result.prompts[0].title).toBe('专业肖像摄影');
        });

        it('应该根据内容搜索提示词', async () => {
            const result = await promptManager.searchPrompts('landscape');
            expect(result.prompts).toHaveLength(1);
            expect(result.prompts[0].title).toBe('梦幻风景');
        });

        it('应该根据标签搜索提示词', async () => {
            const result = await promptManager.searchPrompts('摄影');
            expect(result.prompts).toHaveLength(1);
            expect(result.prompts[0].title).toBe('专业肖像摄影');
        });

        it('应该支持分类筛选', async () => {
            const result = await promptManager.searchPrompts('', { category: 'landscape' });
            expect(result.prompts).toHaveLength(1);
            expect(result.prompts[0].category).toBe('landscape');
        });

        it('应该支持标签筛选', async () => {
            const result = await promptManager.searchPrompts('', { tags: ['专业'] });
            expect(result.prompts).toHaveLength(1);
            expect(result.prompts[0].tags).toContain('专业');
        });

        it('应该支持按使用次数排序', async () => {
            const result = await promptManager.searchPrompts('', {
                sortBy: 'usageCount',
                sortOrder: 'desc'
            });
            expect(result.prompts[0].usageCount).toBe(5);
            expect(result.prompts[1].usageCount).toBe(3);
        });

        it('应该支持分页', async () => {
            const result = await promptManager.searchPrompts('', {
                limit: 1,
                offset: 0
            });
            expect(result.prompts).toHaveLength(1);
            expect(result.total).toBe(2);
        });
    });

    describe('提示词创建', () => {
        it('应该创建新提示词', async () => {
            const request: CreatePromptRequest = {
                title: '新提示词',
                content: '新的提示词内容',
                category: 'portrait',
                tags: ['新', '测试'],
                description: '测试描述'
            };

            const newPrompt = await promptManager.createPrompt(request);

            expect(newPrompt.title).toBe('新提示词');
            expect(newPrompt.content).toBe('新的提示词内容');
            expect(newPrompt.id).toMatch(/^prompt_\d+_/);
            expect(newPrompt.usageCount).toBe(0);
            expect(newPrompt.createdAt).toBeInstanceOf(Date);
            expect(mockFs.writeFile).toHaveBeenCalled();
        });

        it('应该清理标签中的空白字符', async () => {
            const request: CreatePromptRequest = {
                title: '测试',
                content: '测试内容',
                category: 'portrait',
                tags: [' 标签1 ', '', '  标签2  ', '   ']
            };

            const newPrompt = await promptManager.createPrompt(request);
            expect(newPrompt.tags).toEqual(['标签1', '标签2']);
        });
    });

    describe('提示词更新', () => {
        it('应该更新现有提示词', async () => {
            const updates = {
                title: '更新的标题',
                content: '更新的内容'
            };

            const updatedPrompt = await promptManager.updatePrompt('prompt_001', updates);

            expect(updatedPrompt).not.toBeNull();
            expect(updatedPrompt?.title).toBe('更新的标题');
            expect(updatedPrompt?.content).toBe('更新的内容');
            expect(updatedPrompt?.id).toBe('prompt_001'); // ID不应该改变
            expect(mockFs.writeFile).toHaveBeenCalled();
        });

        it('当提示词不存在时应该返回null', async () => {
            const result = await promptManager.updatePrompt('nonexistent', { title: '新标题' });
            expect(result).toBeNull();
        });
    });

    describe('提示词删除', () => {
        it('应该删除现有提示词', async () => {
            const result = await promptManager.deletePrompt('prompt_001');
            expect(result).toBe(true);
            expect(mockFs.writeFile).toHaveBeenCalled();
        });

        it('当提示词不存在时应该返回false', async () => {
            const result = await promptManager.deletePrompt('nonexistent');
            expect(result).toBe(false);
        });
    });

    describe('使用统计', () => {
        it('应该增加使用次数', async () => {
            const result = await promptManager.incrementUsageCount('prompt_001');
            expect(result).toBe(true);
            expect(mockFs.writeFile).toHaveBeenCalled();
        });

        it('当提示词不存在时应该返回false', async () => {
            const result = await promptManager.incrementUsageCount('nonexistent');
            expect(result).toBe(false);
        });
    });

    describe('评分管理', () => {
        it('应该设置提示词评分', async () => {
            const result = await promptManager.setPromptRating('prompt_001', 4);
            expect(result).toBe(true);
            expect(mockFs.writeFile).toHaveBeenCalled();
        });

        it('应该拒绝无效评分', async () => {
            await expect(promptManager.setPromptRating('prompt_001', 6))
                .rejects.toThrow('评分必须在1-5之间');

            await expect(promptManager.setPromptRating('prompt_001', 0))
                .rejects.toThrow('评分必须在1-5之间');
        });
    });

    describe('分类管理', () => {
        it('应该创建新分类', async () => {
            const categoryData = {
                name: '新分类',
                description: '新分类描述',
                icon: '🎯'
            };

            const newCategory = await promptManager.createCategory(categoryData);

            expect(newCategory.name).toBe('新分类');
            expect(newCategory.id).toMatch(/^category_\d+_/);
            expect(mockFs.writeFile).toHaveBeenCalled();
        });

        it('应该更新现有分类', async () => {
            const updates = { name: '更新的分类名' };
            const result = await promptManager.updateCategory('portrait', updates);

            expect(result).not.toBeNull();
            expect(result?.name).toBe('更新的分类名');
        });

        it('应该删除空分类', async () => {
            // 先删除所有使用该分类的提示词
            mockData.prompts = mockData.prompts.filter((p: any) => p.category !== 'landscape');
            mockFs.readFile.mockResolvedValue(JSON.stringify(mockData));

            const result = await promptManager.deleteCategory('landscape');
            expect(result).toBe(true);
        });

        it('应该拒绝删除包含提示词的分类', async () => {
            await expect(promptManager.deleteCategory('portrait'))
                .rejects.toThrow('无法删除包含提示词的分类');
        });
    });

    describe('统计信息', () => {
        it('应该返回正确的统计信息', async () => {
            const stats = await promptManager.getStatistics();

            expect(stats.totalPrompts).toBe(2);
            expect(stats.totalCategories).toBe(2);
            expect(stats.mostUsedPrompts).toHaveLength(2);
            expect(stats.topRatedPrompts).toHaveLength(2);
            expect(stats.categoryStats).toHaveLength(2);

            // 验证最常用的提示词排序
            expect(stats.mostUsedPrompts[0].usageCount).toBe(5);
            expect(stats.mostUsedPrompts[1].usageCount).toBe(3);

            // 验证评分最高的提示词排序
            expect(stats.topRatedPrompts[0].rating).toBe(5);
            expect(stats.topRatedPrompts[1].rating).toBe(4);
        });
    });
});