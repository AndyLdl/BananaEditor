import React, { useState, useEffect, useRef } from "react";
import "./ImageWorkspaceStyles.css";

interface ImageItem {
  id: string;
  url: string;
  prompt?: string;
  timestamp: number;
}

// 扩展 Window 接口以包含 sessionManager
declare global {
  interface Window {
    sessionManager?: {
      getCurrentSession: () => any;
      currentSessionId?: string;
      saveSessions: () => void;
    };
  }
}

export default function ImageWorkspace() {
  const [currentImage, setCurrentImage] = useState<ImageItem | null>(null);
  const [historyImages, setHistoryImages] = useState<ImageItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Display mode: horizontal (gallery) or vertical (list)
  const [displayMode, setDisplayMode] = useState<'horizontal' | 'vertical'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('historyDisplayMode');
      return (saved as 'horizontal' | 'vertical') || 'vertical';
    }
    return 'vertical';
  });
  // Read saved height from localStorage, default 280px
  const [historyHeight, setHistoryHeight] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('historyGalleryHeight');
      return saved ? parseInt(saved, 10) : 280;
    }
    return 280;
  });
  const resizeRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  const galleryRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);

  // Toggle display mode
  const toggleDisplayMode = () => {
    const newMode = displayMode === 'horizontal' ? 'vertical' : 'horizontal';
    setDisplayMode(newMode);
    localStorage.setItem('historyDisplayMode', newMode);
  };

  // 辅助函数：设置当前图片并触发事件，通知 BananaAIProcessor 更新 currentActiveImage
  const setCurrentImageAndNotify = (image: ImageItem | null) => {
    setCurrentImage(image);
    
    // 触发 historyImageSelected 事件
    if (image) {
      window.dispatchEvent(
        new CustomEvent("historyImageSelected", {
          detail: {
            id: image.id,
            imageUrl: image.url,
            prompt: image.prompt,
            timestamp: image.timestamp,
          },
        })
      );
    }
  };

  // Load history images from SessionManager
  const loadHistoryFromSession = () => {
    if (typeof window === 'undefined' || !window.sessionManager) {
      console.warn('⚠️ [ImageWorkspace] SessionManager not available');
      return;
    }

    const session = window.sessionManager.getCurrentSession();
    if (!session) {
      console.warn('⚠️ [ImageWorkspace] No current session');
      setHistoryImages([]);
      setCurrentImage(null);
      return;
    }

    console.log(`🖼️ [ImageWorkspace] Loading history for session: ${session.id}`);
    
    // Extract all records with images from session messages
    const images: ImageItem[] = [];
    session.messages.forEach((msg: any, index: number) => {
      if (msg.role === "model" && msg.imageUrl) {
        // Find corresponding user prompt (previous message)
        const prevMsg = index > 0 ? session.messages[index - 1] : null;
        const prompt = prevMsg && prevMsg.role === "user" 
          ? prevMsg.content 
          : "Image generated";

        images.push({
          id: msg.id || `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          url: msg.imageUrl,
          prompt: prompt,
          timestamp: msg.timestamp || Date.now(),
        });
      }
    });

    console.log(`   Found ${images.length} images in history`);
    
    // Sort by timestamp in descending order (newest first)
    images.sort((a, b) => b.timestamp - a.timestamp);
    setHistoryImages(images);
    
    // Set current image to the newest one and notify
    if (images.length > 0) {
      setCurrentImageAndNotify(images[0]);
    } else {
      setCurrentImage(null);
    }
  };

  // Initialize: Load history images
  useEffect(() => {
    // Wait for SessionManager initialization
    const checkAndLoad = () => {
      if (typeof window !== 'undefined' && window.sessionManager) {
        loadHistoryFromSession();
      } else {
        setTimeout(checkAndLoad, 100);
      }
    };
    checkAndLoad();
  }, []);

  // Listen for session switch events
  useEffect(() => {
    const handleSessionSwitch = () => {
      console.log('🔄 [ImageWorkspace] Session switched, reloading history');
      loadHistoryFromSession();
    };

    window.addEventListener('sessionSwitch', handleSessionSwitch);
    
    return () => {
      window.removeEventListener('sessionSwitch', handleSessionSwitch);
    };
  }, []);

  // Listen for image generation events
  useEffect(() => {
    const handleImageGenerated = (event: CustomEvent) => {
      const { imageUrl, prompt } = event.detail;
      
      const newImage: ImageItem = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        url: imageUrl,
        prompt: prompt,
        timestamp: Date.now(),
      };

      setCurrentImageAndNotify(newImage);
      setHistoryImages(prev => [newImage, ...prev].slice(0, 50)); // Keep max 50 images
      setIsLoading(false);
    };

    const handleImageGenerating = () => {
      setIsLoading(true);
      setLoadingProgress(0);
      
      // Simulate progress
      const interval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + Math.random() * 15;
        });
      }, 500);

      return () => clearInterval(interval);
    };

    window.addEventListener("imageGenerated", handleImageGenerated as EventListener);
    window.addEventListener("imageGenerating", handleImageGenerating as EventListener);

    return () => {
      window.removeEventListener("imageGenerated", handleImageGenerated as EventListener);
      window.removeEventListener("imageGenerating", handleImageGenerating as EventListener);
    };
  }, []);

  // Drag to adjust history area height - Performance optimized version
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !galleryRef.current) return;
      
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      
      rafIdRef.current = requestAnimationFrame(() => {
        const deltaY = startYRef.current - e.clientY;
        const newHeight = Math.max(120, Math.min(500, startHeightRef.current + deltaY));
        
        if (galleryRef.current) {
          galleryRef.current.style.height = `${newHeight}px`;
        }
      });
    };

    const handleMouseUp = () => {
      if (isDragging.current && galleryRef.current) {
        // 取消待处理的动画帧
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        
        // 获取最终高度并更新状态
        const finalHeight = parseInt(galleryRef.current.style.height, 10);
        setHistoryHeight(finalHeight);
        
        // 保存到 localStorage
        localStorage.setItem('historyGalleryHeight', finalHeight.toString());
        
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    // 在组件挂载时添加事件监听器
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      // 清理动画帧
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []); // 空依赖数组，避免频繁重新创建监听器

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    
    if (!galleryRef.current) return;
    
    isDragging.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = galleryRef.current.offsetHeight;
    
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

  // 监听 ESC 键关闭全屏
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    if (isFullscreen) {
      document.addEventListener('keydown', handleEsc);
      // 防止背景滚动
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  const handleImageClick = (image: ImageItem) => {
    setCurrentImageAndNotify(image);
  };

  const handleDownload = async (url: string) => {
    try {
      // 使用 fetch 获取图片数据
      const response = await fetch(url);
      const blob = await response.blob();
      
      // 创建 blob URL
      const blobUrl = window.URL.createObjectURL(blob);
      
      // 创建下载链接
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `banana-ai-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      
      // 清理
      document.body.removeChild(link);
      
      // 延迟释放 blob URL，确保下载完成
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 100);
    } catch (error) {
      console.error('Failed to download image:', error);
      // Fallback: If fetch fails (e.g. CORS issue), use direct download
      const link = document.createElement('a');
      link.href = url;
      link.download = `banana-ai-${Date.now()}.png`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleClearHistory = () => {
    if (confirm('Are you sure you want to clear all history images? This will remove all image records from the current session.')) {
      // Clear React state
      setHistoryImages([]);
      setCurrentImage(null);
      
      // Clear all image messages from current session in SessionManager
      if (window.sessionManager) {
        const session = window.sessionManager.getCurrentSession();
        if (session) {
          // Filter out all messages with images
          session.messages = session.messages.filter((msg: any) => 
            !(msg.role === "model" && msg.imageUrl)
          );
          session.lastImageUrl = null;
          
          // Save updated session
          window.sessionManager.saveSessions();
          
          console.log('🗑️ [ImageWorkspace] Cleared all images from current session');
        }
      }
    }
  };

  return (
    <section className="image-workspace-container">
      {/* 当前图片显示区域 */}
      <div className="current-image-section" style={{ flex: 1 }}>
        <div className="image-header">
          <div className="image-title-section">
            <h2 className="image-title">
              <svg className="title-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
              <span className="title-text">Canvas</span>
            </h2>
            <div className="mode-indicator">
              <svg className="mode-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"></path>
              </svg>
              <span className="mode-text">Image Generation</span>
            </div>
          </div>
          <div className="image-actions">
            <button className="image-btn" onClick={() => setIsFullscreen(true)} title="Fullscreen View">
              <svg className="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
              </svg>
            </button>
            {currentImage && (
              <button className="image-btn" onClick={() => handleDownload(currentImage.url)} title="Download Image">
                <svg className="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7,10 12,15 17,10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="image-container">
          {!currentImage && !isLoading && (
            <div className="image-empty">
              <svg className="empty-icon" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
              <h3 className="empty-title">Start Your AI Creation Journey</h3>
              <p className="empty-desc">Enter a description to generate stunning images with AI</p>
            </div>
          )}

          {isLoading && (
            <div className="image-loading">
              <div className="loading-animation">
                <div className="loading-spinner"></div>
                <div className="loading-text">AI is creating...</div>
                <div className="loading-progress">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${loadingProgress}%` }}></div>
                  </div>
                  <span className="progress-text">{Math.round(loadingProgress)}%</span>
                </div>
              </div>
            </div>
          )}

          {currentImage && !isLoading && (
            <div className="current-image" onClick={() => setIsFullscreen(true)}>
              <img src={currentImage.url} alt="当前图片" />
              <div className="image-overlay">
                <div className="image-info">
                  <span className="info-item">1024×1024</span>
                  <span className="info-item">PNG</span>
                </div>
                <div className="image-hint">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path>
                  </svg>
                  <span>Click to view</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 可拖拽的分割条 */}
      <div 
        ref={resizeRef}
        className="resize-handle" 
        onMouseDown={handleResizeStart}
      >
        <div className="resize-handle-line"></div>
        <div className="resize-handle-grip">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </div>
      </div>

      {/* History Gallery */}
      <div ref={galleryRef} className="history-gallery" style={{ height: `${historyHeight}px` }}>
        <div className="gallery-header">
          <h3 className="gallery-title">
            <svg className="title-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3h18v18H3zM9 9h6v6H9z"></path>
            </svg>
            <span className="title-text">Generation History</span>
            <span className="item-count">{historyImages.length}</span>
          </h3>
          <div className="gallery-actions">
            <button 
              className="gallery-btn" 
              onClick={toggleDisplayMode} 
              title={displayMode === 'horizontal' ? 'Switch to list view' : 'Switch to gallery view'}
            >
              {displayMode === 'horizontal' ? (
                <svg className="btn-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="8" y1="6" x2="21" y2="6"></line>
                  <line x1="8" y1="12" x2="21" y2="12"></line>
                  <line x1="8" y1="18" x2="21" y2="18"></line>
                  <line x1="3" y1="6" x2="3.01" y2="6"></line>
                  <line x1="3" y1="12" x2="3.01" y2="12"></line>
                  <line x1="3" y1="18" x2="3.01" y2="18"></line>
                </svg>
              ) : (
                <svg className="btn-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
              )}
            </button>
            <button className="gallery-btn" onClick={handleClearHistory} title="Clear History">
              <svg className="btn-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3,6 5,6 21,6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>

        <div className="gallery-content">
          {historyImages.length === 0 ? (
            <div className="gallery-empty">
              <svg className="empty-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21,15 16,10 5,21"></polyline>
              </svg>
              <p className="empty-text">No images generated yet</p>
            </div>
          ) : (
            <div className={`gallery-scroll gallery-scroll-${displayMode}`}>
              {historyImages.map((image) => (
                <div 
                  key={image.id}
                  className={`history-item history-item-${displayMode} ${currentImage?.id === image.id ? 'current' : ''}`}
                  onClick={() => handleImageClick(image)}
                >
                  {currentImage?.id === image.id && <div className="item-status"></div>}
                  <img src={image.url} alt={image.prompt || 'Generated image'} />
                  {displayMode === 'vertical' && image.prompt && (
                    <div className="item-info">
                      <p className="item-prompt">{image.prompt}</p>
                      <span className="item-time">
                        {new Date(image.timestamp).toLocaleString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                  )}
                  <div className="item-overlay">
                    <button className="overlay-btn" onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(image.url);
                    }} title="Download">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7,10 12,15 17,10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                    </button>
                    {displayMode === 'vertical' && (
                      <button className="overlay-btn" onClick={(e) => {
                        e.stopPropagation();
                        setCurrentImage(image);
                        setIsFullscreen(true);
                      }} title="View Large">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Modal */}
      {isFullscreen && currentImage && (
        <div className="modal-overlay" onClick={() => setIsFullscreen(false)}>
          <div className="fullscreen-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fullscreen-header">
              <h3 className="fullscreen-title">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
                <span>Image Preview</span>
              </h3>
              <button className="close-btn" onClick={() => setIsFullscreen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="fullscreen-content">
              <img src={currentImage.url} alt="Fullscreen image" />
              <div className="image-actions-overlay">
                <button className="overlay-action-btn" onClick={() => handleDownload(currentImage.url)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7,10 12,15 17,10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  <span>Download</span>
                </button>
                <button className="overlay-action-btn" onClick={() => setIsFullscreen(false)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                  <span>Close (ESC)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

