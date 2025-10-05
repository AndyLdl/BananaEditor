// 错误日志记录和监控系统
import { promises as fs } from 'fs';
import path from 'path';
import type { ErrorLog, ErrorSeverity, ErrorType } from './error-handler';

// 日志配置接口
export interface LoggerConfig {
    logLevel: ErrorSeverity;
    logToFile: boolean;
    logToConsole: boolean;
    logDirectory: string;
    maxFileSize: number; // 字节
    maxFiles: number;
    rotateDaily: boolean;
    enableRemoteLogging: boolean;
    remoteEndpoint?: string;
    bufferSize: number;
    flushInterval: number; // 毫秒
}

// 默认配置
const DEFAULT_LOGGER_CONFIG: LoggerConfig = {
    logLevel: 'low' as ErrorSeverity,
    logToFile: true,
    logToConsole: true,
    logDirectory: './logs',
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 10,
    rotateDaily: true,
    enableRemoteLogging: false,
    bufferSize: 100,
    flushInterval: 5000 // 5秒
};

// 日志条目接口
export interface LogEntry {
    timestamp: string;
    level: ErrorSeverity;
    type: ErrorType;
    message: string;
    data: any;
}

// 监控指标接口
export interface MonitoringMetrics {
    errorCount: number;
    errorRate: number; // 每分钟错误数
    criticalErrors: number;
    highSeverityErrors: number;
    mediumSeverityErrors: number;
    lowSeverityErrors: number;
    topErrorCodes: Array<{ code: string; count: number }>;
    errorsByEndpoint: Record<string, number>;
    averageResponseTime: number;
    uptime: number;
    lastError?: ErrorLog;
}

// 错误日志记录器类
export class ErrorLogger {
    private config: LoggerConfig;
    private logBuffer: LogEntry[] = [];
    private flushTimer: NodeJS.Timeout | null = null;
    private metrics: MonitoringMetrics;
    private startTime: Date;

    constructor(config?: Partial<LoggerConfig>) {
        this.config = { ...DEFAULT_LOGGER_CONFIG, ...config };
        this.startTime = new Date();
        this.metrics = this.initializeMetrics();

        // 确保日志目录存在
        this.ensureLogDirectory();

        // 启动定期刷新
        this.startFlushTimer();
    }

    // 初始化监控指标
    private initializeMetrics(): MonitoringMetrics {
        return {
            errorCount: 0,
            errorRate: 0,
            criticalErrors: 0,
            highSeverityErrors: 0,
            mediumSeverityErrors: 0,
            lowSeverityErrors: 0,
            topErrorCodes: [],
            errorsByEndpoint: {},
            averageResponseTime: 0,
            uptime: 0
        };
    }

    // 确保日志目录存在
    private async ensureLogDirectory(): Promise<void> {
        try {
            await fs.mkdir(this.config.logDirectory, { recursive: true });
        } catch (error) {
            console.error('创建日志目录失败:', error);
        }
    }

    // 检查日志级别
    private shouldLog(severity: ErrorSeverity): boolean {
        const levels: Record<ErrorSeverity, number> = {
            'low': 1,
            'medium': 2,
            'high': 3,
            'critical': 4
        };

        return levels[severity] >= levels[this.config.logLevel];
    }

    // 记录错误日志
    async logError(errorLog: ErrorLog): Promise<void> {
        if (!this.shouldLog(errorLog.severity)) {
            return;
        }

        // 更新监控指标
        this.updateMetrics(errorLog);

        // 创建日志条目
        const logEntry: LogEntry = {
            timestamp: errorLog.timestamp.toISOString(),
            level: errorLog.severity,
            type: errorLog.type,
            message: errorLog.message,
            data: {
                id: errorLog.id,
                code: errorLog.code,
                endpoint: errorLog.endpoint,
                method: errorLog.method,
                requestId: errorLog.requestId,
                sessionId: errorLog.sessionId,
                clientIP: errorLog.clientIP,
                userAgent: errorLog.userAgent,
                processingTime: errorLog.processingTime,
                stack: errorLog.stack,
                details: errorLog.details
            }
        };

        // 控制台输出
        if (this.config.logToConsole) {
            this.logToConsole(logEntry);
        }

        // 添加到缓冲区
        if (this.config.logToFile) {
            this.logBuffer.push(logEntry);

            // 如果缓冲区满了，立即刷新
            if (this.logBuffer.length >= this.config.bufferSize) {
                await this.flushLogs();
            }
        }

        // 远程日志记录
        if (this.config.enableRemoteLogging && this.config.remoteEndpoint) {
            this.sendToRemote(logEntry).catch(error => {
                console.error('发送远程日志失败:', error);
            });
        }
    }

    // 更新监控指标
    private updateMetrics(errorLog: ErrorLog): void {
        this.metrics.errorCount++;
        this.metrics.lastError = errorLog;

        // 按严重级别统计
        switch (errorLog.severity) {
            case 'critical':
                this.metrics.criticalErrors++;
                break;
            case 'high':
                this.metrics.highSeverityErrors++;
                break;
            case 'medium':
                this.metrics.mediumSeverityErrors++;
                break;
            case 'low':
                this.metrics.lowSeverityErrors++;
                break;
        }

        // 按端点统计
        if (errorLog.endpoint) {
            this.metrics.errorsByEndpoint[errorLog.endpoint] =
                (this.metrics.errorsByEndpoint[errorLog.endpoint] || 0) + 1;
        }

        // 计算运行时间
        this.metrics.uptime = Date.now() - this.startTime.getTime();

        // 计算错误率（每分钟）
        const uptimeMinutes = this.metrics.uptime / (1000 * 60);
        this.metrics.errorRate = uptimeMinutes > 0 ? this.metrics.errorCount / uptimeMinutes : 0;
    }

    // 控制台日志输出
    private logToConsole(logEntry: LogEntry): void {
        const timestamp = new Date(logEntry.timestamp).toLocaleString();
        const prefix = `[${timestamp}] [${logEntry.level.toUpperCase()}] [${logEntry.type}]`;

        const logData = {
            message: logEntry.message,
            ...logEntry.data
        };

        switch (logEntry.level) {
            case 'critical':
                console.error(`${prefix} ${logEntry.message}`, logData);
                break;
            case 'high':
                console.error(`${prefix} ${logEntry.message}`, logData);
                break;
            case 'medium':
                console.warn(`${prefix} ${logEntry.message}`, logData);
                break;
            case 'low':
                console.info(`${prefix} ${logEntry.message}`, logData);
                break;
        }
    }

    // 刷新日志到文件
    private async flushLogs(): Promise<void> {
        if (this.logBuffer.length === 0) {
            return;
        }

        try {
            const logFileName = this.getLogFileName();
            const logFilePath = path.join(this.config.logDirectory, logFileName);

            // 准备日志内容
            const logLines = this.logBuffer.map(entry => JSON.stringify(entry)).join('\n') + '\n';

            // 写入文件
            await fs.appendFile(logFilePath, logLines, 'utf8');

            // 检查文件大小并轮转
            await this.rotateLogsIfNeeded(logFilePath);

            // 清空缓冲区
            this.logBuffer = [];

        } catch (error) {
            console.error('写入日志文件失败:', error);
        }
    }

    // 获取日志文件名
    private getLogFileName(): string {
        const now = new Date();

        if (this.config.rotateDaily) {
            const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
            return `error-${dateStr}.log`;
        } else {
            return 'error.log';
        }
    }

    // 日志轮转
    private async rotateLogsIfNeeded(logFilePath: string): Promise<void> {
        try {
            const stats = await fs.stat(logFilePath);

            if (stats.size > this.config.maxFileSize) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const rotatedPath = logFilePath.replace('.log', `-${timestamp}.log`);

                await fs.rename(logFilePath, rotatedPath);

                // 清理旧文件
                await this.cleanupOldLogs();
            }
        } catch (error) {
            console.error('日志轮转失败:', error);
        }
    }

    // 清理旧日志文件
    private async cleanupOldLogs(): Promise<void> {
        try {
            const files = await fs.readdir(this.config.logDirectory);
            const logFiles = files
                .filter(file => file.startsWith('error-') && file.endsWith('.log'))
                .map(file => ({
                    name: file,
                    path: path.join(this.config.logDirectory, file)
                }));

            // 按修改时间排序
            const fileStats = await Promise.all(
                logFiles.map(async file => ({
                    ...file,
                    mtime: (await fs.stat(file.path)).mtime
                }))
            );

            fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

            // 删除超出数量限制的文件
            if (fileStats.length > this.config.maxFiles) {
                const filesToDelete = fileStats.slice(this.config.maxFiles);

                for (const file of filesToDelete) {
                    await fs.unlink(file.path);
                    console.log(`删除旧日志文件: ${file.name}`);
                }
            }
        } catch (error) {
            console.error('清理旧日志文件失败:', error);
        }
    }

    // 发送到远程日志服务
    private async sendToRemote(logEntry: LogEntry): Promise<void> {
        if (!this.config.remoteEndpoint) {
            return;
        }

        try {
            const response = await fetch(this.config.remoteEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'AI-Editor-Logger/1.0'
                },
                body: JSON.stringify({
                    service: 'ai-editor',
                    environment: process.env.NODE_ENV || 'development',
                    ...logEntry
                })
            });

            if (!response.ok) {
                throw new Error(`远程日志服务返回错误: ${response.status}`);
            }
        } catch (error) {
            // 远程日志失败不应该影响主要功能
            console.error('发送远程日志失败:', error);
        }
    }

    // 启动定期刷新定时器
    private startFlushTimer(): void {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }

        this.flushTimer = setInterval(async () => {
            await this.flushLogs();
        }, this.config.flushInterval);
    }

    // 停止定时器
    private stopFlushTimer(): void {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
    }

    // 获取监控指标
    getMetrics(): MonitoringMetrics {
        // 更新运行时间
        this.metrics.uptime = Date.now() - this.startTime.getTime();

        // 计算错误率
        const uptimeMinutes = this.metrics.uptime / (1000 * 60);
        this.metrics.errorRate = uptimeMinutes > 0 ? this.metrics.errorCount / uptimeMinutes : 0;

        return { ...this.metrics };
    }

    // 重置指标
    resetMetrics(): void {
        this.metrics = this.initializeMetrics();
        this.startTime = new Date();
    }

    // 获取日志统计
    async getLogStats(timeRange?: { start: Date; end: Date }): Promise<{
        totalLogs: number;
        logsByLevel: Record<ErrorSeverity, number>;
        logsByType: Record<ErrorType, number>;
        recentLogs: LogEntry[];
    }> {
        // 这里可以实现从日志文件读取统计信息
        // 目前返回基于内存的统计
        return {
            totalLogs: this.metrics.errorCount,
            logsByLevel: {
                'critical': this.metrics.criticalErrors,
                'high': this.metrics.highSeverityErrors,
                'medium': this.metrics.mediumSeverityErrors,
                'low': this.metrics.lowSeverityErrors
            },
            logsByType: {} as Record<ErrorType, number>, // 需要从日志文件统计
            recentLogs: this.logBuffer.slice(-10) // 最近10条日志
        };
    }

    // 搜索日志
    async searchLogs(query: {
        level?: ErrorSeverity;
        type?: ErrorType;
        message?: string;
        timeRange?: { start: Date; end: Date };
        limit?: number;
    }): Promise<LogEntry[]> {
        // 这里可以实现日志搜索功能
        // 目前返回缓冲区中的匹配日志
        let results = [...this.logBuffer];

        if (query.level) {
            results = results.filter(log => log.level === query.level);
        }

        if (query.type) {
            results = results.filter(log => log.type === query.type);
        }

        if (query.message) {
            const searchTerm = query.message.toLowerCase();
            results = results.filter(log =>
                log.message.toLowerCase().includes(searchTerm)
            );
        }

        if (query.timeRange) {
            results = results.filter(log => {
                const logTime = new Date(log.timestamp);
                return logTime >= query.timeRange!.start && logTime <= query.timeRange!.end;
            });
        }

        if (query.limit) {
            results = results.slice(0, query.limit);
        }

        return results;
    }

    // 导出日志
    async exportLogs(
        format: 'json' | 'csv' | 'txt',
        timeRange?: { start: Date; end: Date }
    ): Promise<string> {
        const logs = await this.searchLogs({ timeRange });

        switch (format) {
            case 'json':
                return JSON.stringify(logs, null, 2);

            case 'csv':
                const headers = 'timestamp,level,type,message,endpoint,requestId,sessionId,clientIP\n';
                const rows = logs.map(log => [
                    log.timestamp,
                    log.level,
                    log.type,
                    `"${log.message.replace(/"/g, '""')}"`,
                    log.data.endpoint || '',
                    log.data.requestId || '',
                    log.data.sessionId || '',
                    log.data.clientIP || ''
                ].join(',')).join('\n');
                return headers + rows;

            case 'txt':
                return logs.map(log =>
                    `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.type}] ${log.message}`
                ).join('\n');

            default:
                throw new Error(`不支持的导出格式: ${format}`);
        }
    }

    // 立即刷新所有日志
    async flush(): Promise<void> {
        await this.flushLogs();
    }

    // 销毁日志记录器
    async destroy(): Promise<void> {
        this.stopFlushTimer();
        await this.flushLogs();
    }

    // 更新配置
    updateConfig(config: Partial<LoggerConfig>): void {
        this.config = { ...this.config, ...config };

        // 重启定时器
        this.startFlushTimer();
    }

    // 获取配置
    getConfig(): LoggerConfig {
        return { ...this.config };
    }
}

// 创建默认日志记录器实例
export const defaultErrorLogger = new ErrorLogger();

// 便捷的日志记录函数
export async function logError(errorLog: ErrorLog): Promise<void> {
    await defaultErrorLogger.logError(errorLog);
}

// 便捷的指标获取函数
export function getErrorMetrics(): MonitoringMetrics {
    return defaultErrorLogger.getMetrics();
}