/**
 * 简单的请求体加密/解密工具
 * 防止API被直接调用
 */

import crypto from 'crypto';

// 加密密钥 - 在生产环境中应该从环境变量获取
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-character-secret-key-here!';
const ALGORITHM = 'aes-256-cbc';

/**
 * 将密钥转换为 Buffer
 * 支持十六进制和字符串格式
 */
function getKeyBuffer(key) {
    // 如果是十六进制格式（长度为64的字符串且只包含0-9a-f）
    if (key.length === 64 && /^[0-9a-f]+$/i.test(key)) {
        return Buffer.from(key, 'hex');
    } else {
        // 如果是字符串格式，使用 SHA-256 哈希生成32字节密钥
        return crypto.createHash('sha256').update(key).digest();
    }
}

/**
 * 加密请求体
 * @param {Object} data - 要加密的数据
 * @returns {Object} 加密后的数据
 */
export function encryptRequestBody(data) {
    try {
        const iv = crypto.randomBytes(16);
        const keyBuffer = getKeyBuffer(ENCRYPTION_KEY);
        const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);

        let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
        encrypted += cipher.final('hex');

        return {
            encrypted,
            iv: iv.toString('hex'),
            timestamp: Date.now()
        };
    } catch (error) {
        throw new Error('数据加密失败: ' + error.message);
    }
}

/**
 * 解密请求体
 * @param {string} encryptedData - 加密的数据
 * @param {string} iv - 初始化向量
 * @returns {Object} 解密后的数据
 */
export function decryptRequestBody(encryptedData, iv) {
    try {
        const keyBuffer = getKeyBuffer(ENCRYPTION_KEY);
        const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, Buffer.from(iv, 'hex'));

        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return JSON.parse(decrypted);
    } catch (error) {
        throw new Error('数据解密失败: ' + error.message);
    }
}

/**
 * 生成请求签名
 * @param {string} data - 请求数据
 * @param {number} timestampValue - 时间戳
 * @returns {string} 签名
 */
export function generateSignature(data, timestampValue) {
    const payload = `${data}${timestampValue}`;
    const keyBuffer = getKeyBuffer(ENCRYPTION_KEY);
    return crypto.createHmac('sha256', keyBuffer).update(payload).digest('hex');
}

/**
 * 验证请求签名
 * @param {string} data - 请求数据
 * @param {number} timestampValue - 时间戳
 * @param {string} signature - 签名
 * @returns {boolean} 是否有效
 */
export function verifySignature(data, timestampValue, signature) {
    const expectedSignature = generateSignature(data, timestampValue);
    return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
    );
}

/**
 * 检查时间戳是否在有效范围内（防止重放攻击）
 * @param {number} timestampValue - 时间戳
 * @param {number} maxAge - 最大有效期（毫秒）
 * @returns {boolean} 是否有效
 */
export function isTimestampValid(timestampValue, maxAge = 300000) { // 5分钟有效期
    const now = Date.now();
    return Math.abs(now - timestampValue) <= maxAge;
}