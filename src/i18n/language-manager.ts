/**
 * 语言管理器 - 处理语言偏好保存、自动检测和切换
 */

import {
    defaultLanguage,
    isLanguageSupported,
    getLanguageConfig,
    type LanguageConfig
} from './config';

export interface LanguagePreference {
    language: string;
    autoDetect: boolean;
    lastChanged: number;
}

export class LanguageManager {
    private static instance: LanguageManager;
    private currentLanguage: string = defaultLanguage;
    private storageKey = 'banana-editor-language-preference';
    private listeners: Set<(language: string) => void> = new Set();

    private constructor() {
        this.initialize();
    }

    static getInstance(): LanguageManager {
        if (!LanguageManager.instance) {
            LanguageManager.instance = new LanguageManager();
        }
        return LanguageManager.instance;
    }

    /**
     * 初始化语言管理器
     */
    private initialize(): void {
        // 服务端渲染时不执行浏览器相关逻辑
        if (typeof window === 'undefined') {
            return;
        }

        const preference = this.getStoredPreference();

        if (preference) {
            // 使用存储的语言偏好
            this.currentLanguage = preference.language;
        } else if (this.shouldAutoDetect()) {
            // 自动检测浏览器语言
            this.currentLanguage = this.detectBrowserLanguage();
        }

        // 监听语言变化事件
        this.setupLanguageChangeListener();
    }

    /**
     * 获取当前语言
     */
    getCurrentLanguage(): string {
        return this.currentLanguage;
    }

    /**
     * 设置语言
     */
    setLanguage(language: string, savePreference: boolean = true): boolean {
        if (!isLanguageSupported(language)) {
            console.warn(`Language ${language} is not supported`);
            return false;
        }

        const previousLanguage = this.currentLanguage;
        this.currentLanguage = language;

        if (savePreference) {
            this.savePreference({
                language,
                autoDetect: false,
                lastChanged: Date.now()
            });
        }

        // 更新URL参数
        this.updateUrlLanguage(language);

        // 通知监听器
        this.notifyLanguageChange(language);

        console.log(`Language changed from ${previousLanguage} to ${language}`);
        return true;
    }

    /**
     * 启用自动检测
     */
    enableAutoDetect(): void {
        const detectedLanguage = this.detectBrowserLanguage();

        this.savePreference({
            language: detectedLanguage,
            autoDetect: true,
            lastChanged: Date.now()
        });

        this.setLanguage(detectedLanguage, false);
    }

    /**
     * 禁用自动检测
     */
    disableAutoDetect(): void {
        const preference = this.getStoredPreference();
        if (preference) {
            this.savePreference({
                ...preference,
                autoDetect: false,
                lastChanged: Date.now()
            });
        }
    }

    /**
     * 检测浏览器语言
     */
    private detectBrowserLanguage(): string {
        if (typeof navigator === 'undefined') {
            return defaultLanguage;
        }

        // 检查navigator.languages数组
        if (navigator.languages) {
            for (const lang of navigator.languages) {
                const langCode = this.extractLanguageCode(lang);
                if (isLanguageSupported(langCode)) {
                    return langCode;
                }
            }
        }

        // 检查navigator.language
        if (navigator.language) {
            const langCode = this.extractLanguageCode(navigator.language);
            if (isLanguageSupported(langCode)) {
                return langCode;
            }
        }

        return defaultLanguage;
    }

    /**
     * 提取语言代码（去除地区代码）
     */
    private extractLanguageCode(locale: string): string {
        return locale.split('-')[0].toLowerCase();
    }

    /**
     * 获取存储的语言偏好
     */
    private getStoredPreference(): LanguagePreference | null {
        if (typeof localStorage === 'undefined') {
            return null;
        }

        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const preference = JSON.parse(stored) as LanguagePreference;

                // 验证存储的语言是否仍然支持
                if (isLanguageSupported(preference.language)) {
                    return preference;
                }
            }
        } catch (error) {
            console.warn('Failed to parse stored language preference:', error);
        }

        return null;
    }

    /**
     * 保存语言偏好
     */
    private savePreference(preference: LanguagePreference): void {
        if (typeof localStorage === 'undefined') {
            return;
        }

        try {
            localStorage.setItem(this.storageKey, JSON.stringify(preference));
        } catch (error) {
            console.warn('Failed to save language preference:', error);
        }
    }

    /**
     * 检查是否应该自动检测语言
     */
    private shouldAutoDetect(): boolean {
        const preference = this.getStoredPreference();
        return !preference || preference.autoDetect;
    }

    /**
     * 更新URL语言参数
     */
    private updateUrlLanguage(language: string): void {
        if (typeof window === 'undefined') {
            return;
        }

        try {
            const url = new URL(window.location.href);

            if (language !== defaultLanguage) {
                url.searchParams.set('lang', language);
            } else {
                url.searchParams.delete('lang');
            }

            // 使用replaceState避免添加历史记录
            window.history.replaceState({}, '', url.toString());
        } catch (error) {
            console.warn('Failed to update URL language parameter:', error);
        }
    }

    /**
     * 设置语言变化监听器
     */
    private setupLanguageChangeListener(): void {
        if (typeof window === 'undefined') {
            return;
        }

        // 监听存储变化（多标签页同步）
        window.addEventListener('storage', (event) => {
            if (event.key === this.storageKey && event.newValue) {
                try {
                    const preference = JSON.parse(event.newValue) as LanguagePreference;
                    if (preference.language !== this.currentLanguage) {
                        this.currentLanguage = preference.language;
                        this.notifyLanguageChange(preference.language);
                    }
                } catch (error) {
                    console.warn('Failed to handle storage change:', error);
                }
            }
        });

        // 监听URL变化
        window.addEventListener('popstate', () => {
            const urlLang = this.getLanguageFromUrl();
            if (urlLang && urlLang !== this.currentLanguage) {
                this.setLanguage(urlLang, false);
            }
        });
    }

    /**
     * 从URL获取语言参数
     */
    private getLanguageFromUrl(): string | null {
        if (typeof window === 'undefined') {
            return null;
        }

        try {
            const params = new URLSearchParams(window.location.search);
            const lang = params.get('lang');
            return lang && isLanguageSupported(lang) ? lang : null;
        } catch (error) {
            return null;
        }
    }

    /**
     * 添加语言变化监听器
     */
    addLanguageChangeListener(callback: (language: string) => void): void {
        this.listeners.add(callback);
    }

    /**
     * 移除语言变化监听器
     */
    removeLanguageChangeListener(callback: (language: string) => void): void {
        this.listeners.delete(callback);
    }

    /**
     * 通知语言变化
     */
    private notifyLanguageChange(language: string): void {
        this.listeners.forEach(callback => {
            try {
                callback(language);
            } catch (error) {
                console.warn('Language change listener error:', error);
            }
        });
    }

    /**
     * 获取语言配置信息
     */
    getLanguageInfo(language?: string): LanguageConfig | undefined {
        return getLanguageConfig(language || this.currentLanguage);
    }

    /**
     * 重置语言设置
     */
    reset(): void {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(this.storageKey);
        }

        this.currentLanguage = defaultLanguage;
        this.updateUrlLanguage(defaultLanguage);
        this.notifyLanguageChange(defaultLanguage);
    }

    /**
     * 获取语言统计信息
     */
    getLanguageStats(): {
        current: string;
        isAutoDetect: boolean;
        browserLanguage: string;
        supportedLanguages: string[];
    } {
        const preference = this.getStoredPreference();

        return {
            current: this.currentLanguage,
            isAutoDetect: preference?.autoDetect ?? true,
            browserLanguage: this.detectBrowserLanguage(),
            supportedLanguages: Object.keys(getLanguageConfig('') || {})
        };
    }
}

// 导出单例实例
export const languageManager = LanguageManager.getInstance();

// 便捷函数
export function getCurrentLanguage(): string {
    return languageManager.getCurrentLanguage();
}

export function setLanguage(language: string): boolean {
    return languageManager.setLanguage(language);
}

export function enableAutoDetect(): void {
    languageManager.enableAutoDetect();
}

export function addLanguageChangeListener(callback: (language: string) => void): void {
    languageManager.addLanguageChangeListener(callback);
}