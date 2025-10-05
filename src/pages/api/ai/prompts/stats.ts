import type { APIRoute } from 'astro';
import { createSuccessResponse, createErrorResponse } from '../../../../utils/static-helpers';

/**
 * 获取统计信息API
 * 简化版本，适用于静态构建
 */
export const GET: APIRoute = async () => {
    try {
        // 返回静态统计数据
        const stats = {
            totalPrompts: 124,
            totalCategories: 6,
            totalUsers: 1250,
            popularCategories: [
                { name: '艺术创作', count: 25 },
                { name: '设计元素', count: 32 },
                { name: '人物肖像', count: 22 }
            ],
            recentActivity: {
                promptsAdded: 8,
                promptsUsed: 156,
                newUsers: 23
            }
        };

        return createSuccessResponse(stats);

    } catch (error) {
        console.error('获取统计信息失败:', error);
        return createErrorResponse('获取统计信息失败', 'STATS_FETCH_ERROR');
    }
};