import React, { useState, useRef, useEffect } from "react";

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

  return (
    <div className="chat-input-section">
      <div className="input-container">
        <div className="input-wrapper">
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
        </div>
        <button
          className="send-btn"
          onClick={handleSend}
          disabled={!hasContent || disabled}
          title="Send message"
        >
          <svg
            width="20"
            height="20"
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
