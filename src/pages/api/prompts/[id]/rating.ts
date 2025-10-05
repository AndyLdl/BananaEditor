// 提示词评分API - 对提示词进行评分

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

interface RatingRequest {
    rating: number;
}

interface RatingResponse {
    success: boolean;
    data?: {
        promptId: string;
        newRating: number;
        totalRatings: number;
        message: string;
    };
    error?: {
        code: string;
        message: string;
    };
}

// 模拟评分数据存储（实际项目中应该使用数据库）
const promptRatings = new Map<string, { total: number; count: number; userRatings: Map<string, number> }>();

// 获取用户ID（实际项目中从认证信息获取）
function getUserId(request: Request): string {
    const userAgent = request.headers.get('user-agent') || 'anonymous';
    return `user_${Buffer.from(userAgent).toString('base64').slice(0, 10)}`;
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

// 验证评分数据
function validateRating(data: any): number {
    if (!data || typeof data.rating !== 'number') {
        throw new Error('评分必须是数字');
    }

    const rating = Math.round(data.rating);
    if (rating < 1 || rating > 5) {
        throw new Error('评分必须在1-5之间');
    }

    return rating;
}

// 计算新的平均评分
function calculateNewRating(promptId: string, userRating: number, userId: string): { newRating: number; totalRatings: number } {
    if (!promptRatings.has(promptId)) {
        promptRatings.set(promptId, {
            total: 0,
            count: 0,
            userRatings: new Map()
        });
    }

    const ratingData = promptRatings.get(promptId)!;
    const previousUserRating = ratingData.userRatings.get(userId);

    if (previousUserRating !== undefined) {
        // 用户之前已经评分，更新评分
        ratingData.total = ratingData.total - previousUserRating + userRating;
    } else {
        // 用户首次评分
        ratingData.total += userRating;
        ratingData.count += 1;
    }

    ratingData.userRatings.set(userId, userRating);

    const newRating = Math.round((ratingData.total / ratingData.count) * 10) / 10;

    return {
        newRating,
        totalRatings: ratingData.count
    };
}

// POST 请求处理器 - 提交评分
export const POST: APIRoute = async ({ params, request }) => {
    try {
        const { id } = params;

        if (!id) {
            const errorResponse: RatingResponse = {
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

        // 验证评分
        const rating = validateRating(requestData);

        // 获取用户ID
        const userId = getUserId(request);

        // 加载提示词数据
        const data = await loadPromptsData();
        const prompts = data.prompts || [];

        // 查找提示词
        const promptIndex = prompts.findIndex((prompt: any) => prompt.id === id);

        if (promptIndex === -1) {
            const errorResponse: RatingResponse = {
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

        // 计算新评分
        const { newRating, totalRatings } = calculateNewRating(id, rating, userId);

        // 更新提示词评分
        prompts[promptIndex].rating = newRating;
        prompts[promptIndex].updatedAt = new Date().toISOString();

        // 保存数据
        await savePromptsData(data);

        // 返回结果
        const response: RatingResponse = {
            success: true,
            data: {
                promptId: id,
                newRating,
                totalRatings,
                message: '评分提交成功'
            }
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('提交评分失败:', error);

        const errorResponse: RatingResponse = {
            success: false,
            error: {
                code: 'SUBMIT_RATING_FAILED',
                message: error instanceof Error ? error.message : '提交评分失败，请稍后重试'
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

// GET 请求处理器 - 获取用户评分
export const GET: APIRoute = async ({ params, request }) => {
    try {
        const { id } = params;

        if (!id) {
            const errorResponse: RatingResponse = {
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

        // 获取用户ID
        const userId = getUserId(request);

        // 获取用户评分
        const ratingData = promptRatings.get(id);
        const userRating = ratingData?.userRatings.get(userId) || 0;

        // 返回用户评分
        const response = {
            success: true,
            data: {
                promptId: id,
                userRating,
                hasRated: userRating > 0,
                message: userRating > 0 ? `您的评分: ${userRating}星` : '您还未评分'
            }
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'private, max-age=60'
            }
        });

    } catch (error) {
        console.error('获取用户评分失败:', error);

        const errorResponse: RatingResponse = {
            success: false,
            error: {
                code: 'GET_USER_RATING_FAILED',
                message: '获取用户评分失败，请稍后重试'
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};