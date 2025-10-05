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
 * 提示词评分API
 * 简化版本，适用于静态构建
 */
export const POST: APIRoute = async ({ params }) => {
    try {
        const { id } = params;

        // 模拟评分处理
        const result = {
            promptId: id,
            rating: Math.floor(Math.random() * 5) + 1,
            message: '评分已记录'
        };

        return createSuccessResponse(result);

    } catch (error) {
        console.error('评分失败:', error);
        return createErrorResponse('评分失败', 'RATING_ERROR');
    }
};