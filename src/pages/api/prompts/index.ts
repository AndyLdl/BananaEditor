// 提示词库API - 获取提示词列表
// 支持搜索、筛选、分页等功能

import type { APIRoute } from 'astro';
import { promises as fs } from 'fs';
import path from 'path';

// 提示词接口定义
interface PromptItem {
    id: string;
    title: string;
    content: string;
    category: string;
    tags: string[];
    description: string;
    createdAt: string;
    updatedAt: string;
    usageCount: number;
    rating: number;
    isFavorite?: boolean;
    author?: string;
}

interface PromptCategory {
    id: string;
    name: string;
    description: string;
    icon: string;
}

interface PromptsResponse {
    success: boolean;
    data?: {
        prompts: PromptItem[];
        categories: PromptCategory[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
        filters: {
            category?: string;
            search?: string;
            rating?: number;
            sort?: string;
        };
    };
    error?: {
        code: string;
        message: string;
    };
}

// 加载提示词数据
async function loadPromptsData(): Promise<{ prompts: PromptItem[]; categories: PromptCategory[] }> {
    try {
        const dataPath = path.join(process.cwd(), 'src/data/prompts.json');
        const data = await fs.readFile(dataPath, 'utf-8');
        const parsed = JSON.parse(data);

        return {
            prompts: parsed.prompts || [],
            categories: parsed.categories || []
        };
    } catch (error) {
        console.error('加载提示词数据失败:', error);
        return {
            prompts: [],
            categories: []
        };
    }
}

// 筛选和搜索提示词
function filterPrompts(
    prompts: PromptItem[],
    filters: {
        category?: string;
        search?: string;
        rating?: number;
        sort?: string;
    }
): PromptItem[] {
    let filtered = [...prompts];

    // 分类筛选
    if (filters.category && filters.category !== 'all') {
        filtered = filtered.filter(prompt => prompt.category === filters.category);
    }

    // 搜索筛选
    if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        filtered = filtered.filter(prompt =>
            prompt.title.toLowerCase().includes(searchTerm) ||
            prompt.content.toLowerCase().includes(searchTerm) ||
            prompt.description.toLowerCase().includes(searchTerm) ||
            prompt.tags.some(tag => tag.toLowerCase().includes(searchTerm))
        );
    }

    // 评分筛选
    if (filters.rating && filters.rating > 0) {
        filtered = filtered.filter(prompt => prompt.rating >= filters.rating);
    }

    // 排序
    switch (filters.sort) {
        case 'newest':
            filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            break;
        case 'oldest':
            filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            break;
        case 'rating':
            filtered.sort((a, b) => b.rating - a.rating);
            break;
        case 'usage':
            filtered.sort((a, b) => b.usageCount - a.usageCount);
            break;
        case 'alphabetical':
            filtered.sort((a, b) => a.title.localeCompare(b.title));
            break;
        default:
            // 默认按最新排序
            filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return filtered;
}

// 分页处理
function paginatePrompts(
    prompts: PromptItem[],
    page: number,
    limit: number
): {
    prompts: PromptItem[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
} {
    const total = prompts.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    return {
        prompts: prompts.slice(startIndex, endIndex),
        pagination: {
            page,
            limit,
            total,
            totalPages
        }
    };
}

// GET 请求处理器 - 获取提示词列表
export const GET: APIRoute = async ({ url }) => {
    try {
        // 解析查询参数
        const searchParams = url.searchParams;
        const category = searchParams.get('category') || undefined;
        const search = searchParams.get('search') || undefined;
        const rating = searchParams.get('rating') ? parseInt(searchParams.get('rating')!) : undefined;
        const sort = searchParams.get('sort') || 'newest';
        const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
        const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '12')));

        // 加载数据
        const { prompts, categories } = await loadPromptsData();

        // 应用筛选
        const filters = { category, search, rating, sort };
        const filteredPrompts = filterPrompts(prompts, filters);

        // 分页
        const paginatedResult = paginatePrompts(filteredPrompts, page, limit);

        // 构建响应
        const response: PromptsResponse = {
            success: true,
            data: {
                prompts: paginatedResult.prompts,
                categories,
                pagination: paginatedResult.pagination,
                filters
            }
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=300' // 缓存5分钟
            }
        });

    } catch (error) {
        console.error('获取提示词列表失败:', error);

        const errorResponse: PromptsResponse = {
            success: false,
            error: {
                code: 'GET_PROMPTS_FAILED',
                message: '获取提示词列表失败，请稍后重试'
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
};