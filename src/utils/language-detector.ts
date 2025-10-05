/**
 * 语言检测和管理工具
 * 处理语言检测、切换和持久化
 */

import { defaultLanguage, isLanguageSupported } from '../i18n/config';

export class LanguageDetector {
    /**
     * 获取当前语言
     * 优先级：URL参数 > localStorage > 浏览器语言 > 默认语言
     */
    static getCurrentLanguage(): string {
        // 1. 检查URL参数
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            const urlLang = urlParams.get('lang');
            if (urlLang && isLanguageSupported(urlLang)) {
                return urlLang;
            }
        }

        // 2. 检查localStorage
        if (typeof localStorage !== 'undefined') {
            const storedLang = localStorage.getItem('banana-editor-language');
            if (storedLang && isLanguageSupported(storedLang)) {
                return storedLang;
            }
        }

        // 3. 检查浏览器语言
        if (typeof navigator !== 'undefined') {
            const browserLang = navigator.language.split('-')[0];
            if (isLanguageSupported(browserLang)) {
                return browserLang;
            }
        }

        // 4. 返回默认语言
        return defaultLanguage;
    }

    /**
     * 设置语言
     */
    static setLanguage(language: string): void {
        if (!isLanguageSupported(language)) {
            console.warn(`Language ${language} is not supported`);
            return;
        }

        // 保存到localStorage
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('banana-editor-language', language);
        }

        // 更新URL参数
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('lang', language);
            window.history.replaceState({}, '', url.toString());
        }
    }

    /**
     * 切换语言并重新加载页面
     */
    static switchLanguage(language: string): void {
        this.setLanguage(language);

        if (typeof window !== 'undefined') {
            window.location.reload();
        }
    }

    /**
     * 获取语言切换URL
     */
    static getLanguageUrl(language: string, currentPath?: string): string {
        if (typeof window === 'undefined') {
            return `?lang=${language}`;
        }

        const url = new URL(currentPath || window.location.href);
        url.searchParams.set('lang', language);
        return url.toString();
    }

    /**
     * 初始化语言检测
     * 在页面加载时调用，确保语言设置正确
     */
    static initialize(): void {
        const currentLang = this.getCurrentLanguage();

        // 如果URL中没有语言参数，只在 localStorage 中保存，不修改 URL
        // 避免触发页面重新加载
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            if (!urlParams.has('lang')) {
                // 只保存到 localStorage，不修改 URL
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('banana-editor-language', currentLang);
                }
            }
        }

        // 设置HTML lang属性
        if (typeof document !== 'undefined') {
            document.documentElement.lang = currentLang;
        }
    }
}

/**
 * 语言切换事件处理器
 */
export function setupLanguageSwitcher(): void {
    if (typeof document === 'undefined') return;

    document.addEventListener('DOMContentLoaded', () => {
        // 初始化语言检测
        LanguageDetector.initialize();

        // 绑定语言切换按钮事件
        const languageButtons = document.querySelectorAll('[data-language]');
        languageButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                const target = event.currentTarget as HTMLElement;
                const language = target.dataset.language;

                if (language) {
                    LanguageDetector.switchLanguage(language);
                }
            });
        });
    });
}

/**
 * 服务端语言检测（用于Astro）
 * 在静态模式下只检查URL参数
 */
export function detectLanguageFromRequest(request: Request): string {
    try {
        const url = new URL(request.url);
        const langParam = url.searchParams.get('lang');

        if (langParam && isLanguageSupported(langParam)) {
            return langParam;
        }

        // 在静态模式下，无法访问headers，所以直接返回默认语言
        return defaultLanguage;
    } catch (error) {
        // 如果无法访问request，返回默认语言
        return defaultLanguage;
    }
}