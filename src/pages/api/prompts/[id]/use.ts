// 提示词使用统计API - 记录提示词使用次数

import type { APIRoute } from 'astro';

// 为静态构建提供路径
export async function getStaticPaths() {
    // 返回一些示例路径，实际使用时这些路由是动态的
    return [
        { params: { id: '1' } },
        { params: { id: '2' } },
        { params: { id: '3' } },
        { params: { id: '4' } },
        { params: { id: '5' } }
    ];
}
import { promises as fs } from 'fs';
import path from 'path';

interface UseResponse {
    success: boolean;
    data?: {
        promptId: string;
        newUsageCount: number;
        message: string;
    };
    error?: {
        code: string;
        message: string;
    };
}

// 加载提示词数据
async function loadPromptsData(): Promise<any> {
    try {
        const dataPath = path.join(process.cwd(), 'src/data/prompts.json');
        const data = await fs.readFile(dataPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('加载提示词数据失败:', error);
        return { prompts: [], categories: [] };
    }
}

// 保存提示词数据
async function savePromptsData(data: any): Promise<void> {
    try {
        const dataPath = path.join(process.cwd(), 'src/data/prompts.json');
        await fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error('保存提示词数据失败:', error);
        throw new Error('保存提示词失败');
    }
}

// POST 请求处理器 - 记录使用次数
export const POST: APIRoute = async ({ params, request }) => {
    try {
        const { id } = params;

        if (!id) {
            const errorResponse: UseResponse = {
                success: false,
                error: {
                    code: 'MISSING_ID',
                    message: '缺少提示词ID'
                }
            };

            return new Response(JSON.stringify(errorResponse), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 加载提示词数据
        const data = await loadPromptsData();
        const prompts = data.prompts || [];

        // 查找提示词
        const promptIndex = prompts.findIndex((prompt: any) => prompt.id === id);

        if (promptIndex === -1) {
            const errorResponse: UseResponse = {
                success: false,
                error: {
                    code: 'PROMPT_NOT_FOUND',
                    message: '提示词不存在'
                }
            };

            return new Response(JSON.stringify(errorResponse), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 增加使用次数
        const prompt = prompts[promptIndex];
        prompt.usageCount = (prompt.usageCount || 0) + 1;
        prompt.updatedAt = new Date().toISOString();

        // 保存数据
        await savePromptsData(data);

        // 返回结果
        const response: UseResponse = {
            success: true,
            data: {
                promptId: id,
                newUsageCount: prompt.usageCount,
                message: '使用次数已记录'
            }
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('记录使用次数失败:', error);

        const errorResponse: UseResponse = {
            success: false,
            error: {
                code: 'RECORD_USAGE_FAILED',
                message: '记录使用次数失败，请稍后重试'
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};