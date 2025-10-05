// 图片上传API路由
import type { APIRoute } from 'astro';
import { UPLOAD_CONFIG } from '../../../config/upload';
import { processImage, ImageProcessingError } from '../../../utils/image-processor';
import { defaultSecurityMiddleware, SecurityError, setSecurityHeaders, logSecurityEvent } from '../../../utils/security';
import { promises as fs } from 'fs';
import path from 'path';

// 确保上传目录存在
async function ensureUploadDirectories() {
    try {
        await fs.access(UPLOAD_CONFIG.UPLOAD_DIR);
    } catch {
        await fs.mkdir(UPLOAD_CONFIG.UPLOAD_DIR, { recursive: true });
    }

    try {
        await fs.access(UPLOAD_CONFIG.TEMP_DIR);
    } catch {
        await fs.mkdir(UPLOAD_CONFIG.TEMP_DIR, { recursive: true });
    }
}

// 清理临时文件的函数
async function cleanupTempFiles(olderThanMinutes: number = 60) {
    try {
        const tempDir = UPLOAD_CONFIG.TEMP_DIR;
        const files = await fs.readdir(tempDir);
        const now = Date.now();
        const cutoffTime = now - (olderThanMinutes * 60 * 1000);

        for (const file of files) {
            const filePath = path.join(tempDir, file);
            const stats = await fs.stat(filePath);

            if (stats.mtime.getTime() < cutoffTime) {
                await fs.unlink(filePath);
                console.log(`清理临时文件: ${file}`);
            }
        }
    } catch (error) {
        console.error('清理临时文件失败:', error);
    }
}

// 保存文件到磁盘
async function saveFile(buffer: Buffer, filename: string, isTemp: boolean = false): Promise<string> {
    const dir = isTemp ? UPLOAD_CONFIG.TEMP_DIR : UPLOAD_CONFIG.UPLOAD_DIR;
    const filePath = path.join(dir, filename);

    await fs.writeFile(filePath, buffer);
    return filePath;
}

export const POST: APIRoute = async ({ request }) => {
    let sessionId = '';
    let clientIP = '';

    try {
        // 1. 安全验证
        const securityCheck = defaultSecurityMiddleware.validateRequest(request);
        sessionId = securityCheck.sessionId;
        clientIP = securityCheck.clientIP;

        // 2. 确保目录存在
        await ensureUploadDirectories();

        // 3. 清理旧的临时文件
        await cleanupTempFiles();

        // 4. 解析表单数据
        const formData = await request.formData();
        const file = formData.get('image') as File;
        const isTemp = formData.get('temp') === 'true'; // 是否为临时文件

        if (!file) {
            return new Response(JSON.stringify({
                success: false,
                error: {
                    code: 'NO_FILE',
                    message: '未找到上传的文件'
                }
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 5. 基础文件验证
        if (!defaultSecurityMiddleware.validateFileType(file)) {
            logSecurityEvent({
                type: 'VALIDATION_FAILED',
                sessionId,
                clientIP,
                details: { reason: 'invalid_file_type', fileType: file.type }
            });

            return new Response(JSON.stringify({
                success: false,
                error: {
                    code: 'INVALID_FILE_TYPE',
                    message: `不支持的文件类型: ${file.type}，仅支持 JPG、PNG、WebP 格式`
                }
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 6. 文件大小验证
        if (file.size > UPLOAD_CONFIG.MAX_FILE_SIZE) {
            logSecurityEvent({
                type: 'VALIDATION_FAILED',
                sessionId,
                clientIP,
                details: { reason: 'file_too_large', fileSize: file.size }
            });

            return new Response(JSON.stringify({
                success: false,
                error: {
                    code: 'FILE_TOO_LARGE',
                    message: `文件大小超出限制，最大允许 ${Math.round(UPLOAD_CONFIG.MAX_FILE_SIZE / 1024 / 1024)}MB`
                }
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 7. 读取文件内容
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 8. 图片内容验证和处理
        const processedResult = await processImage(buffer, {
            validation: {
                maxWidth: 4096,
                maxHeight: 4096,
                minWidth: 32,
                minHeight: 32
            },
            compression: {
                quality: 85,
                width: undefined, // 保持原始尺寸
                height: undefined
            },
            stripMeta: true,
            securityCheck: true
        });

        // 9. 生成文件名
        const filename = UPLOAD_CONFIG.generateFileName(file.name);

        // 10. 保存文件
        const filePath = await saveFile(processedResult.processedBuffer, filename, isTemp);

        // 11. 生成文件URL
        const fileUrl = isTemp
            ? `/temp/${filename}`
            : UPLOAD_CONFIG.getFileUrl(filename);

        // 12. 返回成功响应
        const response = new Response(JSON.stringify({
            success: true,
            data: {
                filename,
                url: fileUrl,
                size: processedResult.processedBuffer.length,
                originalSize: file.size,
                info: processedResult.info,
                isTemp,
                uploadedAt: new Date().toISOString()
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

        return setSecurityHeaders(response);

    } catch (error) {
        console.error('图片上传失败:', error);

        // 记录安全事件
        if (error instanceof SecurityError) {
            logSecurityEvent({
                type: 'VALIDATION_FAILED',
                sessionId,
                clientIP,
                details: { error: error.message, code: error.code }
            });
        }

        // 处理不同类型的错误
        if (error instanceof ImageProcessingError) {
            return new Response(JSON.stringify({
                success: false,
                error: {
                    code: error.code,
                    message: error.message
                }
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (error instanceof SecurityError) {
            const statusCode = error.code === 'RATE_LIMITED' ? 429 : 403;
            return new Response(JSON.stringify({
                success: false,
                error: {
                    code: error.code,
                    message: error.message
                }
            }), {
                status: statusCode,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 通用错误处理
        return new Response(JSON.stringify({
            success: false,
            error: {
                code: 'UPLOAD_FAILED',
                message: '文件上传失败，请稍后重试'
            }
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

// 获取上传文件信息的GET接口
export const GET: APIRoute = async ({ request, url }) => {
    try {
        const filename = url.searchParams.get('filename');

        if (!filename) {
            return new Response(JSON.stringify({
                success: false,
                error: {
                    code: 'MISSING_FILENAME',
                    message: '缺少文件名参数'
                }
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 检查文件是否存在
        const filePath = path.join(UPLOAD_CONFIG.UPLOAD_DIR, filename);

        try {
            const stats = await fs.stat(filePath);

            const response = new Response(JSON.stringify({
                success: true,
                data: {
                    filename,
                    size: stats.size,
                    createdAt: stats.birthtime.toISOString(),
                    modifiedAt: stats.mtime.toISOString(),
                    url: UPLOAD_CONFIG.getFileUrl(filename)
                }
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });

            return setSecurityHeaders(response);
        } catch {
            return new Response(JSON.stringify({
                success: false,
                error: {
                    code: 'FILE_NOT_FOUND',
                    message: '文件不存在'
                }
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

    } catch (error) {
        console.error('获取文件信息失败:', error);

        return new Response(JSON.stringify({
            success: false,
            error: {
                code: 'GET_INFO_FAILED',
                message: '获取文件信息失败'
            }
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

// 删除上传文件的DELETE接口
export const DELETE: APIRoute = async ({ request, url }) => {
    let sessionId = '';
    let clientIP = '';

    try {
        // 安全验证
        const securityCheck = defaultSecurityMiddleware.validateRequest(request);
        sessionId = securityCheck.sessionId;
        clientIP = securityCheck.clientIP;

        const filename = url.searchParams.get('filename');

        if (!filename) {
            return new Response(JSON.stringify({
                success: false,
                error: {
                    code: 'MISSING_FILENAME',
                    message: '缺少文件名参数'
                }
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 安全检查：确保文件名不包含路径遍历字符
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            logSecurityEvent({
                type: 'VALIDATION_FAILED',
                sessionId,
                clientIP,
                details: { reason: 'path_traversal_attempt', filename }
            });

            return new Response(JSON.stringify({
                success: false,
                error: {
                    code: 'INVALID_FILENAME',
                    message: '无效的文件名'
                }
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 删除文件
        const filePath = path.join(UPLOAD_CONFIG.UPLOAD_DIR, filename);

        try {
            await fs.unlink(filePath);

            const response = new Response(JSON.stringify({
                success: true,
                message: '文件删除成功'
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });

            return setSecurityHeaders(response);
        } catch {
            return new Response(JSON.stringify({
                success: false,
                error: {
                    code: 'FILE_NOT_FOUND',
                    message: '文件不存在或已被删除'
                }
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

    } catch (error) {
        console.error('删除文件失败:', error);

        if (error instanceof SecurityError) {
            const statusCode = error.code === 'RATE_LIMITED' ? 429 : 403;
            return new Response(JSON.stringify({
                success: false,
                error: {
                    code: error.code,
                    message: error.message
                }
            }), {
                status: statusCode,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({
            success: false,
            error: {
                code: 'DELETE_FAILED',
                message: '删除文件失败'
            }
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};