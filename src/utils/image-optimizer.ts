// image-optimizer.ts - 图片优化和懒加载工具
// 提供图片压缩、格式转换、懒加载等功能

export interface ImageOptimizationOptions {
    quality?: number;
    maxWidth?: number;
    maxHeight?: number;
    format?: 'jpeg' | 'png' | 'webp';
    progressive?: boolean;
}

export interface LazyLoadOptions {
    rootMargin?: string;
    threshold?: number;
    fadeIn?: boolean;
    placeholder?: string;
}

export class ImageOptimizer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d')!;
    }

    /**
     * 压缩图片文件
     */
    public async compressImage(
        file: File,
        options: ImageOptimizationOptions = {}
    ): Promise<File> {
        const {
            quality = 0.8,
            maxWidth = 1920,
            maxHeight = 1080,
            format = 'jpeg',
            progressive = true
        } = options;

        return new Promise((resolve, reject) => {
            const img = new Image();

            img.onload = () => {
                try {
                    // 计算新尺寸
                    const { width, height } = this.calculateDimensions(
                        img.width,
                        img.height,
                        maxWidth,
                        maxHeight
                    );

                    // 设置画布尺寸
                    this.canvas.width = width;
                    this.canvas.height = height;

                    // 清除画布
                    this.ctx.clearRect(0, 0, width, height);

                    // 绘制图片
                    this.ctx.drawImage(img, 0, 0, width, height);

                    // 转换为Blob
                    this.canvas.toBlob(
                        (blob) => {
                            if (blob) {
                                const compressedFile = new File(
                                    [blob],
                                    this.generateFileName(file.name, format),
                                    { type: `image/${format}` }
                                );
                                resolve(compressedFile);
                            } else {
                                reject(new Error('图片压缩失败'));
                            }
                        },
                        `image/${format}`,
                        quality
                    );
                } catch (error) {
                    reject(error);
                }
            };

            img.onerror = () => {
                reject(new Error('图片加载失败'));
            };

            img.src = URL.createObjectURL(file);
        });
    }

    /**
     * 生成缩略图
     */
    public async generateThumbnail(
        file: File,
        size: number = 200
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            const img = new Image();

            img.onload = () => {
                try {
                    this.canvas.width = size;
                    this.canvas.height = size;

                    // 计算裁剪区域（居中裁剪）
                    const sourceSize = Math.min(img.width, img.height);
                    const sourceX = (img.width - sourceSize) / 2;
                    const sourceY = (img.height - sourceSize) / 2;

                    this.ctx.clearRect(0, 0, size, size);
                    this.ctx.drawImage(
                        img,
                        sourceX, sourceY, sourceSize, sourceSize,
                        0, 0, size, size
                    );

                    resolve(this.canvas.toDataURL('image/jpeg', 0.8));
                } catch (error) {
                    reject(error);
                }
            };

            img.onerror = () => {
                reject(new Error('缩略图生成失败'));
            };

            img.src = URL.createObjectURL(file);
        });
    }

    /**
     * 检测WebP支持
     */
    public static supportsWebP(): Promise<boolean> {
        return new Promise((resolve) => {
            const webP = new Image();
            webP.onload = webP.onerror = () => {
                resolve(webP.height === 2);
            };
            webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
        });
    }

    /**
     * 检测AVIF支持
     */
    public static supportsAVIF(): Promise<boolean> {
        return new Promise((resolve) => {
            const avif = new Image();
            avif.onload = avif.onerror = () => {
                resolve(avif.height === 2);
            };
            avif.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A=';
        });
    }

    /**
     * 获取最佳图片格式
     */
    public static async getBestImageFormat(): Promise<'avif' | 'webp' | 'jpeg'> {
        if (await this.supportsAVIF()) {
            return 'avif';
        } else if (await this.supportsWebP()) {
            return 'webp';
        } else {
            return 'jpeg';
        }
    }

    private calculateDimensions(
        originalWidth: number,
        originalHeight: number,
        maxWidth: number,
        maxHeight: number
    ): { width: number; height: number } {
        let { width, height } = { width: originalWidth, height: originalHeight };

        // 按比例缩放
        if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
        }

        if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
        }

        return { width: Math.round(width), height: Math.round(height) };
    }

    private generateFileName(originalName: string, format: string): string {
        const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
        return `${nameWithoutExt}_optimized.${format}`;
    }
}

/**
 * 懒加载管理器
 */
export class LazyLoader {
    private observer: IntersectionObserver | null = null;
    private options: LazyLoadOptions;
    private loadedImages: Set<HTMLImageElement> = new Set();

    constructor(options: LazyLoadOptions = {}) {
        this.options = {
            rootMargin: '50px',
            threshold: 0.1,
            fadeIn: true,
            placeholder: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2Y0ZjRmNCIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+TG9hZGluZy4uLjwvdGV4dD48L3N2Zz4=',
            ...options
        };

        this.init();
    }

    private init(): void {
        if (!('IntersectionObserver' in window)) {
            // 降级处理：直接加载所有图片
            this.loadAllImages();
            return;
        }

        this.observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        this.loadImage(entry.target as HTMLImageElement);
                    }
                });
            },
            {
                rootMargin: this.options.rootMargin,
                threshold: this.options.threshold
            }
        );
    }

    /**
     * 观察图片元素
     */
    public observe(img: HTMLImageElement): void {
        if (this.loadedImages.has(img)) return;

        // 设置占位符
        if (!img.src && this.options.placeholder) {
            img.src = this.options.placeholder;
        }

        // 添加懒加载样式
        if (this.options.fadeIn) {
            img.style.opacity = '0';
            img.style.transition = 'opacity 0.3s ease';
        }

        if (this.observer) {
            this.observer.observe(img);
        } else {
            // 降级处理
            this.loadImage(img);
        }
    }

    /**
     * 批量观察图片
     */
    public observeAll(selector: string = 'img[data-src]'): void {
        const images = document.querySelectorAll(selector) as NodeListOf<HTMLImageElement>;
        images.forEach((img) => this.observe(img));
    }

    /**
     * 加载单个图片
     */
    private loadImage(img: HTMLImageElement): void {
        if (this.loadedImages.has(img)) return;

        const src = img.dataset.src || img.dataset.lazySrc;
        if (!src) return;

        // 创建新图片对象预加载
        const newImg = new Image();

        newImg.onload = () => {
            // 加载成功后替换src
            img.src = src;

            if (this.options.fadeIn) {
                img.style.opacity = '1';
            }

            // 移除data属性
            img.removeAttribute('data-src');
            img.removeAttribute('data-lazy-src');

            // 添加加载完成类
            img.classList.add('lazy-loaded');

            // 标记为已加载
            this.loadedImages.add(img);

            // 停止观察
            if (this.observer) {
                this.observer.unobserve(img);
            }

            // 触发自定义事件
            img.dispatchEvent(new CustomEvent('lazyloaded', {
                detail: { src }
            }));
        };

        newImg.onerror = () => {
            // 加载失败处理
            img.classList.add('lazy-error');

            if (this.observer) {
                this.observer.unobserve(img);
            }

            img.dispatchEvent(new CustomEvent('lazyerror', {
                detail: { src }
            }));
        };

        // 开始加载
        newImg.src = src;
    }

    /**
     * 降级处理：加载所有图片
     */
    private loadAllImages(): void {
        const images = document.querySelectorAll('img[data-src], img[data-lazy-src]') as NodeListOf<HTMLImageElement>;
        images.forEach((img) => this.loadImage(img));
    }

    /**
     * 销毁懒加载器
     */
    public destroy(): void {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.loadedImages.clear();
    }
}

/**
 * 响应式图片管理器
 */
export class ResponsiveImageManager {
    private breakpoints: { [key: string]: number } = {
        xs: 480,
        sm: 768,
        md: 1024,
        lg: 1200,
        xl: 1920
    };

    /**
     * 获取当前断点
     */
    public getCurrentBreakpoint(): string {
        const width = window.innerWidth;

        if (width < this.breakpoints.xs) return 'xs';
        if (width < this.breakpoints.sm) return 'sm';
        if (width < this.breakpoints.md) return 'md';
        if (width < this.breakpoints.lg) return 'lg';
        return 'xl';
    }

    /**
     * 生成响应式图片URL
     */
    public generateResponsiveUrl(
        baseUrl: string,
        breakpoint?: string
    ): string {
        const bp = breakpoint || this.getCurrentBreakpoint();
        const size = this.breakpoints[bp] || this.breakpoints.lg;

        // 如果是外部URL，直接返回
        if (baseUrl.startsWith('http')) {
            return baseUrl;
        }

        // 生成优化后的URL
        const ext = baseUrl.split('.').pop();
        const nameWithoutExt = baseUrl.replace(/\.[^/.]+$/, '');

        return `${nameWithoutExt}_${size}w.${ext}`;
    }

    /**
     * 设置响应式图片
     */
    public setupResponsiveImage(img: HTMLImageElement): void {
        const baseSrc = img.dataset.src || img.src;
        if (!baseSrc) return;

        // 生成srcset
        const srcset = Object.keys(this.breakpoints)
            .map(bp => {
                const url = this.generateResponsiveUrl(baseSrc, bp);
                const width = this.breakpoints[bp];
                return `${url} ${width}w`;
            })
            .join(', ');

        img.srcset = srcset;
        img.sizes = `(max-width: ${this.breakpoints.xs}px) ${this.breakpoints.xs}px, 
                 (max-width: ${this.breakpoints.sm}px) ${this.breakpoints.sm}px, 
                 (max-width: ${this.breakpoints.md}px) ${this.breakpoints.md}px, 
                 (max-width: ${this.breakpoints.lg}px) ${this.breakpoints.lg}px, 
                 ${this.breakpoints.xl}px`;
    }
}

/**
 * 图片预加载器
 */
export class ImagePreloader {
    private cache: Map<string, HTMLImageElement> = new Map();
    private loading: Set<string> = new Set();

    /**
     * 预加载单个图片
     */
    public preload(src: string): Promise<HTMLImageElement> {
        // 检查缓存
        if (this.cache.has(src)) {
            return Promise.resolve(this.cache.get(src)!);
        }

        // 检查是否正在加载
        if (this.loading.has(src)) {
            return new Promise((resolve, reject) => {
                const checkLoading = () => {
                    if (this.cache.has(src)) {
                        resolve(this.cache.get(src)!);
                    } else if (!this.loading.has(src)) {
                        reject(new Error('预加载失败'));
                    } else {
                        setTimeout(checkLoading, 100);
                    }
                };
                checkLoading();
            });
        }

        // 开始加载
        this.loading.add(src);

        return new Promise((resolve, reject) => {
            const img = new Image();

            img.onload = () => {
                this.cache.set(src, img);
                this.loading.delete(src);
                resolve(img);
            };

            img.onerror = () => {
                this.loading.delete(src);
                reject(new Error(`图片预加载失败: ${src}`));
            };

            img.src = src;
        });
    }

    /**
     * 批量预加载图片
     */
    public preloadBatch(urls: string[]): Promise<HTMLImageElement[]> {
        return Promise.all(urls.map(url => this.preload(url)));
    }

    /**
     * 清除缓存
     */
    public clearCache(): void {
        this.cache.clear();
        this.loading.clear();
    }

    /**
     * 获取缓存大小
     */
    public getCacheSize(): number {
        return this.cache.size;
    }
}

// 导出单例实例
export const imageOptimizer = new ImageOptimizer();
export const lazyLoader = new LazyLoader();
export const responsiveImageManager = new ResponsiveImageManager();
export const imagePreloader = new ImagePreloader();

// 工具函数
export function setupLazyLoading(options?: LazyLoadOptions): LazyLoader {
    const loader = new LazyLoader(options);

    // 自动观察所有懒加载图片
    document.addEventListener('DOMContentLoaded', () => {
        loader.observeAll();
    });

    return loader;
}

export function optimizeImageForUpload(
    file: File,
    options?: ImageOptimizationOptions
): Promise<File> {
    return imageOptimizer.compressImage(file, options);
}

export function createImageThumbnail(
    file: File,
    size?: number
): Promise<string> {
    return imageOptimizer.generateThumbnail(file, size);
}