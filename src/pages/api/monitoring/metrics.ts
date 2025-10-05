/**
 * 性能指标API端点
 * 简化版本，适用于静态构建
 */

import type { APIRoute } from 'astro';
import { createSuccessResponse, createErrorResponse } from '../../../utils/static-helpers';

export const GET: APIRoute = async () => {
    try {
        // 返回模拟性能指标
        const metrics = {
            system: {
                cpuUsage: 0.45,
                memoryUsage: 0.67,
                diskUsage: 0.23,
                uptime: 86400 * 7 // 7 days
            },
            api: {
                totalRequests: 12456,
                successRate: 0.98,
                avgResponseTime: 245,
                requestsPerSecond: 15.6
            },
            ai: {
                generationRequests: 1234,
                fusionRequests: 567,
                optimizationRequests: 890,
                avgProcessingTime: 3.2,
                successRate: 0.95
            },
            performance: {
                pageLoadTime: 1.2,
                firstContentfulPaint: 0.8,
                largestContentfulPaint: 2.1,
                cumulativeLayoutShift: 0.05
            },
            trends: [
                { timestamp: Date.now() - 3600000, requests: 120, responseTime: 250 },
                { timestamp: Date.now() - 1800000, requests: 135, responseTime: 240 },
                { timestamp: Date.now(), requests: 156, responseTime: 245 }
            ]
        };

        return createSuccessResponse(metrics);

    } catch (error) {
        console.error('获取性能指标失败:', error);
        return createErrorResponse('获取性能指标失败', 'METRICS_ERROR');
    }
};