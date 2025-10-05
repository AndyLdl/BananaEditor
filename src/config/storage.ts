/**
 * 文件存储配置和权限管理
 * 处理文件上传、存储权限和清理策略
 */

import { promises as fs } from 'fs';
import path from 'path';

export interface StorageConfig {
    uploadDir: string;
    tempDir: string;
    maxFileSize: number;
    maxConcurrentUploads: number;
    fileCleanupInterval: number;
    fileMaxAge: number;
    allowedMimeTypes: string[];
    allowedExtensions: string[];
}

/**
 * 获取存储配置
 */
export function getStorageConfig(): StorageConfig {
    return {
        uploadDir: process.env.UPLOAD_DIR || './public/uploads',
        tempDir: process.env.TEMP_DIR || './temp',
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
        maxConcurrentUploads: parseInt(process.env.MAX_CONCURRENT_UPLOADS || '5'),
        fileCleanupInterval: parseInt(process.env.FILE_CLEANUP_INTERVAL || '3600000'), // 1小时
        fileMaxAge: parseInt(process.env.FILE_MAX_AGE || '86400000'), // 24小时
        allowedMimeTypes: [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif'
        ],
        allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif']
    };
}

/**
 * 初始化存储目录
 */
export async function initializeStorageDirectories(config: StorageConfig): Promise<void> {
    try {
        // 创建上传目录
        await fs.mkdir(config.uploadDir, { recursive: true, mode: 0o755 });

        // 创建临时目录
        await fs.mkdir(config.tempDir, { recursive: true, mode: 0o755 });

        // 设置目录权限
        await fs.chmod(config.uploadDir, 0o755);
        await fs.chmod(config.tempDir, 0o755);

        console.log('存储目录初始化完成');
    } catch (error) {
        console.error('存储目录初始化失败:', error);
        throw error;
    }
}

/**
 * 验证文件类型和大小
 */
export function validateFile(file: File, config: StorageConfig): { valid: boolean; error?: string } {
    // 检查文件大小
    if (file.size > config.maxFileSize) {
        return {
            valid: false,
            error: `文件大小超过限制 (${Math.round(config.maxFileSize / 1024 / 1024)}MB)`
        };
    }

    // 检查MIME类型
    if (!config.allowedMimeTypes.includes(file.type)) {
        return {
            valid: false,
            error: `不支持的文件类型: ${file.type}`
        };
    }

    // 检查文件扩展名
    const ext = path.extname(file.name).toLowerCase();
    if (!config.allowedExtensions.includes(ext)) {
        return {
            valid: false,
            error: `不支持的文件扩展名: ${ext}`
        };
    }

    return { valid: true };
}

/**
 * 生成安全的文件名
 */
export function generateSecureFileName(originalName: string): string {
    const ext = path.extname(originalName);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);

    return `${timestamp}_${random}${ext}`;
}

/**
 * 清理过期文件
 */
export async function cleanupExpiredFiles(config: StorageConfig): Promise<void> {
    try {
        const now = Date.now();
        const directories = [config.tempDir, config.uploadDir];

        for (const dir of directories) {
            try {
                const files = await fs.readdir(dir);

                for (const file of files) {
                    const filePath = path.join(dir, file);
                    const stats = await fs.stat(filePath);

                    // 检查文件是否过期
                    if (now - stats.mtime.getTime() > config.fileMaxAge) {
                        await fs.unlink(filePath);
                        console.log(`已删除过期文件: ${filePath}`);
                    }
                }
            } catch (error) {
                console.error(`清理目录 ${dir} 时出错:`, error);
            }
        }
    } catch (error) {
        console.error('文件清理过程中出错:', error);
    }
}

/**
 * 启动文件清理定时器
 */
export function startFileCleanupScheduler(config: StorageConfig): NodeJS.Timeout {
    console.log(`启动文件清理定时器，间隔: ${config.fileCleanupInterval}ms`);

    return setInterval(() => {
        cleanupExpiredFiles(config).catch(error => {
            console.error('定时文件清理失败:', error);
        });
    }, config.fileCleanupInterval);
}

/**
 * 获取目录使用情况统计
 */
export async function getStorageStats(config: StorageConfig): Promise<{
    uploadDir: { files: number; size: number };
    tempDir: { files: number; size: number };
}> {
    const getDirectoryStats = async (dir: string) => {
        try {
            const files = await fs.readdir(dir);
            let totalSize = 0;

            for (const file of files) {
                const filePath = path.join(dir, file);
                const stats = await fs.stat(filePath);
                if (stats.isFile()) {
                    totalSize += stats.size;
                }
            }

            return { files: files.length, size: totalSize };
        } catch (error) {
            return { files: 0, size: 0 };
        }
    };

    const [uploadStats, tempStats] = await Promise.all([
        getDirectoryStats(config.uploadDir),
        getDirectoryStats(config.tempDir)
    ]);

    return {
        uploadDir: uploadStats,
        tempDir: tempStats
    };
}

/**
 * 检查磁盘空间
 */
export async function checkDiskSpace(directory: string): Promise<{ free: number; total: number }> {
    try {
        const stats = await fs.statfs(directory);
        return {
            free: stats.bavail * stats.bsize,
            total: stats.blocks * stats.bsize
        };
    } catch (error) {
        console.error('检查磁盘空间失败:', error);
        return { free: 0, total: 0 };
    }
}

/**
 * 设置文件权限
 */
export async function setFilePermissions(filePath: string, mode: number = 0o644): Promise<void> {
    try {
        await fs.chmod(filePath, mode);
    } catch (error) {
        console.error(`设置文件权限失败 ${filePath}:`, error);
        throw error;
    }
}