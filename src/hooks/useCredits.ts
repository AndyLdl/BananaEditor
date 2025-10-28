/**
 * React Hook: 使用全局积分管理器
 * 统一的积分查询和更新接口
 */

import { useState, useEffect } from 'react';
import { creditManager } from '../utils/credit-manager';

export interface UseCreditsReturn {
    credits: number | null;
    loading: boolean;
    refresh: () => Promise<void>;
}

/**
 * 使用积分的 Hook
 * @param autoLoad 是否自动加载积分（默认 true）
 */
export function useCredits(autoLoad: boolean = true): UseCreditsReturn {
    const [credits, setCredits] = useState<number | null>(creditManager.getCurrentCredits());
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // 订阅积分更新（订阅时如果有缓存会立即通知）
        const unsubscribe = creditManager.subscribe((newCredits) => {
            console.log('[useCredits] Credits updated:', newCredits);
            setCredits(newCredits);
            setLoading(false); // 收到更新时结束加载状态
        });

        // 🚀 优化：只在没有缓存且没有正在加载时才真正查询
        if (autoLoad && creditManager.getCurrentCredits() === null && !creditManager.isLoading()) {
            const loadCredits = async () => {
                // 🚀 延迟500ms，给 EditorUserInfo 优先查询的机会
                await new Promise(resolve => setTimeout(resolve, 500));

                // 再次检查是否已有缓存（可能已被其他组件加载）
                if (creditManager.getCurrentCredits() === null && !creditManager.isLoading()) {
                    console.log('[useCredits] No cache after delay, triggering load...');
                    try {
                        await creditManager.getCredits();
                    } catch (error) {
                        console.error('[useCredits] Load failed:', error);
                    }
                } else {
                    console.log('[useCredits] Credits loaded by another component, skipping load');
                }
            };

            loadCredits();
        } else if (creditManager.isLoading()) {
            console.log('[useCredits] Credits already loading, waiting...');
        }

        // 清理订阅
        return () => {
            unsubscribe();
        };
    }, [autoLoad]);

    // 刷新积分
    const refresh = async () => {
        setLoading(true);
        try {
            await creditManager.refresh();
        } catch (error) {
            console.error('[useCredits] Refresh failed:', error);
        } finally {
            setLoading(false);
        }
    };

    return {
        credits,
        loading,
        refresh,
    };
}

