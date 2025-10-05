import { useState, useEffect, useCallback } from "react";
import type { Message } from "../types";

// 与全局 SessionManager 交互的 Hook
export function useSessionManager() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isReady, setIsReady] = useState(false);

    // 加载当前会话的消息
    const loadCurrentMessages = useCallback(() => {
        if ((window as any).sessionManager) {
            const session = (window as any).sessionManager.getCurrentSession();
            console.log("🔄 [useSessionManager] Loading session:", session?.id, "messages:", session?.messages?.length);
            if (session) {
                setMessages(session.messages || []);
            } else {
                console.warn("⚠️ [useSessionManager] No current session found");
                setMessages([]);
            }
        }
    }, []);

    // 等待全局 SessionManager 初始化
    useEffect(() => {
        const checkSessionManager = () => {
            if ((window as any).sessionManager) {
                setIsReady(true);
                loadCurrentMessages();
            } else {
                setTimeout(checkSessionManager, 100);
            }
        };
        checkSessionManager();
    }, [loadCurrentMessages]);

    // 监听会话切换事件
    useEffect(() => {
        if (!isReady) return;

        const handleSessionSwitch = (e: CustomEvent) => {
            console.log("🔄 [useSessionManager] Session switch event received:", e.detail);
            const { session } = e.detail;
            if (session) {
                console.log("📝 [useSessionManager] Setting messages from session:", session.id, session.messages?.length);
                setMessages(session.messages || []);
            } else {
                console.warn("⚠️ [useSessionManager] No session in event detail, loading manually");
                loadCurrentMessages();
            }
        };

        const handleMessageUpdate = (e: CustomEvent) => {
            const { sessionId, message } = e.detail;
            const currentSessionId = (window as any).sessionManager?.currentSessionId;

            if (sessionId === currentSessionId) {
                // 当 sessionManager 添加消息时，更新本地状态
                setMessages((prev) => {
                    // 检查消息是否已存在，避免重复
                    if (prev.some(m => m.id === message.id)) {
                        return prev;
                    }
                    return [...prev, message];
                });
            }
        };

        const handleSessionClear = (e: CustomEvent) => {
            const { sessionId } = e.detail;
            const currentSessionId = (window as any).sessionManager?.currentSessionId;

            if (sessionId === currentSessionId) {
                setMessages([]);
            }
        };

        window.addEventListener("sessionSwitch", handleSessionSwitch as EventListener);
        window.addEventListener("messageUpdate", handleMessageUpdate as EventListener);
        window.addEventListener("sessionClear", handleSessionClear as EventListener);

        return () => {
            window.removeEventListener("sessionSwitch", handleSessionSwitch as EventListener);
            window.removeEventListener("messageUpdate", handleMessageUpdate as EventListener);
            window.removeEventListener("sessionClear", handleSessionClear as EventListener);
        };
    }, [isReady, loadCurrentMessages]);

    // 添加消息到当前会话
    const addMessage = useCallback((message: Omit<Message, "id">) => {
        if ((window as any).sessionManager) {
            // 调用 sessionManager.addMessage 会触发 messageUpdate 事件
            // messageUpdate 事件会自动更新本地状态，所以这里不需要手动更新
            const addedMessage = (window as any).sessionManager.addMessage(message);
            return addedMessage;
        }
        return null;
    }, []);

    return {
        messages,
        addMessage,
        isReady,
    };
}
