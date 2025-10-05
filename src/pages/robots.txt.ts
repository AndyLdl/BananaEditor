/**
 * 动态robots.txt生成器
 * 根据环境和配置生成robots.txt文件
 */

import type { APIRoute } from 'astro';
import { baseSEOConfig } from '../config/seo';

// 环境配置
const isProduction = import.meta.env.PROD;
const isDevelopment = import.meta.env.DEV;

// 生产环境robots.txt配置
const productionRobots = `# BananaEditor Robots.txt
# Optimized for nano banana AI image editor

User-agent: *
Allow: /

# 重要页面优先抓取
Allow: /editor
Allow: /prompts
Allow: /about
Allow: /contact

# 静态资源
Allow: /assets/
Allow: /images/
Allow: /*.css
Allow: /*.js
Allow: /*.png
Allow: /*.jpg
Allow: /*.jpeg
Allow: /*.gif
Allow: /*.svg
Allow: /*.webp
Allow: /*.ico

# 禁止抓取的路径
Disallow: /api/
Disallow: /admin/
Disallow: /_astro/
Disallow: /temp/
Disallow: /uploads/
Disallow: /logs/
Disallow: /.well-known/
Disallow: /test/
Disallow: /dev/

# 禁止抓取临时和私有文件
Disallow: /*.tmp
Disallow: /*.log
Disallow: /*.bak
Disallow: /*.old
Disallow: /.*

# 搜索引擎特定规则
User-agent: Googlebot
Allow: /
Crawl-delay: 1

User-agent: Bingbot
Allow: /
Crawl-delay: 1

User-agent: Slurp
Allow: /
Crawl-delay: 2

User-agent: DuckDuckBot
Allow: /
Crawl-delay: 1

User-agent: Baiduspider
Allow: /
Crawl-delay: 2

User-agent: YandexBot
Allow: /
Crawl-delay: 2

# 禁止恶意爬虫
User-agent: AhrefsBot
Disallow: /

User-agent: MJ12bot
Disallow: /

User-agent: DotBot
Disallow: /

User-agent: SemrushBot
Disallow: /

User-agent: MegaIndex
Disallow: /

# Sitemap位置
Sitemap: ${baseSEOConfig.siteUrl}/sitemap.xml

# 抓取延迟（秒）
Crawl-delay: 1

# 访问时间限制（可选）
# Visit-time: 0100-0800

# 请求频率限制（可选）
# Request-rate: 1/10s`;

// 开发环境robots.txt配置
const developmentRobots = `# BananaEditor Development Environment
# 禁止所有搜索引擎抓取

User-agent: *
Disallow: /

# 开发环境不提供sitemap
# Sitemap: ${baseSEOConfig.siteUrl}/sitemap.xml`;

// 测试环境robots.txt配置
const stagingRobots = `# BananaEditor Staging Environment
# 限制搜索引擎抓取

User-agent: *
Disallow: /

# 仅允许Google抓取用于测试
User-agent: Googlebot
Allow: /
Noindex: /

Sitemap: ${baseSEOConfig.siteUrl}/sitemap.xml`;

// 根据环境生成robots.txt内容
const generateRobotsContent = (): string => {
    const environment = import.meta.env.PUBLIC_ENVIRONMENT || 'production';

    switch (environment) {
        case 'development':
            return developmentRobots;
        case 'staging':
            return stagingRobots;
        case 'production':
        default:
            return productionRobots;
    }
};

// 添加自定义规则
const addCustomRules = (baseContent: string): string => {
    let content = baseContent;

    // 如果有特定的SEO配置，可以在这里添加
    const customDisallows = [
        '/private/',
        '/internal/',
        '/*?debug=*',
        '/*?test=*',
        '/*?preview=*'
    ];

    if (isProduction) {
        customDisallows.forEach(rule => {
            content += `\nDisallow: ${rule}`;
        });
    }

    // 添加特定于nano banana关键词的优化
    if (isProduction) {
        content += `\n\n# 针对nano banana AI关键词优化的特殊规则`;
        content += `\n# 确保重要的nano banana相关页面被正确抓取`;
        content += `\nAllow: /*nano-banana*`;
        content += `\nAllow: /*banana-ai*`;
        content += `\nAllow: /editor/*`;
        content += `\nAllow: /prompts/*`;
    }

    return content;
};

// 验证robots.txt内容
const validateRobotsContent = (content: string): boolean => {
    // 基本验证规则
    const hasUserAgent = content.includes('User-agent:');
    const hasValidDirectives = /^(Allow|Disallow|Crawl-delay|Sitemap):/m.test(content);

    return hasUserAgent && hasValidDirectives;
};

export const GET: APIRoute = async () => {
    try {
        let robotsContent = generateRobotsContent();
        robotsContent = addCustomRules(robotsContent);

        // 验证内容
        if (!validateRobotsContent(robotsContent)) {
            throw new Error('Invalid robots.txt content generated');
        }

        // 添加生成时间戳注释
        const timestamp = new Date().toISOString();
        robotsContent = `# Generated on: ${timestamp}\n${robotsContent}`;

        return new Response(robotsContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'public, max-age=86400, s-maxage=86400', // 24小时缓存
                'X-Robots-Tag': 'noindex, nofollow'
            }
        });

    } catch (error) {
        console.error('Error generating robots.txt:', error);

        // 返回基本的robots.txt作为后备
        const fallbackRobots = isDevelopment
            ? 'User-agent: *\nDisallow: /'
            : `User-agent: *\nAllow: /\nSitemap: ${baseSEOConfig.siteUrl}/sitemap.xml`;

        return new Response(fallbackRobots, {
            status: 200,
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'public, max-age=3600, s-maxage=3600'
            }
        });
    }
};

// 预渲染robots.txt
export const prerender = false;