import {
    onRequest
} from 'firebase-functions/v2/https';
import {
    initializeApp
} from 'firebase-admin/app';
import {
    getStorage
} from 'firebase-admin/storage';
import {
    GoogleGenAI
} from '@google/genai';
import sharp from 'sharp';
import cors from 'cors';
import Busboy from 'busboy';
import crypto from 'crypto';
import {
    decryptRequestBody,
    verifySignature,
    isTimestampValid
} from './encryption.js';
import {
    createClient
} from '@supabase/supabase-js';

// 初始化 Firebase Admin
const app = initializeApp();

// 获取项目 ID（Firebase Functions 中的标准方式）
// Firebase 会自动设置 GCLOUD_PROJECT 环境变量
const projectId = process.env.GCLOUD_PROJECT || 'bananaeditor-927be';

// 初始化 Supabase 客户端（用于 v2 版本的积分验证）
const getSupabaseClient = () => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.warn('⚠️ Supabase 环境变量未配置，v2 版本将无法使用');
        return null;
    }

    return createClient(supabaseUrl, supabaseServiceKey);
};

// 初始化 Google Gen AI（延迟初始化，避免部署时的问题）
let genAI;
const getGenAI = () => {
    if (!genAI) {
        // 根据官方文档，设置环境变量来使用 Vertex AI
        process.env.GOOGLE_GENAI_USE_VERTEXAI = 'True';
        process.env.GOOGLE_CLOUD_LOCATION = 'global';

        genAI = new GoogleGenAI({
            vertexai: true,
            project: projectId,
            location: process.env.GOOGLE_CLOUD_LOCATION || 'global',
        });
    }
    return genAI;
};

// 初始化 Cloud Storage
const storage = getStorage(app);
const getBucket = () => {
    const bucketName = process.env.STORAGE_BUCKET_NAME || `${projectId}.appspot.com`;
    return storage.bucket(bucketName);
};

// 配置 CORS - 使用环境变量控制允许的来源
const corsHandler = cors({
    origin: (origin, callback) => {
        // 获取允许的来源列表
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];

        console.log('🔍 CORS检查:', {
            requestOrigin: origin,
            allowedOrigins: allowedOrigins,
            isAllowed: allowedOrigins.includes('*') || allowedOrigins.includes(origin)
        });

        // 允许所有来源（开发环境）或特定来源（生产环境）
        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log('❌ CORS拒绝来源:', origin);
            callback(new Error('CORS策略不允许此来源'));
        }
    },
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Request-ID',
        'X-Encrypted-Data',
        'X-IV',
        'X-Signature',
        'X-Timestamp'
    ],
    credentials: false // 更安全，不发送凭据
});

/**
 * 验证请求参数
 * @param {Object} body - 请求体
 * @returns {Array} 错误信息数组
 */
const validateRequest = (body) => {
    const errors = [];

    if (!body.prompt || typeof body.prompt !== 'string') {
        errors.push('提示词是必需的');
    } else if (body.prompt.trim().length === 0) {
        errors.push('提示词不能为空');
    } else if (body.prompt.length > 2000) {
        errors.push('提示词长度不能超过2000字符');
    }

    if (body.quality && !['standard', 'high', 'ultra'].includes(body.quality)) {
        errors.push('质量参数必须是 standard、high 或 ultra');
    }

    if (body.creativity) {
        const creativity = parseInt(body.creativity);
        if (isNaN(creativity) || creativity < 0 || creativity > 100) {
            errors.push('创意程度必须是0-100之间的数字');
        }
    }

    return errors;
};

/**
 * 处理图片文件
 * @param {Buffer} imageBuffer - 图片缓冲区
 * @returns {Object} 处理后的图片信息
 */
const processImage = async (imageBuffer) => {
    try {
        // 使用 sharp 处理图片
        const processedImage = await sharp(imageBuffer)
            .resize(1024, 1024, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({
                quality: 90,
                progressive: true
            })
            .toBuffer();

        // 转换为 base64
        const base64Image = processedImage.toString('base64');

        return {
            base64: base64Image,
            mimeType: 'image/jpeg',
            size: processedImage.length
        };
    } catch (error) {
        throw new Error(`图片处理失败: ${error.message}`);
    }
};

/**
 * 构建增强提示词
 * @param {Object} params - 参数对象
 * @returns {string} 增强后的提示词
 */
const buildEnhancedPrompt = (params) => {
    // 从用户的原始提示词开始
    let enhancedPrompt = params.prompt;

    // 添加质量和细节增强
    const qualityEnhancements = {
        'standard': 'detailed, well-composed',
        'high': 'highly detailed, professional quality, sharp focus, 4K resolution',
        'ultra': 'ultra-detailed, masterpiece, professional photography, 8K resolution, perfect lighting'
    };

    const qualityLevel = params.quality || 'standard';
    enhancedPrompt += `, ${qualityEnhancements[qualityLevel]}`;

    // 添加风格指导
    if (params.style && params.style !== 'creative') {
        const styleMap = {
            'realistic': 'photorealistic, natural lighting, authentic textures, lifelike details',
            'artistic': 'artistic interpretation, creative composition, expressive brushwork, fine art style',
            'cartoon': 'cartoon style, vibrant colors, clean lines, animated character design',
            'watercolor': 'watercolor painting, soft gradients, flowing colors, artistic medium',
            'oil-painting': 'oil painting style, rich textures, classical art technique, painterly brushstrokes',
            'sketch': 'pencil sketch, clean lineart, artistic drawing, monochromatic shading',
            'digital-art': 'digital art, modern illustration, clean vector style, contemporary design'
        };

        if (styleMap[params.style]) {
            enhancedPrompt += `, ${styleMap[params.style]}`;
        }
    }

    // 添加色调指导
    if (params.colorTone) {
        const colorMap = {
            'warm': 'warm color palette, golden hour lighting, cozy atmosphere',
            'cool': 'cool color palette, blue tones, serene mood',
            'vibrant': 'vibrant colors, high saturation, energetic composition',
            'muted': 'muted colors, soft tones, elegant palette',
            'monochrome': 'monochromatic, black and white, high contrast'
        };

        if (colorMap[params.colorTone]) {
            enhancedPrompt += `, ${colorMap[params.colorTone]}`;
        }
    }

    // 根据创意程度调整风格
    const creativity = parseInt(params.creativity || 50);
    if (creativity <= 30) {
        enhancedPrompt += ', traditional composition, classic style, conventional approach';
    } else if (creativity >= 70) {
        enhancedPrompt += ', creative composition, innovative perspective, artistic flair, unique interpretation';
    } else {
        enhancedPrompt += ', balanced composition, harmonious design';
    }

    // 添加通用的质量提升关键词
    enhancedPrompt += ', professional quality, well-lit, clear focus';

    return enhancedPrompt;
};

/**
 * 从 URL 下载图片并转为 base64
 */
const downloadImageAsBase64 = async (imageUrl) => {
    try {
        console.log('📥 开始下载图片:', imageUrl);
        const response = await fetch(imageUrl);
        if (!response.ok) {
            console.log('⚠️ 无法下载图片，状态:', response.status);
            return null;
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');
        console.log('✅ 图片下载成功，大小:', buffer.length, 'bytes');
        return base64;
    } catch (error) {
        console.error('❌ 下载图片失败:', error.message);
        return null;
    }
};

/**
 * 检测用户消息是否为修改请求
 */
const isModificationRequest = (prompt) => {
    const modificationKeywords = [
        '换', '改', '变成', '变为', '改成', '改为',
        '修改', '调整', '把这', '把它', '这个',
        '其他', '保持', '不变'
    ];
    return modificationKeywords.some(keyword => prompt.includes(keyword));
};

/**
 * 调用 Vertex AI Gemini 模型
 * @param {string} prompt - 提示词
 * @param {string} imageBase64 - 图片base64编码（可选）
 * @returns {string} 生成的文本
 */
const callVertexAI = async (prompt, imageBase64 = null, conversationHistory = [], currentActiveImage = null) => {
    try {
        console.log('🤖 调用 Vertex AI Gemini 模型...');
        console.log('📝 提示词长度:', prompt.length);
        console.log('🖼️ 包含图片:', !!imageBase64);
        console.log('📚 对话历史长度:', conversationHistory.length);
        console.log('🏗️ 项目ID:', projectId);

        // 使用 Gemini 2.5 Flash Image Preview 模型
        const modelName = 'gemini-2.5-flash-image-preview';
        console.log('🎯 使用模型:', modelName);

        // 使用新的 Gen AI SDK
        const genAI = getGenAI();

        // 构建对话内容，包含历史记录
        const contents = [];

        // 获取当前激活的图片（用户在 Canvas 中选中的图片）
        let activeImageBase64 = null;
        if (currentActiveImage && currentActiveImage.base64) {
            console.log('✅ 接收到用户激活图片（来自 Canvas）:', currentActiveImage.url);
            activeImageBase64 = currentActiveImage.base64;
        } else {
            // 如果没有提供激活图片，检测是否为修改请求
            const isModRequest = isModificationRequest(prompt);
            console.log('🔍 是否为修改请求:', isModRequest);

            // 如果是修改请求，找到最近一张图片并下载
            if (isModRequest && conversationHistory && conversationHistory.length > 0) {
                console.log('🔎 未提供激活图片，查找最近一张图片...');
                // 从后往前找最近一张图片
                for (let i = conversationHistory.length - 1; i >= 0; i--) {
                    const historyItem = conversationHistory[i];
                    if (historyItem.role === 'model' && historyItem.imageUrl) {
                        console.log('✅ 找到最近图片:', historyItem.imageUrl);
                        activeImageBase64 = await downloadImageAsBase64(historyItem.imageUrl);
                        break;
                    }
                }
            }
        }

        // 添加对话历史（智能添加图片）
        if (conversationHistory && conversationHistory.length > 0) {
            console.log('📚 添加对话历史到请求中');
            for (let i = 0; i < conversationHistory.length; i++) {
                const historyItem = conversationHistory[i];
                if (historyItem.role && historyItem.content) {
                    const parts = [{
                        text: historyItem.content
                    }];

                    // 如果有激活图片，在最后一条 AI 消息处添加
                    if (activeImageBase64 && historyItem.role === 'model' && historyItem.imageUrl) {
                        // 检查是否是最后一张图片
                        const isLatest = i === conversationHistory.length - 1 ||
                            !conversationHistory.slice(i + 1).some(h => h.role === 'model' && h.imageUrl);

                        if (isLatest) {
                            console.log('🖼️ 添加激活图片到对话中（用于修改）');
                            parts.push({
                                inlineData: {
                                    mimeType: 'image/jpeg',
                                    data: activeImageBase64
                                }
                            });
                            activeImageBase64 = null; // 只添加一次
                        }
                    }

                    contents.push({
                        role: historyItem.role.toUpperCase(), // USER 或 MODEL
                        parts: parts
                    });
                }
            }
        }

        // 添加当前用户消息
        const currentParts = [{
            text: prompt
        }];

        if (imageBase64) {
            currentParts.push({
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: imageBase64
                }
            });
        }

        contents.push({
            role: 'USER',
            parts: currentParts
        });

        console.log('📋 构建的对话内容长度:', contents.length);

        console.log('📡 发送请求到 Gen AI...');

        // 构建系统指令
        const systemInstruction = `你是一个专业的 AI 图片生成助手。重要规则：

1. 对话历史中包含了之前生成的图片（图像数据），你可以看到这些图片
2. 当用户说"换颜色"、"改成"、"变成"、"把这个"等修改请求时：
   - **查看对话历史中的图片**，看清楚原图是什么样子的
   - **保持原图的主体、构图、姿势、场景等核心元素完全不变**
   - **只修改用户明确要求改变的部分**（如颜色、背景、风格等）
   - 在回复中明确说明："我看到了之前生成的[描述原图]，现在将其[修改内容]"
3. 当用户问"我是谁"、"刚才说了什么"等问题时：
   - 查看对话历史回答问题
   - 如果需要，生成一张相关的图片
4. 修改图片时的关键要点：
   - 用户说"其他内容都不需要变" = 只改指定部分，其他100%保持原样
   - 用户说"换成黑色" = 只改颜色，猫的品种、姿势、背景等都不变
   - 用户说"改成橘色" = 只改颜色，不要重新生成一只新的猫

请务必仔细查看历史图片，理解用户的修改意图，保持图片的连贯性。`;

        const response = await genAI.models.generateContent({
            model: modelName,
            contents: contents,
            systemInstruction: systemInstruction, // 添加系统指令
            config: {
                generationConfig: {
                    temperature: 0.7,
                    topK: 32,
                    topP: 1,
                    maxOutputTokens: 4096,
                    responseModalities: ["TEXT", "IMAGE"], // 启用图片生成
                }
            }
        });

        if (!response) {
            throw new Error('Gen AI 返回了空的响应');
        }

        console.log('✅ Gen AI 调用成功');
        console.log('响应内容:', JSON.stringify(response, null, 2));

        // 提取文本和图片数据
        let generatedText = '';
        let imageData = null;

        if (response.text) {
            generatedText = response.text.trim();
        }

        // 检查是否有图片数据
        if (response.candidates && response.candidates.length > 0) {
            const candidate = response.candidates[0];
            if (candidate.content && candidate.content.parts) {
                for (const part of candidate.content.parts) {
                    if (part.text) {
                        generatedText += part.text;
                    }
                    if (part.inlineData && part.inlineData.mimeType && part.inlineData.mimeType.startsWith('image/')) {
                        imageData = part.inlineData.data;
                        console.log('🖼️ 找到生成的图片数据，大小:', imageData.length);
                    }
                }
            }
        }

        return {
            text: generatedText,
            imageData: imageData
        };

    } catch (error) {
        console.error('❌ Gen AI 调用失败:', error);
        console.error('错误详情:', {
            message: error.message,
            code: error.code,
            status: error.status,
            projectId: projectId
        });
        throw new Error(`AI服务调用失败: ${error.message}`);
    }
};

/**
 * 保存生成结果到 Cloud Storage
 * @param {Buffer} data - 文件数据
 * @param {string} filename - 文件名
 * @returns {string} 公共访问URL
 */
const saveToCloudStorage = async (data, filename) => {
    try {
        const bucket = getBucket();
        const file = bucket.file(filename);
        await file.save(data, {
            metadata: {
                contentType: 'image/jpeg',
                cacheControl: 'public, max-age=31536000'
            }
        });

        // 生成公共访问URL
        await file.makePublic();
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

        return publicUrl;
    } catch (error) {
        console.error('保存到 Cloud Storage 失败:', error);
        throw new Error(`文件保存失败: ${error.message}`);
    }
};

/**
 * 生成创作建议
 * @param {string} prompt - 原始提示词
 * @param {string} style - 风格
 * @returns {Array} 建议数组
 */
const generateSuggestions = (prompt, style) => {
    const baseSuggestions = [
        '添加具体的光线描述，如"金色阳光"、"柔和散射光"或"戏剧性侧光"',
        '指定画面构图，如"特写镜头"、"广角全景"或"对称构图"',
        '描述环境氛围，如"宁静祥和"、"充满活力"或"神秘梦幻"',
        '添加材质细节，如"丝绸质感"、"粗糙纹理"或"光滑表面"'
    ];

    const styleSuggestions = {
        'realistic': [
            '添加真实的环境细节和自然光影效果',
            '描述具体的材质和纹理，增强真实感'
        ],
        'artistic': [
            '尝试添加艺术性的色彩搭配和构图元素',
            '考虑加入抽象或表现主义的视觉效果'
        ],
        'cartoon': [
            '使用更生动的色彩和夸张的表现手法',
            '添加可爱或幽默的元素来增强卡通效果'
        ],
        'watercolor': [
            '描述水彩特有的渐变和晕染效果',
            '添加柔和的色彩过渡和艺术感'
        ]
    };

    let suggestions = [...baseSuggestions];

    // 添加风格特定建议
    if (style && styleSuggestions[style]) {
        suggestions = suggestions.concat(styleSuggestions[style]);
    }

    // 根据提示词内容提供个性化建议
    const promptLower = prompt.toLowerCase();

    if (promptLower.includes('人') || promptLower.includes('person') || promptLower.includes('character')) {
        suggestions.push('描述人物的表情、姿态和服装细节，增加人物魅力');
    }

    if (promptLower.includes('风景') || promptLower.includes('landscape') || promptLower.includes('nature')) {
        suggestions.push('指定时间和天气，如"日出时分"、"雨后清晨"或"夕阳西下"');
    }

    if (promptLower.includes('动物') || promptLower.includes('animal') || promptLower.includes('cat') || promptLower.includes('dog')) {
        suggestions.push('描述动物的动作和表情，以及周围的自然环境');
    }

    if (promptLower.includes('建筑') || promptLower.includes('building') || promptLower.includes('architecture')) {
        suggestions.push('添加建筑风格描述和周围环境的细节');
    }

    // 随机选择3-4个建议
    const shuffled = suggestions.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3);
};

/**
 * 解析 multipart/form-data 请求
 * @param {Object} req - 请求对象
 * @returns {Promise} 解析结果
 */
const parseMultipartData = (req) => {
    return new Promise((resolve, reject) => {
        const busboy = Busboy({
            headers: req.headers
        });
        const fields = {};
        let fileBuffer = null;
        let fileName = '';

        busboy.on('field', (fieldname, val) => {
            fields[fieldname] = val;
        });

        busboy.on('file', (fieldname, file, info) => {
            fileName = info.filename;
            const chunks = [];

            file.on('data', (chunk) => {
                chunks.push(chunk);
            });

            file.on('end', () => {
                fileBuffer = Buffer.concat(chunks);
            });
        });

        busboy.on('finish', () => {
            resolve({
                fields,
                file: fileBuffer ? {
                    buffer: fileBuffer,
                    originalname: fileName
                } : null
            });
        });

        busboy.on('error', (error) => {
            reject(error);
        });

        req.pipe(busboy);
    });
};

/**
 * Banana AI 生成器 Firebase 云函数
 */
export const bananaAIGenerator = onRequest({
    timeoutSeconds: 300,
    memory: '1GiB',
    maxInstances: 10,
    cors: true
}, async (req, res) => {
    const startTime = Date.now();
    let requestId = '';

    // 使用 CORS 中间件
    return corsHandler(req, res, async () => {
        try {
            // 生成请求ID
            requestId = `banana_fb_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
            console.log(`开始处理请求 ${requestId}`);
            console.log('请求方法:', req.method);
            console.log('Content-Type:', req.headers['content-type']);

            // 只允许 POST 请求
            if (req.method !== 'POST') {
                res.status(405).json({
                    success: false,
                    error: {
                        code: 'METHOD_NOT_ALLOWED',
                        message: '只允许 POST 请求'
                    }
                });
                return;
            }

            // 🔐 简单的加密验证
            // ⚠️ 注意：由于加密数据可能很大（几百KB），我们从请求体中读取，而不是请求头
            const isEncryptedRequest = req.headers['x-encrypted-request'] === 'true';
            const signature = req.headers['x-signature'];
            const requestTimestamp = req.headers['x-timestamp'];
            const iv = req.headers['x-iv'];

            let encryptedData = null;

            if (isEncryptedRequest) {
                // 从请求体中读取加密数据
                try {
                    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);
                    const bodyData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
                    encryptedData = bodyData.encrypted;
                    console.log('📦 从请求体中读取加密数据, 长度:', encryptedData ? encryptedData.length : 0);
                } catch (error) {
                    console.error('❌ 读取加密数据失败:', error);
                }
            }

            if (!encryptedData || !signature || !requestTimestamp || !iv) {
                console.error('❌ 缺少加密参数:', {
                    hasEncryptedData: !!encryptedData,
                    hasSignature: !!signature,
                    hasTimestamp: !!requestTimestamp,
                    hasIV: !!iv
                });
                res.status(403).json({
                    success: false,
                    error: {
                        code: 'MISSING_ENCRYPTION_HEADERS',
                        message: '缺少加密请求头或加密数据，请使用加密客户端'
                    }
                });
                return;
            }

            // 验证时间戳
            if (!isTimestampValid(parseInt(requestTimestamp))) {
                res.status(403).json({
                    success: false,
                    error: {
                        code: 'INVALID_TIMESTAMP',
                        message: '请求时间戳无效或已过期'
                    }
                });
                return;
            }

            // 验证签名
            if (!verifySignature(encryptedData, requestTimestamp, signature)) {
                res.status(403).json({
                    success: false,
                    error: {
                        code: 'INVALID_SIGNATURE',
                        message: '请求签名验证失败'
                    }
                });
                return;
            }

            // 检查请求类型并相应处理
            const contentType = req.headers['content-type'] || '';
            let requestBody = {};
            let hasImage = false;
            let imageFile = null;
            let conversationHistory = [];

            if (contentType.includes('application/json')) {
                // 处理 JSON 请求（BananaEditor 聊天模式）
                console.log('📋 处理加密的 JSON 请求');

                try {
                    // 解密请求体
                    requestBody = decryptRequestBody(encryptedData, req.headers['x-iv']);
                    console.log('✅ 请求体解密成功');
                } catch (error) {
                    console.log('❌ 请求体解密失败:', error.message);
                    res.status(400).json({
                        success: false,
                        error: {
                            code: 'DECRYPTION_FAILED',
                            message: '请求体解密失败'
                        }
                    });
                    return;
                }

                // 提取对话历史
                if (requestBody.conversationHistory && Array.isArray(requestBody.conversationHistory)) {
                    conversationHistory = requestBody.conversationHistory;
                    console.log('📚 对话历史长度:', conversationHistory.length);
                }

                console.log('解密后的请求体:', JSON.stringify(requestBody, null, 2));
            } else if (contentType.includes('multipart/form-data')) {
                // 处理 multipart/form-data 请求（带图片上传）
                console.log('📎 处理 multipart/form-data 请求');
                const parsed = await parseMultipartData(req);
                requestBody = parsed.fields;
                imageFile = parsed.file;
                hasImage = !!imageFile;

                // 处理对话历史（从form字段中解析）
                if (requestBody.conversationHistory) {
                    try {
                        conversationHistory = JSON.parse(requestBody.conversationHistory);
                        console.log('📚 对话历史长度:', conversationHistory.length);
                    } catch (error) {
                        console.log('⚠️ 对话历史解析失败:', error.message);
                        conversationHistory = [];
                    }
                }

                console.log('Form 请求体:', JSON.stringify(requestBody, null, 2));
                console.log('包含图片:', hasImage);
            } else {
                throw new Error(`不支持的 Content-Type: ${contentType}`);
            }

            // 验证请求参数
            const errors = validateRequest(requestBody);
            if (errors.length > 0) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: 'INVALID_REQUEST_PARAMS',
                        message: `请求参数验证失败: ${errors.join(', ')}`
                    }
                });
                return;
            }

            // 构建请求参数
            const params = {
                prompt: requestBody.prompt.trim(),
                style: requestBody.style || 'creative',
                quality: requestBody.quality || 'standard',
                creativity: parseInt(requestBody.creativity || '50'),
                colorTone: requestBody.colorTone || '',
                outputFormat: requestBody.outputFormat || 'jpeg'
            };

            console.log(`请求参数:`, params);

            // 处理上传的图片（如果有）
            let imageBase64 = null;
            if (hasImage && imageFile) {
                console.log(`处理上传的图片: ${imageFile.originalname}, 大小: ${imageFile.buffer.length} bytes`);
                const processedImage = await processImage(imageFile.buffer);
                imageBase64 = processedImage.base64;
            } else {
                console.log('没有上传图片，处理纯文本请求');
            }

            // 构建提示词
            // 如果有对话历史，让 AI 根据上下文智能判断；否则按图片生成处理
            let finalPrompt;
            if (conversationHistory.length > 0) {
                // 有对话历史时，使用原始提示词，让 AI 根据上下文理解意图
                finalPrompt = params.prompt;
                console.log('对话模式（有历史）, 使用原始提示词:', finalPrompt);
            } else {
                // 首次对话，按图片生成请求处理
                finalPrompt = buildEnhancedPrompt(params);
                console.log('图片生成模式（首次对话）, 增强提示词:', finalPrompt);
            }

            // 提取当前激活图片
            const currentActiveImage = requestBody.currentActiveImage || null;

            // 调用 Vertex AI（支持对话历史和激活图片）
            const aiResult = await callVertexAI(finalPrompt, imageBase64, conversationHistory, currentActiveImage);
            console.log(`AI 生成完成，文本长度: ${aiResult.text.length}`);

            let imageBuffer;
            if (aiResult.imageData) {
                // 使用AI生成的图片
                imageBuffer = Buffer.from(aiResult.imageData, 'base64');
                console.log('🖼️ 使用AI生成的图片，大小:', imageBuffer.length, 'bytes');
            } else {
                // 如果没有生成图片，创建一个占位符
                console.log('⚠️ 没有生成图片，使用占位符');
                imageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
            }

            // 保存到 Cloud Storage
            const imageTimestamp = Date.now();
            const imageFilename = `banana-generated/${requestId}-${imageTimestamp}.${params.outputFormat}`;
            const thumbnailFilename = `banana-thumbnails/${requestId}-${imageTimestamp}.${params.outputFormat}`;

            const imageUrl = await saveToCloudStorage(imageBuffer, imageFilename);
            const thumbnailUrl = await saveToCloudStorage(imageBuffer, thumbnailFilename);

            // 生成创作建议
            const suggestions = generateSuggestions(params.prompt, params.style);

            // 计算处理时间
            const processingTime = Date.now() - startTime;

            // 构建更新的对话历史
            const updatedHistory = [...conversationHistory];

            // 添加用户消息到历史
            updatedHistory.push({
                role: 'user',
                content: params.prompt,
                timestamp: Date.now(),
                hasImage: !!imageBase64
            });

            // 添加AI响应到历史
            updatedHistory.push({
                role: 'model',
                content: aiResult.text,
                imageUrl: imageUrl,
                timestamp: Date.now()
            });

            // 构建响应
            const response = {
                success: true,
                data: {
                    imageUrl,
                    thumbnailUrl,
                    generatedPrompt: aiResult.text,
                    conversationHistory: updatedHistory, // 返回更新的对话历史
                    metadata: {
                        requestId,
                        processingTime,
                        model: 'gemini-2.5-flash-image-preview',
                        style: params.style,
                        quality: params.quality,
                        dimensions: {
                            width: 1024,
                            height: 1024
                        },
                        fileSize: imageBuffer.length,
                        format: params.outputFormat,
                        conversationTurns: updatedHistory.length / 2 // 对话轮数
                    },
                    suggestions
                }
            };

            console.log(`请求 ${requestId} 处理完成，耗时 ${processingTime}ms`);
            res.status(200).json(response);

        } catch (error) {
            const processingTime = Date.now() - startTime;
            console.error(`请求 ${requestId} 处理失败:`, error);

            // 根据错误类型返回不同的状态码
            let statusCode = 500;
            let errorCode = 'GENERATION_FAILED';

            if (error.message.includes('参数验证失败')) {
                statusCode = 400;
                errorCode = 'INVALID_PARAMS';
            } else if (error.message.includes('文件上传失败')) {
                statusCode = 400;
                errorCode = 'UPLOAD_FAILED';
            } else if (error.message.includes('AI服务调用失败')) {
                statusCode = 503;
                errorCode = 'AI_SERVICE_ERROR';
            }

            res.status(statusCode).json({
                success: false,
                error: {
                    code: errorCode,
                    message: error.message,
                    requestId,
                    processingTime
                }
            });
        }
    });
});

/**
 * 辅助函数：验证 Supabase JWT 并获取用户信息
 */
async function verifySupabaseToken(authToken) {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) {
            throw new Error('Supabase 客户端未初始化');
        }

        // 验证 JWT token
        const {
            data: {
                user
            },
            error
        } = await supabase.auth.getUser(authToken);

        if (error) {
            console.error('JWT 验证失败:', error);
            return {
                success: false,
                error: 'INVALID_TOKEN',
                message: '认证令牌无效'
            };
        }

        if (!user) {
            return {
                success: false,
                error: 'USER_NOT_FOUND',
                message: '用户不存在'
            };
        }

        return {
            success: true,
            user
        };
    } catch (error) {
        console.error('验证 token 异常:', error);
        return {
            success: false,
            error: 'VERIFICATION_ERROR',
            message: '验证失败'
        };
    }
}

/**
 * 辅助函数：检查用户积分余额
 */
async function checkUserCredits(userId, requiredCredits = 1) {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) {
            throw new Error('Supabase 客户端未初始化');
        }

        const {
            data,
            error
        } = await supabase
            .from('user_credits')
            .select('credits')
            .eq('user_id', userId)
            .single();

        if (error) {
            console.error('查询积分失败:', error);
            return {
                success: false,
                error: 'QUERY_ERROR',
                message: '查询积分失败'
            };
        }

        if (!data) {
            return {
                success: false,
                error: 'NO_CREDITS_RECORD',
                message: '积分记录不存在'
            };
        }

        const hasEnough = data.credits >= requiredCredits;

        return {
            success: true,
            hasEnough,
            currentCredits: data.credits,
            requiredCredits
        };
    } catch (error) {
        console.error('检查积分异常:', error);
        return {
            success: false,
            error: 'CHECK_ERROR',
            message: '检查积分失败'
        };
    }
}

/**
 * 辅助函数：扣除用户积分
 */
async function deductUserCredits(userId, amount, reason, metadata = {}) {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) {
            throw new Error('Supabase 客户端未初始化');
        }

        const {
            data,
            error
        } = await supabase.rpc('deduct_credits', {
            p_user_id: userId,
            p_amount: amount,
            p_reason: reason,
            p_metadata: metadata
        });

        if (error) {
            console.error('扣除积分失败:', error);
            return {
                success: false,
                error: 'DEDUCTION_ERROR',
                message: '扣除积分失败'
            };
        }

        if (!data.success) {
            return {
                success: false,
                error: data.error || 'DEDUCTION_FAILED',
                message: data.message || '扣除积分失败'
            };
        }

        return {
            success: true,
            newBalance: data.new_balance
        };
    } catch (error) {
        console.error('扣除积分异常:', error);
        return {
            success: false,
            error: 'DEDUCTION_EXCEPTION',
            message: '扣除积分异常'
        };
    }
}

/**
 * Banana AI 生成器 Firebase 云函数 - V2 版本
 * 包含 Supabase 认证和积分检查
 */
export const bananaAIGenerator_v2 = onRequest({
    timeoutSeconds: 300,
    memory: '1GiB',
    maxInstances: 10,
    cors: true
}, async (req, res) => {
    const startTime = Date.now();
    let requestId = '';
    let userId = null;

    // 使用 CORS 中间件
    return corsHandler(req, res, async () => {
        try {
            // 生成请求ID
            requestId = `banana_fb_v2_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
            console.log(`🆕 [V2] 开始处理请求 ${requestId}`);

            // 只允许 POST 请求
            if (req.method !== 'POST') {
                res.status(405).json({
                    success: false,
                    error: {
                        code: 'METHOD_NOT_ALLOWED',
                        message: '只允许 POST 请求'
                    }
                });
                return;
            }

            // ==========================================
            // 1. Supabase JWT 验证
            // ==========================================
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: 'MISSING_AUTH_TOKEN',
                        message: '缺少认证令牌'
                    }
                });
                return;
            }

            const token = authHeader.substring(7); // 移除 "Bearer " 前缀
            const authResult = await verifySupabaseToken(token);

            if (!authResult.success) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: authResult.error,
                        message: authResult.message
                    }
                });
                return;
            }

            userId = authResult.user.id;
            console.log(`✅ [V2] 用户认证成功: ${userId}`);

            // ==========================================
            // 2. 检查积分余额
            // ==========================================
            const creditCheck = await checkUserCredits(userId, 1);

            if (!creditCheck.success) {
                res.status(500).json({
                    success: false,
                    error: {
                        code: creditCheck.error,
                        message: creditCheck.message
                    }
                });
                return;
            }

            if (!creditCheck.hasEnough) {
                console.warn(`⚠️ [V2] 用户积分不足: ${creditCheck.currentCredits}/${creditCheck.requiredCredits}`);
                res.status(402).json({
                    success: false,
                    error: {
                        code: 'INSUFFICIENT_CREDITS',
                        message: `积分不足。当前积分: ${creditCheck.currentCredits}，需要: ${creditCheck.requiredCredits}`,
                        currentCredits: creditCheck.currentCredits,
                        requiredCredits: creditCheck.requiredCredits
                    }
                });
                return;
            }

            console.log(`✅ [V2] 积分检查通过: ${creditCheck.currentCredits}/${creditCheck.requiredCredits}`);

            // ==========================================
            // 3. 原有的加密验证逻辑
            // ==========================================
            const isEncryptedRequest = req.headers['x-encrypted-request'] === 'true';
            const signature = req.headers['x-signature'];
            const requestTimestamp = req.headers['x-timestamp'];
            const iv = req.headers['x-iv'];

            let encryptedData = null;

            if (isEncryptedRequest) {
                try {
                    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);
                    const bodyData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
                    encryptedData = bodyData.encrypted;
                } catch (error) {
                    console.error('❌ [V2] 读取加密数据失败:', error);
                }
            }

            if (!encryptedData || !signature || !requestTimestamp || !iv) {
                res.status(403).json({
                    success: false,
                    error: {
                        code: 'MISSING_ENCRYPTION_HEADERS',
                        message: '缺少加密请求头或加密数据'
                    }
                });
                return;
            }

            // 验证时间戳
            if (!isTimestampValid(parseInt(requestTimestamp))) {
                res.status(403).json({
                    success: false,
                    error: {
                        code: 'INVALID_TIMESTAMP',
                        message: '请求时间戳无效或已过期'
                    }
                });
                return;
            }

            // 验证签名
            if (!verifySignature(encryptedData, requestTimestamp, signature)) {
                res.status(403).json({
                    success: false,
                    error: {
                        code: 'INVALID_SIGNATURE',
                        message: '请求签名验证失败'
                    }
                });
                return;
            }

            // ==========================================
            // 4. 解析请求并调用 AI（复用原有逻辑）
            // ==========================================
            const contentType = req.headers['content-type'] || '';
            let requestBody = {};
            let hasImage = false;
            let imageFile = null;
            let conversationHistory = [];

            if (contentType.includes('application/json')) {
                try {
                    requestBody = decryptRequestBody(encryptedData, req.headers['x-iv']);
                    console.log('✅ [V2] 请求体解密成功');
                } catch (error) {
                    res.status(400).json({
                        success: false,
                        error: {
                            code: 'DECRYPTION_FAILED',
                            message: '请求体解密失败'
                        }
                    });
                    return;
                }

                if (requestBody.conversationHistory && Array.isArray(requestBody.conversationHistory)) {
                    conversationHistory = requestBody.conversationHistory;
                }
            } else if (contentType.includes('multipart/form-data')) {
                const parsed = await parseMultipartData(req);
                requestBody = parsed.fields;
                imageFile = parsed.file;
                hasImage = !!imageFile;

                if (requestBody.conversationHistory) {
                    try {
                        conversationHistory = JSON.parse(requestBody.conversationHistory);
                    } catch (error) {
                        conversationHistory = [];
                    }
                }
            } else {
                throw new Error(`不支持的 Content-Type: ${contentType}`);
            }

            // 验证请求参数
            const errors = validateRequest(requestBody);
            if (errors.length > 0) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: 'INVALID_REQUEST_PARAMS',
                        message: `请求参数验证失败: ${errors.join(', ')}`
                    }
                });
                return;
            }

            const params = {
                prompt: requestBody.prompt.trim(),
                style: requestBody.style || 'creative',
                quality: requestBody.quality || 'standard',
                creativity: parseInt(requestBody.creativity || '50'),
                colorTone: requestBody.colorTone || '',
                outputFormat: requestBody.outputFormat || 'jpeg'
            };

            // 处理图片
            let imageBase64 = null;
            if (hasImage && imageFile) {
                const processedImage = await processImage(imageFile.buffer);
                imageBase64 = processedImage.base64;
            }

            // 构建提示词
            let finalPrompt;
            if (conversationHistory.length > 0) {
                finalPrompt = params.prompt;
            } else {
                finalPrompt = buildEnhancedPrompt(params);
            }

            const currentActiveImage = requestBody.currentActiveImage || null;

            // 调用 AI
            console.log(`🤖 [V2] 调用 AI 生成...`);
            const aiResult = await callVertexAI(finalPrompt, imageBase64, conversationHistory, currentActiveImage);
            console.log(`✅ [V2] AI 生成完成，文本长度: ${aiResult.text.length}`);

            // ==========================================
            // 5. 扣除积分（只有成功生成后才扣除）
            // ==========================================
            const deductionResult = await deductUserCredits(userId, 1, 'image_generation', {
                requestId,
                prompt: params.prompt.substring(0, 100), // 只记录前100字符
                hasImage
            });

            if (!deductionResult.success) {
                console.error(`❌ [V2] 扣除积分失败:`, deductionResult);
                // 即使扣除失败，也返回成功结果，但记录错误
                // 可以考虑将失败记录到数据库中，稍后补扣
            } else {
                console.log(`✅ [V2] 积分扣除成功，新余额: ${deductionResult.newBalance}`);
            }

            // ==========================================
            // 6. 上传图片并返回结果（复用原有逻辑）
            // ==========================================
            let imageBuffer;
            if (aiResult.imageData) {
                imageBuffer = Buffer.from(aiResult.imageData, 'base64');
            } else {
                imageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
            }

            const bucket = getBucket();
            const filename = `${requestId}_${Date.now()}.${params.outputFormat}`;
            const file = bucket.file(filename);

            await file.save(imageBuffer, {
                metadata: {
                    contentType: `image/${params.outputFormat}`,
                    metadata: {
                        generated: 'true',
                        model: 'vertex-ai',
                        timestamp: new Date().toISOString()
                    }
                }
            });

            await file.makePublic();
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

            const updatedHistory = [
                ...conversationHistory,
                {
                    role: 'user',
                    content: params.prompt
                },
                {
                    role: 'model',
                    content: aiResult.text,
                    imageUrl: publicUrl
                }
            ];

            const processingTime = Date.now() - startTime;
            const suggestions = aiResult.suggestions || [];

            const response = {
                success: true,
                data: {
                    text: aiResult.text,
                    imageUrl: publicUrl,
                    requestId,
                    processingTime,
                    conversationHistory: updatedHistory,
                    metadata: {
                        userId, // 包含用户 ID
                        creditsRemaining: deductionResult.success ? deductionResult.newBalance : undefined,
                        dimensions: {
                            width: 1024,
                            height: 1024
                        },
                        fileSize: imageBuffer.length,
                        format: params.outputFormat,
                        conversationTurns: updatedHistory.length / 2
                    },
                    suggestions
                }
            };

            console.log(`✅ [V2] 请求 ${requestId} 处理完成，耗时 ${processingTime}ms，剩余积分: ${deductionResult.newBalance || 'N/A'}`);
            res.status(200).json(response);

        } catch (error) {
            const processingTime = Date.now() - startTime;
            console.error(`❌ [V2] 请求 ${requestId} 处理失败:`, error);

            let statusCode = 500;
            let errorCode = 'GENERATION_FAILED';

            if (error.message.includes('参数验证失败')) {
                statusCode = 400;
                errorCode = 'INVALID_PARAMS';
            } else if (error.message.includes('文件上传失败')) {
                statusCode = 400;
                errorCode = 'UPLOAD_FAILED';
            } else if (error.message.includes('AI服务调用失败')) {
                statusCode = 503;
                errorCode = 'AI_SERVICE_ERROR';
            }

            res.status(statusCode).json({
                success: false,
                error: {
                    code: errorCode,
                    message: error.message,
                    requestId,
                    processingTime
                }
            });
        }
    });
});