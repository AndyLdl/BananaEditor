// performance-init.ts - 性能优化统一初始化
// 整合所有性能优化工具的初始化

import { setupLazyLoading } from './image-optimizer';
import { initializeCodeSplitting } from './component-loader';
import { initializeCacheManager } from './cache-manager';
import { initializePerformanceOptimization } from './performance-monitor';

/**
 * 性能优化配置
 */
export interface PerformanceConfig {
    // 图片优化配置
    imageOptimization: {
        enabled: boolean;
        quality: number;
        lazyLoading: boolean;
        webpSupport: boolean;
    };

    // 代码分割配置
    codeSplitting: {
        enabled: boolean;
        preloadOnHover: boolean;
        preloadOnIdle: boolean;
    };

    // 缓存配置
    caching: {
        enabled: boolean;
        apiCacheTTL: number;
        imageCacheTTL: number;
        componentCacheTTL: number;
    };

    // 性能监控配置
    monitoring: {
        enabled: boolean;
        reportInterval: number;
        trackUserInteractions: boolean;
    };
}

/**
 * 默认性能配置
 */
const defaultConfig: PerformanceConfig = {
    imageOptimization: {
        enabled: true,
        quality: 0.8,
        lazyLoading: true,
        webpSupport: true
    },
    codeSplitting: {
        enabled: true,
        preloadOnHover: true,
        preloadOnIdle: true
    },
    caching: {
        enabled: true,
        apiCacheTTL: 300000, // 5分钟
        imageCacheTTL: 3600000, // 1小时
        componentCacheTTL: 1800000 // 30分钟
    },
    monitoring: {
        enabled: true,
        reportInterval: 30000, // 30秒
        trackUserInteractions: true
    }
};

/**
 * 性能优化管理器
 */
export class PerformanceManager {
    private config: PerformanceConfig;
    private initialized: boolean = false;
    private observers: Map<string, any> = new Map();

    constructor(config: Partial<PerformanceConfig> = {}) {
        this.config = { ...defaultConfig, ...config };
    }

    /**
     * 初始化所有性能优化
     */
    public async initialize(): Promise<void> {
        if (this.initialized) return;

        console.log('🚀 初始化性能优化系统...');

        try {
            // 并行初始化各个模块
            await Promise.all([
                this.initializeImageOptimization(),
                this.initializeCodeSplitting(),
                this.initializeCaching(),
                this.initializeMonitoring()
            ]);

            this.setupPerformanceObservers();
            this.setupResourceHints();
            this.optimizeCriticalRenderingPath();

            this.initialized = true;
            console.log('✅ 性能优化系统初始化完成');

            // 发送初始化完成事件
            document.dispatchEvent(new CustomEvent('performance:initialized', {
                detail: { config: this.config }
            }));

        } catch (error) {
            console.error('❌ 性能优化系统初始化失败:', error);
            throw error;
        }
    }

    /**
     * 初始化图片优化
     */
    private async initializeImageOptimization(): Promise<void> {
        if (!this.config.imageOptimization.enabled) return;

        console.log('📸 初始化图片优化...');

        // 设置懒加载
        if (this.config.imageOptimization.lazyLoading) {
            setupLazyLoading({
                rootMargin: '50px',
                threshold: 0.1,
                fadeIn: true
            });
        }

        // 检测WebP支持并设置
        if (this.config.imageOptimization.webpSupport) {
            const { ImageOptimizer } = await import('./image-optimizer');
            const supportsWebP = await ImageOptimizer.supportsWebP();

            if (supportsWebP) {
                document.documentElement.classList.add('webp-support');
            }
        }

        console.log('✅ 图片优化初始化完成');
    }

    /**
     * 初始化代码分割
     */
    private async initializeCodeSplitting(): Promise<void> {
        if (!this.config.codeSplitting.enabled) return;

        console.log('📦 初始化代码分割...');

        initializeCodeSplitting();

        console.log('✅ 代码分割初始化完成');
    }

    /**
     * 初始化缓存管理
     */
    private async initializeCaching(): Promise<void> {
        if (!this.config.caching.enabled) return;

        console.log('💾 初始化缓存管理...');

        initializeCacheManager();

        console.log('✅ 缓存管理初始化完成');
    }

    /**
     * 初始化性能监控
     */
    private async initializeMonitoring(): Promise<void> {
        if (!this.config.monitoring.enabled) return;

        console.log('📊 初始化性能监控...');

        initializePerformanceOptimization();

        console.log('✅ 性能监控初始化完成');
    }

    /**
     * 设置性能观察器
     */
    private setupPerformanceObservers(): void {
        // 监控长任务
        if ('PerformanceObserver' in window) {
            try {
                const longTaskObserver = new PerformanceObserver((list) => {
                    list.getEntries().forEach((entry) => {
                        if (entry.duration > 50) {
                            console.warn(`⚠️ 长任务检测: ${entry.duration.toFixed(2)}ms`);

                            // 发送长任务事件
                            document.dispatchEvent(new CustomEvent('performance:longtask', {
                                detail: { duration: entry.duration, entry }
                            }));
                        }
                    });
                });

                longTaskObserver.observe({ entryTypes: ['longtask'] });
                this.observers.set('longtask', longTaskObserver);
            } catch (error) {
                console.warn('长任务观察器不支持:', error);
            }
        }

        // 监控内存使用
        if ('memory' in performance) {
            const checkMemory = () => {
                const memory = (performance as any).memory;
                const usedPercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;

                if (usedPercent > 80) {
                    console.warn(`⚠️ 内存使用过高: ${usedPercent.toFixed(1)}%`);

                    // 触发垃圾回收建议
                    document.dispatchEvent(new CustomEvent('performance:memory-warning', {
                        detail: { usedPercent, memory }
                    }));
                }
            };

            setInterval(checkMemory, 10000); // 每10秒检查一次
        }
    }

    /**
     * 设置资源提示
     */
    private setupResourceHints(): void {
        // 预连接到重要域名
        const importantDomains = [
            'https://fonts.googleapis.com',
            'https://fonts.gstatic.com',
            'https://api.gemini.com'
        ];

        importantDomains.forEach(domain => {
            this.addResourceHint('preconnect', domain);
        });

        // DNS预解析
        const dnsPrefetchDomains = [
            'https://cdn.jsdelivr.net',
            'https://unpkg.com'
        ];

        dnsPrefetchDomains.forEach(domain => {
            this.addResourceHint('dns-prefetch', domain);
        });
    }

    /**
     * 添加资源提示
     */
    private addResourceHint(rel: string, href: string): void {
        if (document.querySelector(`link[rel="${rel}"][href="${href}"]`)) {
            return;
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
     * 优化关键渲染路径
     */
    private optimizeCriticalRenderingPath(): void {
        // 内联关键CSS
        this.inlineCriticalCSS();

        // 延迟加载非关键CSS
        this.deferNonCriticalCSS();

        // 优化字体加载
        this.optimizeFontLoading();
    }

    /**
     * 内联关键CSS
     */
    private inlineCriticalCSS(): void {
        // 这里可以添加关键CSS内联逻辑
        // 通常在构建时处理，这里只是示例
        const criticalCSS = `
      /* 关键CSS - 首屏渲染必需 */
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
      .banana-gradient { background: linear-gradient(135deg, #ffd700 0%, #ffa500 100%); }
    `;

        const style = document.createElement('style');
        style.textContent = criticalCSS;
        document.head.appendChild(style);
    }

    /**
     * 延迟加载非关键CSS
     */
    private deferNonCriticalCSS(): void {
        const nonCriticalCSS = [
            '/styles/animations.css',
            '/styles/print.css'
        ];

        // 在页面加载完成后加载
        window.addEventListener('load', () => {
            nonCriticalCSS.forEach(href => {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = href;
                link.media = 'print';
                link.onload = () => {
                    link.media = 'all';
                };
                document.head.appendChild(link);
            });
        });
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
            const link = document.createElement('link');
            link.rel = 'preload';
            link.href = font;
            link.as = 'font';
            link.type = 'font/woff2';
            link.crossOrigin = 'anonymous';
            document.head.appendChild(link);
        });

        // 添加font-display: swap
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
     * 获取性能报告
     */
    public async getPerformanceReport(): Promise<any> {
        const { performanceMonitor } = await import('./performance-monitor');
        return performanceMonitor.generateReport();
    }

    /**
     * 优化建议
     */
    public async getOptimizationSuggestions(): Promise<string[]> {
        const suggestions: string[] = [];

        // 检查图片优化
        const images = document.querySelectorAll('img');
        let unoptimizedImages = 0;

        images.forEach(img => {
            if (!img.loading || img.loading !== 'lazy') {
                unoptimizedImages++;
            }
        });

        if (unoptimizedImages > 0) {
            suggestions.push(`发现 ${unoptimizedImages} 张图片未启用懒加载`);
        }

        // 检查缓存
        const { getCacheSize } = await import('./cache-manager');
        const cacheSize = getCacheSize();

        if (cacheSize.localStorage > 5 * 1024 * 1024) { // 5MB
            suggestions.push('本地存储缓存过大，建议清理');
        }

        // 检查性能指标
        const { performanceMonitor } = await import('./performance-monitor');
        const score = performanceMonitor.getPerformanceScore();

        if (score < 70) {
            suggestions.push('页面性能评分较低，建议优化关键渲染路径');
        }

        return suggestions;
    }

    /**
     * 清理资源
     */
    public cleanup(): void {
        this.observers.forEach((observer) => {
            if (observer && typeof observer.disconnect === 'function') {
                observer.disconnect();
            }
        });
        this.observers.clear();
        this.initialized = false;
    }
}

// 导出单例实例
export const performanceManager = new PerformanceManager();

// 自动初始化函数
export async function initializePerformance(config?: Partial<PerformanceConfig>): Promise<void> {
    if (config) {
        const manager = new PerformanceManager(config);
        await manager.initialize();
    } else {
        await performanceManager.initialize();
    }
}

// 页面加载时自动初始化
// 注释掉自动初始化，避免与页面手动调用冲突导致重复初始化
// if (typeof window !== 'undefined') {
//     if (document.readyState === 'loading') {
//         document.addEventListener('DOMContentLoaded', () => {
//             initializePerformance().catch(console.error);
//         });
//     } else {
//         initializePerformance().catch(console.error);
//     }
// }