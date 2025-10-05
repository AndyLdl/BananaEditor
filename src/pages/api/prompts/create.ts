// 提示词库API - 创建新提示词
// 支持创建、验证、保存提示词

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
    author?: string;
}

interface CreatePromptRequest {
    title: string;
    content: string;
    category: string;
    tags: string[];
    description: string;
}

interface CreatePromptResponse {
    success: boolean;
    data?: {
        prompt: PromptItem;
        message: string;
    };
    error?: {
        code: string;
        message: string;
        details?: any;
    };
}

// 验证提示词数据
function validatePromptData(data: any): CreatePromptRequest {
    const errors: string[] = [];

    // 验证标题
    if (!data.title || typeof data.title !== 'string') {
        errors.push('标题是必需的');
    } else if (data.title.length < 2) {
        errors.push('标题至少需要2个字符');
    } else if (data.title.length > 100) {
        errors.push('标题不能超过100个字符');
    }

    // 验证内容
    if (!data.content || typeof data.content !== 'string') {
        errors.push('提示词内容是必需的');
    } else if (data.content.length < 10) {
        errors.push('提示词内容至少需要10个字符');
    } else if (data.content.length > 2000) {
        errors.push('提示词内容不能超过2000个字符');
    }

    // 验证分类
    const validCategories = ['portrait', 'landscape', 'abstract', 'anime'];
    if (!data.category || !validCategories.includes(data.category)) {
        errors.push('请选择有效的分类');
    }

    // 验证标签
    let tags: string[] = [];
    if (data.tags) {
        if (Array.isArray(data.tags)) {
            tags = data.tags.filter(tag => typeof tag === 'string' && tag.trim().length > 0);
        } else if (typeof data.tags === 'string') {
            tags = data.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
        }
    }

    if (tags.length === 0) {
        errors.push('至少需要一个标签');
    } else if (tags.length > 10) {
        errors.push('标签数量不能超过10个');
    }

    // 验证描述
    if (!data.description || typeof data.description !== 'string') {
        errors.push('描述是必需的');
    } else if (data.description.length < 5) {
        errors.push('描述至少需要5个字符');
    } else if (data.description.length > 500) {
        errors.push('描述不能超过500个字符');
    }

    if (errors.length > 0) {
        throw new Error(`验证失败: ${errors.join(', ')}`);
    }

    return {
        title: data.title.trim(),
        content: data.content.trim(),
        category: data.category,
        tags: tags.slice(0, 10), // 限制最多10个标签
        description: data.description.trim()
    };
}

// 生成唯一ID
function generatePromptId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `prompt_${timestamp}_${random}`;
}

// 加载现有提示词数据
async function loadPromptsData(): Promise<any> {
    try {
        const dataPath = path.join(process.cwd(), 'src/data/prompts.json');
        const data = await fs.readFile(dataPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('加载提示词数据失败:', error);
        return {
            categories: [
                {
                    id: "portrait",
                    name: "人物肖像",
                    description: "人物肖像相关的提示词",
                    icon: "👤"
                },
                {
                    id: "landscape",
                    name: "风景自然",
                    description: "风景和自然场景的提示词",
                    icon: "🌄"
                },
                {
                    id: "abstract",
                    name: "抽象艺术",
                    description: "抽象和艺术风格的提示词",
                    icon: "🎨"
                },
                {
                    id: "anime",
                    name: "动漫风格",
                    description: "动漫和卡通风格的提示词",
                    icon: "🎭"
                }
            ],
            prompts: []
        };
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

// 检查重复提示词
function checkDuplicatePrompt(prompts: PromptItem[], newPrompt: CreatePromptRequest): boolean {
    return prompts.some(prompt =>
        prompt.title.toLowerCase() === newPrompt.title.toLowerCase() ||
        prompt.content.toLowerCase() === newPrompt.content.toLowerCase()
    );
}

// POST 请求处理器 - 创建新提示词
export const POST: APIRoute = async ({ request }) => {
    try {
        // 解析请求数据
        const requestData = await request.json();

        // 验证数据
        const validatedData = validatePromptData(requestData);

        // 加载现有数据
        const data = await loadPromptsData();
        const prompts = data.prompts || [];

        // 检查重复
        if (checkDuplicatePrompt(prompts, validatedData)) {
            const errorResponse: CreatePromptResponse = {
                success: false,
                error: {
                    code: 'DUPLICATE_PROMPT',
                    message: '已存在相同标题或内容的提示词'
                }
            };

            return new Response(JSON.stringify(errorResponse), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        // 创建新提示词
        const now = new Date().toISOString();
        const newPrompt: PromptItem = {
            id: generatePromptId(),
            title: validatedData.title,
            content: validatedData.content,
            category: validatedData.category,
            tags: validatedData.tags,
            description: validatedData.description,
            createdAt: now,
            updatedAt: now,
            usageCount: 0,
            rating: 5, // 默认评分
            author: 'user' // 可以从认证信息获取
        };

        // 添加到数据中
        prompts.push(newPrompt);
        data.prompts = prompts;

        // 保存数据
        await savePromptsData(data);

        // 构建成功响应
        const response: CreatePromptResponse = {
            success: true,
            data: {
                prompt: newPrompt,
                message: '提示词创建成功'
            }
        };

        return new Response(JSON.stringify(response), {
            status: 201,
            headers: {
                'Content-Type': 'application/json'
            }
        });

    } catch (error) {
        console.error('创建提示词失败:', error);

        const errorResponse: CreatePromptResponse = {
            success: false,
            error: {
                code: 'CREATE_PROMPT_FAILED',
                message: error instanceof Error ? error.message : '创建提示词失败，请稍后重试'
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