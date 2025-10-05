/**
 * 静态模式辅助函数
 * 处理在静态构建模式下的API兼容性
 */

/**
 * 安全获取客户端地址
 */
export function getClientAddress(clientAddress?: string): string {
    try {
        return clientAddress || 'static-mode';
    } catch (error) {
        return 'static-mode';
    }
}

/**
 * 创建标准API响应
 */
export function createApiResponse(data: any, status: number = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
    });
}

/**
 * 创建错误响应
 */
export function createErrorResponse(error: string, code: string = 'UNKNOWN_ERROR', status: number = 500) {
    return createApiResponse({
        success: false,
        error: {
            code,
            message: error
        },
        timestamp: new Date()
    }, status);
}

/**
 * 创建成功响应
 */
export function createSuccessResponse(data: any) {
    return createApiResponse({
        success: true,
        data,
        timestamp: new Date()
    });
}