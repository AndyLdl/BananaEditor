/**
 * 报警通知系统
 * 处理系统异常和性能问题的通知
 */

import { logger } from './logger';

export interface AlertConfig {
    webhookUrl?: string;
    emailConfig?: {
        smtp: {
            host: string;
            port: number;
            secure: boolean;
            auth: {
                user: string;
                pass: string;
            };
        };
        from: string;
        to: string[];
    };
    slackConfig?: {
        webhookUrl: string;
        channel: string;
    };
}

export interface Alert {
    level: 'info' | 'warning' | 'error' | 'critical';
    title: string;
    message: string;
    timestamp: Date;
    source: string;
    metadata?: Record<string, any>;
}

class AlertManager {
    private config: AlertConfig;
    private alertQueue: Alert[] = [];
    private isProcessing = false;

    constructor(config: AlertConfig) {
        this.config = config;
    }

    /**
     * 发送报警
     */
    async sendAlert(alert: Alert): Promise<void> {
        this.alertQueue.push(alert);

        // 记录到日志
        const logLevel = alert.level === 'critical' || alert.level === 'error' ? 'error' :
            alert.level === 'warning' ? 'warn' : 'info';

        logger[logLevel](`报警: ${alert.title}`, {
            message: alert.message,
            source: alert.source,
            metadata: alert.metadata
        });

        // 处理报警队列
        if (!this.isProcessing) {
            await this.processAlertQueue();
        }
    }

    /**
     * 处理报警队列
     */
    private async processAlertQueue(): Promise<void> {
        if (this.isProcessing || this.alertQueue.length === 0) {
            return;
        }

        this.isProcessing = true;

        try {
            while (this.alertQueue.length > 0) {
                const alert = this.alertQueue.shift()!;
                await this.deliverAlert(alert);
            }
        } catch (error) {
            logger.error('处理报警队列失败', error);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 投递报警到各个通道
     */
    private async deliverAlert(alert: Alert): Promise<void> {
        const promises: Promise<void>[] = [];

        // Webhook通知
        if (this.config.webhookUrl) {
            promises.push(this.sendWebhookAlert(alert));
        }

        // Slack通知
        if (this.config.slackConfig) {
            promises.push(this.sendSlackAlert(alert));
        }

        // 邮件通知（仅对严重级别的报警）
        if (this.config.emailConfig && (alert.level === 'error' || alert.level === 'critical')) {
            promises.push(this.sendEmailAlert(alert));
        }

        // 等待所有通知完成
        await Promise.allSettled(promises);
    }

    /**
     * 发送Webhook报警
     */
    private async sendWebhookAlert(alert: Alert): Promise<void> {
        try {
            const response = await fetch(this.config.webhookUrl!, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    level: alert.level,
                    title: alert.title,
                    message: alert.message,
                    timestamp: alert.timestamp.toISOString(),
                    source: alert.source,
                    metadata: alert.metadata
                })
            });

            if (!response.ok) {
                throw new Error(`Webhook请求失败: ${response.status}`);
            }

            logger.debug('Webhook报警发送成功', { title: alert.title });
        } catch (error) {
            logger.error('发送Webhook报警失败', error);
        }
    }

    /**
     * 发送Slack报警
     */
    private async sendSlackAlert(alert: Alert): Promise<void> {
        try {
            const color = {
                info: '#36a64f',
                warning: '#ff9500',
                error: '#ff0000',
                critical: '#8b0000'
            }[alert.level];

            const slackMessage = {
                channel: this.config.slackConfig!.channel,
                username: 'AI图片编辑工具监控',
                icon_emoji: ':warning:',
                attachments: [
                    {
                        color,
                        title: alert.title,
                        text: alert.message,
                        fields: [
                            {
                                title: '级别',
                                value: alert.level.toUpperCase(),
                                short: true
                            },
                            {
                                title: '来源',
                                value: alert.source,
                                short: true
                            },
                            {
                                title: '时间',
                                value: alert.timestamp.toLocaleString('zh-CN'),
                                short: true
                            }
                        ],
                        footer: 'AI图片编辑工具',
                        ts: Math.floor(alert.timestamp.getTime() / 1000)
                    }
                ]
            };

            const response = await fetch(this.config.slackConfig!.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(slackMessage)
            });

            if (!response.ok) {
                throw new Error(`Slack请求失败: ${response.status}`);
            }

            logger.debug('Slack报警发送成功', { title: alert.title });
        } catch (error) {
            logger.error('发送Slack报警失败', error);
        }
    }

    /**
     * 发送邮件报警
     */
    private async sendEmailAlert(alert: Alert): Promise<void> {
        try {
            // 这里需要实现邮件发送逻辑
            // 可以使用nodemailer或其他邮件库
            logger.info('邮件报警功能需要配置SMTP服务器', { title: alert.title });
        } catch (error) {
            logger.error('发送邮件报警失败', error);
        }
    }
}

// 默认报警配置
const defaultAlertConfig: AlertConfig = {
    webhookUrl: process.env.ALERT_WEBHOOK_URL,
    slackConfig: process.env.SLACK_WEBHOOK_URL ? {
        webhookUrl: process.env.SLACK_WEBHOOK_URL,
        channel: process.env.SLACK_CHANNEL || '#alerts'
    } : undefined
};

// 全局报警管理器实例
export const alertManager = new AlertManager(defaultAlertConfig);

/**
 * 系统监控报警
 */
export class SystemMonitor {
    private memoryThreshold = 0.9; // 90%
    private responseTimeThreshold = 2000; // 2秒
    private errorRateThreshold = 0.1; // 10%
    private lastCheck = Date.now();

    /**
     * 检查系统状态
     */
    async checkSystemHealth(): Promise<void> {
        try {
            // 检查内存使用率
            await this.checkMemoryUsage();

            // 检查响应时间
            await this.checkResponseTime();

            // 检查错误率
            await this.checkErrorRate();

            this.lastCheck = Date.now();
        } catch (error) {
            logger.error('系统健康检查失败', error);

            await alertManager.sendAlert({
                level: 'error',
                title: '系统健康检查失败',
                message: `健康检查过程中发生错误: ${error.message}`,
                timestamp: new Date(),
                source: 'SystemMonitor',
                metadata: { error: error.message }
            });
        }
    }

    /**
     * 检查内存使用率
     */
    private async checkMemoryUsage(): Promise<void> {
        const memoryUsage = process.memoryUsage();
        const usageRatio = memoryUsage.heapUsed / memoryUsage.heapTotal;

        if (usageRatio > this.memoryThreshold) {
            await alertManager.sendAlert({
                level: usageRatio > 0.95 ? 'critical' : 'warning',
                title: '内存使用率过高',
                message: `当前内存使用率: ${(usageRatio * 100).toFixed(1)}%`,
                timestamp: new Date(),
                source: 'SystemMonitor',
                metadata: {
                    heapUsed: memoryUsage.heapUsed,
                    heapTotal: memoryUsage.heapTotal,
                    usageRatio
                }
            });
        }
    }

    /**
     * 检查响应时间
     */
    private async checkResponseTime(): Promise<void> {
        // 这里应该从指标收集器获取实际的响应时间数据
        // 现在使用模拟检查
        const avgResponseTime = Math.random() * 3000; // 模拟响应时间

        if (avgResponseTime > this.responseTimeThreshold) {
            await alertManager.sendAlert({
                level: 'warning',
                title: '响应时间过长',
                message: `平均响应时间: ${avgResponseTime.toFixed(0)}ms`,
                timestamp: new Date(),
                source: 'SystemMonitor',
                metadata: { avgResponseTime }
            });
        }
    }

    /**
     * 检查错误率
     */
    private async checkErrorRate(): Promise<void> {
        // 这里应该从指标收集器获取实际的错误率数据
        // 现在使用模拟检查
        const errorRate = Math.random() * 0.2; // 模拟错误率

        if (errorRate > this.errorRateThreshold) {
            await alertManager.sendAlert({
                level: 'warning',
                title: '错误率过高',
                message: `当前错误率: ${(errorRate * 100).toFixed(1)}%`,
                timestamp: new Date(),
                source: 'SystemMonitor',
                metadata: { errorRate }
            });
        }
    }
}

// 全局系统监控实例
export const systemMonitor = new SystemMonitor();

/**
 * 启动系统监控
 */
export function startSystemMonitoring(): NodeJS.Timeout {
    const monitorInterval = 5 * 60 * 1000; // 5分钟检查一次

    logger.info('启动系统监控', { interval: monitorInterval });

    return setInterval(() => {
        systemMonitor.checkSystemHealth().catch(error => {
            logger.error('系统监控检查失败', error);
        });
    }, monitorInterval);
}