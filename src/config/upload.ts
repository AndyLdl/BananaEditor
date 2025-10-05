// 文件上传配置
import { getConfig } from '../utils/gemini-client';

const config = getConfig();

export const UPLOAD_CONFIG = {
    // 最大文件大小 (10MB)
    MAX_FILE_SIZE: config.MAX_FILE_SIZE,

    // 支持的文件类型
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],

    // 上传目录
    UPLOAD_DIR: './public/uploads',
    TEMP_DIR: './temp',

    // 文件名生成规则
    generateFileName: (originalName: string): string => {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const extension = originalName.split('.').pop();
        return `${timestamp}_${random}.${extension}`;
    },

    // 获取文件URL
    getFileUrl: (filename: string): string => {
        return `/uploads/${filename}`;
    }
};

// 创建必要的目录
export async function ensureDirectories() {
    const { ensureDirectories: ensureDirs } = await import('../utils/file-cleanup');
    await ensureDirs();
}