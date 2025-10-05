// SessionSidebar React组件
(function () {
    'use strict';

    // 确保React和ReactDOM已加载
    function waitForReact(callback) {
        if (typeof React !== 'undefined' && typeof ReactDOM !== 'undefined') {
            callback();
        } else {
            setTimeout(() => waitForReact(callback), 100);
        }
    }

    // SessionSidebar组件定义
    function createSessionSidebar() {
        const {
            useState,
            useEffect,
            createElement: h
        } = React;

        function SessionSidebar({
            className = ""
        }) {
            const [sessions, setSessions] = useState([]);
            const [currentSessionId, setCurrentSessionId] = useState(null);
            const [stats, setStats] = useState({
                sessionCount: 0,
                messageCount: 0
            });

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
                window.addEventListener('sessionListUpdate', (e) => {
                    setSessions(e.detail.sessions);
                });

                window.addEventListener('sessionSwitch', (e) => {
                    setCurrentSessionId(e.detail.sessionId);
                });

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

            // 更新统计信息
            useEffect(() => {
                const sessionCount = sessions.length;
                const messageCount = sessions.reduce((sum, session) => sum + session.messages.length, 0);
                setStats({
                    sessionCount,
                    messageCount
                });
            }, [sessions]);

            // 事件处理函数
            const createNewSession = () => {
                // 直接创建新会话，使用默认标题
                if (window.sessionManager) {
                    window.sessionManager.createNewSession();
                }
            };

            const switchToSession = (sessionId) => {
                if (window.sessionManager) {
                    window.sessionManager.switchToSession(sessionId);
                }
            };

            const renameSession = (sessionId, currentTitle) => {
                // 找到对应的会话项元素
                const sessionItem = document.querySelector(`[data-session-id="${sessionId}"]`);
                if (!sessionItem) return;

                const titleElement = sessionItem.querySelector('.session-title');
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

            const exportSession = (sessionId) => {
                if (window.sessionManager) {
                    const exportData = window.sessionManager.exportSession(sessionId);
                    if (exportData) {
                        downloadJSON(exportData, `banana-session-${sessionId.split('_')[1]}.json`);
                        // showToast('会话导出成功');
                    }
                }
            };

            const deleteSession = (sessionId, title) => {
                if (confirm(`Are you sure you want to delete session "${title}"? This action cannot be undone.`)) {
                    if (window.sessionManager) {
                        window.sessionManager.deleteSession(sessionId);
                        // showToast('会话已删除');
                    }
                }
            };

            const exportAllSessions = () => {
                if (window.sessionManager) {
                    const exportData = window.sessionManager.exportAllSessions();
                    downloadJSON(exportData, `banana-all-sessions-${new Date().toISOString().split('T')[0]}.json`);
                    // showToast('所有会话导出成功');
                }
            };

            const clearAllSessions = () => {
                if (confirm('Are you sure you want to clear all sessions? This action cannot be undone.')) {
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

            // 工具函数
            const truncateText = (text, maxLength) => {
                if (text.length <= maxLength) return text;
                return text.substring(0, maxLength) + '...';
            };

            const formatTimeAgo = (timestamp) => {
                const now = Date.now();
                const diff = now - timestamp;
                const minutes = Math.floor(diff / 60000);
                const hours = Math.floor(diff / 3600000);
                const days = Math.floor(diff / 86400000);

                if (minutes < 1) return 'Just now';
                if (minutes < 60) return `${minutes} minutes ago`;
                if (hours < 24) return `${hours} hours ago`;
                if (days < 7) return `${days} days ago`;
                return new Date(timestamp).toLocaleDateString('en-US');
            };

            const downloadJSON = (data, filename) => {
                const dataStr = JSON.stringify(data, null, 2);
                const dataBlob = new Blob([dataStr], {
                    type: 'application/json'
                });
                const url = URL.createObjectURL(dataBlob);

                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                URL.revokeObjectURL(url);
            };

            const showToast = (message) => {
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
            const renderSessionItem = (session) => {
                const isActive = session.id === currentSessionId;
                const lastMessage = session.messages[session.messages.length - 1];
                const messagePreview = lastMessage ? truncateText(lastMessage.content, 30) : 'No messages yet';
                const timeAgo = formatTimeAgo(session.updatedAt);
                const messageCount = session.messages.length;
                const imageCount = session.messages.filter(msg => msg.imageUrl).length;

                return h('div', {
                    key: session.id,
                    'data-session-id': session.id,
                    className: `session-item ${isActive ? 'active' : ''}`,
                    style: {
                        display: 'flex',
                        alignItems: 'center',
                        marginBottom: '6px',
                        background: isActive ? 'linear-gradient(135deg, rgba(255, 248, 220, 0.8) 0%, rgba(255, 248, 220, 0.4) 100%)' : 'white',
                        border: isActive ? '1px solid #ffd700' : '1px solid #e2e8f0',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        transition: 'all 0.3s ease',
                        boxShadow: isActive ? '0 4px 12px rgba(255, 215, 0, 0.2)' : '0 1px 3px rgba(0, 0, 0, 0.05)',
                    },
                    onMouseEnter: (e) => {
                        const actions = e.currentTarget.querySelector('.session-actions');
                        if (actions) {
                            actions.style.opacity = '1';
                        }
                    },
                    onMouseLeave: (e) => {
                        const actions = e.currentTarget.querySelector('.session-actions');
                        if (actions) {
                            actions.style.opacity = '0';
                        }
                    }
                }, [
                    h('div', {
                        className: 'session-main',
                        style: {
                            flex: 1,
                            padding: '10px 12px',
                            cursor: 'pointer',
                            minWidth: 0,
                        },
                        onClick: () => switchToSession(session.id)
                    }, [
                        h('div', {
                            className: 'session-header',
                            style: {
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '3px',
                            }
                        }, [
                            h('div', {
                                className: 'session-title',
                                style: {
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    color: '#1e293b',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    flex: 1,
                                    minWidth: 0,
                                },
                                title: session.title
                            }, session.title),
                            h('div', {
                                className: 'session-time',
                                style: {
                                    fontSize: '11px',
                                    color: '#64748b',
                                    marginLeft: '8px',
                                    flexShrink: 0,
                                }
                            }, timeAgo)
                        ]),
                        h('div', {
                            className: 'session-preview',
                            style: {
                                fontSize: '12px',
                                color: '#64748b',
                                marginBottom: '4px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                lineHeight: 1.3,
                            }
                        }, messagePreview),
                        h('div', {
                            className: 'session-stats',
                            style: {
                                display: 'flex',
                                gap: '12px',
                            }
                        }, [
                            h('span', {
                                className: 'stat-item',
                                style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '11px',
                                    color: '#64748b',
                                }
                            }, [
                                h('svg', {
                                    width: 12,
                                    height: 12,
                                    viewBox: '0 0 24 24',
                                    fill: 'none',
                                    stroke: 'currentColor',
                                    strokeWidth: 2
                                }, h('path', {
                                    d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'
                                })),
                                messageCount
                            ]),
                            imageCount > 0 && h('span', {
                                className: 'stat-item',
                                style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '11px',
                                    color: '#64748b',
                                }
                            }, [
                                h('svg', {
                                    width: 12,
                                    height: 12,
                                    viewBox: '0 0 24 24',
                                    fill: 'none',
                                    stroke: 'currentColor',
                                    strokeWidth: 2
                                }, [
                                    h('rect', {
                                        key: 'rect',
                                        x: 3,
                                        y: 3,
                                        width: 18,
                                        height: 18,
                                        rx: 2,
                                        ry: 2
                                    }),
                                    h('circle', {
                                        key: 'circle',
                                        cx: 8.5,
                                        cy: 8.5,
                                        r: 1.5
                                    }),
                                    h('polyline', {
                                        key: 'polyline',
                                        points: '21,15 16,10 5,21'
                                    })
                                ]),
                                imageCount
                            ])
                        ])
                    ]),
                    h('div', {
                        className: 'session-actions',
                        style: {
                            display: 'flex',
                            flexDirection: 'column',
                            padding: '4px',
                            gap: '2px',
                            opacity: 0,
                            transition: 'opacity 0.2s ease',
                        }
                    }, [
                        h('button', {
                            className: 'action-btn',
                            style: {
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
                            },
                            onClick: (e) => {
                                e.stopPropagation();
                                renameSession(session.id, session.title);
                            },
                            title: 'Rename'
                        }, h('svg', {
                            width: 12,
                            height: 12,
                            viewBox: '0 0 24 24',
                            fill: 'none',
                            stroke: 'currentColor',
                            strokeWidth: 2
                        }, [
                            h('path', {
                                key: 'path1',
                                d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'
                            }),
                            h('path', {
                                key: 'path2',
                                d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'
                            })
                        ])),
                        h('button', {
                            className: 'action-btn',
                            style: {
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
                            },
                            onClick: (e) => {
                                e.stopPropagation();
                                exportSession(session.id);
                            },
                            title: 'Export'
                        }, h('svg', {
                            width: 12,
                            height: 12,
                            viewBox: '0 0 24 24',
                            fill: 'none',
                            stroke: 'currentColor',
                            strokeWidth: 2
                        }, [
                            h('path', {
                                key: 'path1',
                                d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'
                            }),
                            h('polyline', {
                                key: 'polyline',
                                points: '17,8 12,3 7,8'
                            }),
                            h('line', {
                                key: 'line',
                                x1: 12,
                                y1: 3,
                                x2: 12,
                                y2: 15
                            })
                        ])),
                        h('button', {
                            className: 'action-btn delete-btn',
                            style: {
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
                            },
                            onClick: (e) => {
                                e.stopPropagation();
                                deleteSession(session.id, session.title);
                            },
                            title: 'Delete'
                        }, h('svg', {
                            width: 12,
                            height: 12,
                            viewBox: '0 0 24 24',
                            fill: 'none',
                            stroke: 'currentColor',
                            strokeWidth: 2
                        }, [
                            h('polyline', {
                                key: 'polyline',
                                points: '3,6 5,6 21,6'
                            }),
                            h('path', {
                                key: 'path',
                                d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'
                            })
                        ]))
                    ])
                ]);
            };

            // 主渲染
            return h('div', {
                className: `session-sidebar ${className}`,
                style: {
                    width: '280px',
                    height: 'calc(100vh - 60px)',
                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    borderRight: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    flexShrink: 0,
                    order: 2,
                }
            }, [
                // 侧边栏头部
                h('div', {
                    className: 'sidebar-header',
                    style: {
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        padding: '12px 16px',
                        background: 'rgba(255, 255, 255, 0.8)',
                        backdropFilter: 'blur(10px)',
                        borderBottom: '1px solid #e2e8f0',
                        flexShrink: 0,
                    }
                }, [
                    h('div', {
                        className: 'header-top',
                        style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }
                    }, [
                        h('div', {
                            className: 'header-title',
                            style: {
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                            }
                        }, [
                            h('svg', {
                                className: 'title-icon',
                                width: 20,
                                height: 20,
                                viewBox: '0 0 24 24',
                                fill: 'none',
                                stroke: 'currentColor',
                                strokeWidth: 2,
                                style: {
                                    color: '#64748b',
                                    opacity: 0.8,
                                }
                            }, h('path', {
                                d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'
                            })),
                            h('span', {
                                className: 'title-text',
                                style: {
                                    fontSize: '15px',
                                    fontWeight: 700,
                                    color: '#1e293b',
                                    background: 'linear-gradient(135deg, #2d1810 0%, #64748b 100%)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text',
                                }
                            }, 'Conversations')
                        ]),
                        h('button', {
                            className: 'new-session-btn',
                            style: {
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
                            },
                            onClick: createNewSession,
                            title: 'New session'
                        }, h('svg', {
                            width: 16,
                            height: 16,
                            viewBox: '0 0 24 24',
                            fill: 'none',
                            stroke: 'currentColor',
                            strokeWidth: 2
                        }, [
                            h('line', {
                                key: 'line1',
                                x1: 12,
                                y1: 5,
                                x2: 12,
                                y2: 19
                            }),
                            h('line', {
                                key: 'line2',
                                x1: 5,
                                y1: 12,
                                x2: 19,
                                y2: 12
                            })
                        ]))
                    ]),
                    // 统计信息
                    h('div', {
                        className: 'session-stats',
                        style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px',
                            padding: '6px 10px',
                            background: 'linear-gradient(135deg, rgba(255, 248, 220, 0.3) 0%, rgba(254, 243, 199, 0.2) 100%)',
                            borderRadius: '6px',
                            border: '1px solid rgba(251, 191, 36, 0.2)',
                        }
                    }, [
                        h('div', {
                            className: 'stat-item',
                            style: {
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '12px',
                                fontWeight: 500,
                                color: '#64748b',
                            }
                        }, [
                            h('svg', {
                                width: 14,
                                height: 14,
                                viewBox: '0 0 24 24',
                                fill: 'none',
                                stroke: 'currentColor',
                                strokeWidth: 2,
                                style: {
                                    color: '#fbbf24',
                                }
                            }, h('path', {
                                d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'
                            })),
                            h('span', {}, `${stats.sessionCount} sessions`)
                        ]),
                        h('div', {
                            style: {
                                width: '1px',
                                height: '14px',
                                background: 'rgba(100, 116, 139, 0.2)',
                            }
                        }),
                        h('div', {
                            className: 'stat-item',
                            style: {
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '12px',
                                fontWeight: 500,
                                color: '#64748b',
                            }
                        }, [
                            h('svg', {
                                width: 14,
                                height: 14,
                                viewBox: '0 0 24 24',
                                fill: 'none',
                                stroke: 'currentColor',
                                strokeWidth: 2,
                                style: {
                                    color: '#fbbf24',
                                }
                            }, [
                                h('line', {
                                    key: 'line1',
                                    x1: 22,
                                    y1: 2,
                                    x2: 11,
                                    y2: 13
                                }),
                                h('polygon', {
                                    key: 'polygon',
                                    points: '22,2 15,22 11,13 2,9'
                                })
                            ]),
                            h('span', {}, `${stats.messageCount} messages`)
                        ])
                    ])
                ]),

                // 会话列表
                h('div', {
                    className: 'session-list',
                    style: {
                        flex: 1,
                        overflowY: 'auto',
                        padding: '6px 8px',
                        minHeight: 0,
                    }
                }, sessions.length === 0 ? [
                    h('div', {
                        className: 'session-empty',
                        style: {
                            textAlign: 'center',
                            padding: '40px 20px',
                            color: '#64748b',
                        }
                    }, [
                        h('svg', {
                            className: 'empty-icon',
                            width: 32,
                            height: 32,
                            viewBox: '0 0 24 24',
                            fill: 'none',
                            stroke: 'currentColor',
                            strokeWidth: 1.5,
                            style: {
                                marginBottom: '16px',
                                opacity: 0.5,
                            }
                        }, h('path', {
                            d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'
                        })),
                        h('p', {
                            className: 'empty-text',
                            style: {
                                margin: '0 0 16px 0',
                                fontSize: '14px',
                            }
                        }, 'No sessions yet'),
                        h('button', {
                            className: 'empty-action',
                            style: {
                                padding: '8px 16px',
                                background: 'linear-gradient(135deg, #ffd700 0%, #ffa500 100%)',
                                color: '#2d1810',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                            },
                            onClick: createNewSession
                        }, 'Create first session')
                    ])
                ] : sessions.map(renderSessionItem)),

                // 侧边栏底部
                h('div', {
                    className: 'sidebar-footer',
                    style: {
                        padding: '10px 16px',
                        background: 'rgba(255, 255, 255, 0.8)',
                        backdropFilter: 'blur(10px)',
                        borderTop: '1px solid #e2e8f0',
                        flexShrink: 0,
                    }
                }, [
                    h('div', {
                        className: 'footer-actions',
                        style: {
                            display: 'flex',
                            gap: '8px',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }
                    }, [
                        h('button', {
                            className: 'footer-btn',
                            style: {
                                padding: '6px 12px',
                                border: '1px solid #e2e8f0',
                                background: 'white',
                                color: '#64748b',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                transition: 'all 0.3s ease',
                                fontSize: '12px',
                                fontWeight: 500,
                            },
                            onClick: exportAllSessions,
                            title: 'Export all sessions'
                        }, [
                            h('svg', {
                                width: 14,
                                height: 14,
                                viewBox: '0 0 24 24',
                                fill: 'none',
                                stroke: 'currentColor',
                                strokeWidth: 2
                            }, [
                                h('path', {
                                    key: 'path1',
                                    d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'
                                }),
                                h('polyline', {
                                    key: 'polyline',
                                    points: '17,8 12,3 7,8'
                                }),
                                h('line', {
                                    key: 'line',
                                    x1: 12,
                                    y1: 3,
                                    x2: 12,
                                    y2: 15
                                })
                            ]),
                            'Export'
                        ]),
                        h('button', {
                            className: 'footer-btn',
                            style: {
                                padding: '6px 12px',
                                border: '1px solid #e2e8f0',
                                background: 'white',
                                color: '#64748b',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                transition: 'all 0.3s ease',
                                fontSize: '12px',
                                fontWeight: 500,
                            },
                            onClick: clearAllSessions,
                            title: 'Clear all sessions'
                        }, [
                            h('svg', {
                                width: 14,
                                height: 14,
                                viewBox: '0 0 24 24',
                                fill: 'none',
                                stroke: 'currentColor',
                                strokeWidth: 2
                            }, [
                                h('polyline', {
                                    key: 'polyline',
                                    points: '3,6 5,6 21,6'
                                }),
                                h('path', {
                                    key: 'path',
                                    d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'
                                })
                            ]),
                            'Clear'
                        ])
                    ])
                ])
            ]);
        }

        // 将组件暴露到全局
        window.SessionSidebar = SessionSidebar;
        console.log('✅ SessionSidebar React组件已定义');
    }

    // 等待React加载完成后定义组件
    waitForReact(createSessionSidebar);
})();