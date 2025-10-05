/**
 * 健康检查API端点
 * 用于监控系统状态和服务可用性
 */

import type { APIRoute } from 'astro';
import { getStorageStats, checkDiskSpace } from '../../config/storage';
import { getStorageConfig } from '../../config/storage';

interface HealthStatus {
    status: 'healthy' | 'unhealthy' | 'degraded';
    timestamp: string;
    uptime: number;
    version: string;
    services: {
        storage: {
            status: 'healthy' | 'unhealthy';
            uploadDir: {
                accessible: boolean;
                files: number;
                size: number;
            };
            tempDir: {
                accessible: boolean;
                files: number;
                size: number;
            };
            diskSpace: {
                free: number;
                total: number;
                usage: number;
            };
        };
        gemini: {
            status: 'healthy' | 'unhealthy' | 'unknown';
            configured: boolean;
        };
        memory: {
            used: number;
            total: number;
            usage: number;
        };
    };
}

export const GET: APIRoute = async ({ request }) => {
    const startTime = Date.now();

    try {
        const config = getStorageConfig();
        const healthStatus: HealthStatus = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: process.env.npm_package_version || '1.0.0',
            services: {
                storage: {
                    status: 'healthy',
                    uploadDir: {
                        accessible: false,
                        files: 0,
                        size: 0
                    },
                    tempDir: {
                        accessible: false,
                        files: 0,
                        size: 0
                    },
                    diskSpace: {
                        free: 0,
                        total: 0,
                        usage: 0
                    }
                },
                gemini: {
                    status: 'unknown',
                    configured: !!process.env.GEMINI_API_KEY
                },
                memory: {
                    used: 0,
                    total: 0,
                    usage: 0
                }
            }
        };

        // 检查存储状态
        try {
            const storageStats = await getStorageStats(config);
            const diskSpace = await checkDiskSpace(config.uploadDir);

            healthStatus.services.storage.uploadDir = {
                accessible: true,
                files: storageStats.uploadDir.files,
                size: storageStats.uploadDir.size
            };

            healthStatus.services.storage.tempDir = {
                accessible: true,
                files: storageStats.tempDir.files,
                size: storageStats.tempDir.size
            };

            healthStatus.services.storage.diskSpace = {
                free: diskSpace.free,
                total: diskSpace.total,
                usage: diskSpace.total > 0 ? (diskSpace.total - diskSpace.free) / diskSpace.total : 0
            };

            // 检查磁盘空间是否充足（低于90%使用率）
            if (healthStatus.services.storage.diskSpace.usage > 0.9) {
                healthStatus.services.storage.status = 'unhealthy';
                healthStatus.status = 'degraded';
            }

        } catch (error) {
            console.error('存储健康检查失败:', error);
            healthStatus.services.storage.status = 'unhealthy';
            healthStatus.status = 'degraded';
        }

        // 检查内存使用情况
        const memoryUsage = process.memoryUsage();
        healthStatus.services.memory = {
            used: memoryUsage.heapUsed,
            total: memoryUsage.heapTotal,
            usage: memoryUsage.heapUsed / memoryUsage.heapTotal
        };

        // 如果内存使用率超过90%，标记为降级状态
        if (healthStatus.services.memory.usage > 0.9) {
            healthStatus.status = 'degraded';
        }

        // 检查Gemini API配置
        if (healthStatus.services.gemini.configured) {
            healthStatus.services.gemini.status = 'healthy';
        } else {
            healthStatus.services.gemini.status = 'unhealthy';
            healthStatus.status = 'unhealthy';
        }

        // 确定整体状态
        const hasUnhealthyServices = Object.values(healthStatus.services).some(
            service => service.status === 'unhealthy'
        );

        if (hasUnhealthyServices) {
            healthStatus.status = 'unhealthy';
        }

        const responseTime = Date.now() - startTime;

        // 根据健康状态返回适当的HTTP状态码
        const httpStatus = healthStatus.status === 'healthy' ? 200 :
            healthStatus.status === 'degraded' ? 200 : 503;

        return new Response(JSON.stringify({
            ...healthStatus,
            responseTime
        }), {
            status: httpStatus,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        });

    } catch (error) {
        console.error('健康检查失败:', error);

        return new Response(JSON.stringify({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: '健康检查执行失败',
            responseTime: Date.now() - startTime
        }), {
            status: 503,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        });
    }
};

// 简化的健康检查端点（仅返回状态）
export const HEAD: APIRoute = async () => {
    try {
        // 快速检查关键服务
        const geminiConfigured = !!process.env.GEMINI_API_KEY;
        const memoryUsage = process.memoryUsage();
        const memoryUsageRatio = memoryUsage.heapUsed / memoryUsage.heapTotal;

        if (!geminiConfigured || memoryUsageRatio > 0.95) {
            return new Response(null, { status: 503 });
        }

        return new Response(null, { status: 200 });
    } catch (error) {
        return new Response(null, { status: 503 });
    }
};