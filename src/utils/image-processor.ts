// 图片处理工具函数 - 完整实现
import sharp from 'sharp';
import { getConfig } from './gemini-client';

// 支持的图片格式
export const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type SupportedFormat = typeof SUPPORTED_FORMATS[number];

// 图片处理错误类
export class ImageProcessingError extends Error {
    constructor(message: string, public code: string, public details?: any) {
        super(message);
        this.name = 'ImageProcessingError';
    }
}

// 图片验证选项
export interface ImageValidationOptions {
    maxSize?: number;
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
    allowedFormats?: SupportedFormat[];
}

// 图片压缩选项
export interface ImageCompressionOptions {
    width?: number;
    height?: number;
    quality?: number;
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
    background?: string;
}

// 图片信息接口
export interface ImageInfo {
    width?: number;
    height?: number;
    format?: string;
    size: number;
    channels?: number;
    density?: number;
    hasAlpha?: boolean;
}

// 验证文件类型（基于MIME类型）
export function validateImageFile(file: File, options?: ImageValidationOptions): boolean {
    const config = getConfig();
    const maxSize = options?.maxSize || config.MAX_FILE_SIZE;
    const allowedFormats = options?.allowedFormats || SUPPORTED_FORMATS;

    // 检查MIME类型
    if (!allowedFormats.includes(file.type as SupportedFormat)) {
        throw new ImageProcessingError(
            `不支持的文件格式: ${file.type}`,
            'UNSUPPORTED_FORMAT',
            { fileType: file.type, allowedFormats }
        );
    }

    // 检查文件大小
    if (file.size > maxSize) {
        throw new ImageProcessingError(
            `文件大小超出限制，最大允许 ${Math.round(maxSize / 1024 / 1024)}MB`,
            'FILE_TOO_LARGE',
            { fileSize: file.size, maxSize }
        );
    }

    return true;
}

// 验证图片内容（基于实际图片数据）
export async function validateImageContent(
    buffer: Buffer,
    options?: ImageValidationOptions
): Promise<boolean> {
    try {
        const metadata = await sharp(buffer).metadata();

        // 检查是否为有效图片
        if (!metadata.width || !metadata.height) {
            throw new ImageProcessingError(
                '无效的图片文件',
                'INVALID_IMAGE',
                { metadata }
            );
        }

        // 检查图片尺寸
        if (options?.minWidth && metadata.width < options.minWidth) {
            throw new ImageProcessingError(
                `图片宽度过小，最小要求 ${options.minWidth}px`,
                'IMAGE_TOO_SMALL',
                { width: metadata.width, minWidth: options.minWidth }
            );
        }

        if (options?.minHeight && metadata.height < options.minHeight) {
            throw new ImageProcessingError(
                `图片高度过小，最小要求 ${options.minHeight}px`,
                'IMAGE_TOO_SMALL',
                { height: metadata.height, minHeight: options.minHeight }
            );
        }

        if (options?.maxWidth && metadata.width > options.maxWidth) {
            throw new ImageProcessingError(
                `图片宽度过大，最大允许 ${options.maxWidth}px`,
                'IMAGE_TOO_LARGE',
                { width: metadata.width, maxWidth: options.maxWidth }
            );
        }

        if (options?.maxHeight && metadata.height > options.maxHeight) {
            throw new ImageProcessingError(
                `图片高度过大，最大允许 ${options.maxHeight}px`,
                'IMAGE_TOO_LARGE',
                { height: metadata.height, maxHeight: options.maxHeight }
            );
        }

        return true;
    } catch (error) {
        if (error instanceof ImageProcessingError) {
            throw error;
        }
        throw new ImageProcessingError(
            '图片内容验证失败',
            'VALIDATION_FAILED',
            error
        );
    }
}

// 图片压缩函数
export async function compressImage(
    buffer: Buffer,
    options: ImageCompressionOptions = {}
): Promise<Buffer> {
    try {
        const {
            width,
            height,
            quality = 80,
            fit = 'inside',
            background = '#ffffff'
        } = options;

        let sharpInstance = sharp(buffer);

        // 调整尺寸
        if (width || height) {
            sharpInstance = sharpInstance.resize(width, height, {
                fit,
                background,
                withoutEnlargement: true
            });
        }

        // 获取原始格式
        const metadata = await sharp(buffer).metadata();
        const format = metadata.format;

        // 根据格式应用压缩
        switch (format) {
            case 'jpeg':
                sharpInstance = sharpInstance.jpeg({
                    quality,
                    progressive: true,
                    mozjpeg: true
                });
                break;
            case 'png':
                sharpInstance = sharpInstance.png({
                    quality,
                    compressionLevel: 9,
                    progressive: true
                });
                break;
            case 'webp':
                sharpInstance = sharpInstance.webp({
                    quality,
                    effort: 6
                });
                break;
            default:
                // 默认转换为JPEG
                sharpInstance = sharpInstance.jpeg({
                    quality,
                    progressive: true
                });
        }

        return await sharpInstance.toBuffer();
    } catch (error) {
        throw new ImageProcessingError(
            '图片压缩失败',
            'COMPRESSION_FAILED',
            error
        );
    }
}

// 图片格式转换函数
export async function convertImageFormat(
    buffer: Buffer,
    targetFormat: 'jpeg' | 'png' | 'webp',
    options: { quality?: number; background?: string } = {}
): Promise<Buffer> {
    try {
        const { quality = 80, background = '#ffffff' } = options;
        let sharpInstance = sharp(buffer);

        switch (targetFormat) {
            case 'jpeg':
                sharpInstance = sharpInstance
                    .flatten({ background })
                    .jpeg({
                        quality,
                        progressive: true,
                        mozjpeg: true
                    });
                break;
            case 'png':
                sharpInstance = sharpInstance.png({
                    quality,
                    compressionLevel: 9,
                    progressive: true
                });
                break;
            case 'webp':
                sharpInstance = sharpInstance.webp({
                    quality,
                    effort: 6
                });
                break;
            default:
                throw new ImageProcessingError(
                    `不支持的目标格式: ${targetFormat}`,
                    'UNSUPPORTED_TARGET_FORMAT',
                    { targetFormat }
                );
        }

        return await sharpInstance.toBuffer();
    } catch (error) {
        if (error instanceof ImageProcessingError) {
            throw error;
        }
        throw new ImageProcessingError(
            '图片格式转换失败',
            'CONVERSION_FAILED',
            error
        );
    }
}

// 获取图片信息
export async function getImageInfo(buffer: Buffer): Promise<ImageInfo> {
    try {
        const metadata = await sharp(buffer).metadata();
        return {
            width: metadata.width,
            height: metadata.height,
            format: metadata.format,
            size: buffer.length,
            channels: metadata.channels,
            density: metadata.density,
            hasAlpha: metadata.hasAlpha,
        };
    } catch (error) {
        throw new ImageProcessingError(
            '无法获取图片信息',
            'METADATA_FAILED',
            error
        );
    }
}

// 生成图片缩略图
export async function generateThumbnail(
    buffer: Buffer,
    size: number = 200,
    options: { format?: 'jpeg' | 'png' | 'webp'; quality?: number } = {}
): Promise<Buffer> {
    try {
        const { format = 'jpeg', quality = 80 } = options;

        let sharpInstance = sharp(buffer)
            .resize(size, size, {
                fit: 'cover',
                position: 'center'
            });

        switch (format) {
            case 'jpeg':
                sharpInstance = sharpInstance.jpeg({ quality });
                break;
            case 'png':
                sharpInstance = sharpInstance.png({ quality });
                break;
            case 'webp':
                sharpInstance = sharpInstance.webp({ quality });
                break;
        }

        return await sharpInstance.toBuffer();
    } catch (error) {
        throw new ImageProcessingError(
            '生成缩略图失败',
            'THUMBNAIL_FAILED',
            error
        );
    }
}

// 图片安全检查（检查是否包含恶意内容）
export async function performSecurityCheck(buffer: Buffer): Promise<boolean> {
    try {
        // 基础安全检查：验证图片是否可以正常解析
        const metadata = await sharp(buffer).metadata();

        // 检查图片尺寸是否合理（防止过大图片攻击）
        const maxDimension = 10000; // 最大10000像素
        if (metadata.width && metadata.width > maxDimension) {
            throw new ImageProcessingError(
                '图片宽度超出安全限制',
                'SECURITY_VIOLATION',
                { width: metadata.width, maxDimension }
            );
        }

        if (metadata.height && metadata.height > maxDimension) {
            throw new ImageProcessingError(
                '图片高度超出安全限制',
                'SECURITY_VIOLATION',
                { height: metadata.height, maxDimension }
            );
        }

        // 检查图片是否包含EXIF数据（可能包含敏感信息）
        if (metadata.exif) {
            console.warn('图片包含EXIF数据，建议清除');
        }

        return true;
    } catch (error) {
        if (error instanceof ImageProcessingError) {
            throw error;
        }
        throw new ImageProcessingError(
            '图片安全检查失败',
            'SECURITY_CHECK_FAILED',
            error
        );
    }
}

// 清除图片元数据
export async function stripMetadata(buffer: Buffer): Promise<Buffer> {
    try {
        return await sharp(buffer)
            .rotate() // 自动旋转（基于EXIF）
            .withMetadata(false) // 移除所有元数据
            .toBuffer();
    } catch (error) {
        throw new ImageProcessingError(
            '清除图片元数据失败',
            'STRIP_METADATA_FAILED',
            error
        );
    }
}

// 转换为Base64字符串（用于API调用）
export function bufferToBase64(buffer: Buffer): string {
    return buffer.toString('base64');
}

// 从Base64字符串转换为Buffer
export function base64ToBuffer(base64: string): Buffer {
    return Buffer.from(base64, 'base64');
}

// 综合图片处理函数（包含验证、压缩、安全检查）
export async function processImage(
    buffer: Buffer,
    options: {
        validation?: ImageValidationOptions;
        compression?: ImageCompressionOptions;
        targetFormat?: 'jpeg' | 'png' | 'webp';
        stripMeta?: boolean;
        securityCheck?: boolean;
    } = {}
): Promise<{
    processedBuffer: Buffer;
    info: ImageInfo;
    base64: string;
}> {
    try {
        let processedBuffer = buffer;

        // 1. 内容验证
        if (options.validation !== false) {
            await validateImageContent(processedBuffer, options.validation);
        }

        // 2. 安全检查
        if (options.securityCheck !== false) {
            await performSecurityCheck(processedBuffer);
        }

        // 3. 清除元数据
        if (options.stripMeta !== false) {
            processedBuffer = await stripMetadata(processedBuffer);
        }

        // 4. 格式转换
        if (options.targetFormat) {
            processedBuffer = await convertImageFormat(processedBuffer, options.targetFormat);
        }

        // 5. 压缩
        if (options.compression) {
            processedBuffer = await compressImage(processedBuffer, options.compression);
        }

        // 6. 获取处理后的图片信息
        const info = await getImageInfo(processedBuffer);

        // 7. 转换为Base64
        const base64 = bufferToBase64(processedBuffer);

        return {
            processedBuffer,
            info,
            base64
        };
    } catch (error) {
        if (error instanceof ImageProcessingError) {
            throw error;
        }
        throw new ImageProcessingError(
            '图片处理失败',
            'PROCESSING_FAILED',
            error
        );
    }
}