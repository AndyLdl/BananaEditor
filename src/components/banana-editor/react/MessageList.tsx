import React, { useEffect, useRef } from "react";
import ChatMessage from "./ChatMessage";
import ThinkingIndicator from "./ThinkingIndicator";
import type { Message } from "./types";

interface MessageListProps {
  messages: Message[];
  isProcessing: boolean;
}

export default function MessageList({ messages, isProcessing }: MessageListProps) {
  const historyRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  const hasMessages = messages.length > 0;

  return (
    <div className="chat-history" id="chat-history" ref={historyRef}>
      {!hasMessages && !isProcessing && (
        <div className="history-empty">
          <div className="empty-icon">💬</div>
          <p className="empty-text">
            Start a conversation, describe the image effect you want
          </p>
        </div>
      )}

      {messages.map((message) => (
        <ChatMessage key={message.id} message={message} />
      ))}

      {isProcessing && <ThinkingIndicator />}
    </div>
  );
}
