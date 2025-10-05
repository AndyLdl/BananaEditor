/**
 * 资源优化工具
 * 提供代码分割、资源预加载、压缩等功能
 */

export interface ResourceOptimizationConfig {
    enablePreloading?: boolean;
    enablePrefetching?: boolean;
    enableCompression?: boolean;
    criticalResourcesOnly?: boolean;
    maxConcurrentLoads?: number;
}

export class ResourceOptimizer {
    private config: Required<ResourceOptimizationConfig>;
    private loadingQueue: Map<string, Promise<any>> = new Map();
    private loadedResources: Set<string> = new Set();
    private criticalResources: Set<string> = new Set();

    constructor(config: ResourceOptimizationConfig = {}) {
        this.config = {
            enablePreloading: true,
            enablePrefetching: true,
            enableCompression: true,
            criticalResourcesOnly: false,
            maxConcurrentLoads: 6,
            ...config,
        };

        this.init();
    }

    private init(): void {
        this.identifyCriticalResources();
        this.setupResourceHints();
        this.optimizeExistingResources();
    }

    private identifyCriticalResources(): void {
        // 识别关键资源
        const criticalSelectors = [
            'link[rel="stylesheet"]',
            'script[src*="critical"]',
            'script[src*="main"]',
            'link[href*="font"]',
        ];

        criticalSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
                const resource = element.getAttribute('href') || element.getAttribute('src');
                if (resource) {
                    this.criticalResources.add(resource);
                }
            });
        });
    }

    private setupResourceHints(): void {
        if (!this.config.enablePreloading && !this.config.enablePrefetching) return;

        // 为关键资源添加预加载提示
        this.criticalResources.forEach(resource => {
            this.addResourceHint(resource, 'preload');
        });

        // 为可能需要的资源添加预获取提示
        const prefetchResources = [
            '/api/ai/prompts/categories.ts',
            '/api/ai/prompts/stats.ts',
        ];

        prefetchResources.forEach(resource => {
            this.addResourceHint(resource, 'prefetch');
        });
    }

    private addResourceHint(href: string, rel: 'preload' | 'prefetch' | 'dns-prefetch' | 'preconnect'): void {
        if (document.querySelector(`link[href="${href}"][rel="${rel}"]`)) return;

        const link = document.createElement('link');
        link.rel = rel;
        link.href = href;

        // 为预加载添加适当的 as 属性
        if (rel === 'preload') {
            if (href.endsWith('.css')) {
                link.as = 'style';
            } else if (href.endsWith('.js')) {
                link.as = 'script';
            } else if (href.match(/\.(woff|woff2|ttf|otf)$/)) {
                link.as = 'font';
                link.crossOrigin = 'anonymous';
            } else if (href.match(/\.(jpg|jpeg|png|webp|svg)$/)) {
                link.as = 'image';
            }
        }

        document.head.appendChild(link);
    }

    private optimizeExistingResources(): void {
        // 优化图片加载
        this.optimizeImages();

        // 优化字体加载
        this.optimizeFonts();

        // 优化脚本加载
        this.optimizeScripts();
    }

    private optimizeImages(): void {
        const images = document.querySelectorAll('img');
        images.forEach(img => {
            // 添加懒加载
            if (!img.hasAttribute('loading')) {
                img.loading = 'lazy';
            }

            // 添加解码提示
            if (!img.hasAttribute('decoding')) {
                img.decoding = 'async';
            }

            // 为关键图片添加预加载
            if (img.hasAttribute('data-critical')) {
                this.preloadImage(img.src);
            }
        });
    }

    private optimizeFonts(): void {
        const fontLinks = document.querySelectorAll('link[href*="font"]');
        fontLinks.forEach(link => {
            if (!link.hasAttribute('crossorigin')) {
                link.setAttribute('crossorigin', 'anonymous');
            }
        });
    }

    private optimizeScripts(): void {
        const scripts = document.querySelectorAll('script[src]');
        scripts.forEach(script => {
            // 为非关键脚本添加延迟加载
            if (!script.hasAttribute('async') && !script.hasAttribute('defer')) {
                const src = script.getAttribute('src');
                if (src && !this.criticalResources.has(src)) {
                    script.defer = true;
                }
            }
        });
    }

    // 预加载图片
    public preloadImage(src: string): Promise<HTMLImageElement> {
        if (this.loadingQueue.has(src)) {
            return this.loadingQueue.get(src)!;
        }

        const promise = new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.loadedResources.add(src);
                resolve(img);
            };
            img.onerror = reject;
            img.src = src;
        });

        this.loadingQueue.set(src, promise);
        return promise;
    }

    // 预加载CSS
    public preloadCSS(href: string): Promise<void> {
        if (this.loadingQueue.has(href)) {
            return this.loadingQueue.get(href)!;
        }

        const promise = new Promise<void>((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = () => {
                this.loadedResources.add(href);
                resolve();
            };
            link.onerror = reject;
            document.head.appendChild(link);
        });

        this.loadingQueue.set(href, promise);
        return promise;
    }

    // 预加载JavaScript
    public preloadScript(src: string): Promise<void> {
        if (this.loadingQueue.has(src)) {
            return this.loadingQueue.get(src)!;
        }

        const promise = new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = () => {
                this.loadedResources.add(src);
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });

        this.loadingQueue.set(src, promise);
        return promise;
    }

    // 动态导入模块（代码分割）
    public async loadModule<T = any>(modulePath: string): Promise<T> {
        if (this.loadingQueue.has(modulePath)) {
            return this.loadingQueue.get(modulePath)!;
        }

        const promise = import(modulePath).then(module => {
            this.loadedResources.add(modulePath);
            return module;
        });

        this.loadingQueue.set(modulePath, promise);
        return promise;
    }

    // 批量预加载资源
    public async preloadResources(resources: string[]): Promise<void> {
        const chunks = this.chunkArray(resources, this.config.maxConcurrentLoads);

        for (const chunk of chunks) {
            const promises = chunk.map(resource => {
                if (resource.endsWith('.css')) {
                    return this.preloadCSS(resource);
                } else if (resource.endsWith('.js')) {
                    return this.preloadScript(resource);
                } else if (resource.match(/\.(jpg|jpeg|png|webp|svg)$/)) {
                    return this.preloadImage(resource);
                } else {
                    return Promise.resolve();
                }
            });

            await Promise.allSettled(promises);
        }
    }

    // 压缩文本内容
    public compressText(text: string): string {
        if (!this.config.enableCompression) return text;

        return text
            .replace(/\s+/g, ' ') // 合并多个空格
            .replace(/\n\s*/g, '\n') // 移除行首空格
            .trim();
    }

    // 优化JSON数据
    public optimizeJSON(data: any): string {
        const jsonString = JSON.stringify(data);

        if (!this.config.enableCompression) return jsonString;

        // 移除不必要的空格和换行
        return jsonString.replace(/\s+/g, ' ').trim();
    }

    // 获取资源加载统计
    public getLoadingStats(): {
        totalRequested: number;
        totalLoaded: number;
        loadingProgress: number;
        criticalResourcesCount: number;
    } {
        const totalRequested = this.loadingQueue.size;
        const totalLoaded = this.loadedResources.size;

        return {
            totalRequested,
            totalLoaded,
            loadingProgress: totalRequested > 0 ? (totalLoaded / totalRequested) * 100 : 100,
            criticalResourcesCount: this.criticalResources.size,
        };
    }

    // 清理已完成的加载任务
    public cleanup(): void {
        const completedTasks: string[] = [];

        this.loadingQueue.forEach((promise, key) => {
            promise.then(() => {
                completedTasks.push(key);
            }).catch(() => {
                completedTasks.push(key);
            });
        });

        completedTasks.forEach(key => {
            this.loadingQueue.delete(key);
        });
    }

    // 工具函数：将数组分块
    private chunkArray<T>(array: T[], chunkSize: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    // 检查资源是否已加载
    public isResourceLoaded(resource: string): boolean {
        return this.loadedResources.has(resource);
    }

    // 获取关键资源列表
    public getCriticalResources(): string[] {
        return Array.from(this.criticalResources);
    }

    // 添加关键资源
    public addCriticalResource(resource: string): void {
        this.criticalResources.add(resource);
        if (this.config.enablePreloading) {
            this.addResourceHint(resource, 'preload');
        }
    }

    // 移除关键资源
    public removeCriticalResource(resource: string): void {
        this.criticalResources.delete(resource);
    }
}

// 创建全局资源优化器实例
export const resourceOptimizer = new ResourceOptimizer();

// 组件懒加载装饰器
export function lazyLoad(importFn: () => Promise<any>) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            // 动态导入组件
            const module = await importFn();

            // 如果模块有默认导出，使用它
            const Component = module.default || module;

            // 调用原始方法，传入加载的组件
            return originalMethod.call(this, Component, ...args);
        };

        return descriptor;
    };
}

// 图片优化函数
export function optimizeImageUrl(
    src: string,
    options: {
        width?: number;
        height?: number;
        quality?: number;
        format?: 'webp' | 'avif' | 'jpg' | 'png';
    } = {}
): string {
    const { width, height, quality = 75, format } = options;

    const url = new URL(src, window.location.origin);

    if (width) url.searchParams.set('w', width.toString());
    if (height) url.searchParams.set('h', height.toString());
    if (quality !== 75) url.searchParams.set('q', quality.toString());
    if (format) url.searchParams.set('f', format);

    return url.toString();
}

// 检测浏览器支持的图片格式
export function getSupportedImageFormat(): 'avif' | 'webp' | 'jpg' {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;

    // 检测AVIF支持
    if (canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0) {
        return 'avif';
    }

    // 检测WebP支持
    if (canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0) {
        return 'webp';
    }

    return 'jpg';
}