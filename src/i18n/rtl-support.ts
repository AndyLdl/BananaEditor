/**
 * RTL (Right-to-Left) 语言支持工具
 * 处理阿拉伯语、希伯来语等RTL语言的布局和样式
 */

import { getLanguageConfig } from './config';
import { languageManager } from './language-manager';

export interface RTLConfig {
    isRTL: boolean;
    direction: 'ltr' | 'rtl';
    textAlign: 'left' | 'right';
    marginStart: string;
    marginEnd: string;
    paddingStart: string;
    paddingEnd: string;
}

export class RTLManager {
    private static instance: RTLManager;
    private currentConfig: RTLConfig;

    private constructor() {
        this.currentConfig = this.createConfig(languageManager.getCurrentLanguage());
        this.initialize();
    }

    static getInstance(): RTLManager {
        if (!RTLManager.instance) {
            RTLManager.instance = new RTLManager();
        }
        return RTLManager.instance;
    }

    private initialize(): void {
        // 监听语言变化
        languageManager.addLanguageChangeListener((language) => {
            this.updateRTLConfig(language);
        });

        // 应用初始RTL配置
        this.applyRTLStyles();
    }

    /**
     * 创建RTL配置
     */
    private createConfig(language: string): RTLConfig {
        const langConfig = getLanguageConfig(language);
        const isRTL = langConfig?.rtl || false;

        return {
            isRTL,
            direction: isRTL ? 'rtl' : 'ltr',
            textAlign: isRTL ? 'right' : 'left',
            marginStart: isRTL ? 'margin-right' : 'margin-left',
            marginEnd: isRTL ? 'margin-left' : 'margin-right',
            paddingStart: isRTL ? 'padding-right' : 'padding-left',
            paddingEnd: isRTL ? 'padding-left' : 'padding-right'
        };
    }

    /**
     * 更新RTL配置
     */
    private updateRTLConfig(language: string): void {
        const newConfig = this.createConfig(language);
        const wasRTL = this.currentConfig.isRTL;

        this.currentConfig = newConfig;

        // 如果RTL状态发生变化，重新应用样式
        if (wasRTL !== newConfig.isRTL) {
            this.applyRTLStyles();
        }
    }

    /**
     * 应用RTL样式
     */
    private applyRTLStyles(): void {
        if (typeof document === 'undefined') return;

        const html = document.documentElement;
        const body = document.body;

        // 设置文档方向
        html.setAttribute('dir', this.currentConfig.direction);
        html.setAttribute('lang', languageManager.getCurrentLanguage());

        // 添加RTL类名
        if (this.currentConfig.isRTL) {
            html.classList.add('rtl');
            body.classList.add('rtl');
        } else {
            html.classList.remove('rtl');
            body.classList.remove('rtl');
        }

        // 更新CSS自定义属性
        html.style.setProperty('--text-align', this.currentConfig.textAlign);
        html.style.setProperty('--direction', this.currentConfig.direction);

        // 触发RTL变化事件
        this.dispatchRTLChangeEvent();
    }

    /**
     * 触发RTL变化事件
     */
    private dispatchRTLChangeEvent(): void {
        if (typeof window === 'undefined') return;

        const event = new CustomEvent('rtlchange', {
            detail: {
                isRTL: this.currentConfig.isRTL,
                direction: this.currentConfig.direction,
                config: this.currentConfig
            }
        });

        window.dispatchEvent(event);
    }

    /**
     * 获取当前RTL配置
     */
    getConfig(): RTLConfig {
        return { ...this.currentConfig };
    }

    /**
     * 检查当前是否为RTL语言
     */
    isRTL(): boolean {
        return this.currentConfig.isRTL;
    }

    /**
     * 获取方向性CSS类名
     */
    getDirectionClass(): string {
        return this.currentConfig.isRTL ? 'rtl' : 'ltr';
    }

    /**
     * 获取文本对齐方式
     */
    getTextAlign(): 'left' | 'right' {
        return this.currentConfig.textAlign;
    }

    /**
     * 获取逻辑边距/内边距属性
     */
    getLogicalProperty(property: 'margin' | 'padding', side: 'start' | 'end'): string {
        const key = `${property}${side.charAt(0).toUpperCase() + side.slice(1)}` as keyof RTLConfig;
        return this.currentConfig[key] as string;
    }
}

/**
 * RTL工具函数
 */
export const rtlUtils = {
    /**
     * 根据RTL状态返回对应的值
     */
    rtlValue<T>(ltrValue: T, rtlValue: T): T {
        const rtlManager = RTLManager.getInstance();
        return rtlManager.isRTL() ? rtlValue : ltrValue;
    },

    /**
     * 获取方向性的CSS类名
     */
    directionClass(baseClass: string): string {
        const rtlManager = RTLManager.getInstance();
        return `${baseClass} ${baseClass}-${rtlManager.getDirectionClass()}`;
    },

    /**
     * 获取逻辑方向的样式
     */
    logicalStyle(property: 'margin' | 'padding', startValue: string, endValue?: string): Record<string, string> {
        const rtlManager = RTLManager.getInstance();
        const config = rtlManager.getConfig();

        const styles: Record<string, string> = {};
        styles[config.marginStart.replace('margin-', `${property}-`)] = startValue;

        if (endValue) {
            styles[config.marginEnd.replace('margin-', `${property}-`)] = endValue;
        }

        return styles;
    },

    /**
     * 创建RTL感知的Tailwind类名
     */
    tailwindRTL(ltrClasses: string, rtlClasses?: string): string {
        const rtlManager = RTLManager.getInstance();

        if (!rtlClasses) {
            // 自动转换常见的方向性类名
            rtlClasses = ltrClasses
                .replace(/\bl-/g, 'r-')
                .replace(/\br-/g, 'l-')
                .replace(/\bml-/g, 'mr-')
                .replace(/\bmr-/g, 'ml-')
                .replace(/\bpl-/g, 'pr-')
                .replace(/\bpr-/g, 'pl-')
                .replace(/\btext-left/g, 'text-right')
                .replace(/\btext-right/g, 'text-left');
        }

        return rtlManager.isRTL() ? rtlClasses : ltrClasses;
    }
};

// 导出单例实例
export const rtlManager = RTLManager.getInstance();

// 便捷函数
export function isRTLLanguage(language?: string): boolean {
    const lang = language || languageManager.getCurrentLanguage();
    const config = getLanguageConfig(lang);
    return config?.rtl || false;
}

export function getCurrentDirection(): 'ltr' | 'rtl' {
    return rtlManager.getConfig().direction;
}

export function addRTLChangeListener(callback: (config: RTLConfig) => void): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('rtlchange', (event: CustomEvent) => {
        callback(event.detail.config);
    });
}