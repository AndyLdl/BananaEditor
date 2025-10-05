import React from "react";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import { useSessionManager } from "./hooks/useSessionManager";
import { useAIProcessor } from "./hooks/useAIProcessor";
import "./ChatStyles.css";

export default function ChatContainer() {
  const { messages, addMessage, isReady } = useSessionManager();
  const { isProcessing, processMessage } = useAIProcessor();

  // 处理发送消息
  const handleSend = async (text: string) => {
    if (!text || !text.trim()) return;

    // 添加用户消息到会话
    addMessage({
      role: "user",
      content: text.trim(),
      timestamp: Date.now(),
    });

    // 处理 AI 响应
    await processMessage(text.trim());
  };

  if (!isReady) {
    return (
      <div className="chat-history">
        <div className="history-empty">
          <div className="empty-icon">⏳</div>
          <p className="empty-text">Loading chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      overflow: 'hidden' 
    }}>
      <MessageList messages={messages} isProcessing={isProcessing} />
      <ChatInput onSend={handleSend} disabled={isProcessing} />
    </div>
  );
}
