import type { APIRoute, GetStaticPaths } from 'astro';
import { createSuccessResponse, createErrorResponse } from '../../../../utils/static-helpers';

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
 * 获取单个提示词API
 * 简化版本，适用于静态构建
 */
export const GET: APIRoute = async ({ params }) => {
    try {
        const { id } = params;

        // 模拟提示词数据
        const prompt = {
            id,
            title: `示例提示词 ${id}`,
            content: `这是一个关于nano banana的示例提示词内容 ${id}`,
            category: 'art',
            tags: ['nano banana', 'ai', 'creative'],
            rating: Math.floor(Math.random() * 5) + 1,
            usageCount: Math.floor(Math.random() * 100) + 1,
            createdAt: new Date().toISOString(),
            author: 'BananaEditor Team'
        };

        return createSuccessResponse(prompt);

    } catch (error) {
        console.error('获取提示词失败:', error);
        return createErrorResponse('获取提示词失败', 'PROMPT_FETCH_ERROR');
    }
};