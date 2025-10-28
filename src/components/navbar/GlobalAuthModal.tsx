/**
 * 全局认证弹窗
 * 可在任何页面使用，支持邮箱登录和 Google OAuth
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../utils/supabase-client';
import './GlobalAuthModal.css';

interface GlobalAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GlobalAuthModal({ isOpen, onClose }: GlobalAuthModalProps) {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!supabase) {
      setError('Authentication system not configured. Please contact support.');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        // Sign up
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }

        if (password.length < 6) {
          setError('Password must be at least 6 characters');
          setLoading(false);
          return;
        }

        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) {
          setError(signUpError.message);
        } else {
          setSuccess('Sign up successful! Redirecting to editor...');
          setTimeout(() => {
            window.location.href = '/editor';
          }, 1500);
        }
      } else {
        // Sign in
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          setError(signInError.message);
        } else {
          setSuccess('Sign in successful! Redirecting to editor...');
          setTimeout(() => {
            window.location.href = '/editor';
          }, 1500);
        }
      }
    } catch (err) {
      setError('Operation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!supabase) {
      setError('Authentication system not configured');
      return;
    }

    setLoading(true);
    console.log('🔵 Starting Google OAuth sign in...');
    
    try {
      // 获取当前页面 URL，OAuth 回调后返回当前页面
      const redirectUrl = `${window.location.origin}${window.location.pathname}`;
      console.log('🔗 Redirect URL:', redirectUrl);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('❌ Google OAuth error:', error);
        setError(error.message);
        setLoading(false);
      } else {
        console.log('✅ Google OAuth initiated:', data);
        // OAuth will automatically redirect
      }
    } catch (err) {
      console.error('❌ Google sign in exception:', err);
      setError('Google sign in failed');
      setLoading(false);
    }
  };

  // 防止在服务端渲染时出错
  if (!mounted || !isOpen) return null;

  const modalContent = (
    <div className="global-auth-overlay" onClick={onClose}>
      <div className="global-auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="modal-header">
          <h2>{mode === 'login' ? 'Sign In' : 'Sign Up'} to BananaEditor</h2>
          <p className="modal-subtitle">
            {mode === 'login' 
              ? 'Get 10 free credits after signing in' 
              : 'Get 20 free credits when you sign up'}
          </p>
        </div>

        <div className="modal-tabs">
          <button
            className={`tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => {
              setMode('login');
              setError('');
              setSuccess('');
            }}
          >
            Sign In
          </button>
          <button
            className={`tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => {
              setMode('signup');
              setError('');
              setSuccess('');
            }}
          >
            Sign Up
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
              required
              disabled={loading}
              minLength={6}
            />
          </div>

          {mode === 'signup' && (
            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                required
                disabled={loading}
                minLength={6}
              />
            </div>
          )}

          <button type="submit" className="submit-button" disabled={loading}>
            {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Sign Up'}
          </button>

          <div className="divider">
            <span>or</span>
          </div>

          <button
            type="button"
            className="google-button"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>

          {mode === 'signup' && (
            <p className="terms">
              By signing up, you agree to our{' '}
              <a href="/terms" target="_blank">Terms of Service</a>
              {' '}and{' '}
              <a href="/privacy" target="_blank">Privacy Policy</a>
            </p>
          )}
        </form>
      </div>
    </div>
  );

  // 使用 Portal 将弹窗渲染到 body 顶层
  return createPortal(modalContent, document.body);
}

