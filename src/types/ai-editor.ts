// AI图片编辑工具的TypeScript类型定义

// 图片生成相关类型
export interface GenerateImageRequest {
    image: File;
    prompt: string;
    style?: string;
    quality?: 'standard' | 'high';
}

export interface GenerateImageResponse {
    success: boolean;
    imageUrl?: string;
    error?: string;
    requestId: string;
}

// 提示词优化相关类型
export interface OptimizePromptRequest {
    originalPrompt: string;
    style?: string;
    language?: 'zh' | 'en';
}

export interface OptimizePromptResponse {
    success: boolean;
    optimizedPrompt?: string;
    suggestions?: string[];
    error?: string;
}

// 图片融合相关类型
export interface FusionImageRequest {
    image1: File;
    image2: File;
    fusionRatio?: number; // 0-1之间
    style?: string;
}

export interface FusionImageResponse {
    success: boolean;
    fusedImageUrl?: string;
    error?: string;
    requestId: string;
}

// 提示词管理相关类型
export interface PromptItem {
    id: string;
    title: string;
    content: string;
    category: string;
    tags: string[];
    description?: string;
    createdAt: Date;
    updatedAt: Date;
    usageCount: number;
    rating?: number;
}

export interface PromptCategory {
    id: string;
    name: string;
    description: string;
    icon?: string;
}

export interface GetPromptsResponse {
    prompts: PromptItem[];
    categories: string[];
    total: number;
}

export interface CreatePromptRequest {
    title: string;
    content: string;
    category: string;
    tags: string[];
    description?: string;
}

// 系统相关类型
export interface RequestLog {
    id: string;
    userId?: string;
    sessionId: string;
    endpoint: string;
    timestamp: Date;
    success: boolean;
    error?: string;
    processingTime: number;
}

export interface UserSession {
    sessionId: string;
    requestCount: number;
    lastRequestTime: Date;
    isBlocked: boolean;
    blockUntil?: Date;
    requestHistory?: Array<{
        timestamp: number;
        endpoint: string;
        success: boolean;
    }>;
}

export interface ErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: any;
    };
    requestId: string;
    timestamp: Date;
}

// 环境配置类型
export interface EnvironmentConfig {
    GEMINI_API_KEY: string;
    GEMINI_API_ENDPOINT: string;
    MAX_FILE_SIZE: number;
    RATE_LIMIT_WINDOW: number;
    RATE_LIMIT_MAX_REQUESTS: number;
}

// 安全中间件接口
export interface SecurityMiddleware {
    validateFileType(file: File): boolean;
    sanitizePrompt(prompt: string): string;
    checkRateLimit(sessionId: string): boolean;
    validateImageContent(buffer: Buffer): Promise<boolean>;
}

// 文件上传相关类型
export interface UploadedFile {
    filename: string;
    originalName: string;
    mimetype: string;
    size: number;
    path: string;
    url: string;
}

// API响应基础类型
export interface BaseResponse {
    success: boolean;
    message?: string;
    requestId: string;
    timestamp: Date;
}