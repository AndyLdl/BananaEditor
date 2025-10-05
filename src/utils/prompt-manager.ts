import fs from 'fs/promises';
import path from 'path';
import { PromptItem, PromptCategory, CreatePromptRequest } from '../types/ai-editor';

// 提示词数据文件路径
const PROMPTS_DATA_PATH = path.join(process.cwd(), 'src/data/prompts.json');

// 提示词数据结构接口
interface PromptsData {
    categories: PromptCategory[];
    prompts: PromptItem[];
}

/**
 * 提示词管理器类
 * 负责提示词的CRUD操作和数据持久化
 */
export class PromptManager {
    private static instance: PromptManager;
    private data: PromptsData | null = null;

    private constructor() { }

    /**
     * 获取提示词管理器单例实例
     */
    public static getInstance(): PromptManager {
        if (!PromptManager.instance) {
            PromptManager.instance = new PromptManager();
        }
        return PromptManager.instance;
    }

    /**
     * 加载提示词数据
     */
    private async loadData(): Promise<PromptsData> {
        if (this.data) {
            return this.data;
        }

        try {
            const fileContent = await fs.readFile(PROMPTS_DATA_PATH, 'utf-8');
            const rawData = JSON.parse(fileContent);

            // 转换日期字符串为Date对象
            const prompts = rawData.prompts.map((prompt: any) => ({
                ...prompt,
                createdAt: new Date(prompt.createdAt),
                updatedAt: new Date(prompt.updatedAt)
            }));

            this.data = {
                categories: rawData.categories,
                prompts
            };

            return this.data;
        } catch (error) {
            console.error('加载提示词数据失败:', error);
            // 如果文件不存在或损坏，返回默认数据结构
            this.data = {
                categories: [],
                prompts: []
            };
            return this.data;
        }
    }

    /**
     * 保存提示词数据到文件
     */
    private async saveData(): Promise<void> {
        if (!this.data) {
            throw new Error('没有数据可保存');
        }

        try {
            // 确保目录存在
            const dir = path.dirname(PROMPTS_DATA_PATH);
            await fs.mkdir(dir, { recursive: true });

            // 转换Date对象为字符串
            const dataToSave = {
                categories: this.data.categories,
                prompts: this.data.prompts.map(prompt => ({
                    ...prompt,
                    createdAt: prompt.createdAt.toISOString(),
                    updatedAt: prompt.updatedAt.toISOString()
                }))
            };

            await fs.writeFile(PROMPTS_DATA_PATH, JSON.stringify(dataToSave, null, 4), 'utf-8');
        } catch (error) {
            console.error('保存提示词数据失败:', error);
            throw new Error('保存数据失败');
        }
    }

    /**
     * 生成唯一ID
     */
    private generateId(prefix: string = 'prompt'): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `${prefix}_${timestamp}_${random}`;
    }

    /**
     * 获取所有提示词分类
     */
    async getCategories(): Promise<PromptCategory[]> {
        const data = await this.loadData();
        return data.categories;
    }

    /**
     * 获取所有提示词
     */
    async getAllPrompts(): Promise<PromptItem[]> {
        const data = await this.loadData();
        return data.prompts;
    }

    /**
     * 根据ID获取提示词
     */
    async getPromptById(id: string): Promise<PromptItem | null> {
        const data = await this.loadData();
        return data.prompts.find(prompt => prompt.id === id) || null;
    }

    /**
     * 根据分类获取提示词
     */
    async getPromptsByCategory(categoryId: string): Promise<PromptItem[]> {
        const data = await this.loadData();
        return data.prompts.filter(prompt => prompt.category === categoryId);
    }

    /**
     * 搜索提示词
     */
    async searchPrompts(query: string, options?: {
        category?: string;
        tags?: string[];
        sortBy?: 'createdAt' | 'updatedAt' | 'usageCount' | 'rating';
        sortOrder?: 'asc' | 'desc';
        limit?: number;
        offset?: number;
    }): Promise<{ prompts: PromptItem[]; total: number }> {
        const data = await this.loadData();
        let filteredPrompts = data.prompts;

        // 文本搜索
        if (query.trim()) {
            const searchQuery = query.toLowerCase();
            filteredPrompts = filteredPrompts.filter(prompt =>
                prompt.title.toLowerCase().includes(searchQuery) ||
                prompt.content.toLowerCase().includes(searchQuery) ||
                prompt.description?.toLowerCase().includes(searchQuery) ||
                prompt.tags.some(tag => tag.toLowerCase().includes(searchQuery))
            );
        }

        // 分类筛选
        if (options?.category) {
            filteredPrompts = filteredPrompts.filter(prompt => prompt.category === options.category);
        }

        // 标签筛选
        if (options?.tags && options.tags.length > 0) {
            filteredPrompts = filteredPrompts.filter(prompt =>
                options.tags!.some(tag => prompt.tags.includes(tag))
            );
        }

        // 排序
        if (options?.sortBy) {
            const sortOrder = options.sortOrder || 'desc';
            filteredPrompts.sort((a, b) => {
                let aValue: any = a[options.sortBy!];
                let bValue: any = b[options.sortBy!];

                // 处理日期类型
                if (aValue instanceof Date) {
                    aValue = aValue.getTime();
                    bValue = bValue.getTime();
                }

                if (sortOrder === 'asc') {
                    return aValue > bValue ? 1 : -1;
                } else {
                    return aValue < bValue ? 1 : -1;
                }
            });
        }

        const total = filteredPrompts.length;

        // 分页
        if (options?.limit) {
            const offset = options.offset || 0;
            filteredPrompts = filteredPrompts.slice(offset, offset + options.limit);
        }

        return { prompts: filteredPrompts, total };
    }

    /**
     * 创建新提示词
     */
    async createPrompt(request: CreatePromptRequest): Promise<PromptItem> {
        const data = await this.loadData();

        const newPrompt: PromptItem = {
            id: this.generateId('prompt'),
            title: request.title.trim(),
            content: request.content.trim(),
            category: request.category,
            tags: request.tags.map(tag => tag.trim()).filter(tag => tag.length > 0),
            description: request.description?.trim(),
            createdAt: new Date(),
            updatedAt: new Date(),
            usageCount: 0,
            rating: undefined
        };

        data.prompts.push(newPrompt);
        await this.saveData();

        return newPrompt;
    }

    /**
     * 更新提示词
     */
    async updatePrompt(id: string, updates: Partial<CreatePromptRequest>): Promise<PromptItem | null> {
        const data = await this.loadData();
        const promptIndex = data.prompts.findIndex(prompt => prompt.id === id);

        if (promptIndex === -1) {
            return null;
        }

        const existingPrompt = data.prompts[promptIndex];
        const updatedPrompt: PromptItem = {
            ...existingPrompt,
            ...updates,
            id: existingPrompt.id, // 确保ID不被修改
            createdAt: existingPrompt.createdAt, // 确保创建时间不被修改
            updatedAt: new Date(),
            tags: updates.tags ? updates.tags.map(tag => tag.trim()).filter(tag => tag.length > 0) : existingPrompt.tags
        };

        data.prompts[promptIndex] = updatedPrompt;
        await this.saveData();

        return updatedPrompt;
    }

    /**
     * 删除提示词
     */
    async deletePrompt(id: string): Promise<boolean> {
        const data = await this.loadData();
        const promptIndex = data.prompts.findIndex(prompt => prompt.id === id);

        if (promptIndex === -1) {
            return false;
        }

        data.prompts.splice(promptIndex, 1);
        await this.saveData();

        return true;
    }

    /**
     * 增加提示词使用次数
     */
    async incrementUsageCount(id: string): Promise<boolean> {
        const data = await this.loadData();
        const prompt = data.prompts.find(p => p.id === id);

        if (!prompt) {
            return false;
        }

        prompt.usageCount += 1;
        prompt.updatedAt = new Date();
        await this.saveData();

        return true;
    }

    /**
     * 设置提示词评分
     */
    async setPromptRating(id: string, rating: number): Promise<boolean> {
        if (rating < 1 || rating > 5) {
            throw new Error('评分必须在1-5之间');
        }

        const data = await this.loadData();
        const prompt = data.prompts.find(p => p.id === id);

        if (!prompt) {
            return false;
        }

        prompt.rating = rating;
        prompt.updatedAt = new Date();
        await this.saveData();

        return true;
    }

    /**
     * 创建新分类
     */
    async createCategory(category: Omit<PromptCategory, 'id'>): Promise<PromptCategory> {
        const data = await this.loadData();

        const newCategory: PromptCategory = {
            id: this.generateId('category'),
            name: category.name.trim(),
            description: category.description.trim(),
            icon: category.icon
        };

        data.categories.push(newCategory);
        await this.saveData();

        return newCategory;
    }

    /**
     * 更新分类
     */
    async updateCategory(id: string, updates: Partial<Omit<PromptCategory, 'id'>>): Promise<PromptCategory | null> {
        const data = await this.loadData();
        const categoryIndex = data.categories.findIndex(cat => cat.id === id);

        if (categoryIndex === -1) {
            return null;
        }

        const updatedCategory = {
            ...data.categories[categoryIndex],
            ...updates
        };

        data.categories[categoryIndex] = updatedCategory;
        await this.saveData();

        return updatedCategory;
    }

    /**
     * 删除分类
     */
    async deleteCategory(id: string): Promise<boolean> {
        const data = await this.loadData();
        const categoryIndex = data.categories.findIndex(cat => cat.id === id);

        if (categoryIndex === -1) {
            return false;
        }

        // 检查是否有提示词使用此分类
        const hasPrompts = data.prompts.some(prompt => prompt.category === id);
        if (hasPrompts) {
            throw new Error('无法删除包含提示词的分类');
        }

        data.categories.splice(categoryIndex, 1);
        await this.saveData();

        return true;
    }

    /**
     * 获取统计信息
     */
    async getStatistics(): Promise<{
        totalPrompts: number;
        totalCategories: number;
        mostUsedPrompts: PromptItem[];
        topRatedPrompts: PromptItem[];
        categoryStats: Array<{ category: string; count: number }>;
    }> {
        const data = await this.loadData();

        // 最常用的提示词（前5个）
        const mostUsedPrompts = [...data.prompts]
            .sort((a, b) => b.usageCount - a.usageCount)
            .slice(0, 5);

        // 评分最高的提示词（前5个）
        const topRatedPrompts = [...data.prompts]
            .filter(p => p.rating !== undefined)
            .sort((a, b) => (b.rating || 0) - (a.rating || 0))
            .slice(0, 5);

        // 分类统计
        const categoryStats = data.categories.map(category => ({
            category: category.name,
            count: data.prompts.filter(p => p.category === category.id).length
        }));

        return {
            totalPrompts: data.prompts.length,
            totalCategories: data.categories.length,
            mostUsedPrompts,
            topRatedPrompts,
            categoryStats
        };
    }
}

// 导出单例实例
export const promptManager = PromptManager.getInstance();