// 提示词库API - 单个提示词的CRUD操作
// 支持获取、更新、删除单个提示词

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
    author?: string;
}

interface PromptResponse {
    success: boolean;
    data?: {
        prompt?: PromptItem;
        message?: string;
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

// 查找提示词
function findPromptById(prompts: PromptItem[], id: string): PromptItem | null {
    return prompts.find(prompt => prompt.id === id) || null;
}

// 验证更新数据
function validateUpdateData(data: any): Partial<PromptItem> {
    const updateData: Partial<PromptItem> = {};

    if (data.title !== undefined) {
        if (typeof data.title !== 'string' || data.title.length < 2 || data.title.length > 100) {
            throw new Error('标题长度必须在2-100个字符之间');
        }
        updateData.title = data.title.trim();
    }

    if (data.content !== undefined) {
        if (typeof data.content !== 'string' || data.content.length < 10 || data.content.length > 2000) {
            throw new Error('提示词内容长度必须在10-2000个字符之间');
        }
        updateData.content = data.content.trim();
    }

    if (data.category !== undefined) {
        const validCategories = ['portrait', 'landscape', 'abstract', 'anime'];
        if (!validCategories.includes(data.category)) {
            throw new Error('无效的分类');
        }
        updateData.category = data.category;
    }

    if (data.tags !== undefined) {
        let tags: string[] = [];
        if (Array.isArray(data.tags)) {
            tags = data.tags.filter(tag => typeof tag === 'string' && tag.trim().length > 0);
        } else if (typeof data.tags === 'string') {
            tags = data.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
        }

        if (tags.length === 0 || tags.length > 10) {
            throw new Error('标签数量必须在1-10个之间');
        }
        updateData.tags = tags;
    }

    if (data.description !== undefined) {
        if (typeof data.description !== 'string' || data.description.length < 5 || data.description.length > 500) {
            throw new Error('描述长度必须在5-500个字符之间');
        }
        updateData.description = data.description.trim();
    }

    if (data.rating !== undefined) {
        const rating = Number(data.rating);
        if (isNaN(rating) || rating < 1 || rating > 5) {
            throw new Error('评分必须在1-5之间');
        }
        updateData.rating = rating;
    }

    return updateData;
}

// GET 请求处理器 - 获取单个提示词
export const GET: APIRoute = async ({ params }) => {
    try {
        const { id } = params;

        if (!id) {
            const errorResponse: PromptResponse = {
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

        // 加载数据
        const data = await loadPromptsData();
        const prompts = data.prompts || [];

        // 查找提示词
        const prompt = findPromptById(prompts, id);

        if (!prompt) {
            const errorResponse: PromptResponse = {
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

        // 返回提示词
        const response: PromptResponse = {
            success: true,
            data: {
                prompt
            }
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=300'
            }
        });

    } catch (error) {
        console.error('获取提示词失败:', error);

        const errorResponse: PromptResponse = {
            success: false,
            error: {
                code: 'GET_PROMPT_FAILED',
                message: '获取提示词失败，请稍后重试'
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

// PUT 请求处理器 - 更新提示词
export const PUT: APIRoute = async ({ params, request }) => {
    try {
        const { id } = params;

        if (!id) {
            const errorResponse: PromptResponse = {
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

        // 解析请求数据
        const requestData = await request.json();

        // 验证更新数据
        const updateData = validateUpdateData(requestData);

        // 加载数据
        const data = await loadPromptsData();
        const prompts = data.prompts || [];

        // 查找提示词
        const promptIndex = prompts.findIndex((prompt: PromptItem) => prompt.id === id);

        if (promptIndex === -1) {
            const errorResponse: PromptResponse = {
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

        // 更新提示词
        const updatedPrompt = {
            ...prompts[promptIndex],
            ...updateData,
            updatedAt: new Date().toISOString()
        };

        prompts[promptIndex] = updatedPrompt;
        data.prompts = prompts;

        // 保存数据
        await savePromptsData(data);

        // 返回更新后的提示词
        const response: PromptResponse = {
            success: true,
            data: {
                prompt: updatedPrompt,
                message: '提示词更新成功'
            }
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('更新提示词失败:', error);

        const errorResponse: PromptResponse = {
            success: false,
            error: {
                code: 'UPDATE_PROMPT_FAILED',
                message: error instanceof Error ? error.message : '更新提示词失败，请稍后重试'
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

// DELETE 请求处理器 - 删除提示词
export const DELETE: APIRoute = async ({ params }) => {
    try {
        const { id } = params;

        if (!id) {
            const errorResponse: PromptResponse = {
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

        // 加载数据
        const data = await loadPromptsData();
        const prompts = data.prompts || [];

        // 查找提示词
        const promptIndex = prompts.findIndex((prompt: PromptItem) => prompt.id === id);

        if (promptIndex === -1) {
            const errorResponse: PromptResponse = {
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

        // 删除提示词
        const deletedPrompt = prompts.splice(promptIndex, 1)[0];
        data.prompts = prompts;

        // 保存数据
        await savePromptsData(data);

        // 返回删除结果
        const response: PromptResponse = {
            success: true,
            data: {
                message: '提示词删除成功'
            }
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('删除提示词失败:', error);

        const errorResponse: PromptResponse = {
            success: false,
            error: {
                code: 'DELETE_PROMPT_FAILED',
                message: '删除提示词失败，请稍后重试'
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};