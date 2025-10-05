import React, { useEffect, useRef } from "react";
import type { Message } from "./types";

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const messageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 添加进入动画
    if (messageRef.current) {
      setTimeout(() => {
        messageRef.current?.classList.add("message-visible");
      }, 10);
    }
  }, []);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatMessageText = (text: string) => {
    return text.split("\n").map((line, i) => (
      <React.Fragment key={i}>
        {line}
        {i < text.split("\n").length - 1 && <br />}
      </React.Fragment>
    ));
  };

  const messageClasses = [
    "chat-message",
    `${message.role}-message`,
    message.isError ? "error-message" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={messageRef} className={messageClasses}>
      <div className="message-header">
        <div className={`message-avatar ${message.role}`}>
          {message.role === "user" ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          ) : (
            "🍌"
          )}
        </div>
        <div className="message-info">
          <span className="message-sender">
            {message.role === "user" ? "You" : "BananaAI"}
          </span>
          <span className="message-time">{formatTime(message.timestamp)}</span>
        </div>
      </div>
      <div className="message-content">
        <div className="message-text">{formatMessageText(message.content)}</div>
        
        {/* 如果AI消息包含图片，显示提示 */}
        {message.role === "model" && message.imageUrl && (
          <div className="image-generated-notice">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21,15 16,10 5,21"></polyline>
            </svg>
            <span>Image generated and displayed on the right canvas</span>
          </div>
        )}
      </div>
    </div>
  );
}
