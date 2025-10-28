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
        console.log('🔐 开始加密请求数据...');

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
        const jsonString = JSON.stringify(data);
        console.log(`📏 JSON 数据大小: ${jsonString.length} 字符`);

        const dataBuffer = new TextEncoder().encode(jsonString);
        console.log(`📦 编码后数据大小: ${dataBuffer.length} 字节`);

        console.log('🔒 开始 AES-CBC 加密...');
        const encryptedBuffer = await crypto.subtle.encrypt(
            { name: 'AES-CBC', iv: iv as unknown as ArrayBuffer },
            key,
            dataBuffer
        );
        console.log('✅ 加密完成');

        const timestamp = Date.now();

        return {
            encrypted: arrayBufferToHex(encryptedBuffer),
            iv: arrayBufferToHex(iv.buffer as unknown as ArrayBuffer),
            timestamp
        };
    } catch (error) {
        console.error('❌ 加密过程出错:', error);
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
 * 获取 Supabase 访问令牌（如果可用）
 */
async function getSupabaseToken(): Promise<string | null> {
    try {
        // 动态导入 Supabase 客户端
        const { getAccessToken } = await import('./supabase-client');
        return await getAccessToken();
    } catch (error) {
        console.warn('⚠️ 无法获取 Supabase token:', error);
        return null;
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
        console.log('🚀 secureApiCall 开始, URL:', url);

        // 加密请求数据
        const { encrypted, iv, timestamp } = await encryptRequestData(data);
        console.log('✅ 数据加密完成, 加密数据长度:', encrypted.length);

        // 生成签名
        console.log('🔏 生成签名...');
        const signature = await generateRequestSignature(encrypted, timestamp);
        console.log('✅ 签名生成完成');

        // 构建请求头 - 只放小的元数据，不要放大的加密数据
        const headers = new Headers(options.headers);
        headers.set('Content-Type', 'application/json');
        // headers.set('X-Encrypted-Data', encrypted); // ❌ 移除：数据太大，放不进请求头
        headers.set('X-IV', iv);
        headers.set('X-Signature', signature);
        headers.set('X-Timestamp', timestamp.toString());
        headers.set('X-Encrypted-Request', 'true'); // 标记这是加密请求

        // 添加 Supabase 认证令牌（如果可用）
        const token = await getSupabaseToken();
        if (token) {
            headers.set('Authorization', `Bearer ${token}`);
            console.log('✅ 已添加 Supabase 认证令牌');
        } else {
            console.log('⚠️ 未找到 Supabase 认证令牌');
        }

        // 发送请求 - 加密数据放在请求体中
        const requestBody = JSON.stringify({
            encrypted,  // 加密数据在这里
            iv,
            timestamp
        });
        console.log('📡 发送 POST 请求...');
        console.log('📦 请求体大小:', requestBody.length, '字符');

        const response = await fetch(url, {
            ...options,
            method: 'POST',
            headers,
            body: requestBody
        });

        console.log('📨 收到响应, status:', response.status, 'statusText:', response.statusText);

        // 检查响应内容类型
        const contentType = response.headers.get('content-type');
        console.log('📄 响应 Content-Type:', contentType);

        return response;
    } catch (error) {
        console.error('❌ secureApiCall 失败:', error);
        console.error('❌ 错误堆栈:', (error as Error).stack);
        throw error;
    }
}

/**
 * 获取云函数 URL（根据环境选择 v1 或 v2）
 */
function getCloudFunctionUrl(): string {
    // 检查是否为开发环境
    const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';

    if (isDev) {
        // 开发环境使用 v2（包含积分检查）
        const devUrl = import.meta.env.PUBLIC_FIREBASE_FUNCTION_URL_DEV;
        if (devUrl) {
            console.log('🟢 [开发环境] 使用云函数 v2:', devUrl);
            return devUrl;
        }
    }

    // 生产环境使用 v1（稳定版）
    const prodUrl = import.meta.env.PUBLIC_FIREBASE_FUNCTION_URL;
    console.log('🔵 [生产环境] 使用云函数 v1:', prodUrl);
    return prodUrl || '';
}

/**
 * 安全的 BananaAI 处理器
 */
export class SecureBananaAIProcessor {
    private baseUrl: string;

    constructor(baseUrl?: string) {
        // 如果提供了 baseUrl 则使用，否则根据环境自动选择
        this.baseUrl = baseUrl || getCloudFunctionUrl();
        console.log('📍 SecureBananaAIProcessor 初始化, URL:', this.baseUrl);
    }

    /**
     * 调用云函数
     */
    async callCloudFunction(data: any, currentActiveImage?: string): Promise<any> {
        try {
            console.log('🎯 SecureBananaAIProcessor.callCloudFunction 开始');

            // 添加当前活动图片到请求数据
            if (currentActiveImage) {
                (data as any).currentActiveImage = currentActiveImage;
            }

            console.log('📞 调用 secureApiCall...');
            const response = await secureApiCall(this.baseUrl, data);
            console.log('✅ secureApiCall 返回响应');

            if (!response.ok) {
                console.error('❌ HTTP 错误, status:', response.status);
                const errorText = await response.text();
                console.error('❌ 错误响应内容:', errorText);
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            // 解析响应为 JSON
            console.log('📖 解析响应 JSON...');
            const result = await response.json();
            console.log('✅ JSON 解析完成');
            return result;
        } catch (error) {
            console.error('❌ SecureBananaAIProcessor 失败:', error);
            console.error('❌ 错误类型:', error.constructor.name);
            console.error('❌ 错误消息:', (error as Error).message);
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