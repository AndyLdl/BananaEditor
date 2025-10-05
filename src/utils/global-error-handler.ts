// 全局错误处理和用户反馈系统
// 为BananaEditor提供统一的错误处理和用户友好的反馈机制

import { defaultErrorLogger } from './error-logger';
import { defaultNetworkRetry } from './network-retry';
import type { ErrorLog } from './error-handler';

// 用户反馈类型
export enum FeedbackType {
    SUCCESS = 'success',
    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'error',
    LOADING = 'loading'
}

// 用户反馈消息接口
export interface UserFeedback {
    id: string;
    type: FeedbackType;
    title: string;
    message: string;
    duration?: number; // 显示时长（毫秒），0表示不自动消失
    actions?: FeedbackAction[];
    metadata?: any;
    timestamp: Date;
}

// 反馈操作接口
export interface FeedbackAction {
    label: string;
    action: () => void | Promise<void>;
    style?: 'primary' | 'secondary' | 'danger';
}

// 网络状态接口
export interface NetworkStatus {
    isOnline: boolean;
    isSlowConnection: boolean;
    lastOnlineTime?: Date;
    retryCount: number;
}

// 操作状态接口
export interface OperationStatus {
    id: string;
    type: 'generate' | 'fusion' | 'optimize' | 'upload' | 'other';
    status: 'pending' | 'processing' | 'success' | 'error' | 'cancelled';
    progress?: number; // 0-100
    message?: string;
    startTime: Date;
    endTime?: Date;
    result?: any;
    error?: Error;
}

// 全局错误处理器类
export class GlobalErrorHandler {
    private static instance: GlobalErrorHandler;
    private feedbackQueue: UserFeedback[] = [];
    private operationStatuses = new Map<string, OperationStatus>();
    private networkStatus: NetworkStatus = {
        isOnline: navigator.onLine,
        isSlowConnection: false,
        retryCount: 0
    };
    private feedbackListeners: Array<(feedback: UserFeedback) => void> = [];
    private statusListeners: Array<(status: OperationStatus) => void> = [];
    private networkListeners: Array<(status: NetworkStatus) => void> = [];

    private constructor() {
        this.initializeNetworkMonitoring();
        this.initializeGlobalErrorHandling();
    }

    // 获取单例实例
    static getInstance(): GlobalErrorHandler {
        if (!GlobalErrorHandler.instance) {
            GlobalErrorHandler.instance = new GlobalErrorHandler();
        }
        return GlobalErrorHandler.instance;
    }

    // 初始化网络监控
    private initializeNetworkMonitoring(): void {
        // 监听网络状态变化
        window.addEventListener('online', () => {
            this.updateNetworkStatus({ isOnline: true, retryCount: 0 });
            this.showFeedback({
                type: FeedbackType.SUCCESS,
                title: '网络已恢复',
                message: '网络连接已恢复正常，可以继续使用所有功能',
                duration: 3000
            });
        });

        window.addEventListener('offline', () => {
            this.updateNetworkStatus({ isOnline: false });
            this.showFeedback({
                type: FeedbackType.WARNING,
                title: '网络连接中断',
                message: '网络连接已中断，部分功能可能无法使用',
                duration: 0,
                actions: [{
                    label: '重试连接',
                    action: () => this.checkNetworkConnection(),
                    style: 'primary'
                }]
            });
        });

        // 检测慢网络连接
        this.detectSlowConnection();
    }

    // 初始化全局错误处理
    private initializeGlobalErrorHandling(): void {
        // 捕获未处理的Promise拒绝
        window.addEventListener('unhandledrejection', (event) => {
            console.error('未处理的Promise拒绝:', event.reason);

            this.handleGlobalError(event.reason, {
                type: 'unhandled_promise_rejection',
                source: 'global'
            });

            // 阻止默认的错误处理
            event.preventDefault();
        });

        // 捕获全局JavaScript错误
        window.addEventListener('error', (event) => {
            console.error('全局JavaScript错误:', event.error);

            this.handleGlobalError(event.error, {
                type: 'javascript_error',
                source: 'global',
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });

        // 捕获资源加载错误
        window.addEventListener('error', (event) => {
            if (event.target && event.target !== window) {
                const target = event.target as HTMLElement;
                console.error('资源加载错误:', target.tagName, target.getAttribute('src') || target.getAttribute('href'));

                this.handleResourceError(target);
            }
        }, true);
    }

    // 处理全局错误
    private handleGlobalError(error: Error, context: any): void {
        // 记录错误日志
        const errorLog: ErrorLog = {
            id: `global_err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'UNKNOWN_ERROR' as any,
            severity: 'high' as any,
            code: 'GLOBAL_ERROR',
            message: error.message || '未知错误',
            stack: error.stack,
            endpoint: window.location.pathname,
            method: 'GET',
            timestamp: new Date(),
            details: context
        };

        defaultErrorLogger.logError(errorLog);

        // 显示用户友好的错误消息
        this.showFeedback({
            type: FeedbackType.ERROR,
            title: '系统错误',
            message: '系统遇到了一个意外错误，我们正在处理中',
            duration: 5000,
            actions: [{
                label: '刷新页面',
                action: () => window.location.reload(),
                style: 'primary'
            }, {
                label: '报告问题',
                action: () => this.reportError(errorLog),
                style: 'secondary'
            }]
        });
    }

    // 处理资源加载错误
    private handleResourceError(element: HTMLElement): void {
        const tagName = element.tagName.toLowerCase();
        const src = element.getAttribute('src') || element.getAttribute('href');

        let message = '资源加载失败';
        let actions: FeedbackAction[] = [];

        switch (tagName) {
            case 'img':
                message = '图片加载失败，可能是网络问题或图片不存在';
                actions = [{
                    label: '重新加载',
                    action: () => {
                        if (src) {
                            element.setAttribute('src', src + '?t=' + Date.now());
                        }
                    },
                    style: 'primary'
                }];
                break;
            case 'script':
                message = 'JavaScript文件加载失败，可能影响页面功能';
                actions = [{
                    label: '刷新页面',
                    action: () => window.location.reload(),
                    style: 'primary'
                }];
                break;
            case 'link':
                message = '样式文件加载失败，页面显示可能异常';
                break;
        }

        this.showFeedback({
            type: FeedbackType.WARNING,
            title: '资源加载错误',
            message,
            duration: 5000,
            actions
        });
    }

    // 检测慢网络连接
    private detectSlowConnection(): void {
        // 使用Navigation Timing API检测网络速度
        if ('connection' in navigator) {
            const connection = (navigator as any).connection;
            if (connection) {
                const isSlowConnection = connection.effectiveType === 'slow-2g' ||
                    connection.effectiveType === '2g' ||
                    connection.downlink < 1;

                if (isSlowConnection !== this.networkStatus.isSlowConnection) {
                    this.updateNetworkStatus({ isSlowConnection });

                    if (isSlowConnection) {
                        this.showFeedback({
                            type: FeedbackType.INFO,
                            title: '网络较慢',
                            message: '检测到网络连接较慢，建议在WiFi环境下使用以获得更好体验',
                            duration: 5000
                        });
                    }
                }
            }
        }
    }

    // 更新网络状态
    private updateNetworkStatus(updates: Partial<NetworkStatus>): void {
        const oldStatus = { ...this.networkStatus };
        this.networkStatus = { ...this.networkStatus, ...updates };

        // 如果网络状态发生变化，通知监听器
        if (JSON.stringify(oldStatus) !== JSON.stringify(this.networkStatus)) {
            this.networkListeners.forEach(listener => {
                try {
                    listener(this.networkStatus);
                } catch (error) {
                    console.error('网络状态监听器错误:', error);
                }
            });
        }
    }

    // 检查网络连接
    private async checkNetworkConnection(): Promise<boolean> {
        try {
            // 尝试请求一个小的资源来测试连接
            const response = await fetch('/favicon.svg', {
                method: 'HEAD',
                cache: 'no-cache'
            });

            const isOnline = response.ok;
            this.updateNetworkStatus({
                isOnline,
                lastOnlineTime: isOnline ? new Date() : this.networkStatus.lastOnlineTime
            });

            return isOnline;
        } catch (error) {
            this.updateNetworkStatus({ isOnline: false });
            return false;
        }
    }

    // 显示用户反馈
    showFeedback(feedback: Omit<UserFeedback, 'id' | 'timestamp'>): string {
        const fullFeedback: UserFeedback = {
            id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(),
            duration: 4000, // 默认4秒
            ...feedback
        };

        this.feedbackQueue.push(fullFeedback);

        // 通知监听器
        this.feedbackListeners.forEach(listener => {
            try {
                listener(fullFeedback);
            } catch (error) {
                console.error('反馈监听器错误:', error);
            }
        });

        // 自动移除反馈（如果设置了持续时间）
        if (fullFeedback.duration && fullFeedback.duration > 0) {
            setTimeout(() => {
                this.removeFeedback(fullFeedback.id);
            }, fullFeedback.duration);
        }

        return fullFeedback.id;
    }

    // 移除反馈
    removeFeedback(feedbackId: string): void {
        const index = this.feedbackQueue.findIndex(f => f.id === feedbackId);
        if (index !== -1) {
            this.feedbackQueue.splice(index, 1);
        }
    }

    // 清除所有反馈
    clearAllFeedback(): void {
        this.feedbackQueue = [];
    }

    // 开始操作跟踪
    startOperation(
        type: OperationStatus['type'],
        message?: string
    ): string {
        const operationId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const status: OperationStatus = {
            id: operationId,
            type,
            status: 'pending',
            message: message || '正在处理...',
            startTime: new Date(),
            progress: 0
        };

        this.operationStatuses.set(operationId, status);

        // 显示加载反馈
        this.showFeedback({
            type: FeedbackType.LOADING,
            title: this.getOperationTitle(type),
            message: status.message,
            duration: 0 // 不自动消失
        });

        // 通知监听器
        this.statusListeners.forEach(listener => {
            try {
                listener(status);
            } catch (error) {
                console.error('状态监听器错误:', error);
            }
        });

        return operationId;
    }

    // 更新操作状态
    updateOperation(
        operationId: string,
        updates: Partial<Pick<OperationStatus, 'status' | 'progress' | 'message' | 'result' | 'error'>>
    ): void {
        const status = this.operationStatuses.get(operationId);
        if (!status) {
            return;
        }

        const updatedStatus = { ...status, ...updates };

        // 如果操作完成，设置结束时间
        if (updates.status && ['success', 'error', 'cancelled'].includes(updates.status)) {
            updatedStatus.endTime = new Date();
        }

        this.operationStatuses.set(operationId, updatedStatus);

        // 通知监听器
        this.statusListeners.forEach(listener => {
            try {
                listener(updatedStatus);
            } catch (error) {
                console.error('状态监听器错误:', error);
            }
        });

        // 显示完成反馈
        if (updatedStatus.status === 'success') {
            this.showFeedback({
                type: FeedbackType.SUCCESS,
                title: `${this.getOperationTitle(status.type)}完成`,
                message: updatedStatus.message || '操作已成功完成',
                duration: 3000
            });
        } else if (updatedStatus.status === 'error') {
            this.showFeedback({
                type: FeedbackType.ERROR,
                title: `${this.getOperationTitle(status.type)}失败`,
                message: updatedStatus.error?.message || updatedStatus.message || '操作失败',
                duration: 5000,
                actions: [{
                    label: '重试',
                    action: () => this.retryOperation(operationId),
                    style: 'primary'
                }]
            });
        }
    }

    // 获取操作标题
    private getOperationTitle(type: OperationStatus['type']): string {
        const titles = {
            generate: 'AI图片生成',
            fusion: '图片融合',
            optimize: '提示词优化',
            upload: '文件上传',
            other: '操作'
        };
        return titles[type] || '操作';
    }

    // 重试操作
    private async retryOperation(operationId: string): Promise<void> {
        const status = this.operationStatuses.get(operationId);
        if (!status) {
            return;
        }

        // 重置状态
        this.updateOperation(operationId, {
            status: 'pending',
            progress: 0,
            message: '正在重试...',
            error: undefined
        });

        // 这里可以添加具体的重试逻辑
        // 实际实现中，应该根据操作类型调用相应的重试函数
    }

    // 执行带错误处理的异步操作
    async executeWithErrorHandling<T>(
        operation: () => Promise<T>,
        options: {
            operationType: OperationStatus['type'];
            operationName: string;
            retryable?: boolean;
            maxRetries?: number;
            onProgress?: (progress: number) => void;
        }
    ): Promise<T> {
        const operationId = this.startOperation(options.operationType, options.operationName);

        try {
            // 检查网络状态
            if (!this.networkStatus.isOnline) {
                throw new Error('网络连接不可用，请检查网络设置');
            }

            // 执行操作
            let result: T;

            if (options.retryable !== false) {
                // 使用网络重试机制
                result = await defaultNetworkRetry.executeWithRetry(
                    operation,
                    {
                        operationName: options.operationName,
                        requestId: operationId
                    }
                );
            } else {
                result = await operation();
            }

            // 更新为成功状态
            this.updateOperation(operationId, {
                status: 'success',
                progress: 100,
                result
            });

            return result;

        } catch (error) {
            // 更新为错误状态
            this.updateOperation(operationId, {
                status: 'error',
                error: error as Error
            });

            // 根据错误类型提供不同的处理建议
            this.handleOperationError(error as Error, options.operationType);

            throw error;
        }
    }

    // 处理操作错误
    private handleOperationError(error: Error, operationType: OperationStatus['type']): void {
        let title = '操作失败';
        let message = error.message;
        let actions: FeedbackAction[] = [];

        // 根据错误类型和操作类型提供具体建议
        if (error.message.includes('网络') || error.message.includes('network')) {
            title = '网络错误';
            message = '网络连接出现问题，请检查网络设置后重试';
            actions = [{
                label: '检查网络',
                action: () => this.checkNetworkConnection(),
                style: 'primary'
            }];
        } else if (error.message.includes('超时') || error.message.includes('timeout')) {
            title = '请求超时';
            message = '操作超时，可能是网络较慢或服务器繁忙';
            actions = [{
                label: '重试',
                action: () => { }, // 具体的重试逻辑需要在调用处实现
                style: 'primary'
            }];
        } else if (error.message.includes('文件') && operationType === 'upload') {
            title = '文件上传失败';
            message = '文件上传失败，请检查文件格式和大小是否符合要求';
        } else if (operationType === 'generate') {
            title = 'AI生成失败';
            message = 'AI图片生成失败，请尝试调整提示词或稍后重试';
        } else if (operationType === 'fusion') {
            title = '图片融合失败';
            message = '图片融合失败，请检查图片格式或稍后重试';
        }

        // 不重复显示反馈，因为updateOperation已经处理了
    }

    // 报告错误
    private async reportError(errorLog: ErrorLog): Promise<void> {
        try {
            // 在实际项目中，这里应该发送错误报告到服务器
            console.log('报告错误:', errorLog);

            this.showFeedback({
                type: FeedbackType.SUCCESS,
                title: '错误报告已发送',
                message: '感谢您的反馈，我们会尽快处理这个问题',
                duration: 3000
            });
        } catch (error) {
            this.showFeedback({
                type: FeedbackType.ERROR,
                title: '报告发送失败',
                message: '无法发送错误报告，请稍后重试',
                duration: 3000
            });
        }
    }

    // 添加反馈监听器
    addFeedbackListener(listener: (feedback: UserFeedback) => void): () => void {
        this.feedbackListeners.push(listener);

        // 返回移除监听器的函数
        return () => {
            const index = this.feedbackListeners.indexOf(listener);
            if (index !== -1) {
                this.feedbackListeners.splice(index, 1);
            }
        };
    }

    // 添加状态监听器
    addStatusListener(listener: (status: OperationStatus) => void): () => void {
        this.statusListeners.push(listener);

        return () => {
            const index = this.statusListeners.indexOf(listener);
            if (index !== -1) {
                this.statusListeners.splice(index, 1);
            }
        };
    }

    // 添加网络状态监听器
    addNetworkListener(listener: (status: NetworkStatus) => void): () => void {
        this.networkListeners.push(listener);

        return () => {
            const index = this.networkListeners.indexOf(listener);
            if (index !== -1) {
                this.networkListeners.splice(index, 1);
            }
        };
    }

    // 获取当前反馈队列
    getFeedbackQueue(): UserFeedback[] {
        return [...this.feedbackQueue];
    }

    // 获取操作状态
    getOperationStatus(operationId: string): OperationStatus | undefined {
        return this.operationStatuses.get(operationId);
    }

    // 获取所有操作状态
    getAllOperationStatuses(): OperationStatus[] {
        return Array.from(this.operationStatuses.values());
    }

    // 获取网络状态
    getNetworkStatus(): NetworkStatus {
        return { ...this.networkStatus };
    }

    // 清理已完成的操作
    cleanupCompletedOperations(maxAge: number = 5 * 60 * 1000): void {
        const cutoff = new Date(Date.now() - maxAge);

        for (const [id, status] of this.operationStatuses.entries()) {
            if (status.endTime && status.endTime < cutoff) {
                this.operationStatuses.delete(id);
            }
        }
    }

    // 销毁处理器
    destroy(): void {
        this.feedbackListeners = [];
        this.statusListeners = [];
        this.networkListeners = [];
        this.feedbackQueue = [];
        this.operationStatuses.clear();
    }
}

// 导出默认实例
export const globalErrorHandler = GlobalErrorHandler.getInstance();

// 便捷函数
export function showSuccess(title: string, message: string, duration?: number): string {
    return globalErrorHandler.showFeedback({
        type: FeedbackType.SUCCESS,
        title,
        message,
        duration
    });
}

export function showError(title: string, message: string, actions?: FeedbackAction[]): string {
    return globalErrorHandler.showFeedback({
        type: FeedbackType.ERROR,
        title,
        message,
        duration: 5000,
        actions
    });
}

export function showWarning(title: string, message: string, duration?: number): string {
    return globalErrorHandler.showFeedback({
        type: FeedbackType.WARNING,
        title,
        message,
        duration: duration || 4000
    });
}

export function showInfo(title: string, message: string, duration?: number): string {
    return globalErrorHandler.showFeedback({
        type: FeedbackType.INFO,
        title,
        message,
        duration: duration || 3000
    });
}

export function showLoading(title: string, message: string): string {
    return globalErrorHandler.showFeedback({
        type: FeedbackType.LOADING,
        title,
        message,
        duration: 0
    });
}