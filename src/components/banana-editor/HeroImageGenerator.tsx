/**
 * Hero 区图片生成组件
 * 集成积分系统和云函数调用
 */

import React, { useState, useEffect } from 'react';
import { useCredits } from '../../hooks/useCredits';
import { getCurrentUser } from '../../utils/supabase-client';
import { SecureBananaAIProcessor } from '../../utils/secure-api-client';

interface HeroImageGeneratorProps {
  onImageGenerated?: (imageUrl: string) => void;
}

export default function HeroImageGenerator({ onImageGenerated }: HeroImageGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { credits, loading: creditsLoading, refresh: refreshCredits } = useCredits();

  // 从 URL 参数中读取 prompt
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 处理 hash 后面的参数，如 /#hero?prompt=xxx
      const hash = window.location.hash;
      if (hash.includes('?')) {
        const hashParts = hash.split('?');
        const urlParams = new URLSearchParams(hashParts[1]);
        const promptParam = urlParams.get('prompt');
        if (promptParam) {
          setPrompt(decodeURIComponent(promptParam));
          // 清除 URL 参数，只保留 hash
          window.history.replaceState({}, '', hashParts[0]);
        }
      } else {
        // 也检查普通的 search 参数
        const urlParams = new URLSearchParams(window.location.search);
        const promptParam = urlParams.get('prompt');
        if (promptParam) {
          setPrompt(decodeURIComponent(promptParam));
          // 清除 URL 参数
          const newUrl = window.location.pathname + window.location.hash;
          window.history.replaceState({}, '', newUrl);
        }
      }
    }
  }, []);

  // 获取云函数 URL
  const getCloudFunctionUrl = (): string => {
    const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';
    const devUrl = import.meta.env.PUBLIC_FIREBASE_FUNCTION_URL_DEV;
    const prodUrl = import.meta.env.PUBLIC_FIREBASE_FUNCTION_URL;

    if (isDev && devUrl) {
      return devUrl;
    }
    return prodUrl || '';
  };

  // 生成图片
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    // 检查积分
    if (credits !== null && credits < 1) {
      setError('Insufficient credits. Please purchase more credits.');
      return;
    }

    setLoading(true);
    setError(null);
    setGeneratedImage(null);

    try {
      // 获取用户信息（优雅处理未登录状态）
      let user = null;
      try {
        user = await getCurrentUser();
      } catch (authError: any) {
        // AuthSessionMissingError 是正常的未登录状态，不需要报错
        if (authError?.name !== 'AuthSessionMissingError') {
          console.warn('⚠️ Auth check warning:', authError);
        }
        user = null;
      }
      
      if (!user) {
        setError('Please sign in to generate images');
        setLoading(false);
        return;
      }

      // 创建云函数处理器
      const cloudFunctionUrl = getCloudFunctionUrl();
      if (!cloudFunctionUrl) {
        setError('Cloud function URL not configured');
        setLoading(false);
        return;
      }

      const processor = new SecureBananaAIProcessor(cloudFunctionUrl);

      // 构建请求数据
      const requestData = {
        prompt: prompt.trim(),
        style: 'realistic',
        quality: 'high',
        creativity: 70,
        colorTone: '',
        outputFormat: 'jpeg',
        conversationHistory: [],
      };

      console.log('🚀 Calling cloud function to generate image...');
      const result = await processor.callCloudFunction(requestData);

      console.log('✅ Cloud function response:', result);

      // 检查响应
      if (result.success && result.data?.imageUrl) {
        const imageUrl = result.data.imageUrl;
        setGeneratedImage(imageUrl);
        
        // 刷新积分（云函数会自动扣除）
        await refreshCredits();
        
        // 触发回调
        if (onImageGenerated) {
          onImageGenerated(imageUrl);
        }
      } else {
        const errorMessage = result.error?.message || 'Failed to generate image';
        setError(errorMessage);
      }
    } catch (err: any) {
      console.error('❌ Image generation failed:', err);
      setError(err.message || 'Failed to generate image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <>
      {/* Input Area */}
      <div className="flex flex-col gap-4 bg-[#0A0A0A]/50 rounded-xl p-6 border border-white/5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-300">Your Prompt</label>
          <div className="flex items-center gap-2">
            {credits !== null && (
              <span className="text-xs text-gray-500">
                Credits: {credits}
              </span>
            )}
            <span className="text-xs text-gray-500">English preferred</span>
          </div>
        </div>

        <div className="flex-1 relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full h-full bg-transparent text-gray-200 placeholder-gray-600 resize-none focus:outline-none text-lg leading-relaxed"
            placeholder="Describe the image you want to generate, e.g.: A cyberpunk city street at night, neon lights, rain reflections, cinematic lighting, 8k resolution..."
            rows={6}
            disabled={loading}
          />
        </div>

        <div className="flex flex-col gap-3 mt-auto">
          <button
            onClick={handleGenerate}
            disabled={loading || creditsLoading || (credits !== null && credits < 1)}
            className="w-full py-3.5 px-6 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 group"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Generating...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 group-hover:animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                <span>Generate Image</span>
              </>
            )}
          </button>
          
          <a
            href="/pricing"
            className="w-full py-3 px-6 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-medium transition-all flex items-center justify-center gap-2 text-sm border border-purple-400/20"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
            Buy more credits
          </a>
        </div>

        {error && (
          <div className="mt-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Preview Area */}
      <div className="bg-[#0A0A0A] rounded-xl border border-white/5 flex flex-col items-center justify-center relative overflow-hidden group min-h-[300px] md:min-h-auto">
        {loading && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-300 text-sm">Generating your image...</p>
            </div>
          </div>
        )}

        {generatedImage ? (
          <div className="w-full h-full flex items-center justify-center p-4">
            <img
              src={generatedImage}
              alt="Generated image"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
        ) : (
          <div className="text-center p-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center text-gray-600 group-hover:text-gray-400 transition-colors">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-500">Generated image will appear here</p>
          </div>
        )}
      </div>
    </>
  );
}

