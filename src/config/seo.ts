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
    'Z-Image Studio',
    'Z-Image',
    'Z-Image-Turbo',
    'AI image generation',
    'diffusion transformer'
];

export const secondaryKeywords = [
    'image editing',
    'prompt optimization',
    'bilingual text rendering',
    'instruction following',
    'high resolution',
    'open-source model'
];

// 基础SEO配置
export const baseSEOConfig = {
    siteName: 'Z-Image Studio',
    siteUrl: process.env.SITE_URL || 'https://zimagestudio.com',
    defaultLanguage: 'en',
    defaultImage: '/opengraph.jpg',
    twitterHandle: '@zimagestudio'
};

// 页面特定的SEO配置
export const pageSEOConfigs: Record<string, Record<string, SEOConfig>> = {
    // 首页SEO配置
    home: {
        en: {
            title: 'Z-Image Studio - Advanced AI Image Generation Platform',
            description: 'Experience Z-Image Studio, powered by Z-Image foundation models with single-stream diffusion transformer technology. Ultra-fast inference with Z-Image-Turbo.',
            keywords: [
                ...primaryKeywords,
                'AI image generation platform',
                'single-stream diffusion transformer',
                'sub-second inference'
            ],
            ogType: 'website',
            twitterCard: 'summary_large_image'
        },
        zh: {
            title: 'Z-Image Studio - 高级AI图像生成平台',
            description: 'Z-Image Studio 基于 Z-Image 基座模型与单流扩散 Transformer 技术，提供 Z-Image-Turbo 的超快推理能力与高质量生图体验。',
            keywords: [
                'Z-Image Studio',
                'Z-Image',
                'Z-Image-Turbo',
                'AI图片生成',
                '扩散Transformer',
                '单流架构'
            ],
            ogType: 'website',
            twitterCard: 'summary_large_image'
        }
    },

    // 编辑器页面SEO配置
    editor: {
        en: {
            title: 'AI Image Editor - Z-Image Studio',
            description: 'Create, edit, and enhance images with Z-Image Studio. Powered by Z-Image models for fast, high-quality generation and editing workflows.',
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
            title: 'AI图片编辑器 - Z-Image Studio',
            description: '使用 Z-Image Studio 创建、编辑与增强图片：快速推理、高质量输出，适用于专业创作与商业场景。',
            keywords: [
                'Z-Image Studio',
                'Z-Image',
                'Z-Image-Edit',
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
            title: 'AI Prompt Library - Z-Image Studio',
            description: 'Discover curated prompts for Z-Image models. Browse our prompt library and enhance your creative workflow with Z-Image Studio.',
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
            title: 'AI提示词库 - Z-Image Studio',
            description: '发现适用于 Z-Image 模型的精选提示词。浏览我们的提示词库，提升你的生图与创作效率。',
            keywords: [
                'Z-Image Studio',
                'Z-Image',
                '提示词库',
                'AI提示词',
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
        name: 'Z-Image Studio',
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
            name: 'Z-Image Studio Team'
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