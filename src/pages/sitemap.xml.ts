/**
 * 动态sitemap生成器
 * 自动生成包含所有页面和多语言版本的sitemap
 */

import type { APIRoute } from 'astro';
import { baseSEOConfig } from '../config/seo';
import { enabledLanguages } from '../i18n/config';

interface SitemapEntry {
    url: string;
    lastmod?: string;
    changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
    priority?: number;
    alternates?: Array<{
        lang: string;
        url: string;
    }>;
}

// 静态页面配置
const staticPages = [
    {
        path: '',
        priority: 1.0,
        changefreq: 'daily' as const,
        lastmod: new Date().toISOString()
    },
    {
        path: '/editor',
        priority: 0.9,
        changefreq: 'weekly' as const,
        lastmod: new Date().toISOString()
    },
    {
        path: '/prompts',
        priority: 0.8,
        changefreq: 'daily' as const,
        lastmod: new Date().toISOString()
    },
    {
        path: '/about',
        priority: 0.6,
        changefreq: 'monthly' as const,
        lastmod: new Date().toISOString()
    },
    {
        path: '/contact',
        priority: 0.5,
        changefreq: 'monthly' as const,
        lastmod: new Date().toISOString()
    },
    {
        path: '/pricing',
        priority: 0.7,
        changefreq: 'weekly' as const,
        lastmod: new Date().toISOString()
    }
];

// 动态页面配置（如博客文章等）
const getDynamicPages = async (): Promise<Array<{
    path: string;
    priority: number;
    changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
    lastmod: string;
}>> => {
    // 这里可以从CMS或数据库获取动态页面
    // 目前返回空数组，后续可以扩展
    return [];
};

// 生成多语言URL
const generateMultilingualUrls = (basePath: string): SitemapEntry[] => {
    const entries: SitemapEntry[] = [];

    enabledLanguages.forEach(language => {
        const isDefault = language.code === 'en';
        const url = isDefault
            ? `${baseSEOConfig.siteUrl}${basePath}`
            : `${baseSEOConfig.siteUrl}${basePath}?lang=${language.code}`;

        // 生成备用语言链接
        const alternates = enabledLanguages
            .filter(lang => lang.code !== language.code)
            .map(lang => ({
                lang: lang.code,
                url: lang.code === 'en'
                    ? `${baseSEOConfig.siteUrl}${basePath}`
                    : `${baseSEOConfig.siteUrl}${basePath}?lang=${lang.code}`
            }));

        entries.push({
            url,
            alternates
        });
    });

    return entries;
};

// 生成sitemap XML
const generateSitemapXML = (entries: SitemapEntry[]): string => {
    const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';
    const sitemapOpen = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">';
    const sitemapClose = '</urlset>';

    const urlEntries = entries.map(entry => {
        let urlXml = `  <url>
    <loc>${entry.url}</loc>`;

        if (entry.lastmod) {
            urlXml += `
    <lastmod>${entry.lastmod}</lastmod>`;
        }

        if (entry.changefreq) {
            urlXml += `
    <changefreq>${entry.changefreq}</changefreq>`;
        }

        if (entry.priority !== undefined) {
            urlXml += `
    <priority>${entry.priority.toFixed(1)}</priority>`;
        }

        // 添加多语言链接
        if (entry.alternates && entry.alternates.length > 0) {
            entry.alternates.forEach(alternate => {
                urlXml += `
    <xhtml:link rel="alternate" hreflang="${alternate.lang}" href="${alternate.url}" />`;
            });
        }

        urlXml += `
  </url>`;

        return urlXml;
    }).join('\n');

    return `${xmlHeader}
${sitemapOpen}
${urlEntries}
${sitemapClose}`;
};

export const GET: APIRoute = async () => {
    try {
        const allEntries: SitemapEntry[] = [];

        // 添加静态页面
        for (const page of staticPages) {
            const multilingualUrls = generateMultilingualUrls(page.path);

            multilingualUrls.forEach(entry => {
                allEntries.push({
                    ...entry,
                    lastmod: page.lastmod,
                    changefreq: page.changefreq,
                    priority: page.priority
                });
            });
        }

        // 添加动态页面
        const dynamicPages = await getDynamicPages();
        for (const page of dynamicPages) {
            const multilingualUrls = generateMultilingualUrls(page.path);

            multilingualUrls.forEach(entry => {
                allEntries.push({
                    ...entry,
                    lastmod: page.lastmod,
                    changefreq: page.changefreq,
                    priority: page.priority
                });
            });
        }

        // 去重并排序
        const uniqueEntries = allEntries.filter((entry, index, self) =>
            index === self.findIndex(e => e.url === entry.url)
        ).sort((a, b) => (b.priority || 0) - (a.priority || 0));

        const sitemapXML = generateSitemapXML(uniqueEntries);

        return new Response(sitemapXML, {
            status: 200,
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Cache-Control': 'public, max-age=3600, s-maxage=3600',
                'X-Robots-Tag': 'noindex'
            }
        });

    } catch (error) {
        console.error('Error generating sitemap:', error);

        return new Response('Error generating sitemap', {
            status: 500,
            headers: {
                'Content-Type': 'text/plain'
            }
        });
    }
};

// 预渲染sitemap
export const prerender = false;