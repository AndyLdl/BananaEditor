/**
 * 配置系统入口文件
 * 统一导出所有配置模块
 */

// 主题配置
export { bananaTheme, type BananaTheme, type ThemeColors } from './theme';

// SEO配置
export {
    baseSEOConfig,
    pageSEOConfigs,
    primaryKeywords,
    secondaryKeywords,
    getPageSEOConfig,
    generateStructuredData,
    generateAlternateLanguages,
    type SEOConfig
} from './seo';

// 环境变量配置
export {
    env,
    isDevelopment,
    isProduction,
    isTesting,
    features,
    validateConfig,
    type Environment
} from './env';

// 多语言配置
export {
    languages,
    enabledLanguages,
    defaultLanguage,
    languageMap,
    isLanguageSupported,
    getLanguageConfig,
    getBrowserLanguage,
    type LanguageConfig
} from '../i18n/config';

// 多语言工具
export {
    loadTranslations,
    getTranslation,
    createTranslator,
    languageStorage,
    urlLanguage,
    type TranslationData,
    type TranslationKey
} from '../i18n/utils';

// 应用配置常量
export const APP_CONFIG = {
    name: 'BananaEditor',
    version: '1.0.0',
    description: 'Professional AI Image Editor powered by Nano Banana Technology',
    author: 'BananaEditor Team',
    keywords: ['nano banana', 'nano banana ai', 'banana ai', 'image editor'],

    // 默认设置
    defaults: {
        language: 'en',
        theme: 'light',
        imageQuality: 'high',
        maxFileSize: 10 * 1024 * 1024, // 10MB
    },

    // 支持的文件格式
    supportedFormats: {
        images: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
        export: ['jpg', 'png', 'webp']
    },

    // API端点
    api: {
        generate: '/api/banana-editor/generate',
        fusion: '/api/banana-editor/fusion',
        optimize: '/api/banana-editor/optimize-prompt',
        prompts: '/api/banana-editor/prompts',
        upload: '/api/banana-editor/upload'
    },

    // 路由配置
    routes: {
        home: '/',
        editor: '/editor',
        prompts: '/prompts',
        about: '/about',
        contact: '/contact'
    }
} as const;

// 类型导出
export type AppConfig = typeof APP_CONFIG;