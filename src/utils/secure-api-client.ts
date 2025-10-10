/**
 * 安全的API客户端
 * 提供请求加密功能，防止API被直接调用
 * 使用浏览器兼容的 Web Crypto API
 */

// 加密配置 - 从环境变量获取，确保安全
const ENCRYPTION_KEY = import.meta.env.PUBLIC_ENCRYPTION_KEY ||
    import.meta.env.ENCRYPTION_KEY ||
    'fallback-key-for-development-only';

// 检查密钥是否已正确配置
if (ENCRYPTION_KEY === 'fallback-key-for-development-only') {
    console.warn('⚠️ 警告: 使用默认加密密钥，生产环境中请设置 PUBLIC_ENCRYPTION_KEY 环境变量');
}

/**
 * 将密钥转换为 ArrayBuffer
 * 支持十六进制和字符串格式
 */
function keyToArrayBuffer(key: string): ArrayBuffer {
    // 如果是十六进制格式（长度为64的字符串且只包含0-9a-f）
    if (key.length === 64 && /^[0-9a-f]+$/i.test(key)) {
        const bytes = new Uint8Array(key.length / 2);
        for (let i = 0; i < key.length; i += 2) {
            bytes[i / 2] = parseInt(key.substr(i, 2), 16);
        }
        return bytes.buffer;
    } else {
        // 如果是字符串格式，使用 SHA-256 哈希生成32字节密钥
        return new TextEncoder().encode(key).slice(0, 32).buffer;
    }
}

/**
 * 将 ArrayBuffer 转换为十六进制字符串
 */
function arrayBufferToHex(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
        hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
}

/**
 * 生成随机 IV
 */
function generateRandomIV(): Uint8Array {
    const iv = new Uint8Array(16);
    crypto.getRandomValues(iv);
    return iv;
}

/**
 * 加密请求数据
 */
export async function encryptRequestData(data: any): Promise<{ encrypted: string; iv: string; timestamp: number }> {
    try {
        // 生成随机 IV
        const iv = generateRandomIV();

        // 将密钥转换为 ArrayBuffer
        const keyBuffer = keyToArrayBuffer(ENCRYPTION_KEY);

        // 导入密钥
        const key = await crypto.subtle.importKey(
            'raw',
            keyBuffer,
            { name: 'AES-CBC' },
            false,
            ['encrypt']
        );

        // 加密数据
        const dataBuffer = new TextEncoder().encode(JSON.stringify(data));
        const encryptedBuffer = await crypto.subtle.encrypt(
            { name: 'AES-CBC', iv: iv as unknown as ArrayBuffer },
            key,
            dataBuffer
        );

        const timestamp = Date.now();

        return {
            encrypted: arrayBufferToHex(encryptedBuffer),
            iv: arrayBufferToHex(iv.buffer as unknown as ArrayBuffer),
            timestamp
        };
    } catch (error) {
        throw new Error('数据加密失败: ' + (error as Error).message);
    }
}

/**
 * 生成请求签名
 */
export async function generateRequestSignature(data: string, timestamp: number): Promise<string> {
    try {
        const payload = `${data}${timestamp}`;
        const keyBuffer = keyToArrayBuffer(ENCRYPTION_KEY);

        // 导入 HMAC 密钥
        const key = await crypto.subtle.importKey(
            'raw',
            keyBuffer,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );

        // 生成签名
        const signature = await crypto.subtle.sign(
            'HMAC',
            key,
            new TextEncoder().encode(payload)
        );

        return arrayBufferToHex(signature);
    } catch (error) {
        throw new Error('签名生成失败: ' + (error as Error).message);
    }
}

/**
 * 安全的API调用
 */
export async function secureApiCall(
    url: string,
    data: any,
    options: RequestInit = {}
): Promise<Response> {
    try {
        // 加密请求数据
        const { encrypted, iv, timestamp } = await encryptRequestData(data);

        // 生成签名
        const signature = await generateRequestSignature(encrypted, timestamp);

        // 构建请求头
        const headers = new Headers(options.headers);
        headers.set('Content-Type', 'application/json');
        headers.set('X-Encrypted-Data', encrypted);
        headers.set('X-IV', iv);
        headers.set('X-Signature', signature);
        headers.set('X-Timestamp', timestamp.toString());

        // 发送请求
        const response = await fetch(url, {
            ...options,
            method: 'POST',
            headers,
            body: JSON.stringify({ encrypted, iv, timestamp })
        });

        return response;
    } catch (error) {
        console.error('❌ 加密云函数调用失败:', error);
        throw error;
    }
}

/**
 * 安全的 BananaAI 处理器
 */
export class SecureBananaAIProcessor {
    private baseUrl: string;

    constructor(baseUrl?: string) {
        this.baseUrl = baseUrl || import.meta.env.PUBLIC_FIREBASE_FUNCTION_URL || '';
    }

    /**
     * 调用云函数
     */
    async callCloudFunction(data: any, currentActiveImage?: string): Promise<any> {
        try {
            // 添加当前活动图片到请求数据
            if (currentActiveImage) {
                (data as any).currentActiveImage = currentActiveImage;
            }

            const response = await secureApiCall(this.baseUrl, data);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // 解析响应为 JSON
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('❌ 安全API调用失败:', error);
            throw error;
        }
    }

    /**
     * 健康检查
     */
    async healthCheck(): Promise<boolean> {
        try {
            const response = await fetch(this.baseUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return response.ok;
        } catch (error) {
            console.error('❌ 健康检查失败:', error);
            return false;
        }
    }
}

// 导出默认实例
export const secureProcessor = new SecureBananaAIProcessor();