import { useState, useCallback } from "react";

// 与 BananaAIProcessor 交互的 Hook
export function useAIProcessor() {
    const [isProcessing, setIsProcessing] = useState(false);

    // 处理用户消息
    const processMessage = useCallback(async (text: string) => {
        if (isProcessing) {
            console.log("AI is already processing, skipping...");
            return;
        }

        if (!(window as any).BananaAIProcessor) {
            console.error("❌ BananaAIProcessor not available");
            return;
        }

        setIsProcessing(true);

        try {
            // 调用全局 BananaAIProcessor 的实例方法
            const processor = (window as any).BananaAIProcessor.instance;
            if (processor) {
                await processor.processUserMessage({ message: text });
            }
        } catch (error) {
            console.error("❌ Error processing message:", error);
        } finally {
            setIsProcessing(false);
        }
    }, [isProcessing]);

    return {
        isProcessing,
        processMessage,
    };
}
