import type { APIRoute } from 'astro';
import { createSuccessResponse, createErrorResponse } from '../../../../utils/static-helpers';

/**
 * 获取所有分类API
 * 简化版本，适用于静态构建
 */
export const GET: APIRoute = async () => {
    try {
        // 返回静态分类数据
        const categories = [
            { id: 'art', name: '艺术创作', count: 25 },
            { id: 'photography', name: '摄影风格', count: 18 },
            { id: 'design', name: '设计元素', count: 32 },
            { id: 'nature', name: '自然风景', count: 15 },
            { id: 'portrait', name: '人物肖像', count: 22 },
            { id: 'abstract', name: '抽象艺术', count: 12 }
        ];

        return createSuccessResponse(categories);

    } catch (error) {
        console.error('获取分类列表失败:', error);
        return createErrorResponse('获取分类列表失败', 'CATEGORIES_FETCH_ERROR');
    }
};