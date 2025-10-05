import React, { useEffect, useRef } from "react";

export default function ThinkingIndicator() {
  const messageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 添加进入动画
    if (messageRef.current) {
      setTimeout(() => {
        messageRef.current?.classList.add("message-visible");
      }, 10);
    }
  }, []);

  return (
    <div ref={messageRef} className="chat-message model-message ai-thinking">
      <div className="message-header">
        <div className="message-avatar model">🍌</div>
        <div className="message-info">
          <span className="message-sender">BananaAI</span>
          <span className="message-time">Thinking...</span>
        </div>
      </div>
      <div className="message-content">
        <div className="thinking-animation">
          <div className="thinking-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span className="thinking-text">AI is generating image, please wait...</span>
        </div>
      </div>
    </div>
  );
}
