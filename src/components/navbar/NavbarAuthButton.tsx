/**
 * 导航栏认证按钮组件
 * 可在 Astro 页面中使用的轻量级认证组件
 */

import React, { useState, useEffect } from 'react';
import { supabase, getCurrentUser, clearUserCache } from '../../utils/supabase-client';
import type { User } from '../../utils/supabase-client';
import { creditManager } from '../../utils/credit-manager';
import { initializeUserCredits, CREDIT_REASONS, getUserCredits } from '../../utils/credit-service';
import GlobalAuthModal from './GlobalAuthModal.tsx';
import './NavbarAuthButton.css';

// 添加实例计数
let instanceCount = 0;

export default function NavbarAuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    instanceCount++;
    const currentInstance = instanceCount;
    console.log(`🔢 [NavbarAuth] Instance #${currentInstance} mounted (total active: ${instanceCount})`);
    
    return () => {
      console.log(`🧹 [NavbarAuth] Instance #${currentInstance} unmounted`);
    };
  }, []);

  // 创建匿名用户（如果需要）
  const createAnonymousUserIfNeeded = async () => {
    if (!supabase) return;

    try {
      console.log('🔵 [NavbarAuth] 开始创建匿名用户...');
      
      const { data, error } = await supabase.auth.signInAnonymously();
      
      if (error) {
        console.error('❌ [NavbarAuth] 创建匿名用户失败:', error);
        setLoading(false);
        return;
      }

      if (data.user) {
        console.log('✅ [NavbarAuth] 匿名用户创建成功，用户ID:', data.user.id);
        setUser(data.user as User);
        setLoading(false);

        // 等待一小段时间，让数据库触发器有时间执行
        await new Promise(resolve => setTimeout(resolve, 500));

        // 初始化匿名用户积分（10积分）
        console.log('🔵 [NavbarAuth] 正在初始化匿名用户积分...');
        const initResult = await initializeUserCredits(
          data.user.id,
          10,
          CREDIT_REASONS.ANONYMOUS_SIGNUP
        );

        if (initResult.success) {
          console.log('✅ [NavbarAuth] 匿名用户积分初始化成功');
        } else {
          console.error('⚠️ [NavbarAuth] 匿名用户积分初始化失败:', initResult.error);
        }

        // 再等待一小段时间确保数据写入完成
        await new Promise(resolve => setTimeout(resolve, 300));

        // 刷新积分显示
        console.log('🔵 [NavbarAuth] 刷新积分显示...');
        await creditManager.refresh(data.user.id);

        // 验证积分是否成功获取
        const finalCredits = await getUserCredits(data.user.id);
        if (finalCredits && finalCredits.credits > 0) {
          console.log('✅ [NavbarAuth] 匿名用户创建完成，积分余额:', finalCredits.credits);
          setCredits(finalCredits.credits);
        } else {
          console.warn('⚠️ [NavbarAuth] 匿名用户积分可能未正确初始化，当前余额:', finalCredits?.credits || 0);
        }
      }
    } catch (error) {
      console.error('❌ [NavbarAuth] 创建匿名用户异常:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    // 检查 Supabase 是否配置
    if (!supabase) {
      console.warn('⚠️ Supabase 未配置，认证功能不可用');
      setLoading(false);
      return;
    }

    let mounted = true; // 防止组件卸载后更新状态

    // 🚀 订阅全局积分管理器
    const unsubscribeCredits = creditManager.subscribe((newCredits) => {
      if (mounted) {
        console.log('[NavbarAuth] Credits updated via manager:', newCredits);
        setCredits(newCredits);
      }
    });

    // 🚀 关键优化：不再主动查询，完全依赖 onAuthStateChange
    // Supabase 预热太慢（11秒），改为被动监听
    console.log('⏭️ [NavbarAuth] Skipping initial query, waiting for auth state change event');
    
    // 设置一个短超时，如果3秒内没有收到事件，自动创建匿名用户
    const fallbackTimer = setTimeout(async () => {
      if (mounted && loading) {
        console.log('⏱️ [NavbarAuth] No auth event after 3s, creating anonymous user...');
        await createAnonymousUserIfNeeded();
      }
    }, 3000);

    // 监听认证状态变化（包括 INITIAL_SESSION）
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 [NavbarAuth] Auth state changed:', event, session?.user?.email);
        
        if (!mounted) return;
        
        // 🚀 关键修复：只响应 INITIAL_SESSION，跳过 SIGNED_IN（SIGNED_IN 时数据库还没准备好）
        if (event === 'INITIAL_SESSION') {
          clearTimeout(fallbackTimer);
          if (session?.user) {
            console.log('✅ [NavbarAuth] User authenticated (INITIAL_SESSION):', session.user.email);
            setUser(session.user as User);
            setLoading(false);
            // 🚀 优化：直接传递 userId，避免 creditManager 重复查询用户
            await creditManager.refresh(session.user.id);
            // 关闭登录弹窗
            setShowAuthModal(false);
          } else {
            // 有事件但没有 session，创建匿名用户
            console.log('👤 [NavbarAuth] No session in INITIAL_SESSION event, creating anonymous user...');
            await createAnonymousUserIfNeeded();
          }
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // 这些事件只更新用户，不查询积分（数据库可能还没准备好）
          if (session?.user) {
            console.log('✅ [NavbarAuth] User authenticated (早期事件，等待INITIAL_SESSION):', session.user.email, event);
            setUser(session.user as User);
            setLoading(false);
            // 关闭登录弹窗
            setShowAuthModal(false);
          }
        } else if (event === 'SIGNED_OUT') {
          clearTimeout(fallbackTimer);
          console.log('👋 [NavbarAuth] User signed out');
          setUser(null);
          setCredits(0);
          setLoading(false);
          // 🚀 清除积分缓存
          creditManager.clear();
        } else if (event === 'USER_UPDATED') {
          if (session?.user) {
            console.log('🔄 [NavbarAuth] User updated:', session.user.email);
            setUser(session.user as User);
            // 🚀 优化：直接传递 userId，避免重复查询
            await creditManager.refresh(session.user.id);
          }
        }
      }
    );

    return () => {
      console.log('🧹 [NavbarAuth] Cleaning up...');
      mounted = false;
      clearTimeout(fallbackTimer);
      unsubscribeCredits();
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    if (!supabase) return;
    
    try {
      await supabase.auth.signOut();
      clearUserCache(); // 清除用户缓存
      creditManager.clear(); // 清除积分缓存
      setUser(null);
      setCredits(0);
      setShowMenu(false);
      // onAuthStateChange 会自动处理状态更新，无需刷新页面
    } catch (error) {
      console.error('登出失败:', error);
    }
  };

  const handleLoginClick = () => {
    // 打开登录弹窗
    setShowAuthModal(true);
  };

  const goToEditor = () => {
    window.location.href = '/editor';
  };

  if (loading) {
    return (
      <button className="navbar-auth-button loading">
        <svg className="loading-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" opacity="0.25"/>
          <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
        </svg>
        <span className="button-text">Loading...</span>
      </button>
    );
  }

  // 未登录状态
  if (!user) {
    return (
      <>
        <button onClick={handleLoginClick} className="navbar-auth-button login">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <span className="button-text">Sign In</span>
        </button>
        <GlobalAuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />
      </>
    );
  }

  // 匿名用户
  if (user.is_anonymous) {
    return (
      <>
        <button onClick={handleLoginClick} className="navbar-auth-button anonymous">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <span className="button-text">Sign In</span>
        </button>
        <GlobalAuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />
      </>
    );
  }

  // 已登录用户
  const userEmail = user.email || 'User';
  const displayName = userEmail.split('@')[0];
  const userInitial = displayName[0]?.toUpperCase() || 'U';

  return (
    <div className="navbar-user-menu">
      {/* 积分显示 - 独立突出显示 */}
      <div className="navbar-credits-display">
        <svg className="credits-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10"/>
          <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 6v2m0 8v2"/>
        </svg>
        <span className="credits-value">{credits}</span>
      </div>

      {/* 用户菜单触发器 */}
      <button
        className="navbar-user-trigger"
        onClick={() => setShowMenu(!showMenu)}
      >
        <div className="user-avatar">{userInitial}</div>
        <svg className="dropdown-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {/* 下拉菜单 */}
      {showMenu && (
        <>
          <div
            className="menu-backdrop"
            onClick={() => setShowMenu(false)}
          ></div>
          <div className="navbar-user-dropdown">
            <div className="dropdown-header">
              <div className="user-info-header">
                <div className="user-avatar-large">{userInitial}</div>
                <div className="user-details">
                  <div className="user-name-display">{displayName}</div>
                  <div className="user-email-display">{userEmail}</div>
                </div>
              </div>
              <div className="credits-info">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 6v2m0 8v2"/>
                </svg>
                <span className="credits-label">Credits:</span>
                <span className="credits-amount">{credits}</span>
              </div>
            </div>

            <div className="dropdown-divider"></div>

            <div className="dropdown-items">
              <button className="dropdown-item" onClick={goToEditor}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                <span>Go to Editor</span>
              </button>

              <button className="dropdown-item" onClick={() => window.location.href = '/pricing'}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 6v2m0 8v2"/>
                </svg>
                <span>Get Credits</span>
              </button>

              <button className="dropdown-item" onClick={handleSignOut}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

