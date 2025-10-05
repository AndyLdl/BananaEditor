// cache-manager.ts - API响应缓存和本地存储管理工具
// 提供多层缓存、离线存储、数据同步等功能

export interface CacheOptions {
    ttl?: number; // 生存时间（毫秒）
    maxSize?: number; // 最大缓存大小
    storage?: 'memory' | 'localStorage' | 'sessionStorage' | 'indexedDB';
    compress?: boolean; // 是否压缩数据
    encrypt?: boolean; // 是否加密数据
}

export interface CacheItem<T = any> {
    data: T;
    timestamp: number;
    ttl: number;
    size: number;
    compressed?: boolean;
    encrypted?: boolean;
}

export interface CacheStats {
    size: number;
    count: number;
    hitRate: number;
    missRate: number;
    totalRequests: number;
}

/**
 * 内存缓存管理器
 */
export class MemoryCache {
    private cache: Map<string, CacheItem> = new Map();
    private maxSize: number;
    private stats = {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0
    };

    constructor(maxSize: number = 100) {
        this.maxSize = maxSize;
    }

    /**
     * 设置缓存项
     */
    public set<T>(key: string, data: T, ttl: number = 300000): void {
        // 清理过期项
        this.cleanup();

        // 如果缓存已满，删除最旧的项
        if (this.cache.size >= this.maxSize) {
            this.evictOldest();
        }

        const item: CacheItem<T> = {
            data,
            timestamp: Date.now(),
            ttl,
            size: this.calculateSize(data)
        };

        this.cache.set(key, item);
        this.stats.sets++;
    }

    /**
     * 获取缓存项
     */
    public get<T>(key: string): T | null {
        const item = this.cache.get(key);

        if (!item) {
            this.stats.misses++;
            return null;
        }

        // 检查是否过期
        if (Date.now() - item.timestamp > item.ttl) {
            this.cache.delete(key);
            this.stats.misses++;
            return null;
        }

        this.stats.hits++;
        return item.data as T;
    }

    /**
     * 删除缓存项
     */
    public delete(key: string): boolean {
        const deleted = this.cache.delete(key);
        if (deleted) {
            this.stats.deletes++;
        }
        return deleted;
    }

    /**
     * 检查缓存项是否存在且未过期
     */
    public has(key: string): boolean {
        const item = this.cache.get(key);
        if (!item) return false;

        if (Date.now() - item.timestamp > item.ttl) {
            this.cache.delete(key);
            return false;
        }

        return true;
    }

    /**
     * 清空缓存
     */
    public clear(): void {
        this.cache.clear();
        this.resetStats();
    }

    /**
     * 清理过期项
     */
    public cleanup(): void {
        const now = Date.now();
        for (const [key, item] of this.cache.entries()) {
            if (now - item.timestamp > item.ttl) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * 驱逐最旧的项
     */
    private evictOldest(): void {
        let oldestKey: string | null = null;
        let oldestTime = Date.now();

        for (const [key, item] of this.cache.entries()) {
            if (item.timestamp < oldestTime) {
                oldestTime = item.timestamp;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
        }
    }

    /**
     * 计算数据大小
     */
    private calculateSize(data: any): number {
        try {
            return JSON.stringify(data).length;
        } catch {
            return 0;
        }
    }

    /**
     * 获取缓存统计
     */
    public getStats(): CacheStats {
        const totalRequests = this.stats.hits + this.stats.misses;
        return {
            size: this.cache.size,
            count: this.cache.size,
            hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
            missRate: totalRequests > 0 ? this.stats.misses / totalRequests : 0,
            totalRequests
        };
    }

    /**
     * 重置统计
     */
    private resetStats(): void {
        this.stats = { hits: 0, misses: 0, sets: 0, deletes: 0 };
    }
}

/**
 * 本地存储缓存管理器
 */
export class LocalStorageCache {
    private prefix: string;
    private storage: Storage;

    constructor(prefix: string = 'banana_cache_', useSessionStorage: boolean = false) {
        this.prefix = prefix;
        this.storage = useSessionStorage ? sessionStorage : localStorage;
    }

    /**
     * 设置缓存项
     */
    public set<T>(key: string, data: T, ttl: number = 3600000): void {
        try {
            const item: CacheItem<T> = {
                data,
                timestamp: Date.now(),
                ttl,
                size: this.calculateSize(data)
            };

            const serialized = JSON.stringify(item);
            this.storage.setItem(this.prefix + key, serialized);
        } catch (error) {
            console.warn('LocalStorage缓存设置失败:', error);
            // 如果存储空间不足，清理过期项后重试
            this.cleanup();
            try {
                const item: CacheItem<T> = {
                    data,
                    timestamp: Date.now(),
                    ttl,
                    size: this.calculateSize(data)
                };
                this.storage.setItem(this.prefix + key, JSON.stringify(item));
            } catch (retryError) {
                console.error('LocalStorage缓存重试失败:', retryError);
            }
        }
    }

    /**
     * 获取缓存项
     */
    public get<T>(key: string): T | null {
        try {
            const serialized = this.storage.getItem(this.prefix + key);
            if (!serialized) return null;

            const item: CacheItem<T> = JSON.parse(serialized);

            // 检查是否过期
            if (Date.now() - item.timestamp > item.ttl) {
                this.storage.removeItem(this.prefix + key);
                return null;
            }

            return item.data;
        } catch (error) {
            console.warn('LocalStorage缓存读取失败:', error);
            return null;
        }
    }

    /**
     * 删除缓存项
     */
    public delete(key: string): void {
        this.storage.removeItem(this.prefix + key);
    }

    /**
     * 检查缓存项是否存在
     */
    public has(key: string): boolean {
        return this.get(key) !== null;
    }

    /**
     * 清空所有缓存
     */
    public clear(): void {
        const keys = Object.keys(this.storage);
        keys.forEach(key => {
            if (key.startsWith(this.prefix)) {
                this.storage.removeItem(key);
            }
        });
    }

    /**
     * 清理过期项
     */
    public cleanup(): void {
        const keys = Object.keys(this.storage);
        const now = Date.now();

        keys.forEach(key => {
            if (key.startsWith(this.prefix)) {
                try {
                    const serialized = this.storage.getItem(key);
                    if (serialized) {
                        const item: CacheItem = JSON.parse(serialized);
                        if (now - item.timestamp > item.ttl) {
                            this.storage.removeItem(key);
                        }
                    }
                } catch (error) {
                    // 如果解析失败，删除该项
                    this.storage.removeItem(key);
                }
            }
        });
    }

    /**
     * 获取缓存大小
     */
    public getSize(): number {
        let totalSize = 0;
        const keys = Object.keys(this.storage);

        keys.forEach(key => {
            if (key.startsWith(this.prefix)) {
                const value = this.storage.getItem(key);
                if (value) {
                    totalSize += value.length;
                }
            }
        });

        return totalSize;
    }

    /**
     * 计算数据大小
     */
    private calculateSize(data: any): number {
        try {
            return JSON.stringify(data).length;
        } catch {
            return 0;
        }
    }
}

/**
 * IndexedDB缓存管理器
 */
export class IndexedDBCache {
    private dbName: string;
    private storeName: string;
    private version: number;
    private db: IDBDatabase | null = null;

    constructor(dbName: string = 'BananaEditorCache', storeName: string = 'cache', version: number = 1) {
        this.dbName = dbName;
        this.storeName = storeName;
        this.version = version;
    }

    /**
     * 初始化数据库
     */
    public async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                reject(new Error('IndexedDB打开失败'));
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    /**
     * 设置缓存项
     */
    public async set<T>(key: string, data: T, ttl: number = 3600000): Promise<void> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const item = {
                key,
                data,
                timestamp: Date.now(),
                ttl,
                size: this.calculateSize(data)
            };

            const request = store.put(item);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error('IndexedDB写入失败'));
        });
    }

    /**
     * 获取缓存项
     */
    public async get<T>(key: string): Promise<T | null> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(key);

            request.onsuccess = () => {
                const item = request.result;

                if (!item) {
                    resolve(null);
                    return;
                }

                // 检查是否过期
                if (Date.now() - item.timestamp > item.ttl) {
                    this.delete(key);
                    resolve(null);
                    return;
                }

                resolve(item.data);
            };

            request.onerror = () => reject(new Error('IndexedDB读取失败'));
        });
    }

    /**
     * 删除缓存项
     */
    public async delete(key: string): Promise<void> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(key);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error('IndexedDB删除失败'));
        });
    }

    /**
     * 清理过期项
     */
    public async cleanup(): Promise<void> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.openCursor();
            const now = Date.now();

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result;

                if (cursor) {
                    const item = cursor.value;
                    if (now - item.timestamp > item.ttl) {
                        cursor.delete();
                    }
                    cursor.continue();
                } else {
                    resolve();
                }
            };

            request.onerror = () => reject(new Error('IndexedDB清理失败'));
        });
    }

    /**
     * 计算数据大小
     */
    private calculateSize(data: any): number {
        try {
            return JSON.stringify(data).length;
        } catch {
            return 0;
        }
    }
}

/**
 * 多层缓存管理器
 */
export class MultiLevelCache {
    private memoryCache: MemoryCache;
    private localStorageCache: LocalStorageCache;
    private indexedDBCache: IndexedDBCache;
    private defaultOptions: CacheOptions;

    constructor(options: CacheOptions = {}) {
        this.defaultOptions = {
            ttl: 300000, // 5分钟
            maxSize: 100,
            storage: 'memory',
            compress: false,
            encrypt: false,
            ...options
        };

        this.memoryCache = new MemoryCache(this.defaultOptions.maxSize);
        this.localStorageCache = new LocalStorageCache();
        this.indexedDBCache = new IndexedDBCache();
    }

    /**
     * 设置缓存项
     */
    public async set<T>(key: string, data: T, options?: CacheOptions): Promise<void> {
        const opts = { ...this.defaultOptions, ...options };

        // 内存缓存（最快）
        this.memoryCache.set(key, data, opts.ttl!);

        // 根据配置选择持久化存储
        switch (opts.storage) {
            case 'localStorage':
                this.localStorageCache.set(key, data, opts.ttl!);
                break;
            case 'sessionStorage':
                new LocalStorageCache('banana_session_', true).set(key, data, opts.ttl!);
                break;
            case 'indexedDB':
                await this.indexedDBCache.set(key, data, opts.ttl!);
                break;
        }
    }

    /**
     * 获取缓存项
     */
    public async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
        const opts = { ...this.defaultOptions, ...options };

        // 首先尝试内存缓存
        let data = this.memoryCache.get<T>(key);
        if (data !== null) {
            return data;
        }

        // 然后尝试持久化存储
        switch (opts.storage) {
            case 'localStorage':
                data = this.localStorageCache.get<T>(key);
                break;
            case 'sessionStorage':
                data = new LocalStorageCache('banana_session_', true).get<T>(key);
                break;
            case 'indexedDB':
                data = await this.indexedDBCache.get<T>(key);
                break;
        }

        // 如果在持久化存储中找到，同时更新内存缓存
        if (data !== null) {
            this.memoryCache.set(key, data, opts.ttl!);
        }

        return data;
    }

    /**
     * 删除缓存项
     */
    public async delete(key: string): Promise<void> {
        this.memoryCache.delete(key);
        this.localStorageCache.delete(key);
        new LocalStorageCache('banana_session_', true).delete(key);
        await this.indexedDBCache.delete(key);
    }

    /**
     * 清理所有缓存
     */
    public async cleanup(): Promise<void> {
        this.memoryCache.cleanup();
        this.localStorageCache.cleanup();
        new LocalStorageCache('banana_session_', true).cleanup();
        await this.indexedDBCache.cleanup();
    }

    /**
     * 获取缓存统计
     */
    public getStats(): CacheStats {
        return this.memoryCache.getStats();
    }
}

/**
 * API响应缓存管理器
 */
export class APICache {
    private cache: MultiLevelCache;
    private requestQueue: Map<string, Promise<any>> = new Map();

    constructor(options?: CacheOptions) {
        this.cache = new MultiLevelCache(options);
    }

    /**
     * 缓存API请求
     */
    public async request<T>(
        url: string,
        options: RequestInit = {},
        cacheOptions?: CacheOptions
    ): Promise<T> {
        const cacheKey = this.generateCacheKey(url, options);

        // 检查缓存
        const cached = await this.cache.get<T>(cacheKey, cacheOptions);
        if (cached !== null) {
            return cached;
        }

        // 检查是否正在请求中
        if (this.requestQueue.has(cacheKey)) {
            return this.requestQueue.get(cacheKey);
        }

        // 发起新请求
        const requestPromise = this.performRequest<T>(url, options);
        this.requestQueue.set(cacheKey, requestPromise);

        try {
            const result = await requestPromise;

            // 缓存结果
            await this.cache.set(cacheKey, result, cacheOptions);

            return result;
        } finally {
            this.requestQueue.delete(cacheKey);
        }
    }

    /**
     * 执行实际请求
     */
    private async performRequest<T>(url: string, options: RequestInit): Promise<T> {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
        }

        return response.json();
    }

    /**
     * 生成缓存键
     */
    private generateCacheKey(url: string, options: RequestInit): string {
        const method = options.method || 'GET';
        const body = options.body ? JSON.stringify(options.body) : '';
        const headers = JSON.stringify(options.headers || {});

        return `${method}:${url}:${this.hashString(body + headers)}`;
    }

    /**
     * 字符串哈希
     */
    private hashString(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return hash.toString(36);
    }

    /**
     * 清除特定URL的缓存
     */
    public async clearCache(urlPattern?: string): Promise<void> {
        if (urlPattern) {
            // TODO: 实现模式匹配清除
            console.warn('模式匹配清除缓存功能待实现');
        } else {
            await this.cache.cleanup();
        }
    }
}

// 导出单例实例
export const memoryCache = new MemoryCache();
export const localStorageCache = new LocalStorageCache();
export const multiLevelCache = new MultiLevelCache();
export const apiCache = new APICache({
    ttl: 300000, // 5分钟
    storage: 'localStorage'
});

// 初始化函数
export function initializeCacheManager(): void {
    // 定期清理过期缓存
    setInterval(() => {
        memoryCache.cleanup();
        localStorageCache.cleanup();
    }, 60000); // 每分钟清理一次

    // 页面卸载时清理内存缓存
    window.addEventListener('beforeunload', () => {
        memoryCache.clear();
    });

    // 监听存储空间不足事件
    window.addEventListener('storage', (e) => {
        if (e.key === null) {
            // 存储被清空，重新初始化
            localStorageCache.clear();
        }
    });
}

// 工具函数
export function createCacheKey(...parts: string[]): string {
    return parts.join(':');
}

export function getCacheSize(): {
    memory: number;
    localStorage: number;
} {
    return {
        memory: memoryCache.getStats().size,
        localStorage: localStorageCache.getSize()
    };
}