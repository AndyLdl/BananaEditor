/**
 * 积分管理服务
 * 处理用户积分的获取、增加和扣除
 */

import { supabase } from './supabase-client';
import type { UserCredits, CreditTransaction } from './supabase-client';

// 积分操作类型
export type CreditOperationType = 'earn' | 'spend';

// 🚀 积分缓存 - 避免重复查询
const creditsCache = new Map<string, { credits: UserCredits | null; timestamp: number }>();
const CREDITS_CACHE_TTL = 60000; // 缓存60秒（进一步增加缓存时间，避免频繁查询）
let creditsLoadPromises = new Map<string, Promise<UserCredits | null>>();

// 清除用户积分缓存
export function clearCreditsCache(userId?: string): void {
    if (userId) {
        creditsCache.delete(userId);
        creditsLoadPromises.delete(userId);
    } else {
        creditsCache.clear();
        creditsLoadPromises.clear();
    }
}

// 积分原因枚举
export const CREDIT_REASONS = {
    // 获得积分
    ANONYMOUS_SIGNUP: 'anonymous_signup_bonus',
    SIGNUP: 'signup_bonus',
    LOGIN: 'login_bonus',
    REFERRAL: 'referral_bonus',
    PROMOTION: 'promotion',
    PURCHASE: 'purchase',
    REFUND: 'refund',

    // 消费积分
    IMAGE_GENERATION: 'image_generation',
    IMAGE_MODIFICATION: 'image_modification',
    IMAGE_FUSION: 'image_fusion',
    PREMIUM_FEATURE: 'premium_feature',
} as const;

// 积分操作结果
export interface CreditOperationResult {
    success: boolean;
    newBalance?: number;
    error?: string;
    message?: string;
}

/**
 * 获取用户积分余额（带缓存）
 */
export async function getUserCredits(userId: string): Promise<UserCredits | null> {
    if (!supabase) {
        console.warn('Supabase 未配置，无法获取积分');
        return null;
    }

    // 🚀 优化：检查缓存
    const now = Date.now();
    const cached = creditsCache.get(userId);
    if (cached && (now - cached.timestamp) < CREDITS_CACHE_TTL) {
        console.log('📦 Using cached credits for user:', userId);
        return cached.credits;
    }

    // 🚀 优化：如果正在加载，返回相同的 Promise
    const existingPromise = creditsLoadPromises.get(userId);
    if (existingPromise) {
        console.log('⏳ Credits loading in progress for user:', userId);
        return existingPromise;
    }

    // 开始新的加载
    const loadPromise = (async () => {
        const startTime = Date.now();
        try {
            console.log('📡 [getUserCredits] Starting credits query for:', userId);

            // 使用 5 秒超时（恢复到 5 秒，避免网络慢时失败）
            const queryPromise = supabase
                .from('user_credits')
                .select('*')
                .eq('user_id', userId)
                .single(); // 使用 single() 优化查询

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Query timeout after 5 seconds')), 5000)
            );

            const { data, error } = await Promise.race([
                queryPromise,
                timeoutPromise
            ]) as any;

            if (error) {
                // PGRST116 表示没有找到记录，这是正常的
                if (error.code === 'PGRST116') {
                    console.warn('⚠️ No credits record found for user');
                    creditsCache.set(userId, { credits: null, timestamp: Date.now() });
                    return null;
                }
                console.error('❌ Error fetching credits:', error);
                return null;
            }

            // 使用 .single() 后，data 直接是对象，不是数组
            if (!data) {
                console.warn('⚠️ No credits record found for user');
                creditsCache.set(userId, { credits: null, timestamp: Date.now() });
                return null;
            }

            const elapsed = Date.now() - startTime;
            console.log(`✅ [getUserCredits] Successfully retrieved user credits in ${elapsed}ms:`, data.credits);
            const userCredits = data as UserCredits;

            // 缓存结果
            creditsCache.set(userId, { credits: userCredits, timestamp: Date.now() });
            return userCredits;
        } catch (error) {
            console.error('❌ Exception in getUserCredits:', error);
            return null;
        } finally {
            // 清除加载状态
            creditsLoadPromises.delete(userId);
        }
    })();

    // 保存加载 Promise
    creditsLoadPromises.set(userId, loadPromise);
    return loadPromise;
}

/**
 * 检查用户积分是否充足
 */
export async function hasEnoughCredits(
    userId: string,
    requiredAmount: number
): Promise<boolean> {
    const credits = await getUserCredits(userId);
    return credits ? credits.credits >= requiredAmount : false;
}

/**
 * 增加用户积分
 */
export async function addCredits(
    userId: string,
    amount: number,
    reason: string,
    metadata?: Record<string, any>
): Promise<CreditOperationResult> {
    if (!supabase) {
        return {
            success: false,
            error: 'Supabase not configured',
            message: 'Supabase 未配置',
        };
    }

    try {
        const { data, error } = await supabase.rpc('add_credits', {
            p_user_id: userId,
            p_amount: amount,
            p_reason: reason,
            p_metadata: metadata || null,
        });

        if (error) {
            console.error('增加积分失败:', error);
            return {
                success: false,
                error: error.message,
                message: '增加积分失败',
            };
        }

        // 清除缓存，下次查询时会重新获取
        clearCreditsCache(userId);

        return {
            success: data.success,
            newBalance: data.new_balance,
        };
    } catch (error) {
        console.error('增加积分异常:', error);
        return {
            success: false,
            error: String(error),
            message: '增加积分异常',
        };
    }
}

/**
 * 扣除用户积分
 */
export async function deductCredits(
    userId: string,
    amount: number,
    reason: string,
    metadata?: Record<string, any>
): Promise<CreditOperationResult> {
    if (!supabase) {
        return {
            success: false,
            error: 'Supabase not configured',
            message: 'Supabase 未配置',
        };
    }

    try {
        const { data, error } = await supabase.rpc('deduct_credits', {
            p_user_id: userId,
            p_amount: amount,
            p_reason: reason,
            p_metadata: metadata || null,
        });

        if (error) {
            console.error('扣除积分失败:', error);
            return {
                success: false,
                error: error.message,
                message: '扣除积分失败',
            };
        }

        if (!data.success) {
            return {
                success: false,
                error: data.error,
                message: data.message || '扣除积分失败',
            };
        }

        // 清除缓存，下次查询时会重新获取
        clearCreditsCache(userId);

        return {
            success: true,
            newBalance: data.new_balance,
        };
    } catch (error) {
        console.error('扣除积分异常:', error);
        return {
            success: false,
            error: String(error),
            message: '扣除积分异常',
        };
    }
}

/**
 * 初始化用户积分（首次创建用户时）
 */
export async function initializeUserCredits(
    userId: string,
    initialCredits: number = 10,
    reason: string = CREDIT_REASONS.SIGNUP
): Promise<CreditOperationResult> {
    if (!supabase) {
        return {
            success: false,
            error: 'Supabase not configured',
            message: 'Supabase 未配置',
        };
    }

    try {
        const { error } = await supabase.rpc('initialize_user_credits', {
            p_user_id: userId,
            p_initial_credits: initialCredits,
            p_reason: reason,
        });

        if (error) {
            console.error('初始化积分失败:', error);
            return {
                success: false,
                error: error.message,
                message: '初始化积分失败',
            };
        }

        return {
            success: true,
            newBalance: initialCredits,
        };
    } catch (error) {
        console.error('初始化积分异常:', error);
        return {
            success: false,
            error: String(error),
            message: '初始化积分异常',
        };
    }
}

/**
 * 升级匿名用户为正式用户（额外赠送积分）
 */
export async function upgradeAnonymousUser(
    userId: string,
    bonusCredits: number = 10
): Promise<CreditOperationResult> {
    if (!supabase) {
        return {
            success: false,
            error: 'Supabase not configured',
            message: 'Supabase 未配置',
        };
    }

    try {
        const { data, error } = await supabase.rpc('upgrade_anonymous_user', {
            p_user_id: userId,
            p_bonus_credits: bonusCredits,
        });

        if (error) {
            console.error('升级用户失败:', error);
            return {
                success: false,
                error: error.message,
                message: '升级用户失败',
            };
        }

        return {
            success: data.success,
            message: data.message,
        };
    } catch (error) {
        console.error('升级用户异常:', error);
        return {
            success: false,
            error: String(error),
            message: '升级用户异常',
        };
    }
}

/**
 * 获取用户积分交易历史
 */
export async function getTransactionHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0
): Promise<CreditTransaction[]> {
    if (!supabase) {
        return [];
    }

    try {
        const { data, error } = await supabase
            .from('credit_transactions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            console.error('获取交易历史失败:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('获取交易历史异常:', error);
        return [];
    }
}

/**
 * 获取用户积分统计信息
 */
export async function getCreditStats(userId: string): Promise<{
    totalEarned: number;
    totalSpent: number;
    currentBalance: number;
    transactionCount: number;
} | null> {
    if (!supabase) {
        return null;
    }

    try {
        const credits = await getUserCredits(userId);
        if (!credits) return null;

        const { count } = await supabase
            .from('credit_transactions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        return {
            totalEarned: credits.total_earned,
            totalSpent: credits.total_spent,
            currentBalance: credits.credits,
            transactionCount: count || 0,
        };
    } catch (error) {
        console.error('获取积分统计失败:', error);
        return null;
    }
}

/**
 * 验证并扣除积分（用于图片生成等操作）
 */
export async function validateAndDeductCredits(
    userId: string,
    amount: number,
    reason: string,
    metadata?: Record<string, any>
): Promise<CreditOperationResult> {
    // 先检查余额
    const hasEnough = await hasEnoughCredits(userId, amount);

    if (!hasEnough) {
        const credits = await getUserCredits(userId);
        return {
            success: false,
            error: 'insufficient_credits',
            message: `积分不足。当前余额: ${credits?.credits || 0}，需要: ${amount}`,
        };
    }

    // 扣除积分
    return await deductCredits(userId, amount, reason, metadata);
}

