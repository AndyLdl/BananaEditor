/**
 * Supabase 客户端配置
 * 用于认证和数据库操作
 */

import { createClient } from '@supabase/supabase-js';

// 从环境变量获取配置
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

// 检查是否配置了 Supabase
const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
    console.warn('⚠️ Supabase 环境变量未配置，认证功能将不可用');
    console.warn('💡 请按照 SUPABASE_SETUP_GUIDE.md 完成配置');
}

// 创建 Supabase 客户端（如果未配置则返回 null）
export const supabase = isSupabaseConfigured
    ? (() => {
        console.log('🔧 [Supabase] Creating client with config:', {
            url: supabaseUrl,
            hasKey: !!supabaseAnonKey,
        });
        return createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true,
                storage: typeof window !== 'undefined' ? window.localStorage : undefined,
            },
        });
    })()
    : null;

// 添加一个计数器，检测是否有重复初始化
if (typeof window !== 'undefined') {
    (window as any).__supabaseInitCount = ((window as any).__supabaseInitCount || 0) + 1;
    if ((window as any).__supabaseInitCount > 1) {
        console.warn(`⚠️ [Supabase] Multiple initializations detected! Count: ${(window as any).__supabaseInitCount}`);
    }
}

// 全局用户状态缓存 - 避免重复请求
let cachedUser: User | null | undefined = undefined; // undefined = 未加载, null = 未登录
let userLoadPromise: Promise<User | null> | null = null; // 正在加载的 Promise
let lastUserFetch = 0; // 上次获取的时间戳
const USER_CACHE_TTL = 30000; // 缓存30秒（增加到30秒，避免页面跳转时过期）

// 🚀 移除预热逻辑 - getSession() 太慢（11秒），改用 onAuthStateChange 事件驱动
// 预热的目的是加快首次查询，但如果预热本身就慢，反而拖慢应用启动
// 改为让组件被动监听 onAuthStateChange 事件，Supabase 会在准备好后自动触发
console.log('✨ [Supabase] Using event-driven auth, no pre-warming needed');

// 清除缓存（用于登出等场景）
export function clearUserCache(): void {
    cachedUser = undefined;
    userLoadPromise = null;
    lastUserFetch = 0;
}

// 类型定义
export interface User {
    id: string;
    email?: string;
    is_anonymous?: boolean;
    created_at?: string;
}

export interface UserCredits {
    id: string;
    user_id: string;
    credits: number;
    total_earned: number;
    total_spent: number;
    created_at: string;
    updated_at: string;
}

export interface CreditTransaction {
    id: string;
    user_id: string;
    amount: number;
    type: 'earn' | 'spend';
    reason: string;
    metadata?: Record<string, any>;
    created_at: string;
}

// 超时工具函数
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutError: string): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(timeoutError)), timeoutMs)
        )
    ]);
}

// 辅助函数：获取当前用户（带超时保护和缓存）
export async function getCurrentUser(): Promise<User | null> {
    if (!supabase) {
        console.warn('Supabase 未配置');
        return null;
    }

    // 🚀 优化：检查缓存是否有效
    const now = Date.now();
    if (cachedUser !== undefined && (now - lastUserFetch) < USER_CACHE_TTL) {
        console.log('📦 Using cached user data');
        return cachedUser;
    }

    // 🚀 优化：如果正在加载，返回相同的 Promise（避免重复请求）
    if (userLoadPromise) {
        console.log('⏳ User loading in progress, waiting...');
        return userLoadPromise;
    }

    // 开始新的加载
    userLoadPromise = (async () => {
        const startTime = Date.now();
        try {
            console.log('🔍 [getCurrentUser] Starting user query...');

            // 🚀 直接查询，不等待预热（3秒超时）
            const { data: { user }, error } = await withTimeout(
                supabase.auth.getUser(),
                3000,
                'GetUser timeout after 3 seconds'
            );

            const elapsed = Date.now() - startTime;
            console.log(`⏱️ [getCurrentUser] Query completed in ${elapsed}ms`);

            if (error) {
                // AuthSessionMissingError 是正常的未登录状态，不需要报错
                if (error.name === 'AuthSessionMissingError') {
                    cachedUser = null;
                    lastUserFetch = Date.now();
                    return null;
                }
                console.error('获取用户信息失败:', error);
                cachedUser = null;
                lastUserFetch = Date.now();
                return null;
            }

            // 缓存结果
            cachedUser = user as User;
            lastUserFetch = Date.now();
            return cachedUser;
        } catch (error: any) {
            // 超时或其他错误
            if (error?.message?.includes('timeout')) {
                console.warn('⏱️ 获取用户信息超时，将以未登录状态继续');
            } else {
                console.error('获取用户信息异常:', error);
            }
            cachedUser = null;
            lastUserFetch = Date.now();
            return null;
        } finally {
            userLoadPromise = null; // 清除加载状态
        }
    })();

    return userLoadPromise;
}

// 辅助函数：获取当前 session（带超时保护）
export async function getSession() {
    if (!supabase) {
        return null;
    }

    try {
        // 添加 5 秒超时保护
        const { data: { session }, error } = await withTimeout(
            supabase.auth.getSession(),
            5000,
            'GetSession timeout after 5 seconds'
        );

        if (error) {
            // AuthSessionMissingError 是正常的未登录状态，不需要报错
            if (error.name === 'AuthSessionMissingError') {
                return null;
            }
            console.error('获取 session 失败:', error);
            return null;
        }
        return session;
    } catch (error: any) {
        // 超时或其他错误
        if (error?.message?.includes('timeout')) {
            console.warn('⏱️ 获取 session 超时');
        } else {
            console.error('获取 session 异常:', error);
        }
        return null;
    }
}

// 辅助函数：获取访问令牌
export async function getAccessToken(): Promise<string | null> {
    const session = await getSession();
    return session?.access_token || null;
}

// 辅助函数：检查用户是否已登录
export async function isAuthenticated(): Promise<boolean> {
    const user = await getCurrentUser();
    return !!user;
}

// 辅助函数：检查是否为匿名用户
export async function isAnonymousUser(): Promise<boolean> {
    const user = await getCurrentUser();
    return user?.is_anonymous === true;
}

