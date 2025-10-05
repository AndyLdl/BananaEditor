import type { APIRoute } from 'astro';
import { createSuccessResponse, createErrorResponse } from '../../../../utils/static-helpers';

/**
 * 提示词列表API
 * 简化版本，适用于静态构建
 */
export const GET: APIRoute = async () => {
    try {
        // 返回静态提示词数据
        const prompts = [
            {
                id: '1',
                title: 'Nano Banana 艺术风格',
                content: 'A beautiful nano banana in artistic style with golden glow',
                category: 'art',
                tags: ['nano banana', 'artistic', 'golden'],
                rating: 4.8,
                usageCount: 156,
                createdAt: '2024-01-15T10:00:00Z'
            },
            {
                id: '2',
                title: 'Nano Banana 摄影风格',
                content: 'Professional photography of nano banana with studio lighting',
                category: 'photography',
                tags: ['nano banana', 'photography', 'professional'],
                rating: 4.6,
                usageCount: 89,
                createdAt: '2024-01-14T15:30:00Z'
            },
            {
                id: '3',
                title: 'Nano Banana 抽象设计',
                content: 'Abstract nano banana design with geometric patterns',
                category: 'design',
                tags: ['nano banana', 'abstract', 'geometric'],
                rating: 4.9,
                usageCount: 203,
                createdAt: '2024-01-13T09:15:00Z'
            }
        ];

        return createSuccessResponse({
            prompts,
            total: prompts.length,
            page: 1,
            pageSize: 10
        });

    } catch (error) {
        console.error('获取提示词列表失败:', error);
        return createErrorResponse('获取提示词列表失败', 'PROMPTS_FETCH_ERROR');
    }
};