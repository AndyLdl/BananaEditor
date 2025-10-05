// 增强的安全验证工具
// 为BananaEditor提供更严格的安全检查和输入验证

import { SecurityError } from './security';
import { defaultRateLimiter } from './rate-limiter';

// 文件类型验证配置
export interface FileValidationConfig {
    allowedTypes: string[];
    maxSize: number;
    minSize: number;
    allowedExtensions: string[];
    requireMagicBytes: boolean;
    scanForMalware: boolean;
}

// 内容安全检查配置
export interface ContentSecurityConfig {
    enableProfanityFilter: boolean;
    enableToxicityDetection: boolean;
    enablePoliticalContentFilter: boolean;
    enableViolenceFilter: boolean;
    customBlockedWords: string[];
    maxPromptLength: number;
    minPromptLength: number;
}

// CSRF保护配置
export interface CSRFConfig {
    tokenExpiry: number; // 毫秒
    requireDoubleSubmit: boolean;
    checkOrigin: boolean;
    allowedOrigins: string[];
}

// 默认配置
const DEFAULT_FILE_VALIDATION: FileValidationConfig = {
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxSize: 10 * 1024 * 1024, // 10MB
    minSize: 1024, // 1KB
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
    requireMagicBytes: true,
    scanForMalware: false // 在生产环境中应启用
};

const DEFAULT_CONTENT_SECURITY: ContentSecurityConfig = {
    enableProfanityFilter: true,
    enableToxicityDetection: true,
    enablePoliticalContentFilter: true,
    enableViolenceFilter: true,
    customBlockedWords: [],
    maxPromptLength: 2000,
    minPromptLength: 5
};

const DEFAULT_CSRF_CONFIG: CSRFConfig = {
    tokenExpiry: 3600000, // 1小时
    requireDoubleSubmit: true,
    checkOrigin: true,
    allowedOrigins: []
};

// 文件魔术字节映射
const MAGIC_BYTES: Record<string, Uint8Array[]> = {
    'image/jpeg': [
        new Uint8Array([0xFF, 0xD8, 0xFF]), // JPEG
    ],
    'image/png': [
        new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), // PNG
    ],
    'image/webp': [
        new Uint8Array([0x52, 0x49, 0x46, 0x46]), // RIFF (WebP前4字节)
    ]
};

// 敏感词库 - 分类管理
const SENSITIVE_WORDS = {
    profanity: [
        // 这里应该包含实际的敏感词，为了示例只列出占位符
        'profanity1', 'profanity2'
    ],
    violence: [
        '暴力', '血腥', '杀害', '伤害', '攻击', '武器',
        'violence', 'bloody', 'kill', 'harm', 'attack', 'weapon'
    ],
    political: [
        // 政治敏感词应根据具体需求配置
        'political1', 'political2'
    ],
    toxicity: [
        '仇恨', '歧视', '种族', '性别歧视',
        'hate', 'discrimination', 'racist', 'sexist'
    ]
};

// 增强的文件验证器
export class EnhancedFileValidator {
    private config: FileValidationConfig;

    constructor(config?: Partial<FileValidationConfig>) {
        this.config = { ...DEFAULT_FILE_VALIDATION, ...config };
    }

    // 验证文件类型
    async validateFile(file: File): Promise<void> {
        // 1. 基础验证
        this.validateBasicProperties(file);

        // 2. 文件扩展名验证
        this.validateExtension(file.name);

        // 3. MIME类型验证
        this.validateMimeType(file.type);

        // 4. 文件大小验证
        this.validateFileSize(file.size);

        // 5. 魔术字节验证
        if (this.config.requireMagicBytes) {
            await this.validateMagicBytes(file);
        }

        // 6. 恶意软件扫描（如果启用）
        if (this.config.scanForMalware) {
            await this.scanForMalware(file);
        }
    }

    // 基础属性验证
    private validateBasicProperties(file: File): void {
        if (!file) {
            throw new SecurityError('文件对象无效', 'INVALID_FILE_OBJECT');
        }

        if (!file.name || file.name.trim().length === 0) {
            throw new SecurityError('文件名无效', 'INVALID_FILE_NAME');
        }

        if (file.name.length > 255) {
            throw new SecurityError('文件名过长', 'FILE_NAME_TOO_LONG');
        }

        // 检查文件名中的危险字符
        const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/;
        if (dangerousChars.test(file.name)) {
            throw new SecurityError('文件名包含非法字符', 'INVALID_FILE_NAME_CHARS');
        }
    }

    // 文件扩展名验证
    private validateExtension(fileName: string): void {
        const extension = this.getFileExtension(fileName);

        if (!extension) {
            throw new SecurityError('文件缺少扩展名', 'MISSING_FILE_EXTENSION');
        }

        if (!this.config.allowedExtensions.includes(extension.toLowerCase())) {
            throw new SecurityError(
                `不支持的文件扩展名: ${extension}`,
                'UNSUPPORTED_FILE_EXTENSION',
                { extension, allowedExtensions: this.config.allowedExtensions }
            );
        }
    }

    // MIME类型验证
    private validateMimeType(mimeType: string): void {
        if (!mimeType) {
            throw new SecurityError('文件MIME类型缺失', 'MISSING_MIME_TYPE');
        }

        if (!this.config.allowedTypes.includes(mimeType)) {
            throw new SecurityError(
                `不支持的文件类型: ${mimeType}`,
                'UNSUPPORTED_MIME_TYPE',
                { mimeType, allowedTypes: this.config.allowedTypes }
            );
        }
    }

    // 文件大小验证
    private validateFileSize(size: number): void {
        if (size < this.config.minSize) {
            throw new SecurityError(
                `文件过小，最小大小: ${this.config.minSize} 字节`,
                'FILE_TOO_SMALL',
                { size, minSize: this.config.minSize }
            );
        }

        if (size > this.config.maxSize) {
            throw new SecurityError(
                `文件过大，最大大小: ${this.config.maxSize} 字节`,
                'FILE_TOO_LARGE',
                { size, maxSize: this.config.maxSize }
            );
        }
    }

    // 魔术字节验证
    private async validateMagicBytes(file: File): Promise<void> {
        try {
            const buffer = await this.readFileHeader(file, 16); // 读取前16字节
            const magicBytes = MAGIC_BYTES[file.type];

            if (!magicBytes) {
                throw new SecurityError(
                    `无法验证文件类型 ${file.type} 的魔术字节`,
                    'MAGIC_BYTES_NOT_SUPPORTED'
                );
            }

            const isValid = magicBytes.some(magic =>
                this.compareBytes(buffer, magic)
            );

            if (!isValid) {
                throw new SecurityError(
                    '文件头部不匹配声明的文件类型',
                    'MAGIC_BYTES_MISMATCH',
                    {
                        declaredType: file.type,
                        actualHeader: Array.from(buffer).map(b => b.toString(16)).join(' ')
                    }
                );
            }
        } catch (error) {
            if (error instanceof SecurityError) {
                throw error;
            }
            throw new SecurityError(
                '验证文件头部时发生错误',
                'MAGIC_BYTES_VALIDATION_ERROR',
                { originalError: error.message }
            );
        }
    }

    // 恶意软件扫描（模拟实现）
    private async scanForMalware(file: File): Promise<void> {
        // 在实际生产环境中，这里应该集成真正的恶意软件扫描服务
        // 例如 ClamAV、VirusTotal API 等

        try {
            // 模拟扫描延迟
            await new Promise(resolve => setTimeout(resolve, 100));

            // 检查文件名中的可疑模式
            const suspiciousPatterns = [
                /\.exe$/i, /\.bat$/i, /\.cmd$/i, /\.scr$/i,
                /\.vbs$/i, /\.js$/i, /\.jar$/i, /\.com$/i
            ];

            for (const pattern of suspiciousPatterns) {
                if (pattern.test(file.name)) {
                    throw new SecurityError(
                        '检测到可疑文件类型',
                        'SUSPICIOUS_FILE_TYPE',
                        { fileName: file.name, pattern: pattern.source }
                    );
                }
            }

            // 在生产环境中，这里应该调用实际的恶意软件扫描API
            console.log(`恶意软件扫描完成: ${file.name} - 安全`);

        } catch (error) {
            if (error instanceof SecurityError) {
                throw error;
            }
            throw new SecurityError(
                '恶意软件扫描失败',
                'MALWARE_SCAN_ERROR',
                { originalError: error.message }
            );
        }
    }

    // 读取文件头部
    private async readFileHeader(file: File, bytes: number): Promise<Uint8Array> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
                const arrayBuffer = reader.result as ArrayBuffer;
                resolve(new Uint8Array(arrayBuffer));
            };

            reader.onerror = () => {
                reject(new Error('读取文件失败'));
            };

            reader.readAsArrayBuffer(file.slice(0, bytes));
        });
    }

    // 比较字节数组
    private compareBytes(buffer: Uint8Array, magic: Uint8Array): boolean {
        if (buffer.length < magic.length) {
            return false;
        }

        for (let i = 0; i < magic.length; i++) {
            if (buffer[i] !== magic[i]) {
                return false;
            }
        }

        return true;
    }

    // 获取文件扩展名
    private getFileExtension(fileName: string): string | null {
        const lastDot = fileName.lastIndexOf('.');
        if (lastDot === -1 || lastDot === fileName.length - 1) {
            return null;
        }
        return fileName.substring(lastDot);
    }

    // 更新配置
    updateConfig(config: Partial<FileValidationConfig>): void {
        this.config = { ...this.config, ...config };
    }

    // 获取配置
    getConfig(): FileValidationConfig {
        return { ...this.config };
    }
}

// 增强的内容安全检查器
export class EnhancedContentValidator {
    private config: ContentSecurityConfig;

    constructor(config?: Partial<ContentSecurityConfig>) {
        this.config = { ...DEFAULT_CONTENT_SECURITY, ...config };
    }

    // 验证提示词内容
    async validatePrompt(prompt: string): Promise<string> {
        // 1. 基础验证
        this.validateBasicPrompt(prompt);

        // 2. 长度验证
        this.validatePromptLength(prompt);

        // 3. 清理和标准化
        let cleanedPrompt = this.sanitizePrompt(prompt);

        // 4. 内容安全检查
        await this.performContentSecurityChecks(cleanedPrompt);

        return cleanedPrompt;
    }

    // 基础提示词验证
    private validateBasicPrompt(prompt: string): void {
        if (typeof prompt !== 'string') {
            throw new SecurityError('提示词必须是字符串类型', 'INVALID_PROMPT_TYPE');
        }

        if (!prompt || prompt.trim().length === 0) {
            throw new SecurityError('提示词不能为空', 'EMPTY_PROMPT');
        }
    }

    // 提示词长度验证
    private validatePromptLength(prompt: string): void {
        const trimmedLength = prompt.trim().length;

        if (trimmedLength < this.config.minPromptLength) {
            throw new SecurityError(
                `提示词过短，最少需要 ${this.config.minPromptLength} 个字符`,
                'PROMPT_TOO_SHORT',
                { length: trimmedLength, minLength: this.config.minPromptLength }
            );
        }

        if (trimmedLength > this.config.maxPromptLength) {
            throw new SecurityError(
                `提示词过长，最多允许 ${this.config.maxPromptLength} 个字符`,
                'PROMPT_TOO_LONG',
                { length: trimmedLength, maxLength: this.config.maxPromptLength }
            );
        }
    }

    // 清理提示词
    private sanitizePrompt(prompt: string): string {
        let cleaned = prompt.trim();

        // 移除危险的HTML标签和脚本
        cleaned = cleaned
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<[^>]*>/g, '') // 移除所有HTML标签
            .replace(/javascript:/gi, '')
            .replace(/data:/gi, '')
            .replace(/vbscript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .replace(/\0/g, ''); // 移除空字符

        // 标准化空白字符
        cleaned = cleaned.replace(/\s+/g, ' ').trim();

        // 移除控制字符
        cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '');

        return cleaned;
    }

    // 执行内容安全检查
    private async performContentSecurityChecks(prompt: string): Promise<void> {
        const lowerPrompt = prompt.toLowerCase();

        // 1. 脏话过滤
        if (this.config.enableProfanityFilter) {
            this.checkProfanity(lowerPrompt);
        }

        // 2. 暴力内容检查
        if (this.config.enableViolenceFilter) {
            this.checkViolence(lowerPrompt);
        }

        // 3. 政治内容检查
        if (this.config.enablePoliticalContentFilter) {
            this.checkPoliticalContent(lowerPrompt);
        }

        // 4. 毒性内容检查
        if (this.config.enableToxicityDetection) {
            this.checkToxicity(lowerPrompt);
        }

        // 5. 自定义屏蔽词检查
        this.checkCustomBlockedWords(lowerPrompt);

        // 6. 高级AI内容检查（如果需要）
        await this.performAIContentCheck(prompt);
    }

    // 脏话检查
    private checkProfanity(prompt: string): void {
        for (const word of SENSITIVE_WORDS.profanity) {
            if (prompt.includes(word.toLowerCase())) {
                throw new SecurityError(
                    '提示词包含不当内容',
                    'PROFANITY_DETECTED',
                    { detectedWord: word }
                );
            }
        }
    }

    // 暴力内容检查
    private checkViolence(prompt: string): void {
        for (const word of SENSITIVE_WORDS.violence) {
            if (prompt.includes(word.toLowerCase())) {
                throw new SecurityError(
                    '提示词包含暴力内容',
                    'VIOLENCE_CONTENT_DETECTED',
                    { detectedWord: word }
                );
            }
        }
    }

    // 政治内容检查
    private checkPoliticalContent(prompt: string): void {
        for (const word of SENSITIVE_WORDS.political) {
            if (prompt.includes(word.toLowerCase())) {
                throw new SecurityError(
                    '提示词包含政治敏感内容',
                    'POLITICAL_CONTENT_DETECTED',
                    { detectedWord: word }
                );
            }
        }
    }

    // 毒性内容检查
    private checkToxicity(prompt: string): void {
        for (const word of SENSITIVE_WORDS.toxicity) {
            if (prompt.includes(word.toLowerCase())) {
                throw new SecurityError(
                    '提示词包含有害内容',
                    'TOXIC_CONTENT_DETECTED',
                    { detectedWord: word }
                );
            }
        }
    }

    // 自定义屏蔽词检查
    private checkCustomBlockedWords(prompt: string): void {
        for (const word of this.config.customBlockedWords) {
            if (prompt.includes(word.toLowerCase())) {
                throw new SecurityError(
                    '提示词包含被屏蔽的内容',
                    'CUSTOM_BLOCKED_WORD_DETECTED',
                    { detectedWord: word }
                );
            }
        }
    }

    // AI内容检查（高级功能）
    private async performAIContentCheck(prompt: string): Promise<void> {
        // 在生产环境中，这里可以集成第三方内容审核API
        // 例如 Google Cloud Natural Language API、Azure Content Moderator 等

        try {
            // 模拟AI内容检查
            await new Promise(resolve => setTimeout(resolve, 50));

            // 检查是否包含可疑模式
            const suspiciousPatterns = [
                /(?:how\s+to\s+)?(make|create|build)\s+(bomb|weapon|explosive)/i,
                /(?:illegal|harmful|dangerous)\s+(activity|content|material)/i,
                /(hack|crack|exploit)\s+(system|password|account)/i
            ];

            for (const pattern of suspiciousPatterns) {
                if (pattern.test(prompt)) {
                    throw new SecurityError(
                        '提示词包含可疑内容模式',
                        'SUSPICIOUS_CONTENT_PATTERN',
                        { pattern: pattern.source }
                    );
                }
            }

        } catch (error) {
            if (error instanceof SecurityError) {
                throw error;
            }
            // AI检查失败不应该阻止正常流程，只记录警告
            console.warn('AI内容检查失败:', error.message);
        }
    }

    // 更新配置
    updateConfig(config: Partial<ContentSecurityConfig>): void {
        this.config = { ...this.config, ...config };
    }

    // 获取配置
    getConfig(): ContentSecurityConfig {
        return { ...this.config };
    }

    // 添加自定义屏蔽词
    addBlockedWords(words: string[]): void {
        this.config.customBlockedWords.push(...words);
    }

    // 移除自定义屏蔽词
    removeBlockedWords(words: string[]): void {
        this.config.customBlockedWords = this.config.customBlockedWords.filter(
            word => !words.includes(word)
        );
    }
}

// 增强的CSRF保护
export class EnhancedCSRFProtection {
    private config: CSRFConfig;
    private tokens = new Map<string, { token: string; expires: number; origin?: string }>();
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor(config?: Partial<CSRFConfig>) {
        this.config = { ...DEFAULT_CSRF_CONFIG, ...config };
        this.startCleanup();
    }

    // 生成CSRF令牌
    generateToken(sessionId: string, origin?: string): string {
        const token = this.createSecureToken();
        const expires = Date.now() + this.config.tokenExpiry;

        this.tokens.set(sessionId, {
            token,
            expires,
            origin: this.config.checkOrigin ? origin : undefined
        });

        return token;
    }

    // 验证CSRF令牌
    validateToken(sessionId: string, token: string, origin?: string): boolean {
        const stored = this.tokens.get(sessionId);

        if (!stored) {
            throw new SecurityError('CSRF令牌不存在', 'CSRF_TOKEN_NOT_FOUND');
        }

        if (Date.now() > stored.expires) {
            this.tokens.delete(sessionId);
            throw new SecurityError('CSRF令牌已过期', 'CSRF_TOKEN_EXPIRED');
        }

        if (stored.token !== token) {
            throw new SecurityError('CSRF令牌无效', 'CSRF_TOKEN_INVALID');
        }

        // 检查来源
        if (this.config.checkOrigin && stored.origin && origin !== stored.origin) {
            throw new SecurityError('请求来源不匹配', 'CSRF_ORIGIN_MISMATCH');
        }

        return true;
    }

    // 验证请求的CSRF保护
    validateRequest(request: Request, sessionId: string): boolean {
        const origin = request.headers.get('origin') || request.headers.get('referer');

        // 检查来源是否被允许
        if (this.config.checkOrigin && origin) {
            const requestOrigin = new URL(origin).origin;
            if (this.config.allowedOrigins.length > 0 &&
                !this.config.allowedOrigins.includes(requestOrigin)) {
                throw new SecurityError(
                    '请求来源不被允许',
                    'CSRF_ORIGIN_NOT_ALLOWED',
                    { origin: requestOrigin, allowedOrigins: this.config.allowedOrigins }
                );
            }
        }

        // 获取CSRF令牌
        const token = request.headers.get('x-csrf-token') ||
            request.headers.get('csrf-token');

        if (!token) {
            throw new SecurityError('缺少CSRF令牌', 'CSRF_TOKEN_MISSING');
        }

        return this.validateToken(sessionId, token, origin || undefined);
    }

    // 创建安全令牌
    private createSecureToken(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        const randomArray = new Uint8Array(32);

        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            crypto.getRandomValues(randomArray);
        } else {
            // 回退到Math.random（不够安全，仅用于开发环境）
            for (let i = 0; i < randomArray.length; i++) {
                randomArray[i] = Math.floor(Math.random() * 256);
            }
        }

        for (let i = 0; i < randomArray.length; i++) {
            result += chars[randomArray[i] % chars.length];
        }

        return `csrf_${Date.now()}_${result}`;
    }

    // 启动定期清理
    private startCleanup(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 5 * 60 * 1000); // 每5分钟清理一次
    }

    // 清理过期令牌
    private cleanup(): void {
        const now = Date.now();
        for (const [sessionId, data] of this.tokens.entries()) {
            if (now > data.expires) {
                this.tokens.delete(sessionId);
            }
        }
    }

    // 撤销令牌
    revokeToken(sessionId: string): void {
        this.tokens.delete(sessionId);
    }

    // 撤销所有令牌
    revokeAllTokens(): void {
        this.tokens.clear();
    }

    // 获取令牌信息
    getTokenInfo(sessionId: string): { expires: number; origin?: string } | null {
        const stored = this.tokens.get(sessionId);
        if (!stored) {
            return null;
        }

        return {
            expires: stored.expires,
            origin: stored.origin
        };
    }

    // 更新配置
    updateConfig(config: Partial<CSRFConfig>): void {
        this.config = { ...this.config, ...config };
    }

    // 销毁保护器
    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.tokens.clear();
    }
}

// 综合安全中间件
export class ComprehensiveSecurityMiddleware {
    private fileValidator: EnhancedFileValidator;
    private contentValidator: EnhancedContentValidator;
    private csrfProtection: EnhancedCSRFProtection;

    constructor(
        fileConfig?: Partial<FileValidationConfig>,
        contentConfig?: Partial<ContentSecurityConfig>,
        csrfConfig?: Partial<CSRFConfig>
    ) {
        this.fileValidator = new EnhancedFileValidator(fileConfig);
        this.contentValidator = new EnhancedContentValidator(contentConfig);
        this.csrfProtection = new EnhancedCSRFProtection(csrfConfig);
    }

    // 验证API请求
    async validateAPIRequest(request: Request): Promise<{
        sessionId: string;
        clientIP: string;
        csrfToken?: string;
    }> {
        // 1. 基础安全检查
        const clientIP = this.extractClientIP(request);
        const sessionId = request.headers.get('x-session-id') || this.generateSessionId();

        // 2. 速率限制检查
        if (!defaultRateLimiter.checkLimit(sessionId)) {
            throw new SecurityError('请求频率超出限制', 'RATE_LIMITED');
        }

        // 3. CSRF保护（对于POST/PUT/DELETE请求）
        let csrfToken: string | undefined;
        if (['POST', 'PUT', 'DELETE'].includes(request.method)) {
            this.csrfProtection.validateRequest(request, sessionId);
            csrfToken = this.csrfProtection.generateToken(sessionId, request.headers.get('origin') || undefined);
        }

        return {
            sessionId,
            clientIP,
            csrfToken
        };
    }

    // 验证文件上传
    async validateFileUpload(file: File): Promise<void> {
        await this.fileValidator.validateFile(file);
    }

    // 验证提示词内容
    async validatePromptContent(prompt: string): Promise<string> {
        return await this.contentValidator.validatePrompt(prompt);
    }

    // 提取客户端IP
    private extractClientIP(request: Request): string {
        const headers = request.headers;

        return headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            headers.get('x-real-ip') ||
            headers.get('cf-connecting-ip') ||
            'unknown';
    }

    // 生成会话ID
    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // 获取各组件实例
    getFileValidator(): EnhancedFileValidator {
        return this.fileValidator;
    }

    getContentValidator(): EnhancedContentValidator {
        return this.contentValidator;
    }

    getCSRFProtection(): EnhancedCSRFProtection {
        return this.csrfProtection;
    }

    // 销毁中间件
    destroy(): void {
        this.csrfProtection.destroy();
    }
}

// 导出默认实例
export const defaultEnhancedSecurity = new ComprehensiveSecurityMiddleware();