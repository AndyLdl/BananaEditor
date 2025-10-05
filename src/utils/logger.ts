/**
 * 日志系统
 * 提供结构化日志记录和不同级别的日志输出
 */

import { promises as fs } from 'fs';
import path from 'path';

export enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3
}

export interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    meta?: any;
    requestId?: string;
    userId?: string;
    ip?: string;
    userAgent?: string;
}

export interface LoggerConfig {
    level: LogLevel;
    logFile?: string;
    errorLogFile?: string;
    maxFileSize: number;
    maxFiles: number;
    enableConsole: boolean;
}

class Logger {
    private config: LoggerConfig;
    private logQueue: LogEntry[] = [];
    private isWriting = false;

    constructor(config: LoggerConfig) {
        this.config = config;
        this.ensureLogDirectories();
    }

    /**
     * 确保日志目录存在
     */
    private async ensureLogDirectories(): Promise<void> {
        if (this.config.logFile) {
            const logDir = path.dirname(this.config.logFile);
            await fs.mkdir(logDir, { recursive: true });
        }

        if (this.config.errorLogFile) {
            const errorLogDir = path.dirname(this.config.errorLogFile);
            await fs.mkdir(errorLogDir, { recursive: true });
        }
    }

    /**
     * 记录错误日志
     */
    error(message: string, meta?: any, context?: Partial<LogEntry>): void {
        this.log(LogLevel.ERROR, message, meta, context);
    }

    /**
     * 记录警告日志
     */
    warn(message: string, meta?: any, context?: Partial<LogEntry>): void {
        this.log(LogLevel.WARN, message, meta, context);
    }

    /**
     * 记录信息日志
     */
    info(message: string, meta?: any, context?: Partial<LogEntry>): void {
        this.log(LogLevel.INFO, message, meta, context);
    }

    /**
     * 记录调试日志
     */
    debug(message: string, meta?: any, context?: Partial<LogEntry>): void {
        this.log(LogLevel.DEBUG, message, meta, context);
    }

    /**
     * 核心日志记录方法
     */
    private log(level: LogLevel, message: string, meta?: any, context?: Partial<LogEntry>): void {
        if (level > this.config.level) {
            return;
        }

        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level: LogLevel[level],
            message,
            meta,
            ...context
        };

        // 控制台输出
        if (this.config.enableConsole) {
            this.logToConsole(entry);
        }

        // 文件输出
        if (this.config.logFile || this.config.errorLogFile) {
            this.logQueue.push(entry);
            this.processLogQueue();
        }
    }

    /**
     * 控制台输出
     */
    private logToConsole(entry: LogEntry): void {
        const colorMap = {
            ERROR: '\x1b[31m', // 红色
            WARN: '\x1b[33m',  // 黄色
            INFO: '\x1b[36m',  // 青色
            DEBUG: '\x1b[37m'  // 白色
        };

        const reset = '\x1b[0m';
        const color = colorMap[entry.level as keyof typeof colorMap] || '';

        const logMessage = `${color}[${entry.timestamp}] ${entry.level}: ${entry.message}${reset}`;

        if (entry.level === 'ERROR') {
            console.error(logMessage, entry.meta || '');
        } else if (entry.level === 'WARN') {
            console.warn(logMessage, entry.meta || '');
        } else {
            console.log(logMessage, entry.meta || '');
        }
    }

    /**
     * 处理日志队列
     */
    private async processLogQueue(): Promise<void> {
        if (this.isWriting || this.logQueue.length === 0) {
            return;
        }

        this.isWriting = true;

        try {
            const entries = [...this.logQueue];
            this.logQueue = [];

            for (const entry of entries) {
                await this.writeLogEntry(entry);
            }
        } catch (error) {
            console.error('写入日志文件失败:', error);
        } finally {
            this.isWriting = false;
        }
    }

    /**
     * 写入日志条目到文件
     */
    private async writeLogEntry(entry: LogEntry): Promise<void> {
        const logLine = JSON.stringify(entry) + '\n';

        // 写入主日志文件
        if (this.config.logFile) {
            await this.appendToFile(this.config.logFile, logLine);
        }

        // 错误日志单独写入错误日志文件
        if (entry.level === 'ERROR' && this.config.errorLogFile) {
            await this.appendToFile(this.config.errorLogFile, logLine);
        }
    }

    /**
     * 追加内容到文件
     */
    private async appendToFile(filePath: string, content: string): Promise<void> {
        try {
            // 检查文件大小，如果超过限制则轮转
            await this.rotateLogIfNeeded(filePath);

            await fs.appendFile(filePath, content, 'utf8');
        } catch (error) {
            console.error(`写入日志文件失败 ${filePath}:`, error);
        }
    }

    /**
     * 日志轮转
     */
    private async rotateLogIfNeeded(filePath: string): Promise<void> {
        try {
            const stats = await fs.stat(filePath);

            if (stats.size > this.config.maxFileSize) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const rotatedPath = `${filePath}.${timestamp}`;

                await fs.rename(filePath, rotatedPath);

                // 清理旧的日志文件
                await this.cleanupOldLogs(path.dirname(filePath), path.basename(filePath));
            }
        } catch (error) {
            // 文件不存在或其他错误，忽略
        }
    }

    /**
     * 清理旧日志文件
     */
    private async cleanupOldLogs(logDir: string, baseFileName: string): Promise<void> {
        try {
            const files = await fs.readdir(logDir);
            const logFiles = files
                .filter(file => file.startsWith(baseFileName) && file !== baseFileName)
                .map(file => ({
                    name: file,
                    path: path.join(logDir, file),
                    stat: null as any
                }));

            // 获取文件统计信息
            for (const file of logFiles) {
                try {
                    file.stat = await fs.stat(file.path);
                } catch (error) {
                    // 忽略无法访问的文件
                }
            }

            // 按修改时间排序，保留最新的文件
            const validFiles = logFiles
                .filter(file => file.stat)
                .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());

            // 删除超过限制的文件
            if (validFiles.length > this.config.maxFiles) {
                const filesToDelete = validFiles.slice(this.config.maxFiles);

                for (const file of filesToDelete) {
                    try {
                        await fs.unlink(file.path);
                        console.log(`已删除旧日志文件: ${file.name}`);
                    } catch (error) {
                        console.error(`删除日志文件失败 ${file.name}:`, error);
                    }
                }
            }
        } catch (error) {
            console.error('清理旧日志文件失败:', error);
        }
    }

    /**
     * 刷新日志队列
     */
    async flush(): Promise<void> {
        await this.processLogQueue();
    }
}

// 默认日志配置
const defaultConfig: LoggerConfig = {
    level: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
    logFile: process.env.LOG_FILE || (process.env.NODE_ENV === 'production' ? '/var/log/ai-editor/app.log' : './logs/app.log'),
    errorLogFile: process.env.ERROR_LOG_FILE || (process.env.NODE_ENV === 'production' ? '/var/log/ai-editor/error.log' : './logs/error.log'),
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    enableConsole: process.env.NODE_ENV !== 'production'
};

// 全局日志实例
export const logger = new Logger(defaultConfig);

/**
 * 创建带有请求上下文的日志记录器
 */
export function createRequestLogger(request: Request, requestId: string) {
    const ip = request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    return {
        error: (message: string, meta?: any) =>
            logger.error(message, meta, { requestId, ip, userAgent }),
        warn: (message: string, meta?: any) =>
            logger.warn(message, meta, { requestId, ip, userAgent }),
        info: (message: string, meta?: any) =>
            logger.info(message, meta, { requestId, ip, userAgent }),
        debug: (message: string, meta?: any) =>
            logger.debug(message, meta, { requestId, ip, userAgent })
    };
}

/**
 * 生成请求ID
 */
export function generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}