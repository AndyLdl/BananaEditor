/**
 * 环境变量配置
 * 统一管理所有环境变量
 */

// 验证必需的环境变量
function getRequiredEnv(key: string): string {
    const value = import.meta.env[key];
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}

// 获取可选的环境变量
function getOptionalEnv(key: string, defaultValue: string = ''): string {
    return import.meta.env[key] || defaultValue;
}

// 环境变量配置
export const env = {
    // 基础配置
    NODE_ENV: getOptionalEnv('NODE_ENV', 'development'),
    SITE_URL: getOptionalEnv('SITE_URL', 'http://localhost:3000'),

    // API配置
    GEMINI_API_KEY: getOptionalEnv('GEMINI_API_KEY'),
    GEMINI_API_ENDPOINT: getOptionalEnv('GEMINI_API_ENDPOINT', 'https://generativelanguage.googleapis.com'),

    // 功能开关
    ENABLE_IMAGE_GENERATION: getOptionalEnv('ENABLE_IMAGE_GENERATION', 'true') === 'true',
    ENABLE_IMAGE_FUSION: getOptionalEnv('ENABLE_IMAGE_FUSION', 'true') === 'true',
    ENABLE_PROMPT_OPTIMIZATION: getOptionalEnv('ENABLE_PROMPT_OPTIMIZATION', 'true') === 'true',
    ENABLE_ANALYTICS: getOptionalEnv('ENABLE_ANALYTICS', 'false') === 'true',

    // 限制配置
    MAX_FILE_SIZE: parseInt(getOptionalEnv('MAX_FILE_SIZE', '10485760')), // 10MB
    MAX_CONCURRENT_REQUESTS: parseInt(getOptionalEnv('MAX_CONCURRENT_REQUESTS', '5')),
    RATE_LIMIT_PER_MINUTE: parseInt(getOptionalEnv('RATE_LIMIT_PER_MINUTE', '10')),

    // SEO配置
    DEFAULT_LANGUAGE: getOptionalEnv('DEFAULT_LANGUAGE', 'en'),
    SUPPORTED_LANGUAGES: getOptionalEnv('SUPPORTED_LANGUAGES', 'en,zh,es,fr').split(','),

    // 社交媒体配置
    TWITTER_HANDLE: getOptionalEnv('TWITTER_HANDLE', '@bananaeditor'),
    FACEBOOK_APP_ID: getOptionalEnv('FACEBOOK_APP_ID'),

    // 分析和监控
    GOOGLE_ANALYTICS_ID: getOptionalEnv('GOOGLE_ANALYTICS_ID'),
    SENTRY_DSN: getOptionalEnv('SENTRY_DSN'),

    // 存储配置
    UPLOAD_DIR: getOptionalEnv('UPLOAD_DIR', 'public/uploads'),
    TEMP_DIR: getOptionalEnv('TEMP_DIR', 'temp'),

    // 安全配置
    CORS_ORIGINS: getOptionalEnv('CORS_ORIGINS', '*').split(','),
    JWT_SECRET: getOptionalEnv('JWT_SECRET', 'banana-editor-secret'),

    // 缓存配置
    CACHE_TTL: parseInt(getOptionalEnv('CACHE_TTL', '3600')), // 1小时
    REDIS_URL: getOptionalEnv('REDIS_URL'),
} as const;

// 类型定义
export type Environment = typeof env;

// 开发环境检查
export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const isTesting = env.NODE_ENV === 'test';

// 功能检查函数
export const features = {
    imageGeneration: env.ENABLE_IMAGE_GENERATION,
    imageFusion: env.ENABLE_IMAGE_FUSION,
    promptOptimization: env.ENABLE_PROMPT_OPTIMIZATION,
    analytics: env.ENABLE_ANALYTICS,
} as const;

// 验证配置
export function validateConfig(): void {
    const errors: string[] = [];

    // 检查必需的API密钥
    if (features.imageGeneration && !env.GEMINI_API_KEY) {
        errors.push('GEMINI_API_KEY is required when image generation is enabled');
    }

    // 检查文件大小限制
    if (env.MAX_FILE_SIZE < 1024 * 1024) { // 最小1MB
        errors.push('MAX_FILE_SIZE should be at least 1MB');
    }

    // 检查并发请求限制
    if (env.MAX_CONCURRENT_REQUESTS < 1) {
        errors.push('MAX_CONCURRENT_REQUESTS should be at least 1');
    }

    // 检查支持的语言
    if (!env.SUPPORTED_LANGUAGES.includes(env.DEFAULT_LANGUAGE)) {
        errors.push('DEFAULT_LANGUAGE must be included in SUPPORTED_LANGUAGES');
    }

    if (errors.length > 0) {
        throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
}

// 在开发环境下验证配置
if (isDevelopment) {
    try {
        validateConfig();
        console.log('✅ Configuration validation passed');
    } catch (error) {
        console.error('❌ Configuration validation failed:', error);
    }
}