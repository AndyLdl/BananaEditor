// component-loader.ts - 组件代码分割和按需加载工具
// 提供动态组件加载、代码分割、预加载等功能

export interface ComponentLoadOptions {
    timeout?: number;
    retries?: number;
    preload?: boolean;
    cache?: boolean;
}

export interface LoadedComponent {
    component: any;
    timestamp: number;
    size?: number;
}

/**
 * 组件加载器
 */
export class ComponentLoader {
    private cache: Map<string, LoadedComponent> = new Map();
    private loading: Map<string, Promise<any>> = new Map();
    private preloadQueue: Set<string> = new Set();
    private loadingStates: Map<string, boolean> = new Map();

    /**
     * 动态加载组件
     */
    public async loadComponent(
        path: string,
        options: ComponentLoadOptions = {}
    ): Promise<any> {
        const {
            timeout = 10000,
            retries = 3,
            preload = false,
            cache = true
        } = options;

        // 检查缓存
        if (cache && this.cache.has(path)) {
            const cached = this.cache.get(path)!;
            // 检查缓存是否过期（24小时）
            if (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
                return cached.component;
            } else {
                this.cache.delete(path);
            }
        }

        // 检查是否正在加载
        if (this.loading.has(path)) {
            return this.loading.get(path);
        }

        // 开始加载
        const loadPromise = this.performLoad(path, timeout, retries);
        this.loading.set(path, loadPromise);
        this.loadingStates.set(path, true);

        try {
            const component = await loadPromise;

            // 缓存组件
            if (cache) {
                this.cache.set(path, {
                    component,
                    timestamp: Date.now(),
                    size: this.estimateComponentSize(component)
                });
            }

            return component;
        } finally {
            this.loading.delete(path);
            this.loadingStates.set(path, false);
        }
    }

    /**
     * 执行实际加载
     */
    private async performLoad(
        path: string,
        timeout: number,
        retries: number
    ): Promise<any> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                return await this.loadWithTimeout(path, timeout);
            } catch (error) {
                lastError = error as Error;

                if (attempt < retries) {
                    // 指数退避
                    const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
                    await this.delay(delay);
                }
            }
        }

        throw lastError || new Error(`组件加载失败: ${path}`);
    }

    /**
     * 带超时的加载
     */
    private loadWithTimeout(path: string, timeout: number): Promise<any> {
        return Promise.race([
            this.dynamicImport(path),
            new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`组件加载超时: ${path}`));
                }, timeout);
            })
        ]);
    }

    /**
     * 动态导入
     */
    private async dynamicImport(path: string): Promise<any> {
        try {
            // 根据路径类型选择加载方式
            if (path.startsWith('http')) {
                // 外部模块
                return await this.loadExternalModule(path);
            } else {
                // 本地模块
                return await import(/* @vite-ignore */ path);
            }
        } catch (error) {
            throw new Error(`动态导入失败: ${path} - ${error}`);
        }
    }

    /**
     * 加载外部模块
     */
    private async loadExternalModule(url: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.type = 'module';
            script.src = url;

            script.onload = () => {
                document.head.removeChild(script);
                resolve(window);
            };

            script.onerror = () => {
                document.head.removeChild(script);
                reject(new Error(`外部模块加载失败: ${url}`));
            };

            document.head.appendChild(script);
        });
    }

    /**
     * 预加载组件
     */
    public preloadComponent(path: string): Promise<void> {
        if (this.preloadQueue.has(path) || this.cache.has(path)) {
            return Promise.resolve();
        }

        this.preloadQueue.add(path);

        return this.loadComponent(path, { preload: true })
            .then(() => {
                this.preloadQueue.delete(path);
            })
            .catch((error) => {
                this.preloadQueue.delete(path);
                console.warn(`组件预加载失败: ${path}`, error);
            });
    }

    /**
     * 批量预加载组件
     */
    public preloadComponents(paths: string[]): Promise<void[]> {
        return Promise.all(paths.map(path => this.preloadComponent(path)));
    }

    /**
     * 检查组件是否正在加载
     */
    public isLoading(path: string): boolean {
        return this.loadingStates.get(path) || false;
    }

    /**
     * 获取缓存信息
     */
    public getCacheInfo(): {
        size: number;
        components: string[];
        totalSize: number;
    } {
        const components = Array.from(this.cache.keys());
        const totalSize = Array.from(this.cache.values())
            .reduce((sum, item) => sum + (item.size || 0), 0);

        return {
            size: this.cache.size,
            components,
            totalSize
        };
    }

    /**
     * 清除缓存
     */
    public clearCache(): void {
        this.cache.clear();
        this.preloadQueue.clear();
    }

    /**
     * 清除过期缓存
     */
    public clearExpiredCache(): void {
        const now = Date.now();
        const expireTime = 24 * 60 * 60 * 1000; // 24小时

        for (const [path, item] of this.cache.entries()) {
            if (now - item.timestamp > expireTime) {
                this.cache.delete(path);
            }
        }
    }

    /**
     * 估算组件大小
     */
    private estimateComponentSize(component: any): number {
        try {
            return JSON.stringify(component).length;
        } catch {
            return 0;
        }
    }

    /**
     * 延迟函数
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * 路由级代码分割管理器
 */
export class RouteCodeSplitter {
    private routeComponents: Map<string, string> = new Map();
    private loader: ComponentLoader;

    constructor() {
        this.loader = new ComponentLoader();
        this.setupRouteMapping();
    }

    /**
     * 设置路由映射
     */
    private setupRouteMapping(): void {
        this.routeComponents.set('/', '/src/pages/index.astro');
        this.routeComponents.set('/editor', '/src/pages/editor/index.astro');
        this.routeComponents.set('/prompts', '/src/pages/prompts/index.astro');

        // AI编辑器组件
        this.routeComponents.set('/components/image-generator', '/src/components/banana-editor/ImageGenerator.astro');
        this.routeComponents.set('/components/image-fusion', '/src/components/banana-editor/ImageFusion.astro');
        this.routeComponents.set('/components/prompt-optimizer', '/src/components/banana-editor/PromptOptimizer.astro');
    }

    /**
     * 根据路由预加载组件
     */
    public async preloadForRoute(route: string): Promise<void> {
        const componentPaths = this.getComponentsForRoute(route);
        await this.loader.preloadComponents(componentPaths);
    }

    /**
     * 获取路由相关组件
     */
    private getComponentsForRoute(route: string): string[] {
        const components: string[] = [];

        // 基础组件（所有页面都需要）
        components.push(
            '/src/components/ui/BananaButton.astro',
            '/src/components/seo/SEOHead.astro'
        );

        // 根据路由添加特定组件
        switch (route) {
            case '/':
                components.push(
                    '/src/components/banana-editor/BananaHero.astro',
                    '/src/components/banana-editor/BananaFeatures.astro',
                    '/src/components/banana-editor/BananaDemo.astro'
                );
                break;

            case '/editor':
                components.push(
                    '/src/components/banana-editor/layout/EditorLayout.astro',
                    '/src/components/banana-editor/layout/EditorToolbar.astro',
                    '/src/components/banana-editor/layout/EditorCanvas.astro',
                    '/src/components/banana-editor/ImageGenerator.astro',
                    '/src/components/banana-editor/ImageFusion.astro'
                );
                break;

            case '/prompts':
                components.push(
                    '/src/components/banana-editor/PromptLibrary.astro',
                    '/src/components/banana-editor/ui/PromptGrid.astro',
                    '/src/components/banana-editor/ui/PromptSearch.astro'
                );
                break;
        }

        return components;
    }

    /**
     * 智能预加载
     */
    public setupIntelligentPreloading(): void {
        // 基于用户行为预加载
        this.setupHoverPreloading();
        this.setupScrollPreloading();
        this.setupIdlePreloading();
    }

    /**
     * 悬停预加载
     */
    private setupHoverPreloading(): void {
        document.addEventListener('mouseover', (e) => {
            const target = e.target as HTMLElement;
            const link = target.closest('a[href]') as HTMLAnchorElement;

            if (link && link.hostname === window.location.hostname) {
                const route = link.pathname;
                this.preloadForRoute(route).catch(console.warn);
            }
        });
    }

    /**
     * 滚动预加载
     */
    private setupScrollPreloading(): void {
        let scrollTimeout: number;

        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = window.setTimeout(() => {
                // 检查是否接近页面底部
                const scrollPercent = (window.scrollY + window.innerHeight) / document.body.scrollHeight;

                if (scrollPercent > 0.8) {
                    // 预加载相关页面
                    this.preloadRelatedRoutes();
                }
            }, 150);
        });
    }

    /**
     * 空闲时预加载
     */
    private setupIdlePreloading(): void {
        if ('requestIdleCallback' in window) {
            const preloadInIdle = () => {
                (window as any).requestIdleCallback(() => {
                    this.preloadCommonComponents();
                });
            };

            // 页面加载完成后开始空闲预加载
            if (document.readyState === 'complete') {
                preloadInIdle();
            } else {
                window.addEventListener('load', preloadInIdle);
            }
        }
    }

    /**
     * 预加载相关路由
     */
    private preloadRelatedRoutes(): void {
        const currentRoute = window.location.pathname;
        const relatedRoutes: string[] = [];

        switch (currentRoute) {
            case '/':
                relatedRoutes.push('/editor', '/prompts');
                break;
            case '/editor':
                relatedRoutes.push('/prompts');
                break;
            case '/prompts':
                relatedRoutes.push('/editor');
                break;
        }

        relatedRoutes.forEach(route => {
            this.preloadForRoute(route).catch(console.warn);
        });
    }

    /**
     * 预加载常用组件
     */
    private preloadCommonComponents(): void {
        const commonComponents = [
            '/src/components/banana-editor/ui/MobileControlPanel.astro',
            '/src/components/banana-editor/ui/PromptCard.astro',
            '/src/components/banana-editor/ui/ImagePreview.astro'
        ];

        this.loader.preloadComponents(commonComponents).catch(console.warn);
    }
}

/**
 * 资源优先级管理器
 */
export class ResourcePriorityManager {
    private criticalResources: Set<string> = new Set();
    private deferredResources: Set<string> = new Set();

    constructor() {
        this.setupResourceHints();
    }

    /**
     * 设置资源提示
     */
    private setupResourceHints(): void {
        // 预连接到重要域名
        this.addResourceHint('preconnect', 'https://fonts.googleapis.com');
        this.addResourceHint('preconnect', 'https://fonts.gstatic.com');

        // DNS预解析
        this.addResourceHint('dns-prefetch', 'https://api.gemini.com');
    }

    /**
     * 添加资源提示
     */
    private addResourceHint(rel: string, href: string): void {
        const link = document.createElement('link');
        link.rel = rel;
        link.href = href;

        if (rel === 'preconnect') {
            link.crossOrigin = 'anonymous';
        }

        document.head.appendChild(link);
    }

    /**
     * 标记关键资源
     */
    public markAsCritical(resource: string): void {
        this.criticalResources.add(resource);
        this.loadCriticalResource(resource);
    }

    /**
     * 标记延迟资源
     */
    public markAsDeferred(resource: string): void {
        this.deferredResources.add(resource);
    }

    /**
     * 加载关键资源
     */
    private loadCriticalResource(resource: string): void {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = resource;

        // 根据资源类型设置as属性
        if (resource.endsWith('.css')) {
            link.as = 'style';
        } else if (resource.endsWith('.js')) {
            link.as = 'script';
        } else if (resource.match(/\.(jpg|jpeg|png|webp|avif)$/)) {
            link.as = 'image';
        } else if (resource.match(/\.(woff|woff2|ttf|otf)$/)) {
            link.as = 'font';
            link.crossOrigin = 'anonymous';
        }

        document.head.appendChild(link);
    }

    /**
     * 延迟加载非关键资源
     */
    public loadDeferredResources(): void {
        if ('requestIdleCallback' in window) {
            (window as any).requestIdleCallback(() => {
                this.deferredResources.forEach(resource => {
                    this.loadResource(resource);
                });
            });
        } else {
            setTimeout(() => {
                this.deferredResources.forEach(resource => {
                    this.loadResource(resource);
                });
            }, 1000);
        }
    }

    /**
     * 加载资源
     */
    private loadResource(resource: string): void {
        if (resource.endsWith('.css')) {
            this.loadStylesheet(resource);
        } else if (resource.endsWith('.js')) {
            this.loadScript(resource);
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
    private loadScript(src: string): void {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        document.head.appendChild(script);
    }
}

// 导出单例实例
export const componentLoader = new ComponentLoader();
export const routeCodeSplitter = new RouteCodeSplitter();
export const resourcePriorityManager = new ResourcePriorityManager();

// 初始化函数
export function initializeCodeSplitting(): void {
    // 设置智能预加载
    routeCodeSplitter.setupIntelligentPreloading();

    // 延迟加载非关键资源
    if (document.readyState === 'complete') {
        resourcePriorityManager.loadDeferredResources();
    } else {
        window.addEventListener('load', () => {
            resourcePriorityManager.loadDeferredResources();
        });
    }

    // 定期清理过期缓存
    setInterval(() => {
        componentLoader.clearExpiredCache();
    }, 60 * 60 * 1000); // 每小时清理一次
}