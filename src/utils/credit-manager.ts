/**
 * 全局积分管理器 - 单例模式
 * 统一管理用户积分的查询、缓存和更新通知
 */

import { supabase, getCurrentUser } from './supabase-client';
import type { UserCredits } from './supabase-client';

type CreditsUpdateListener = (credits: number) => void;

class CreditManager {
    private static instance: CreditManager | null = null;

    // 当前用户积分
    private credits: number | null = null;
    private userId: string | null = null;

    // 加载状态
    private loading: boolean = false;
    private loadPromise: Promise<number | null> | null = null;

    // 缓存
    private lastFetchTime: number = 0;
    private readonly CACHE_TTL = 60000; // 60秒缓存

    // 订阅者列表
    private listeners: Set<CreditsUpdateListener> = new Set();

    private constructor() {
        console.log('🍌 [CreditManager] Initialized');

        // 监听全局积分更新事件（兼容旧系统）
        if (typeof window !== 'undefined') {
            window.addEventListener('creditsUpdated', ((event: CustomEvent) => {
                if (event.detail?.credits !== undefined) {
                    this.updateCredits(event.detail.credits);
                }
            }) as EventListener);
        }
    }

    /**
     * 获取单例实例
     */
    public static getInstance(): CreditManager {
        if (!CreditManager.instance) {
            CreditManager.instance = new CreditManager();
        }
        return CreditManager.instance;
    }

    /**
     * 订阅积分更新
     */
    public subscribe(listener: CreditsUpdateListener): () => void {
        this.listeners.add(listener);

        // 如果已有积分，立即通知
        if (this.credits !== null) {
            listener(this.credits);
        }

        // 返回取消订阅函数
        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * 获取当前积分（带缓存）
     */
    public async getCredits(): Promise<number | null> {
        // 检查缓存
        const now = Date.now();
        if (this.credits !== null && (now - this.lastFetchTime) < this.CACHE_TTL) {
            console.log('📦 [CreditManager] Using cached credits:', this.credits);
            return this.credits;
        }

        // 如果正在加载，返回相同的 Promise
        if (this.loadPromise) {
            console.log('⏳ [CreditManager] Load in progress, waiting...');
            return this.loadPromise;
        }

        // 开始新的加载
        this.loadPromise = this.fetchCredits();
        const result = await this.loadPromise;
        this.loadPromise = null;

        return result;
    }

    /**
     * 强制刷新积分
     * @param userId 可选的用户ID，如果提供则直接使用，避免重复查询用户
     */
    public async refresh(userId?: string): Promise<number | null> {
        console.log('🔄 [CreditManager] Force refresh', userId ? `for user: ${userId}` : '');
        this.lastFetchTime = 0; // 清除缓存

        if (userId) {
            // 🚀 优化：直接使用提供的 userId，避免重复查询
            return this.fetchCreditsForUser(userId);
        }

        return this.getCredits();
    }

    /**
     * 更新积分（手动设置）
     */
    public updateCredits(newCredits: number): void {
        if (this.credits === newCredits) {
            return; // 没有变化，不需要通知
        }

        console.log(`💰 [CreditManager] Credits updated: ${this.credits} → ${newCredits}`);
        this.credits = newCredits;
        this.lastFetchTime = Date.now();

        // 通知所有订阅者
        this.notifyListeners();
    }

    /**
     * 扣除积分（本地更新）
     */
    public deduct(amount: number): void {
        if (this.credits !== null) {
            this.updateCredits(Math.max(0, this.credits - amount));
        }
    }

    /**
     * 增加积分（本地更新）
     */
    public add(amount: number): void {
        if (this.credits !== null) {
            this.updateCredits(this.credits + amount);
        }
    }

    /**
     * 清除缓存（登出时调用）
     */
    public clear(): void {
        console.log('🧹 [CreditManager] Clearing cache');
        this.credits = null;
        this.userId = null;
        this.lastFetchTime = 0;
        this.loading = false;
        this.loadPromise = null;

        // 通知所有订阅者
        this.notifyListeners();
    }

    /**
     * 获取当前积分值（同步，可能为 null）
     */
    public getCurrentCredits(): number | null {
        return this.credits;
    }

    /**
     * 检查是否正在加载
     */
    public isLoading(): boolean {
        return this.loading;
    }

    // ==================== 私有方法 ====================

    /**
     * 实际查询积分
     */
    private async fetchCredits(): Promise<number | null> {
        if (!supabase) {
            console.warn('⚠️ [CreditManager] Supabase not configured');
            return null;
        }

        this.loading = true;
        const startTime = Date.now();

        try {
            console.log('📡 [CreditManager] Fetching credits...');

            // 🚀 优化：先检查用户缓存，避免重复查询用户
            const user = await getCurrentUser();
            if (!user) {
                const elapsed = Date.now() - startTime;
                console.log(`👤 [CreditManager] No user logged in (${elapsed}ms)`);
                this.credits = 0; // 未登录时设为 0 而不是 null，避免触发重新加载
                this.userId = null;
                this.lastFetchTime = Date.now();
                this.notifyListeners();
                return 0;
            }

            return this.fetchCreditsForUser(user.id);
        } catch (error) {
            console.error('❌ [CreditManager] Exception in fetchCredits:', error);
            this.credits = 0;
            this.userId = null;
            this.lastFetchTime = Date.now();
            this.notifyListeners();
            return 0;
        } finally {
            this.loading = false;
        }
    }

    /**
     * 为指定用户查询积分（跳过用户查询，直接查积分）
     */
    private async fetchCreditsForUser(userId: string): Promise<number | null> {
        if (!supabase) {
            console.warn('⚠️ [CreditManager] Supabase not configured');
            return null;
        }

        this.loading = true;
        const startTime = Date.now();

        try {
            console.log('📡 [CreditManager] Fetching credits for user:', userId);

            this.userId = userId;

            // 查询积分（5秒超时）
            const queryPromise = supabase
                .from('user_credits')
                .select('*')
                .eq('user_id', userId)
                .single();

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Query timeout after 5 seconds')), 5000)
            );

            const { data, error } = await Promise.race([
                queryPromise,
                timeoutPromise
            ]) as any;

            const elapsed = Date.now() - startTime;

            if (error) {
                if (error.code === 'PGRST116') {
                    console.warn(`⚠️ [CreditManager] No credits record found for user (${elapsed}ms)`);
                    this.credits = 0;
                    this.lastFetchTime = Date.now();
                    this.notifyListeners();
                    return 0;
                }
                console.error(`❌ [CreditManager] Error fetching credits (${elapsed}ms):`, error);
                this.credits = 0;
                this.lastFetchTime = Date.now();
                this.notifyListeners();
                return 0;
            }

            if (!data) {
                console.warn(`⚠️ [CreditManager] No credits data returned (${elapsed}ms)`);
                this.credits = 0;
                this.lastFetchTime = Date.now();
                this.notifyListeners();
                return 0;
            }

            const newCredits = data.credits || 0;
            console.log(`✅ [CreditManager] Successfully retrieved credits in ${elapsed}ms:`, newCredits);

            this.credits = newCredits;
            this.lastFetchTime = Date.now();
            this.notifyListeners();

            return newCredits;
        } catch (error: any) {
            const elapsed = Date.now() - startTime;
            if (error?.message?.includes('timeout')) {
                console.warn(`⏱️ [CreditManager] Credits query timeout after ${elapsed}ms`);
            } else {
                console.error(`❌ [CreditManager] Exception in fetchCreditsForUser (${elapsed}ms):`, error);
            }
            this.credits = 0;
            this.lastFetchTime = Date.now();
            this.notifyListeners();
            return 0;
        } finally {
            this.loading = false;
        }
    }

    /**
     * 通知所有订阅者
     */
    private notifyListeners(): void {
        const currentCredits = this.credits ?? 0;
        console.log(`📢 [CreditManager] Notifying ${this.listeners.size} listeners:`, currentCredits);

        this.listeners.forEach(listener => {
            try {
                listener(currentCredits);
            } catch (error) {
                console.error('❌ [CreditManager] Listener error:', error);
            }
        });

        // 同时触发全局事件（兼容旧系统）
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('creditsUpdated', {
                detail: { credits: currentCredits }
            }));
        }
    }
}

// 导出单例实例
export const creditManager = CreditManager.getInstance();

// 导出类型
export type { CreditsUpdateListener };

