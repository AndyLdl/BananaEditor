// 聊天消息类型定义

export interface Message {
    id: string;
    role: "user" | "model";
    content: string;
    timestamp: number;
    imageUrl?: string;
    isError?: boolean;
}

export interface Session {
    id: string;
    title: string;
    messages: Message[];
    createdAt: number;
    updatedAt: number;
    lastImageUrl?: string;
}

export interface AIProcessorConfig {
    cloudFunctionUrl: string;
    isProcessing: boolean;
}
