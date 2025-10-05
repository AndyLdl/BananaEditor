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

// 初始化 Firebase Admin
const app = initializeApp();

// 获取项目 ID（Firebase Functions 中的标准方式）
// Firebase 会自动设置 GCLOUD_PROJECT 环境变量
const projectId = process.env.GCLOUD_PROJECT || 'bananaeditor-927be';

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

// 配置 CORS
const corsHandler = cors({
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    credentials: true
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

            // 检查请求类型并相应处理
            const contentType = req.headers['content-type'] || '';
            let requestBody = {};
            let hasImage = false;
            let imageFile = null;
            let conversationHistory = [];

            if (contentType.includes('application/json')) {
                // 处理 JSON 请求（BananaEditor 聊天模式）
                console.log('📋 处理 JSON 请求');
                requestBody = req.body || {};

                // 提取对话历史
                if (requestBody.conversationHistory && Array.isArray(requestBody.conversationHistory)) {
                    conversationHistory = requestBody.conversationHistory;
                    console.log('📚 对话历史长度:', conversationHistory.length);
                }

                console.log('JSON 请求体:', JSON.stringify(requestBody, null, 2));
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
            const timestamp = Date.now();
            const imageFilename = `banana-generated/${requestId}-${timestamp}.${params.outputFormat}`;
            const thumbnailFilename = `banana-thumbnails/${requestId}-${timestamp}.${params.outputFormat}`;

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