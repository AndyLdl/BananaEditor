/**
 * 使用情况分析API端点
 * 简化版本，适用于静态构建
 */

import type { APIRoute } from 'astro';
import { createSuccessResponse, createErrorResponse } from '../../../utils/static-helpers';

export const GET: APIRoute = async ({ url }) => {
    try {
        const searchParams = url.searchParams;
        const period = searchParams.get('period') || '24h';
        const groupBy = searchParams.get('groupBy') || 'hour';

        // 返回模拟分析数据
        const analytics = {
            period,
            groupBy,
            totalUsers: 1250,
            activeUsers: 89,
            pageViews: 3456,
            sessions: 567,
            bounceRate: 0.35,
            avgSessionDuration: 245,
            topPages: [
                { path: '/', views: 1234, uniqueViews: 890 },
                { path: '/editor', views: 987, uniqueViews: 654 },
                { path: '/prompts', views: 543, uniqueViews: 321 }
            ],
            userFlow: [
                { from: '/', to: '/editor', count: 456 },
                { from: '/editor', to: '/prompts', count: 234 },
                { from: '/prompts', to: '/editor', count: 123 }
            ],
            deviceTypes: {
                desktop: 0.65,
                mobile: 0.30,
                tablet: 0.05
            },
            browsers: {
                chrome: 0.45,
                safari: 0.25,
                firefox: 0.15,
                edge: 0.10,
                other: 0.05
            }
        };

        return createSuccessResponse(analytics);

    } catch (error) {
        console.error('获取分析数据失败:', error);
        return createErrorResponse('获取分析数据失败', 'ANALYTICS_ERROR');
    }
};