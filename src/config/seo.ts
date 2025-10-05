/**
 * SEO优化配置
 * 围绕"nano banana"关键词进行优化
 */

export interface SEOConfig {
    title: string;
    description: string;
    keywords: string[];
    canonical?: string;
    ogImage?: string;
    ogType?: string;
    twitterCard?: string;
    language?: string;
    alternateLanguages?: Array<{
        lang: string;
        url: string;
    }>;
}

// 主关键词和相关关键词
export const primaryKeywords = [
    'nano banana',
    'nano banana ai',
    'banana ai',
    'nano banana image editor',
    'banana ai photo generator'
];

export const secondaryKeywords = [
    'ai image editor',
    'ai photo generator',
    'image fusion ai',
    'prompt optimization',
    'professional image editor',
    'ai art generator'
];

// 基础SEO配置
export const baseSEOConfig = {
    siteName: 'BananaEditor',
    siteUrl: process.env.SITE_URL || 'https://bananaeditor.com',
    defaultLanguage: 'en',
    defaultImage: '/opengraph.jpg',
    twitterHandle: '@bananaeditor'
};

// 页面特定的SEO配置
export const pageSEOConfigs: Record<string, Record<string, SEOConfig>> = {
    // 首页SEO配置
    home: {
        en: {
            title: 'Nano Banana - Professional AI Image Editor | BananaEditor',
            description: 'Create stunning images with nano banana AI technology. Professional image generation and fusion tools powered by advanced AI. Try our banana ai editor now!',
            keywords: [
                ...primaryKeywords,
                'professional image editor',
                'ai art generator',
                'image creation tool'
            ],
            ogType: 'website',
            twitterCard: 'summary_large_image'
        },
        zh: {
            title: 'Nano Banana - 专业AI图片编辑器 | BananaEditor',
            description: '使用nano banana AI技术创建令人惊艳的图片。专业的AI图片生成和融合工具，由先进的banana ai技术驱动。立即试用我们的编辑器！',
            keywords: [
                'nano banana',
                'nano banana ai',
                'banana ai',
                '专业图片编辑器',
                'AI图片生成器',
                '图片创作工具'
            ],
            ogType: 'website',
            twitterCard: 'summary_large_image'
        }
    },

    // 编辑器页面SEO配置
    editor: {
        en: {
            title: 'AI Image Editor - Nano Banana Professional Tools | BananaEditor',
            description: 'Professional nano banana ai image editing suite with generation and fusion capabilities. Create, edit, and enhance images with our advanced banana ai technology.',
            keywords: [
                ...primaryKeywords,
                'image editing suite',
                'ai image tools',
                'professional editor'
            ],
            ogType: 'webapp',
            twitterCard: 'summary'
        },
        zh: {
            title: 'AI图片编辑器 - Nano Banana专业工具 | BananaEditor',
            description: '专业的nano banana ai图片编辑套件，具备生成和融合功能。使用我们先进的banana ai技术创建、编辑和增强图片。',
            keywords: [
                'nano banana',
                'nano banana ai',
                'banana ai',
                '图片编辑套件',
                'AI图片工具',
                '专业编辑器'
            ],
            ogType: 'webapp',
            twitterCard: 'summary'
        }
    },

    // 提示词库页面SEO配置
    prompts: {
        en: {
            title: 'AI Prompt Library - Nano Banana Collections | BananaEditor',
            description: 'Discover curated nano banana ai prompts for stunning image generation. Browse our extensive banana ai prompt library and enhance your creative workflow.',
            keywords: [
                ...primaryKeywords,
                'ai prompts',
                'prompt library',
                'image generation prompts'
            ],
            ogType: 'website',
            twitterCard: 'summary'
        },
        zh: {
            title: 'AI提示词库 - Nano Banana精选集 | BananaEditor',
            description: '发现精选的nano banana ai提示词，用于生成令人惊艳的图片。浏览我们丰富的banana ai提示词库，提升您的创作工作流程。',
            keywords: [
                'nano banana',
                'nano banana ai',
                'banana ai',
                'AI提示词',
                '提示词库',
                '图片生成提示词'
            ],
            ogType: 'website',
            twitterCard: 'summary'
        }
    }
};

/**
 * 获取页面SEO配置
 */
export function getPageSEOConfig(
    page: string,
    language: string = 'en'
): SEOConfig | null {
    const pageConfig = pageSEOConfigs[page];
    if (!pageConfig) return null;

    return pageConfig[language] || pageConfig['en'] || null;
}

/**
 * 生成结构化数据
 */
export function generateStructuredData(page: string, language: string = 'en') {
    const config = getPageSEOConfig(page, language);
    if (!config) return null;

    const baseStructuredData = {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'BananaEditor',
        description: config.description,
        applicationCategory: 'DesignApplication',
        operatingSystem: 'Web Browser',
        url: baseSEOConfig.siteUrl,
        image: `${baseSEOConfig.siteUrl}${baseSEOConfig.defaultImage}`,
        offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD'
        },
        keywords: config.keywords.join(', '),
        creator: {
            '@type': 'Organization',
            name: 'BananaEditor Team'
        }
    };

    // 根据页面类型添加特定的结构化数据
    if (page === 'home') {
        return {
            ...baseStructuredData,
            '@type': 'WebSite',
            potentialAction: {
                '@type': 'SearchAction',
                target: `${baseSEOConfig.siteUrl}/search?q={search_term_string}`,
                'query-input': 'required name=search_term_string'
            }
        };
    }

    return baseStructuredData;
}

/**
 * 生成多语言链接
 */
export function generateAlternateLanguages(
    page: string,
    currentLanguage: string
): Array<{ lang: string; url: string }> {
    const languages = ['en', 'zh', 'es', 'fr'];
    const baseUrl = baseSEOConfig.siteUrl;

    return languages
        .filter(lang => lang !== currentLanguage)
        .map(lang => ({
            lang,
            url: `${baseUrl}${page === 'home' ? '' : `/${page}`}?lang=${lang}`
        }));
}