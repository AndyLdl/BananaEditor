/**
 * 错误监控API端点
 * 简化版本，适用于静态构建
 */

import type { APIRoute } from 'astro';
import { createSuccessResponse, createErrorResponse } from '../../../utils/static-helpers';

export const GET: APIRoute = async () => {
    try {
        // 返回模拟错误数据
        const errors = {
            totalErrors: 23,
            errorRate: 0.02,
            recentErrors: [
                {
                    id: '1',
                    message: 'Network timeout',
                    stack: 'Error: Network timeout at fetch...',
                    timestamp: new Date().toISOString(),
                    count: 5,
                    severity: 'warning'
                },
                {
                    id: '2',
                    message: 'Invalid prompt format',
                    stack: 'Error: Invalid prompt format...',
                    timestamp: new Date().toISOString(),
                    count: 3,
                    severity: 'error'
                }
            ],
            errorsByType: {
                'network': 12,
                'validation': 8,
                'api': 3
            },
            errorTrends: [
                { date: '2024-01-15', count: 5 },
                { date: '2024-01-16', count: 8 },
                { date: '2024-01-17', count: 10 }
            ]
        };

        return createSuccessResponse(errors);

    } catch (error) {
        console.error('获取错误数据失败:', error);
        return createErrorResponse('获取错误数据失败', 'ERROR_FETCH_ERROR');
    }
};