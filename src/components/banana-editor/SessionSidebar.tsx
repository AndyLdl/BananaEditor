import React, { useState, useEffect } from 'react';

// 类型定义
interface Message {
    id: string;
    role: 'user' | 'model';
    content: string;
    imageUrl?: string;
    timestamp: number;
    hasImage?: boolean;
}

interface Session {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    messages: Message[];
    lastImageUrl?: string;
}

interface SessionSidebarProps {
    className?: string;
}

const SessionSidebar: React.FC<SessionSidebarProps> = ({ className = "" }) => {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [stats, setStats] = useState({ sessionCount: 0, messageCount: 0 });

    // 等待SessionManager初始化
    useEffect(() => {
        const checkSessionManager = () => {
            if (window.sessionManager) {
                setupSessionManagerEvents();
                updateSessionList();
            } else {
                setTimeout(checkSessionManager, 100);
            }
        };
        checkSessionManager();
    }, []);

    // 设置SessionManager事件监听
    const setupSessionManagerEvents = () => {
        // 监听会话列表更新
        window.addEventListener('sessionListUpdate', (e: any) => {
            setSessions(e.detail.sessions);
        });

        // 监听会话切换
        window.addEventListener('sessionSwitch', (e: any) => {
            setCurrentSessionId(e.detail.sessionId);
        });

        // 监听会话清空
        window.addEventListener('sessionClear', () => {
            updateSessionList();
        });
    };

    // 更新会话列表
    const updateSessionList = () => {
        if (window.sessionManager) {
            const allSessions = window.sessionManager.getAllSessions();
            setSessions(allSessions);
            setCurrentSessionId(window.sessionManager.currentSessionId);
        }
    };

    // 更新统计信息 - 自动根据 sessions 变化更新
    useEffect(() => {
        const sessionCount = sessions.length;
        const messageCount = sessions.reduce((sum, session) => sum + session.messages.length, 0);
        setStats({ sessionCount, messageCount });
    }, [sessions]);

    // 创建新会话
    const createNewSession = () => {
        // 直接创建新会话，使用默认标题
        if (window.sessionManager) {
            window.sessionManager.createNewSession();
        }
    };

    // 切换会话
    const switchToSession = (sessionId: string) => {
        if (window.sessionManager) {
            window.sessionManager.switchToSession(sessionId);
        }
    };

    // 重命名会话
    const renameSession = (sessionId: string, currentTitle: string) => {
        // 找到对应的会话项元素
        const sessionItem = document.querySelector(`[data-session-id="${sessionId}"]`);
        if (!sessionItem) return;

        const titleElement = sessionItem.querySelector('.session-title') as HTMLElement;
        if (!titleElement) return;

        // 创建输入框
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentTitle;
        input.style.cssText = `
            width: 100%;
            padding: 4px 8px;
            border: 2px solid #3b82f6;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            background: white;
            outline: none;
        `;

        // 保存原始内容
        const originalContent = titleElement.innerHTML;
        const originalStyle = titleElement.style.cssText;

        // 替换为输入框
        titleElement.innerHTML = '';
        titleElement.appendChild(input);
        titleElement.style.cssText = '';

        // 选中文本
        input.focus();
        input.select();

        // 处理输入完成
        const finishRename = () => {
            const newTitle = input.value.trim();
            if (newTitle && newTitle !== currentTitle && window.sessionManager) {
                window.sessionManager.updateSessionTitle(sessionId, newTitle);
            }
            // 恢复原始显示
            titleElement.innerHTML = originalContent;
            titleElement.style.cssText = originalStyle;
        };

        // 绑定事件
        input.addEventListener('blur', finishRename);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                finishRename();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                // 取消重命名，恢复原始内容
                titleElement.innerHTML = originalContent;
                titleElement.style.cssText = originalStyle;
            }
        });
    };

    // 导出会话
    const exportSession = (sessionId: string) => {
        if (window.sessionManager) {
            const exportData = window.sessionManager.exportSession(sessionId);
            if (exportData) {
                downloadJSON(exportData, `banana-session-${sessionId.split('_')[1]}.json`);
                // showToast('会话导出成功');
            }
        }
    };

    // 删除会话
    const deleteSession = (sessionId: string, title: string) => {
        if (confirm(`确定要删除会话"${title}"吗？此操作不可撤销。`)) {
            if (window.sessionManager) {
                window.sessionManager.deleteSession(sessionId);
                // showToast('会话已删除');
            }
        }
    };

    // 导出所有会话
    const exportAllSessions = () => {
        if (window.sessionManager) {
            const exportData = window.sessionManager.exportAllSessions();
            downloadJSON(exportData, `banana-all-sessions-${new Date().toISOString().split('T')[0]}.json`);
            // showToast('所有会话导出成功');
        }
    };

    // 清空所有会话
    const clearAllSessions = () => {
        if (confirm('确定要清空所有会话吗？此操作不可撤销。')) {
            if (window.sessionManager) {
                // 直接清空所有会话
                window.sessionManager.sessions.clear();
                // 清空 localStorage
                localStorage.removeItem('banana-sessions');
                localStorage.removeItem('banana-last-session-id');
                // 重置当前会话 ID
                window.sessionManager.currentSessionId = null;
                // 创建新会话
                window.sessionManager.createNewSession();
            }
        }
    };

    // 工具方法
    const truncateText = (text: string, maxLength: number) => {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    };

    const formatTimeAgo = (timestamp: number) => {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return '刚刚';
        if (minutes < 60) return `${minutes}分钟前`;
        if (hours < 24) return `${hours}小时前`;
        if (days < 7) return `${days}天前`;
        return new Date(timestamp).toLocaleDateString('zh-CN');
    };

    const downloadJSON = (data: any, filename: string) => {
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
    };

    const showToast = (message: string) => {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
      z-index: 10000;
      opacity: 0;
      transform: translateY(-10px);
      transition: all 0.3s ease;
    `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        }, 10);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    };

    // 渲染会话项目
    const renderSessionItem = (session: Session) => {
        const isActive = session.id === currentSessionId;
        const lastMessage = session.messages[session.messages.length - 1];
        const messagePreview = lastMessage ? truncateText(lastMessage.content, 30) : '暂无消息';
        const timeAgo = formatTimeAgo(session.updatedAt);
        const messageCount = session.messages.length;
        const imageCount = session.messages.filter(msg => msg.imageUrl).length;

        return (
            <div
                key={session.id}
                data-session-id={session.id}
                className={`session-item ${isActive ? 'active' : ''}`}
                style={sessionItemStyle}
                onMouseEnter={(e) => {
                    const actions = e.currentTarget.querySelector('.session-actions');
                    if (actions) {
                        (actions as HTMLElement).style.opacity = '1';
                    }
                }}
                onMouseLeave={(e) => {
                    const actions = e.currentTarget.querySelector('.session-actions');
                    if (actions) {
                        (actions as HTMLElement).style.opacity = '0';
                    }
                }}
            >
                <div
                    className="session-main"
                    style={sessionMainStyle}
                    onClick={() => switchToSession(session.id)}
                >
                    <div className="session-header" style={sessionHeaderStyle}>
                        <div 
                            className="session-title" 
                            style={sessionTitleStyle} 
                            title={session.title}
                        >
                            {session.title}
                        </div>
                        <div className="session-time" style={sessionTimeStyle}>
                            {timeAgo}
                        </div>
                    </div>
                    <div className="session-preview" style={sessionPreviewStyle}>
                        {messagePreview}
                    </div>
                    <div className="session-stats" style={sessionStatsStyle}>
                        <span className="stat-item" style={statItemStyle}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                            {messageCount}
                        </span>
                        {imageCount > 0 && (
                            <span className="stat-item" style={statItemStyle}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                    <polyline points="21,15 16,10 5,21"></polyline>
                                </svg>
                                {imageCount}
                            </span>
                        )}
                    </div>
                </div>
                <div className="session-actions" style={sessionActionsStyle}>
                    <button
                        className="action-btn"
                        style={actionBtnStyle}
                        onClick={(e) => {
                            e.stopPropagation();
                            renameSession(session.id, session.title);
                        }}
                        title="重命名"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button
                        className="action-btn"
                        style={actionBtnStyle}
                        onClick={(e) => {
                            e.stopPropagation();
                            exportSession(session.id);
                        }}
                        title="导出"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17,8 12,3 7,8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                    </button>
                    <button
                        className="action-btn delete-btn"
                        style={actionBtnStyle}
                        onClick={(e) => {
                            e.stopPropagation();
                            deleteSession(session.id, session.title);
                        }}
                        title="删除"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3,6 5,6 21,6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className={`session-sidebar ${className}`} style={sidebarStyle}>
            {/* 侧边栏头部 */}
            <div className="sidebar-header" style={headerStyle}>
                <div className="header-top" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                    <div className="header-title" style={headerTitleStyle}>
                        <svg
                            className="title-icon"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            style={titleIconStyle}
                        >
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                        <span className="title-text" style={titleTextStyle}>对话会话</span>
                    </div>
                    <button
                        className="new-session-btn"
                        style={newSessionBtnStyle}
                        onClick={createNewSession}
                        title="新建会话"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                </div>
                {/* 统计信息 */}
                <div className="session-stats" style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    padding: '6px 10px',
                    background: 'linear-gradient(135deg, rgba(255, 248, 220, 0.3) 0%, rgba(254, 243, 199, 0.2) 100%)',
                    borderRadius: '6px',
                    border: '1px solid rgba(251, 191, 36, 0.2)',
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: '#64748b',
                    }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{color: '#fbbf24'}}>
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                        <span>{stats.sessionCount} 个会话</span>
                    </div>
                    <div style={{
                        width: '1px',
                        height: '14px',
                        background: 'rgba(100, 116, 139, 0.2)',
                    }}></div>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: '#64748b',
                    }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{color: '#fbbf24'}}>
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22,2 15,22 11,13 2,9"></polygon>
                        </svg>
                        <span>{stats.messageCount} 条消息</span>
                    </div>
                </div>
            </div>

            {/* 会话列表 */}
            <div className="session-list" style={sessionListStyle}>
                {sessions.length === 0 ? (
                    <div className="session-empty" style={sessionEmptyStyle}>
                        <svg
                            className="empty-icon"
                            width="32"
                            height="32"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            style={emptyIconStyle}
                        >
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                        <p className="empty-text" style={emptyTextStyle}>暂无会话</p>
                        <button className="empty-action" style={emptyActionStyle} onClick={createNewSession}>
                            创建第一个会话
                        </button>
                    </div>
                ) : (
                    sessions.map(renderSessionItem)
                )}
            </div>

            {/* 侧边栏底部 */}
            <div className="sidebar-footer" style={footerStyle}>
                <div className="footer-actions" style={footerActionsStyle}>
                    <button
                        className="footer-btn"
                        style={{...footerBtnStyle, padding: '6px 12px', gap: '6px', fontSize: '12px', fontWeight: 500}}
                        onClick={exportAllSessions}
                        title="导出所有会话"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17,8 12,3 7,8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                        导出
                    </button>
                    <button
                        className="footer-btn"
                        style={{...footerBtnStyle, padding: '6px 12px', gap: '6px', fontSize: '12px', fontWeight: 500}}
                        onClick={clearAllSessions}
                        title="清空所有会话"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3,6 5,6 21,6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        清空
                    </button>
                </div>
            </div>
        </div>
    );
};

// 样式定义
const sidebarStyle: React.CSSProperties = {
    width: '280px',
    height: 'calc(100vh - 48px)', // 减去面包屑导航的高度
    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
    borderRight: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    flexShrink: 0,
    order: 2,
};

const headerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '12px 16px',
    background: 'rgba(255, 255, 255, 0.8)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid #e2e8f0',
    flexShrink: 0,
};

const headerTitleStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
};

const titleIconStyle: React.CSSProperties = {
    color: '#64748b',
    opacity: 0.8,
};

const titleTextStyle: React.CSSProperties = {
    fontSize: '15px',
    fontWeight: 700,
    color: '#1e293b',
    background: 'linear-gradient(135deg, #2d1810 0%, #64748b 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
};

const newSessionBtnStyle: React.CSSProperties = {
    width: '30px',
    height: '30px',
    border: '1px solid #e2e8f0',
    background: 'white',
    color: '#64748b',
    borderRadius: '7px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.3s ease',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
};

const sessionListStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: '6px 8px',
    minHeight: 0,
};

const sessionEmptyStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#64748b',
};

const emptyIconStyle: React.CSSProperties = {
    marginBottom: '16px',
    opacity: 0.5,
};

const emptyTextStyle: React.CSSProperties = {
    margin: '0 0 16px 0',
    fontSize: '14px',
};

const emptyActionStyle: React.CSSProperties = {
    padding: '8px 16px',
    background: 'linear-gradient(135deg, #ffd700 0%, #ffa500 100%)',
    color: '#2d1810',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
};

const sessionItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '6px',
    background: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    overflow: 'hidden',
    transition: 'all 0.3s ease',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
};

const sessionMainStyle: React.CSSProperties = {
    flex: 1,
    padding: '10px 12px',
    cursor: 'pointer',
    minWidth: 0,
};

const sessionHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '3px',
};

const sessionTitleStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1e293b',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flex: 1,
    minWidth: 0,
};

const sessionTimeStyle: React.CSSProperties = {
    fontSize: '11px',
    color: '#64748b',
    marginLeft: '8px',
    flexShrink: 0,
};

const sessionPreviewStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#64748b',
    marginBottom: '4px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    lineHeight: 1.3,
};

const sessionStatsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
};

const statItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    color: '#64748b',
};

const sessionActionsStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    padding: '4px',
    gap: '2px',
    opacity: 0,
    transition: 'opacity 0.2s ease',
};

const actionBtnStyle: React.CSSProperties = {
    width: '24px',
    height: '24px',
    border: 'none',
    background: 'rgba(255, 255, 255, 0.8)',
    color: '#64748b',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
};

const footerStyle: React.CSSProperties = {
    padding: '10px 16px',
    background: 'rgba(255, 255, 255, 0.8)',
    backdropFilter: 'blur(10px)',
    borderTop: '1px solid #e2e8f0',
    flexShrink: 0,
};

const footerStatsStyle: React.CSSProperties = {
    marginBottom: '8px',
};

const statsTextStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#64748b',
};

const footerActionsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
    alignItems: 'center',
};

const footerBtnStyle: React.CSSProperties = {
    width: '28px',
    height: '28px',
    border: '1px solid #e2e8f0',
    background: 'white',
    color: '#64748b',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.3s ease',
};

// 扩展Window接口以包含sessionManager
declare global {
    interface Window {
        sessionManager?: any;
    }
}

export default SessionSidebar;