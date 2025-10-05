/**
 * 离线状态检测和处理工具
 * 提供网络状态监控、离线缓存、数据同步等功能
 */

export interface OfflineConfig {
    enableNotifications?: boolean;
    enableCaching?: boolean;
    syncOnReconnect?: boolean;
    retryAttempts?: number;
    retryDelay?: number;
}

export interface CachedRequest {
    id: string;
    url: string;
    method: string;
    body?: any;
    headers?: Record<string, string>;
    timestamp: number;
    retryCount: number;
}

export class OfflineHandler {
    private isOnline: boolean = navigator.onLine;
    private config: Required<OfflineConfig>;
    private pendingRequests: CachedRequest[] = [];
    private cache: Cache | null = null;
    private syncInProgress: boolean = false;

    constructor(config: OfflineConfig = {}) {
        this.config = {
            enableNotifications: true,
            enableCaching: true,
            syncOnReconnect: true,
            retryAttempts: 3,
            retryDelay: 1000,
            ...config,
        };

        this.init();
    }

    private async init(): Promise<void> {
        // 初始化缓存
        if (this.config.enableCaching && 'caches' in window) {
            try {
                this.cache = await caches.open('ai-editor-offline-v1');
            } catch (error) {
                console.warn('Failed to initialize cache:', error);
            }
        }

        // 从localStorage恢复待同步的请求
        this.loadPendingRequests();

        // 监听网络状态变化
        this.setupNetworkListeners();

        // 如果启用通知，显示当前网络状态
        if (this.config.enableNotifications) {
            this.showNetworkStatus();
        }
    }

    private setupNetworkListeners(): void {
        window.addEventListener('online', () => {
            this.handleOnline();
        });

        window.addEventListener('offline', () => {
            this.handleOffline();
        });

        // 监听连接类型变化（如果支持）
        if ('connection' in navigator) {
            (navigator as any).connection.addEventListener('change', () => {
                this.handleConnectionChange();
            });
        }
    }

    private handleOnline(): void {
        this.isOnline = true;
        console.log('Network connection restored');

        if (this.config.enableNotifications) {
            this.showNotification('网络已连接', '正在同步离线数据...', 'success');
        }

        if (this.config.syncOnReconnect) {
            this.syncPendingRequests();
        }

        // 触发自定义事件
        this.dispatchEvent('online');
    }

    private handleOffline(): void {
        this.isOnline = false;
        console.log('Network connection lost');

        if (this.config.enableNotifications) {
            this.showNotification('网络已断开', '应用将在离线模式下运行', 'warning');
        }

        // 触发自定义事件
        this.dispatchEvent('offline');
    }

    private handleConnectionChange(): void {
        const connection = (navigator as any).connection;
        if (connection) {
            console.log(`Connection type: ${connection.effectiveType}, Speed: ${connection.downlink}Mbps`);

            // 根据连接质量调整行为
            if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
                this.dispatchEvent('slowConnection', { effectiveType: connection.effectiveType });
            }
        }
    }

    // 检查网络状态
    public isNetworkOnline(): boolean {
        return this.isOnline;
    }

    // 获取连接信息
    public getConnectionInfo(): any {
        if ('connection' in navigator) {
            const connection = (navigator as any).connection;
            return {
                effectiveType: connection.effectiveType,
                downlink: connection.downlink,
                rtt: connection.rtt,
                saveData: connection.saveData,
            };
        }
        return null;
    }

    // 缓存请求（离线时使用）
    public async cacheRequest(request: Request, response: Response): Promise<void> {
        if (!this.cache || !this.config.enableCaching) return;

        try {
            // 只缓存GET请求和成功响应
            if (request.method === 'GET' && response.ok) {
                await this.cache.put(request, response.clone());
            }
        } catch (error) {
            console.warn('Failed to cache request:', error);
        }
    }

    // 从缓存获取响应
    public async getCachedResponse(request: Request): Promise<Response | null> {
        if (!this.cache || !this.config.enableCaching) return null;

        try {
            const cachedResponse = await this.cache.match(request);
            if (cachedResponse) {
                console.log('Serving from cache:', request.url);
                return cachedResponse;
            }
        } catch (error) {
            console.warn('Failed to get cached response:', error);
        }

        return null;
    }

    // 添加待同步的请求
    public addPendingRequest(
        url: string,
        method: string,
        body?: any,
        headers?: Record<string, string>
    ): string {
        const id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const request: CachedRequest = {
            id,
            url,
            method,
            body,
            headers,
            timestamp: Date.now(),
            retryCount: 0,
        };

        this.pendingRequests.push(request);
        this.savePendingRequests();

        console.log(`Added pending request: ${method} ${url}`);
        return id;
    }

    // 同步待处理的请求
    public async syncPendingRequests(): Promise<void> {
        if (this.syncInProgress || !this.isOnline || this.pendingRequests.length === 0) {
            return;
        }

        this.syncInProgress = true;
        console.log(`Syncing ${this.pendingRequests.length} pending requests...`);

        const requestsToSync = [...this.pendingRequests];
        const successfulRequests: string[] = [];

        for (const request of requestsToSync) {
            try {
                const response = await fetch(request.url, {
                    method: request.method,
                    body: request.body ? JSON.stringify(request.body) : undefined,
                    headers: {
                        'Content-Type': 'application/json',
                        ...request.headers,
                    },
                });

                if (response.ok) {
                    successfulRequests.push(request.id);
                    console.log(`Successfully synced request: ${request.method} ${request.url}`);
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            } catch (error) {
                console.error(`Failed to sync request ${request.id}:`, error);

                // 增加重试次数
                request.retryCount++;

                // 如果超过最大重试次数，移除请求
                if (request.retryCount >= this.config.retryAttempts) {
                    successfulRequests.push(request.id);
                    console.warn(`Giving up on request ${request.id} after ${request.retryCount} attempts`);
                }
            }

            // 添加延迟避免过于频繁的请求
            await this.delay(this.config.retryDelay);
        }

        // 移除已成功同步的请求
        this.pendingRequests = this.pendingRequests.filter(
            req => !successfulRequests.includes(req.id)
        );
        this.savePendingRequests();

        this.syncInProgress = false;

        if (this.config.enableNotifications && successfulRequests.length > 0) {
            this.showNotification(
                '数据同步完成',
                `成功同步 ${successfulRequests.length} 个请求`,
                'success'
            );
        }

        // 触发同步完成事件
        this.dispatchEvent('syncComplete', {
            syncedCount: successfulRequests.length,
            remainingCount: this.pendingRequests.length,
        });
    }

    // 获取待同步请求数量
    public getPendingRequestCount(): number {
        return this.pendingRequests.length;
    }

    // 清除所有待同步请求
    public clearPendingRequests(): void {
        this.pendingRequests = [];
        this.savePendingRequests();
    }

    // 保存待同步请求到localStorage
    private savePendingRequests(): void {
        try {
            localStorage.setItem('ai-editor-pending-requests', JSON.stringify(this.pendingRequests));
        } catch (error) {
            console.warn('Failed to save pending requests:', error);
        }
    }

    // 从localStorage加载待同步请求
    private loadPendingRequests(): void {
        try {
            const saved = localStorage.getItem('ai-editor-pending-requests');
            if (saved) {
                this.pendingRequests = JSON.parse(saved);
                console.log(`Loaded ${this.pendingRequests.length} pending requests from storage`);
            }
        } catch (error) {
            console.warn('Failed to load pending requests:', error);
            this.pendingRequests = [];
        }
    }

    // 显示网络状态
    private showNetworkStatus(): void {
        const status = this.isOnline ? '在线' : '离线';
        const type = this.isOnline ? 'success' : 'warning';
        this.showNotification('网络状态', `当前状态：${status}`, type);
    }

    // 显示通知
    private showNotification(title: string, message: string, type: 'success' | 'warning' | 'error' | 'info'): void {
        // 这里可以集成现有的通知系统
        console.log(`[${type.toUpperCase()}] ${title}: ${message}`);

        // 如果有全局通知系统，可以调用它
        if ((window as any).showNotification) {
            (window as any).showNotification(type, title, message);
        }
    }

    // 触发自定义事件
    private dispatchEvent(eventName: string, detail?: any): void {
        const event = new CustomEvent(`offline-handler-${eventName}`, { detail });
        window.dispatchEvent(event);
    }

    // 延迟函数
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 清理资源
    public destroy(): void {
        window.removeEventListener('online', this.handleOnline);
        window.removeEventListener('offline', this.handleOffline);

        if ('connection' in navigator) {
            (navigator as any).connection.removeEventListener('change', this.handleConnectionChange);
        }
    }
}

// 创建全局离线处理实例
export const offlineHandler = new OfflineHandler();

// 网络请求包装器，自动处理离线情况
export async function fetchWithOfflineSupport(
    url: string,
    options: RequestInit = {}
): Promise<Response> {
    const request = new Request(url, options);

    // 如果在线，尝试正常请求
    if (offlineHandler.isNetworkOnline()) {
        try {
            const response = await fetch(request);

            // 缓存成功的响应
            if (response.ok) {
                await offlineHandler.cacheRequest(request, response);
            }

            return response;
        } catch (error) {
            console.warn('Network request failed, trying cache:', error);
        }
    }

    // 如果离线或请求失败，尝试从缓存获取
    const cachedResponse = await offlineHandler.getCachedResponse(request);
    if (cachedResponse) {
        return cachedResponse;
    }

    // 如果是POST/PUT/DELETE等修改请求，添加到待同步队列
    if (options.method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method.toUpperCase())) {
        const requestId = offlineHandler.addPendingRequest(
            url,
            options.method,
            options.body,
            options.headers as Record<string, string>
        );

        // 返回一个表示请求已排队的响应
        return new Response(
            JSON.stringify({
                success: true,
                message: 'Request queued for sync when online',
                requestId,
            }),
            {
                status: 202, // Accepted
                statusText: 'Queued for sync',
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }

    // 如果没有缓存且不是修改请求，抛出错误
    throw new Error('Network unavailable and no cached response found');
}

// 检查是否为慢速连接
export function isSlowConnection(): boolean {
    if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        return connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g';
    }
    return false;
}

// 根据连接速度调整图片质量
export function getOptimalImageQuality(): number {
    if (!offlineHandler.isNetworkOnline()) return 30; // 离线时使用最低质量

    const connectionInfo = offlineHandler.getConnectionInfo();
    if (connectionInfo) {
        switch (connectionInfo.effectiveType) {
            case 'slow-2g':
            case '2g':
                return 30;
            case '3g':
                return 50;
            case '4g':
            default:
                return 75;
        }
    }

    return 75; // 默认质量
}