/**
 * 性能监控工具
 * 监控页面加载性能、API响应时间、用户交互等
 */

export interface PerformanceMetrics {
    // 页面加载指标
    firstContentfulPaint?: number;
    largestContentfulPaint?: number;
    firstInputDelay?: number;
    cumulativeLayoutShift?: number;
    timeToInteractive?: number;

    // 自定义指标
    apiResponseTime?: number;
    imageLoadTime?: number;
    componentRenderTime?: number;

    // 用户体验指标
    userInteractionDelay?: number;
    errorRate?: number;

    // 资源加载指标
    totalResourceSize?: number;
    criticalResourceLoadTime?: number;
}

export class PerformanceMonitor {
    private metrics: PerformanceMetrics = {};
    private observers: PerformanceObserver[] = [];
    private startTimes: Map<string, number> = new Map();

    constructor() {
        this.init();
    }

    private init(): void {
        if (typeof window === 'undefined') return;

        this.observeWebVitals();
        this.observeResourceTiming();
        this.observeLongTasks();
        this.setupCustomMetrics();
    }

    private observeWebVitals(): void {
        // 观察 First Contentful Paint
        this.observePerformanceEntry('paint', (entries) => {
            entries.forEach((entry) => {
                if (entry.name === 'first-contentful-paint') {
                    this.metrics.firstContentfulPaint = entry.startTime;
                }
            });
        });

        // 观察 Largest Contentful Paint
        this.observePerformanceEntry('largest-contentful-paint', (entries) => {
            const lastEntry = entries[entries.length - 1];
            this.metrics.largestContentfulPaint = lastEntry.startTime;
        });

        // 观察 First Input Delay
        this.observePerformanceEntry('first-input', (entries) => {
            const firstInput = entries[0];
            this.metrics.firstInputDelay = firstInput.processingStart - firstInput.startTime;
        });

        // 观察 Cumulative Layout Shift
        this.observePerformanceEntry('layout-shift', (entries) => {
            let cumulativeScore = 0;
            entries.forEach((entry: any) => {
                if (!entry.hadRecentInput) {
                    cumulativeScore += entry.value;
                }
            });
            this.metrics.cumulativeLayoutShift = cumulativeScore;
        });
    }

    private observeResourceTiming(): void {
        this.observePerformanceEntry('resource', (entries) => {
            let totalSize = 0;
            let criticalResourceTime = 0;

            entries.forEach((entry: any) => {
                totalSize += entry.transferSize || 0;

                // 识别关键资源（CSS、JS、字体）
                if (this.isCriticalResource(entry.name)) {
                    criticalResourceTime = Math.max(criticalResourceTime, entry.responseEnd);
                }
            });

            this.metrics.totalResourceSize = totalSize;
            this.metrics.criticalResourceLoadTime = criticalResourceTime;
        });
    }

    private observeLongTasks(): void {
        this.observePerformanceEntry('longtask', (entries) => {
            // 记录长任务，影响用户交互
            entries.forEach((entry) => {
                console.warn(`Long task detected: ${entry.duration}ms`);
            });
        });
    }

    private observePerformanceEntry(
        entryType: string,
        callback: (entries: PerformanceEntry[]) => void
    ): void {
        try {
            const observer = new PerformanceObserver((list) => {
                callback(list.getEntries());
            });

            observer.observe({ entryTypes: [entryType] });
            this.observers.push(observer);
        } catch (error) {
            console.warn(`Performance observer for ${entryType} not supported:`, error);
        }
    }

    private isCriticalResource(url: string): boolean {
        return /\.(css|js|woff|woff2|ttf)$/i.test(url) ||
            url.includes('fonts.googleapis.com') ||
            url.includes('cdn.');
    }

    private setupCustomMetrics(): void {
        // 监控页面可交互时间
        document.addEventListener('DOMContentLoaded', () => {
            const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
            if (navigationEntry) {
                this.metrics.timeToInteractive = navigationEntry.domInteractive;
            }
        });

        // 监控图片加载时间
        document.addEventListener('imageLoaded', (event: any) => {
            const loadTime = performance.now() - (event.detail.startTime || 0);
            this.metrics.imageLoadTime = loadTime;
        });
    }

    // 开始计时
    public startTiming(label: string): void {
        this.startTimes.set(label, performance.now());
    }

    // 结束计时
    public endTiming(label: string): number {
        const startTime = this.startTimes.get(label);
        if (!startTime) {
            console.warn(`No start time found for label: ${label}`);
            return 0;
        }

        const duration = performance.now() - startTime;
        this.startTimes.delete(label);
        return duration;
    }

    // 记录API响应时间
    public recordApiResponse(duration: number): void {
        this.metrics.apiResponseTime = duration;
    }

    // 记录组件渲染时间
    public recordComponentRender(duration: number): void {
        this.metrics.componentRenderTime = duration;
    }

    // 记录用户交互延迟
    public recordUserInteraction(delay: number): void {
        this.metrics.userInteractionDelay = delay;
    }

    // 获取所有指标
    public getMetrics(): PerformanceMetrics {
        return { ...this.metrics };
    }

    // 获取性能评分
    public getPerformanceScore(): number {
        const weights = {
            firstContentfulPaint: 0.15,
            largestContentfulPaint: 0.25,
            firstInputDelay: 0.25,
            cumulativeLayoutShift: 0.25,
            timeToInteractive: 0.10
        };

        let score = 100;

        // FCP 评分 (0-2.5s 为好，2.5-4s 为中等，>4s 为差)
        if (this.metrics.firstContentfulPaint) {
            const fcp = this.metrics.firstContentfulPaint / 1000;
            if (fcp > 4) score -= weights.firstContentfulPaint * 40;
            else if (fcp > 2.5) score -= weights.firstContentfulPaint * 20;
        }

        // LCP 评分 (0-2.5s 为好，2.5-4s 为中等，>4s 为差)
        if (this.metrics.largestContentfulPaint) {
            const lcp = this.metrics.largestContentfulPaint / 1000;
            if (lcp > 4) score -= weights.largestContentfulPaint * 40;
            else if (lcp > 2.5) score -= weights.largestContentfulPaint * 20;
        }

        // FID 评分 (0-100ms 为好，100-300ms 为中等，>300ms 为差)
        if (this.metrics.firstInputDelay) {
            if (this.metrics.firstInputDelay > 300) score -= weights.firstInputDelay * 40;
            else if (this.metrics.firstInputDelay > 100) score -= weights.firstInputDelay * 20;
        }

        // CLS 评分 (0-0.1 为好，0.1-0.25 为中等，>0.25 为差)
        if (this.metrics.cumulativeLayoutShift) {
            if (this.metrics.cumulativeLayoutShift > 0.25) score -= weights.cumulativeLayoutShift * 40;
            else if (this.metrics.cumulativeLayoutShift > 0.1) score -= weights.cumulativeLayoutShift * 20;
        }

        // TTI 评分
        if (this.metrics.timeToInteractive) {
            const tti = this.metrics.timeToInteractive / 1000;
            if (tti > 5) score -= weights.timeToInteractive * 40;
            else if (tti > 3) score -= weights.timeToInteractive * 20;
        }

        return Math.max(0, Math.round(score));
    }

    // 生成性能报告
    public generateReport(): string {
        const metrics = this.getMetrics();
        const score = this.getPerformanceScore();

        return `
性能报告 (评分: ${score}/100)
================================

核心Web指标:
- First Contentful Paint: ${metrics.firstContentfulPaint ? (metrics.firstContentfulPaint / 1000).toFixed(2) + 's' : 'N/A'}
- Largest Contentful Paint: ${metrics.largestContentfulPaint ? (metrics.largestContentfulPaint / 1000).toFixed(2) + 's' : 'N/A'}
- First Input Delay: ${metrics.firstInputDelay ? metrics.firstInputDelay.toFixed(2) + 'ms' : 'N/A'}
- Cumulative Layout Shift: ${metrics.cumulativeLayoutShift ? metrics.cumulativeLayoutShift.toFixed(3) : 'N/A'}

其他指标:
- Time to Interactive: ${metrics.timeToInteractive ? (metrics.timeToInteractive / 1000).toFixed(2) + 's' : 'N/A'}
- API Response Time: ${metrics.apiResponseTime ? metrics.apiResponseTime.toFixed(2) + 'ms' : 'N/A'}
- Image Load Time: ${metrics.imageLoadTime ? metrics.imageLoadTime.toFixed(2) + 'ms' : 'N/A'}
- Total Resource Size: ${metrics.totalResourceSize ? (metrics.totalResourceSize / 1024).toFixed(2) + 'KB' : 'N/A'}

建议:
${this.generateRecommendations()}
    `.trim();
    }

    private generateRecommendations(): string {
        const recommendations: string[] = [];
        const metrics = this.getMetrics();

        if (metrics.firstContentfulPaint && metrics.firstContentfulPaint > 2500) {
            recommendations.push('- 优化首次内容绘制时间：压缩CSS/JS，使用CDN');
        }

        if (metrics.largestContentfulPaint && metrics.largestContentfulPaint > 2500) {
            recommendations.push('- 优化最大内容绘制时间：优化图片加载，使用懒加载');
        }

        if (metrics.firstInputDelay && metrics.firstInputDelay > 100) {
            recommendations.push('- 减少首次输入延迟：优化JavaScript执行，避免长任务');
        }

        if (metrics.cumulativeLayoutShift && metrics.cumulativeLayoutShift > 0.1) {
            recommendations.push('- 减少累积布局偏移：为图片和广告预留空间');
        }

        if (metrics.totalResourceSize && metrics.totalResourceSize > 1024 * 1024) {
            recommendations.push('- 减少资源大小：启用压缩，移除未使用的代码');
        }

        return recommendations.length > 0 ? recommendations.join('\n') : '- 性能表现良好！';
    }

    // 清理观察器
    public destroy(): void {
        this.observers.forEach(observer => observer.disconnect());
        this.observers = [];
        this.startTimes.clear();
    }
}

// 创建全局性能监控实例
export const performanceMonitor = new PerformanceMonitor();

// 为API请求添加性能监控装饰器
export function withPerformanceMonitoring<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    label: string
): T {
    return (async (...args: any[]) => {
        const startTime = performance.now();
        try {
            const result = await fn(...args);
            const duration = performance.now() - startTime;
            performanceMonitor.recordApiResponse(duration);
            console.log(`${label} completed in ${duration.toFixed(2)}ms`);
            return result;
        } catch (error) {
            const duration = performance.now() - startTime;
            console.error(`${label} failed after ${duration.toFixed(2)}ms:`, error);
            throw error;
        }
    }) as T;
}

// 组件渲染性能监控装饰器
export function measureRenderTime(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
        const startTime = performance.now();
        const result = originalMethod.apply(this, args);

        if (result instanceof Promise) {
            return result.then((res) => {
                const duration = performance.now() - startTime;
                performanceMonitor.recordComponentRender(duration);
                return res;
            });
        } else {
            const duration = performance.now() - startTime;
            performanceMonitor.recordComponentRender(duration);
            return result;
        }
    };

    return descriptor;
}

/**
 * 资源优化管理器
 */
export class ResourceOptimizer {
    private criticalResources: Set<string> = new Set();
    private preloadedResources: Set<string> = new Set();
    private deferredResources: Set<string> = new Set();

    constructor() {
        this.init();
    }

    private init(): void {
        this.setupResourceHints();
        this.optimizeFontLoading();
        this.setupIntersectionObserver();
    }

    /**
     * 设置资源提示
     */
    private setupResourceHints(): void {
        // 预连接到重要域名
        this.addResourceHint('preconnect', 'https://fonts.googleapis.com');
        this.addResourceHint('preconnect', 'https://fonts.gstatic.com');
        this.addResourceHint('dns-prefetch', 'https://api.gemini.com');
    }

    /**
     * 添加资源提示
     */
    private addResourceHint(rel: string, href: string): void {
        if (document.querySelector(`link[rel="${rel}"][href="${href}"]`)) {
            return; // 已存在
        }

        const link = document.createElement('link');
        link.rel = rel;
        link.href = href;

        if (rel === 'preconnect') {
            link.crossOrigin = 'anonymous';
        }

        document.head.appendChild(link);
    }

    /**
     * 优化字体加载
     */
    private optimizeFontLoading(): void {
        // 预加载关键字体
        const criticalFonts = [
            'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2'
        ];

        criticalFonts.forEach(font => {
            this.preloadResource(font, 'font');
        });

        // 使用font-display: swap
        const style = document.createElement('style');
        style.textContent = `
            @font-face {
                font-family: 'Inter';
                font-display: swap;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 预加载资源
     */
    public preloadResource(href: string, as: string): void {
        if (this.preloadedResources.has(href)) return;

        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = href;
        link.as = as;

        if (as === 'font') {
            link.crossOrigin = 'anonymous';
        }

        document.head.appendChild(link);
        this.preloadedResources.add(href);
    }

    /**
     * 延迟加载非关键资源
     */
    public deferResource(href: string): void {
        this.deferredResources.add(href);
    }

    /**
     * 设置交叉观察器用于懒加载
     */
    private setupIntersectionObserver(): void {
        if (!('IntersectionObserver' in window)) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.loadDeferredResource(entry.target as HTMLElement);
                    observer.unobserve(entry.target);
                }
            });
        }, {
            rootMargin: '50px'
        });

        // 观察所有带有data-defer属性的元素
        document.querySelectorAll('[data-defer]').forEach(el => {
            observer.observe(el);
        });
    }

    /**
     * 加载延迟资源
     */
    private loadDeferredResource(element: HTMLElement): void {
        const src = element.dataset.defer;
        if (!src) return;

        if (element.tagName === 'IMG') {
            (element as HTMLImageElement).src = src;
        } else if (element.tagName === 'SCRIPT') {
            (element as HTMLScriptElement).src = src;
        }

        element.removeAttribute('data-defer');
    }

    /**
     * 批量加载延迟资源
     */
    public loadDeferredResources(): void {
        if ('requestIdleCallback' in window) {
            (window as any).requestIdleCallback(() => {
                this.deferredResources.forEach(href => {
                    this.loadResource(href);
                });
            });
        } else {
            setTimeout(() => {
                this.deferredResources.forEach(href => {
                    this.loadResource(href);
                });
            }, 1000);
        }
    }

    /**
     * 加载单个资源
     */
    private loadResource(href: string): void {
        if (href.endsWith('.css')) {
            this.loadStylesheet(href);
        } else if (href.endsWith('.js')) {
            this.loadScript(href);
        }
    }

    /**
     * 加载样式表
     */
    private loadStylesheet(href: string): void {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
    }

    /**
     * 加载脚本
     */
    private loadScript(href: string): void {
        const script = document.createElement('script');
        script.src = href;
        script.async = true;
        document.head.appendChild(script);
    }
}

/**
 * 渐进式加载管理器
 */
export class ProgressiveLoader {
    private loadQueue: Array<() => Promise<void>> = [];
    private isLoading: boolean = false;
    private loadedModules: Set<string> = new Set();

    /**
     * 添加到加载队列
     */
    public enqueue(loader: () => Promise<void>): void {
        this.loadQueue.push(loader);
        this.processQueue();
    }

    /**
     * 处理加载队列
     */
    private async processQueue(): Promise<void> {
        if (this.isLoading || this.loadQueue.length === 0) return;

        this.isLoading = true;

        while (this.loadQueue.length > 0) {
            const loader = this.loadQueue.shift()!;

            try {
                await loader();
            } catch (error) {
                console.error('Progressive loading failed:', error);
            }

            // 在空闲时间处理下一个
            if ('requestIdleCallback' in window) {
                await new Promise(resolve => {
                    (window as any).requestIdleCallback(resolve);
                });
            } else {
                await new Promise(resolve => setTimeout(resolve, 16));
            }
        }

        this.isLoading = false;
    }

    /**
     * 动态导入模块
     */
    public async loadModule(modulePath: string): Promise<any> {
        if (this.loadedModules.has(modulePath)) {
            return Promise.resolve();
        }

        try {
            const module = await import(/* @vite-ignore */ modulePath);
            this.loadedModules.add(modulePath);
            return module;
        } catch (error) {
            console.error(`Failed to load module: ${modulePath}`, error);
            throw error;
        }
    }

    /**
     * 预加载关键模块
     */
    public preloadCriticalModules(): void {
        const criticalModules = [
            '/src/utils/image-optimizer.ts',
            '/src/utils/cache-manager.ts',
            '/src/components/banana-editor/ui/MobileControlPanel.astro'
        ];

        criticalModules.forEach(modulePath => {
            this.enqueue(() => this.loadModule(modulePath));
        });
    }

    /**
     * 基于路由预加载
     */
    public preloadForRoute(route: string): void {
        const routeModules: Record<string, string[]> = {
            '/editor': [
                '/src/components/banana-editor/ImageGenerator.astro',
                '/src/components/banana-editor/ImageFusion.astro'
            ],
            '/prompts': [
                '/src/components/banana-editor/PromptLibrary.astro'
            ]
        };

        const modules = routeModules[route] || [];
        modules.forEach(modulePath => {
            this.enqueue(() => this.loadModule(modulePath));
        });
    }
}

// 导出单例实例
export const resourceOptimizer = new ResourceOptimizer();
export const progressiveLoader = new ProgressiveLoader();

// 初始化性能优化
export function initializePerformanceOptimization(): void {
    // 页面加载完成后开始优化
    if (document.readyState === 'complete') {
        startOptimization();
    } else {
        window.addEventListener('load', startOptimization);
    }
}

function startOptimization(): void {
    // 延迟加载非关键资源
    resourceOptimizer.loadDeferredResources();

    // 预加载关键模块
    progressiveLoader.preloadCriticalModules();

    // 基于当前路由预加载
    const currentRoute = window.location.pathname;
    progressiveLoader.preloadForRoute(currentRoute);

    // 设置链接悬停预加载
    setupHoverPreloading();
}

function setupHoverPreloading(): void {
    document.addEventListener('mouseover', (e) => {
        const target = e.target as HTMLElement;
        const link = target.closest('a[href]') as HTMLAnchorElement;

        if (link && link.hostname === window.location.hostname) {
            const route = link.pathname;
            progressiveLoader.preloadForRoute(route);
        }
    });
}