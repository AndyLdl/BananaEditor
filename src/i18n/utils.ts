/**
 * 多语言工具函数
 * 提供翻译、语言切换等功能
 */

import { defaultLanguage, isLanguageSupported } from './config';

// 翻译数据类型
export type TranslationData = Record<string, any>;
export type TranslationKey = string;

// 翻译缓存
const translationCache = new Map<string, TranslationData>();

/**
 * 加载翻译文件
 */
export async function loadTranslations(
    language: string,
    namespace: string = 'common'
): Promise<TranslationData> {
    const cacheKey = `${language}-${namespace}`;

    // 检查缓存
    if (translationCache.has(cacheKey)) {
        return translationCache.get(cacheKey)!;
    }

    try {
        // 动态导入翻译文件
        const translations = await import(`./locales/${language}/${namespace}.json`);
        const data = translations.default || translations;

        // 缓存翻译数据
        translationCache.set(cacheKey, data);
        return data;
    } catch (error) {
        console.warn(`Failed to load translations for ${language}/${namespace}:`, error);

        // 回退到默认语言
        if (language !== defaultLanguage) {
            return loadTranslations(defaultLanguage, namespace);
        }

        return {};
    }
}

/**
 * 获取翻译文本或数据
 */
export function getTranslation(
    translations: TranslationData,
    key: TranslationKey,
    params?: Record<string, string | number>
): any {
    // 支持嵌套键值，如 'editor.toolbar.save'
    const keys = key.split('.');
    let value: any = translations;

    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            return key; // 返回原始键值作为回退
        }
    }

    // 如果是数组，直接返回
    if (Array.isArray(value)) {
        return value;
    }

    // 如果不是字符串，返回原始键值
    if (typeof value !== 'string') {
        return key;
    }

    // 参数替换
    if (params) {
        return value.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
            return params[paramKey]?.toString() || match;
        });
    }

    return value;
}

/**
 * 创建翻译函数
 */
export function createTranslator(
    language: string,
    translations: TranslationData
) {
    return (key: TranslationKey, params?: Record<string, string | number>) => {
        return getTranslation(translations, key, params);
    };
}

/**
 * 语言存储工具
 */
export const languageStorage = {
    key: 'banana-editor-language',

    get(): string {
        if (typeof localStorage === 'undefined') return defaultLanguage;

        const stored = localStorage.getItem(this.key);
        return stored && isLanguageSupported(stored) ? stored : defaultLanguage;
    },

    set(language: string): void {
        if (typeof localStorage === 'undefined') return;

        if (isLanguageSupported(language)) {
            localStorage.setItem(this.key, language);
        }
    },

    remove(): void {
        if (typeof localStorage === 'undefined') return;
        localStorage.removeItem(this.key);
    }
};

/**
 * URL 语言参数处理
 */
export const urlLanguage = {
    get(): string | null {
        if (typeof window === 'undefined') return null;

        const params = new URLSearchParams(window.location.search);
        const lang = params.get('lang');
        return lang && isLanguageSupported(lang) ? lang : null;
    },

    set(language: string): void {
        if (typeof window === 'undefined') return;

        const url = new URL(window.location.href);
        if (isLanguageSupported(language)) {
            url.searchParams.set('lang', language);
        } else {
            url.searchParams.delete('lang');
        }

        window.history.replaceState({}, '', url.toString());
    },

    remove(): void {
        if (typeof window === 'undefined') return;

        const url = new URL(window.location.href);
        url.searchParams.delete('lang');
        window.history.replaceState({}, '', url.toString());
    }
};

/**
 * 简化的翻译获取函数，用于Astro组件
 */
export async function getTranslations(
    language: string,
    namespace: string = 'common'
): Promise<TranslationData> {
    return await loadTranslations(language, namespace);
}