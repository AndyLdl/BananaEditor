import React, { useState, useEffect } from 'react';
import { supabase, getCurrentUser, clearUserCache } from '../../utils/supabase-client';
import type { User } from '../../utils/supabase-client';
import { creditManager } from '../../utils/credit-manager';
import './EditorUserInfo.css';

export default function EditorUserInfo() {
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (!supabase) {
      console.warn('⚠️ Supabase 未配置，认证功能不可用');
      setLoading(false);
      return;
    }

    let mounted = true;

    // 🚀 订阅全局积分管理器
    const unsubscribeCredits = creditManager.subscribe((newCredits) => {
      if (mounted) {
        console.log('[EditorUserInfo] Credits updated via manager:', newCredits);
        setCredits(newCredits);
      }
    });

    // 🚀 关键优化：不再主动查询，完全依赖 onAuthStateChange
    // Supabase 预热太慢（11秒），改为被动监听
    console.log('⏭️ [EditorUserInfo] Skipping initial query, waiting for auth state change event');
    
    // 设置一个短超时，如果3秒内没有收到事件，认为未登录
    const fallbackTimer = setTimeout(() => {
      if (mounted && loading) {
        console.log('⏱️ [EditorUserInfo] No auth event after 3s, assuming not logged in');
        setLoading(false);
      }
    }, 3000);

    // 监听认证状态变化
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 [EditorUserInfo] Auth state changed:', event, session?.user?.email);
        
        if (!mounted) return;
        
        // 🚀 关键修复：只响应 INITIAL_SESSION，跳过 SIGNED_IN（SIGNED_IN 时数据库还没准备好）
        if (event === 'INITIAL_SESSION') {
          clearTimeout(fallbackTimer);
          if (session?.user) {
            console.log('✅ [EditorUserInfo] User authenticated (INITIAL_SESSION):', session.user.email);
            setUser(session.user as User);
            setLoading(false);
            // 🚀 优化：直接传递 userId，避免 creditManager 重复查询用户
            await creditManager.refresh(session.user.id);
          } else {
            console.log('👤 [EditorUserInfo] No session in event');
            setUser(null);
            setLoading(false);
          }
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // 这些事件只更新用户，不查询积分（数据库可能还没准备好）
          if (session?.user) {
            console.log('✅ [EditorUserInfo] User authenticated (早期事件，等待INITIAL_SESSION):', session.user.email, event);
            setUser(session.user as User);
            setLoading(false);
          }
        } else if (event === 'SIGNED_OUT') {
          clearTimeout(fallbackTimer);
          console.log('👋 [EditorUserInfo] User signed out');
          setUser(null);
          setCredits(0);
          setLoading(false);
          // 🚀 清除积分缓存
          creditManager.clear();
        } else if (event === 'USER_UPDATED') {
          if (session?.user) {
            console.log('🔄 [EditorUserInfo] User updated:', session.user.email);
            setUser(session.user as User);
            // 🚀 优化：直接传递 userId，避免重复查询
            await creditManager.refresh(session.user.id);
          }
        }
      }
    );

    return () => {
      console.log('🧹 [EditorUserInfo] Cleaning up...');
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
      window.location.href = '/';
    } catch (error) {
      console.error('登出失败:', error);
    }
  };

  if (loading) {
    return (
      <div className="editor-user-info loading">
        <div className="skeleton-avatar"></div>
        <div className="skeleton-text"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="editor-user-info">
        <button 
          className="editor-signin-btn"
          onClick={() => window.location.href = '/?openAuth=true'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span>Sign In</span>
        </button>
      </div>
    );
  }

  // 获取用户显示名称（邮箱的前部分）
  const displayName = user.email?.split('@')[0] || 'User';

  return (
    <div className="editor-user-info">
      {/* 积分显示 - 突出显示 */}
      <div className="editor-credits-display">
        <svg className="credits-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10"/>
          <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 6v2m0 8v2"/>
        </svg>
        <span className="credits-value">{credits}</span>
      </div>

      {/* 用户菜单触发器 */}
      <div className="editor-user-trigger" onClick={() => setShowMenu(!showMenu)}>
        <div className="user-avatar">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <svg className="dropdown-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>

      {/* 下拉菜单 */}
      {showMenu && (
        <>
          <div className="menu-backdrop" onClick={() => setShowMenu(false)}></div>
          <div className="editor-user-menu">
            <div className="menu-header">
              <div className="menu-user-info">
                <div className="menu-avatar">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="menu-user-details">
                  <div className="menu-user-name">{displayName}</div>
                  <div className="menu-user-email">{user.email}</div>
                </div>
              </div>
              <div className="menu-credits">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 6v2m0 8v2"/>
                </svg>
                <span className="menu-credits-label">Credits:</span>
                <span className="menu-credits-value">{credits}</span>
              </div>
            </div>

            <div className="menu-divider"></div>

            <div className="menu-items">
              <button className="menu-item" onClick={() => window.location.href = '/'}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9,22 9,12 15,12 15,22"></polyline>
                </svg>
                <span>Home</span>
              </button>

              <button className="menu-item" onClick={() => window.location.href = '/pricing'}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 6v2m0 8v2"/>
                </svg>
                <span>Get Credits</span>
              </button>

              <button className="menu-item" onClick={handleSignOut}>
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

