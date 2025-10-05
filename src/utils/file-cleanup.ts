// 文件清理工具
import { promises as fs } from 'fs';
import path from 'path';
import { UPLOAD_CONFIG } from '../config/upload';

// 清理选项接口
interface CleanupOptions {
    directory: string;
    maxAgeMinutes: number;
    filePattern?: RegExp;
    dryRun?: boolean;
}

// 清理结果接口
interface CleanupResult {
    totalFiles: number;
    deletedFiles: number;
    deletedSize: number;
    errors: string[];
}

// 文件清理类
export class FileCleanup {
    private static instance: FileCleanup;
    private cleanupIntervals: Map<string, NodeJS.Timeout> = new Map();

    private constructor() { }

    static getInstance(): FileCleanup {
        if (!FileCleanup.instance) {
            FileCleanup.instance = new FileCleanup();
        }
        return FileCleanup.instance;
    }

    // 清理指定目录中的过期文件
    async cleanupDirectory(options: CleanupOptions): Promise<CleanupResult> {
        const result: CleanupResult = {
            totalFiles: 0,
            deletedFiles: 0,
            deletedSize: 0,
            errors: []
        };

        try {
            // 检查目录是否存在
            await fs.access(options.directory);

            const files = await fs.readdir(options.directory);
            result.totalFiles = files.length;

            const now = Date.now();
            const cutoffTime = now - (options.maxAgeMinutes * 60 * 1000);

            for (const file of files) {
                try {
                    // 如果指定了文件模式，检查是否匹配
                    if (options.filePattern && !options.filePattern.test(file)) {
                        continue;
                    }

                    const filePath = path.join(options.directory, file);
                    const stats = await fs.stat(filePath);

                    // 跳过目录
                    if (stats.isDirectory()) {
                        continue;
                    }

                    // 检查文件是否过期
                    if (stats.mtime.getTime() < cutoffTime) {
                        if (!options.dryRun) {
                            await fs.unlink(filePath);
                        }

                        result.deletedFiles++;
                        result.deletedSize += stats.size;

                        console.log(`${options.dryRun ? '[DRY RUN] ' : ''}清理文件: ${file} (${this.formatFileSize(stats.size)})`);
                    }
                } catch (error) {
                    const errorMsg = `清理文件 ${file} 失败: ${error}`;
                    result.errors.push(errorMsg);
                    console.error(errorMsg);
                }
            }

        } catch (error) {
            const errorMsg = `访问目录 ${options.directory} 失败: ${error}`;
            result.errors.push(errorMsg);
            console.error(errorMsg);
        }

        return result;
    }

    // 清理临时文件
    async cleanupTempFiles(maxAgeMinutes: number = 60, dryRun: boolean = false): Promise<CleanupResult> {
        return this.cleanupDirectory({
            directory: UPLOAD_CONFIG.TEMP_DIR,
            maxAgeMinutes,
            dryRun
        });
    }

    // 清理上传文件（可选，用于清理长期未使用的文件）
    async cleanupUploadFiles(maxAgeMinutes: number = 10080, dryRun: boolean = false): Promise<CleanupResult> {
        return this.cleanupDirectory({
            directory: UPLOAD_CONFIG.UPLOAD_DIR,
            maxAgeMinutes, // 默认7天
            dryRun
        });
    }

    // 启动定时清理任务
    startScheduledCleanup(intervalMinutes: number = 30): void {
        const intervalId = setInterval(async () => {
            try {
                console.log('开始定时清理任务...');

                // 清理1小时前的临时文件
                const tempResult = await this.cleanupTempFiles(60);
                console.log(`临时文件清理完成: 删除 ${tempResult.deletedFiles} 个文件，释放 ${this.formatFileSize(tempResult.deletedSize)}`);

                // 清理7天前的上传文件（可选）
                // const uploadResult = await this.cleanupUploadFiles(10080);
                // console.log(`上传文件清理完成: 删除 ${uploadResult.deletedFiles} 个文件，释放 ${this.formatFileSize(uploadResult.deletedSize)}`);

            } catch (error) {
                console.error('定时清理任务失败:', error);
            }
        }, intervalMinutes * 60 * 1000);

        this.cleanupIntervals.set('scheduled', intervalId);
        console.log(`定时清理任务已启动，间隔: ${intervalMinutes} 分钟`);
    }

    // 停止定时清理任务
    stopScheduledCleanup(): void {
        const intervalId = this.cleanupIntervals.get('scheduled');
        if (intervalId) {
            clearInterval(intervalId);
            this.cleanupIntervals.delete('scheduled');
            console.log('定时清理任务已停止');
        }
    }

    // 获取目录统计信息
    async getDirectoryStats(directory: string): Promise<{
        totalFiles: number;
        totalSize: number;
        oldestFile?: { name: string; age: number };
        newestFile?: { name: string; age: number };
    }> {
        const stats = {
            totalFiles: 0,
            totalSize: 0,
            oldestFile: undefined as { name: string; age: number } | undefined,
            newestFile: undefined as { name: string; age: number } | undefined
        };

        try {
            await fs.access(directory);
            const files = await fs.readdir(directory);
            const now = Date.now();

            for (const file of files) {
                try {
                    const filePath = path.join(directory, file);
                    const fileStat = await fs.stat(filePath);

                    if (fileStat.isFile()) {
                        stats.totalFiles++;
                        stats.totalSize += fileStat.size;

                        const age = now - fileStat.mtime.getTime();

                        if (!stats.oldestFile || age > stats.oldestFile.age) {
                            stats.oldestFile = { name: file, age };
                        }

                        if (!stats.newestFile || age < stats.newestFile.age) {
                            stats.newestFile = { name: file, age };
                        }
                    }
                } catch (error) {
                    console.error(`获取文件 ${file} 统计信息失败:`, error);
                }
            }
        } catch (error) {
            console.error(`获取目录 ${directory} 统计信息失败:`, error);
        }

        return stats;
    }

    // 格式化文件大小
    private formatFileSize(bytes: number): string {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }

    // 格式化时间间隔
    private formatDuration(milliseconds: number): string {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}天${hours % 24}小时`;
        if (hours > 0) return `${hours}小时${minutes % 60}分钟`;
        if (minutes > 0) return `${minutes}分钟${seconds % 60}秒`;
        return `${seconds}秒`;
    }

    // 生成清理报告
    async generateCleanupReport(): Promise<string> {
        const tempStats = await this.getDirectoryStats(UPLOAD_CONFIG.TEMP_DIR);
        const uploadStats = await this.getDirectoryStats(UPLOAD_CONFIG.UPLOAD_DIR);

        const report = `
文件清理报告 - ${new Date().toLocaleString()}
========================================

临时文件目录 (${UPLOAD_CONFIG.TEMP_DIR}):
- 文件数量: ${tempStats.totalFiles}
- 总大小: ${this.formatFileSize(tempStats.totalSize)}
- 最旧文件: ${tempStats.oldestFile ? `${tempStats.oldestFile.name} (${this.formatDuration(tempStats.oldestFile.age)} 前)` : '无'}
- 最新文件: ${tempStats.newestFile ? `${tempStats.newestFile.name} (${this.formatDuration(tempStats.newestFile.age)} 前)` : '无'}

上传文件目录 (${UPLOAD_CONFIG.UPLOAD_DIR}):
- 文件数量: ${uploadStats.totalFiles}
- 总大小: ${this.formatFileSize(uploadStats.totalSize)}
- 最旧文件: ${uploadStats.oldestFile ? `${uploadStats.oldestFile.name} (${this.formatDuration(uploadStats.oldestFile.age)} 前)` : '无'}
- 最新文件: ${uploadStats.newestFile ? `${uploadStats.newestFile.name} (${this.formatDuration(uploadStats.newestFile.age)} 前)` : '无'}
        `.trim();

        return report;
    }
}

// 导出单例实例
export const fileCleanup = FileCleanup.getInstance();

// 确保目录存在的工具函数
export async function ensureDirectories(): Promise<void> {
    try {
        await fs.access(UPLOAD_CONFIG.UPLOAD_DIR);
    } catch {
        await fs.mkdir(UPLOAD_CONFIG.UPLOAD_DIR, { recursive: true });
        console.log(`创建上传目录: ${UPLOAD_CONFIG.UPLOAD_DIR}`);
    }

    try {
        await fs.access(UPLOAD_CONFIG.TEMP_DIR);
    } catch {
        await fs.mkdir(UPLOAD_CONFIG.TEMP_DIR, { recursive: true });
        console.log(`创建临时目录: ${UPLOAD_CONFIG.TEMP_DIR}`);
    }
}

// 启动应用时的初始化函数
export async function initializeFileSystem(): Promise<void> {
    await ensureDirectories();

    // 启动定时清理任务
    fileCleanup.startScheduledCleanup(30); // 每30分钟清理一次

    // 生成初始报告
    const report = await fileCleanup.generateCleanupReport();
    console.log(report);
}