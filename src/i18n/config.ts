/**
 * 多语言配置系统
 * 支持英文、中文等主要语言
 */

export interface LanguageConfig {
    code: string;
    name: string;
    nativeName: string;
    flag: string;
    rtl: boolean;
    enabled: boolean;
}

// 支持的语言列表
export const languages: LanguageConfig[] = [
    {
        code: 'en',
        name: 'English',
        nativeName: 'English',
        flag: '🇺🇸',
        rtl: false,
        enabled: true
    },
    {
        code: 'zh',
        name: 'Chinese',
        nativeName: '中文',
        flag: '🇨🇳',
        rtl: false,
        enabled: true
    },
    {
        code: 'es',
        name: 'Spanish',
        nativeName: 'Español',
        flag: '🇪🇸',
        rtl: false,
        enabled: true
    },
    {
        code: 'fr',
        name: 'French',
        nativeName: 'Français',
        flag: '🇫🇷',
        rtl: false,
        enabled: true
    },
    {
        code: 'ja',
        name: 'Japanese',
        nativeName: '日本語',
        flag: '🇯🇵',
        rtl: false,
        enabled: false // 暂时禁用，后续可开启
    },
    {
        code: 'ar',
        name: 'Arabic',
        nativeName: 'العربية',
        flag: '🇸🇦',
        rtl: true,
        enabled: false // RTL语言支持，暂时禁用
    },
    {
        code: 'he',
        name: 'Hebrew',
        nativeName: 'עברית',
        flag: '🇮🇱',
        rtl: true,
        enabled: false // RTL语言支持，暂时禁用
    }
];

// 默认语言
export const defaultLanguage = 'en';

// 获取启用的语言
export const enabledLanguages = languages.filter(lang => lang.enabled);

// 语言代码映射
export const languageMap = new Map(
    languages.map(lang => [lang.code, lang])
);

// 检查语言是否支持
export function isLanguageSupported(code: string): boolean {
    const lang = languageMap.get(code);
    return lang ? lang.enabled : false;
}

// 获取语言配置
export function getLanguageConfig(code: string): LanguageConfig | undefined {
    return languageMap.get(code);
}

// 获取浏览器首选语言
export function getBrowserLanguage(): string {
    if (typeof window === 'undefined') return defaultLanguage;

    const browserLang = navigator.language.split('-')[0];
    return isLanguageSupported(browserLang) ? browserLang : defaultLanguage;
}