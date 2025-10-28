import React, { useState, useRef, useEffect } from "react";
import { supabase } from "../../../utils/supabase-client";
import { useCredits } from "../../../hooks/useCredits";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

const quickSuggestions = [
  { 
    id: 1, 
    label: "Realistic Portrait", 
    prompt: "Professional studio portrait of a person, natural lighting, shallow depth of field, detailed facial features, photorealistic, 4K quality, DSLR camera style" 
  },
  { 
    id: 2, 
    label: "Anime Character", 
    prompt: "Anime style character illustration, vibrant colors, expressive eyes, detailed hair, cel shading, Japanese animation art style, high quality digital painting" 
  },
  { 
    id: 3, 
    label: "Watercolor Art", 
    prompt: "Soft watercolor painting with flowing colors, gentle brush strokes, artistic paper texture, dreamy atmosphere, pastel color palette, traditional art medium" 
  },
  { 
    id: 4, 
    label: "3D Rendered", 
    prompt: "High-quality 3D rendering with ray tracing, smooth surfaces, realistic materials and lighting, volumetric effects, cinema 4D style, octane render quality" 
  },
  { 
    id: 5, 
    label: "Pixel Art", 
    prompt: "Retro pixel art style, 16-bit or 8-bit graphics, limited color palette, nostalgic gaming aesthetic, crisp pixels, detailed sprite work" 
  },
  { 
    id: 6, 
    label: "Cyberpunk Scene", 
    prompt: "Futuristic cyberpunk cityscape, neon lights, rain-soaked streets, dark atmosphere, high-tech low-life aesthetic, blade runner inspired, vibrant purple and blue tones" 
  },
  { 
    id: 7, 
    label: "Fantasy Landscape", 
    prompt: "Epic fantasy landscape with magical elements, floating islands, mystical creatures, dramatic lighting, rich colors, concept art quality, ethereal atmosphere" 
  },
  { 
    id: 8, 
    label: "Vintage Photo", 
    prompt: "Vintage photography from the 1970s, analog film grain, faded colors, nostalgic mood, retro aesthetic, old camera lens effects, aged paper texture" 
  },
  { 
    id: 9, 
    label: "Minimalist Design", 
    prompt: "Clean minimalist composition, simple geometric shapes, negative space, limited color scheme, modern aesthetic, balanced layout, Swiss design influence" 
  },
  { 
    id: 10, 
    label: "Oil Painting", 
    prompt: "Classical oil painting style, rich textures, visible brush strokes, deep colors, renaissance or impressionist technique, museum quality artwork, canvas texture" 
  },
  { 
    id: 11, 
    label: "Sci-Fi Concept", 
    prompt: "Science fiction concept art, futuristic technology, space exploration theme, detailed machinery, dramatic composition, professional concept artist style" 
  },
  { 
    id: 12, 
    label: "Nature Macro", 
    prompt: "Extreme macro photography of nature, incredible detail, shallow depth of field, morning dew, vibrant natural colors, professional wildlife photography" 
  },
];

export default function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // 🚀 使用全局积分管理器
  const { credits, loading: loadingCredits } = useCredits(true);

  const hasContent = message.trim().length > 0;

  const handleSend = () => {
    if (hasContent && !disabled) {
      onSend(message.trim());
      setMessage("");
      textareaRef.current?.focus();
    }
  };

  const handleClear = () => {
    setMessage("");
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (prompt: string) => {
    setMessage(prompt);
    textareaRef.current?.focus();
  };

  // 🚀 积分已通过 useCredits hook 自动管理，无需额外逻辑

  // 检查积分是否足够
  const hasEnoughCredits = credits === null || credits > 0;
  const isButtonDisabled = !hasContent || disabled || !hasEnoughCredits;

  return (
    <div className="chat-input-section">
      {/* 积分状态栏 */}
      {credits !== null && (
        <div className={`credits-status-bar ${!hasEnoughCredits ? 'insufficient' : ''}`}>
          <div className="credits-info">
            <svg className="credits-icon-main" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10"/>
              <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 6v2m0 8v2" stroke="white" strokeWidth="2"/>
            </svg>
            <span className="credits-value">{credits} Credits</span>
          </div>
          <div className="credits-cost">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>1 credit per image</span>
          </div>
        </div>
      )}

      <div className="input-container-new">
        <div className="input-wrapper-new">
          <textarea
            ref={textareaRef}
            className="chat-input"
            placeholder="Describe the image effect you want, for example: A cute orange kitten sitting in a garden..."
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
          />
          <button
            className={`clear-btn ${hasContent ? "visible" : ""}`}
            onClick={handleClear}
            title="Clear input"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <button
            className="send-btn-embedded"
            onClick={handleSend}
            disabled={isButtonDisabled}
            title={
              !hasEnoughCredits 
                ? "Insufficient credits. Please sign in or purchase more credits." 
                : "Generate image"
            }
          >
            <span className="send-text">Send</span>
            <svg
              className="send-icon"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22,2 15,22 11,13 2,9 22,2"></polygon>
            </svg>
          </button>
        </div>
      </div>

      {/* 积分不足提示 */}
      {!hasEnoughCredits && credits !== null && (
        <div className="credit-warning-new">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="#ef4444"/>
          </svg>
          <span className="warning-text">
            You don't have enough credits. 
            <a href="/pricing" className="warning-link">Get more credits</a> or 
            <button className="warning-link-btn" onClick={() => window.location.href = '/'}>sign in</button>
          </span>
        </div>
      )}

      {/* 快捷建议 */}
      <div className="quick-suggestions">
        <div className="suggestions-header">
          <span className="suggestions-title">Quick suggestions:</span>
        </div>
        <div className="suggestions-list">
          {quickSuggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              className="suggestion-tag"
              onClick={() => handleSuggestionClick(suggestion.prompt)}
              disabled={disabled}
            >
              {suggestion.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
