import type { APIRoute, GetStaticPaths } from 'astro';
import { createSuccessResponse, createErrorResponse } from '../../../../../utils/static-helpers';

/**
 * 静态路径生成
 */
export const getStaticPaths: GetStaticPaths = async () => {
    // 为演示目的生成一些静态路径
    const promptIds = ['1', '2', '3', '4', '5'];

    return promptIds.map(id => ({
        params: { id }
    }));
};

/**
 * 使用提示词API
 * 简化版本，适用于静态构建
 */
export const POST: APIRoute = async ({ params }) => {
    try {
        const { id } = params;

        // 模拟使用记录
        const result = {
            promptId: id,
            usageCount: Math.floor(Math.random() * 100) + 1,
            message: '使用记录已更新'
        };

        return createSuccessResponse(result);

    } catch (error) {
        console.error('记录使用失败:', error);
        return createErrorResponse('记录使用失败', 'USE_RECORD_ERROR');
    }
};