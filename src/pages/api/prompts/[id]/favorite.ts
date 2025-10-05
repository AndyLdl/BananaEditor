// 提示词收藏API - 收藏/取消收藏提示词

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

interface FavoriteResponse {
    success: boolean;
    data?: {
        promptId: string;
        isFavorite: boolean;
        message: string;
    };
    error?: {
        code: string;
        message: string;
    };
}

// 模拟用户收藏数据存储（实际项目中应该使用数据库）
const userFavorites = new Map<string, Set<string>>();

// 获取用户ID（实际项目中从认证信息获取）
function getUserId(request: Request): string {
    // 这里简化处理，实际应该从JWT token或session中获取
    const userAgent = request.headers.get('user-agent') || 'anonymous';
    return `user_${Buffer.from(userAgent).toString('base64').slice(0, 10)}`;
}

// POST 请求处理器 - 切换收藏状态
export const POST: APIRoute = async ({ params, request }) => {
    try {
        const { id } = params;

        if (!id) {
            const errorResponse: FavoriteResponse = {
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

        // 获取用户收藏列表
        if (!userFavorites.has(userId)) {
            userFavorites.set(userId, new Set());
        }

        const favorites = userFavorites.get(userId)!;
        const isFavorite = favorites.has(id);

        // 切换收藏状态
        if (isFavorite) {
            favorites.delete(id);
        } else {
            favorites.add(id);
        }

        const newFavoriteStatus = !isFavorite;

        // 返回结果
        const response: FavoriteResponse = {
            success: true,
            data: {
                promptId: id,
                isFavorite: newFavoriteStatus,
                message: newFavoriteStatus ? '已添加到收藏' : '已从收藏中移除'
            }
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('切换收藏状态失败:', error);

        const errorResponse: FavoriteResponse = {
            success: false,
            error: {
                code: 'TOGGLE_FAVORITE_FAILED',
                message: '操作失败，请稍后重试'
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

// GET 请求处理器 - 获取收藏状态
export const GET: APIRoute = async ({ params, request }) => {
    try {
        const { id } = params;

        if (!id) {
            const errorResponse: FavoriteResponse = {
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

        // 检查收藏状态
        const favorites = userFavorites.get(userId) || new Set();
        const isFavorite = favorites.has(id);

        // 返回收藏状态
        const response: FavoriteResponse = {
            success: true,
            data: {
                promptId: id,
                isFavorite,
                message: isFavorite ? '已收藏' : '未收藏'
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
        console.error('获取收藏状态失败:', error);

        const errorResponse: FavoriteResponse = {
            success: false,
            error: {
                code: 'GET_FAVORITE_STATUS_FAILED',
                message: '获取收藏状态失败，请稍后重试'
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};