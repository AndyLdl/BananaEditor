// 图片处理工具单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest';
import sharp from 'sharp';
import {
    validateImageFile,
    validateImageContent,
    compressImage,
    convertImageFormat,
    getImageInfo,
    generateThumbnail,
    performSecurityCheck,
    stripMetadata,
    bufferToBase64,
    base64ToBuffer,
    processImage,
    ImageProcessingError,
    SUPPORTED_FORMATS
} from '../image-processor';

// 模拟getConfig函数
vi.mock('../gemini-client', () => ({
    getConfig: vi.fn(() => ({
        MAX_FILE_SIZE: 10485760, // 10MB
    }))
}));

describe('图片处理工具', () => {
    // 创建测试用的图片Buffer
    let testImageBuffer: Buffer;
    let testFile: File;

    beforeEach(async () => {
        // 创建一个简单的测试图片（100x100的红色正方形）
        testImageBuffer = await sharp({
            create: {
                width: 100,
                height: 100,
                channels: 3,
                background: { r: 255, g: 0, b: 0 }
            }
        }).jpeg().toBuffer();

        // 创建测试文件对象
        testFile = new File([testImageBuffer], 'test.jpg', { type: 'image/jpeg' });
    });

    describe('validateImageFile', () => {
        it('应该验证有效的图片文件', () => {
            expect(validateImageFile(testFile)).toBe(true);
        });

        it('应该拒绝不支持的文件格式', () => {
            const invalidFile = new File([testImageBuffer], 'test.gif', { type: 'image/gif' });

            expect(() => validateImageFile(invalidFile)).toThrow(ImageProcessingError);
            expect(() => validateImageFile(invalidFile)).toThrow('不支持的文件格式');
        });

        it('应该拒绝过大的文件', () => {
            const largeFile = new File([testImageBuffer], 'test.jpg', { type: 'image/jpeg' });
            Object.defineProperty(largeFile, 'size', { value: 20 * 1024 * 1024 }); // 20MB

            expect(() => validateImageFile(largeFile)).toThrow(ImageProcessingError);
            expect(() => validateImageFile(largeFile)).toThrow('文件大小超出限制');
        });

        it('应该支持自定义验证选项', () => {
            // 测试格式限制
            const formatOptions = {
                allowedFormats: ['image/png'] as const
            };
            expect(() => validateImageFile(testFile, formatOptions)).toThrow('不支持的文件格式');

            // 测试大小限制 - 使用一个非常小的限制
            const sizeOptions = {
                maxSize: 100, // 100字节，肯定小于图片大小
            };
            expect(() => validateImageFile(testFile, sizeOptions)).toThrow('文件大小超出限制');
        });
    });

    describe('validateImageContent', () => {
        it('应该验证有效的图片内容', async () => {
            const result = await validateImageContent(testImageBuffer);
            expect(result).toBe(true);
        });

        it('应该拒绝无效的图片数据', async () => {
            const invalidBuffer = Buffer.from('not an image');

            await expect(validateImageContent(invalidBuffer))
                .rejects.toThrow(ImageProcessingError);
        });

        it('应该检查图片尺寸限制', async () => {
            const options = {
                minWidth: 200,
                minHeight: 200
            };

            await expect(validateImageContent(testImageBuffer, options))
                .rejects.toThrow('图片宽度过小');
        });
    });

    describe('compressImage', () => {
        it('应该压缩图片', async () => {
            const compressed = await compressImage(testImageBuffer, {
                width: 50,
                height: 50,
                quality: 50
            });

            expect(compressed).toBeInstanceOf(Buffer);
            expect(compressed.length).toBeLessThan(testImageBuffer.length);

            // 验证压缩后的尺寸
            const metadata = await sharp(compressed).metadata();
            expect(metadata.width).toBe(50);
            expect(metadata.height).toBe(50);
        });

        it('应该保持原始格式', async () => {
            const compressed = await compressImage(testImageBuffer);
            const metadata = await sharp(compressed).metadata();
            expect(metadata.format).toBe('jpeg');
        });
    });

    describe('convertImageFormat', () => {
        it('应该转换图片格式为PNG', async () => {
            const converted = await convertImageFormat(testImageBuffer, 'png');
            const metadata = await sharp(converted).metadata();
            expect(metadata.format).toBe('png');
        });

        it('应该转换图片格式为WebP', async () => {
            const converted = await convertImageFormat(testImageBuffer, 'webp');
            const metadata = await sharp(converted).metadata();
            expect(metadata.format).toBe('webp');
        });

        it('应该拒绝不支持的格式', async () => {
            await expect(convertImageFormat(testImageBuffer, 'gif' as any))
                .rejects.toThrow('不支持的目标格式');
        });
    });

    describe('getImageInfo', () => {
        it('应该返回正确的图片信息', async () => {
            const info = await getImageInfo(testImageBuffer);

            expect(info).toMatchObject({
                width: 100,
                height: 100,
                format: 'jpeg',
                size: expect.any(Number)
            });
        });

        it('应该处理无效图片', async () => {
            const invalidBuffer = Buffer.from('not an image');

            await expect(getImageInfo(invalidBuffer))
                .rejects.toThrow(ImageProcessingError);
        });
    });

    describe('generateThumbnail', () => {
        it('应该生成缩略图', async () => {
            const thumbnail = await generateThumbnail(testImageBuffer, 50);
            const metadata = await sharp(thumbnail).metadata();

            expect(metadata.width).toBe(50);
            expect(metadata.height).toBe(50);
        });

        it('应该支持不同格式的缩略图', async () => {
            const thumbnail = await generateThumbnail(testImageBuffer, 50, { format: 'png' });
            const metadata = await sharp(thumbnail).metadata();

            expect(metadata.format).toBe('png');
        });
    });

    describe('performSecurityCheck', () => {
        it('应该通过正常图片的安全检查', async () => {
            const result = await performSecurityCheck(testImageBuffer);
            expect(result).toBe(true);
        });

        it('应该拒绝过大的图片', async () => {
            // 创建一个超大图片的模拟
            const largeImageBuffer = await sharp({
                create: {
                    width: 15000,
                    height: 15000,
                    channels: 3,
                    background: { r: 255, g: 0, b: 0 }
                }
            }).jpeg().toBuffer();

            await expect(performSecurityCheck(largeImageBuffer))
                .rejects.toThrow('图片宽度超出安全限制');
        });
    });

    describe('stripMetadata', () => {
        it('应该清除图片元数据', async () => {
            const stripped = await stripMetadata(testImageBuffer);
            expect(stripped).toBeInstanceOf(Buffer);

            // 验证处理后的图片仍然有效
            const metadata = await sharp(stripped).metadata();
            expect(metadata.width).toBe(100);
            expect(metadata.height).toBe(100);
        });
    });

    describe('Base64转换', () => {
        it('应该正确转换Buffer到Base64', () => {
            const base64 = bufferToBase64(testImageBuffer);
            expect(typeof base64).toBe('string');
            expect(base64.length).toBeGreaterThan(0);
        });

        it('应该正确转换Base64到Buffer', () => {
            const base64 = bufferToBase64(testImageBuffer);
            const buffer = base64ToBuffer(base64);
            expect(buffer).toEqual(testImageBuffer);
        });
    });

    describe('processImage', () => {
        it('应该完整处理图片', async () => {
            const result = await processImage(testImageBuffer, {
                compression: { width: 80, height: 80, quality: 70 },
                targetFormat: 'webp'
            });

            expect(result).toHaveProperty('processedBuffer');
            expect(result).toHaveProperty('info');
            expect(result).toHaveProperty('base64');

            expect(result.info.width).toBe(80);
            expect(result.info.height).toBe(80);
            expect(result.info.format).toBe('webp');
            expect(typeof result.base64).toBe('string');
        });

        it('应该处理验证失败的情况', async () => {
            await expect(processImage(testImageBuffer, {
                validation: { minWidth: 200 }
            })).rejects.toThrow(ImageProcessingError);
        });
    });

    describe('ImageProcessingError', () => {
        it('应该正确创建错误实例', () => {
            const error = new ImageProcessingError('测试错误', 'TEST_ERROR', { detail: 'test' });

            expect(error.message).toBe('测试错误');
            expect(error.code).toBe('TEST_ERROR');
            expect(error.details).toEqual({ detail: 'test' });
            expect(error.name).toBe('ImageProcessingError');
        });
    });

    describe('常量', () => {
        it('应该导出支持的格式', () => {
            expect(SUPPORTED_FORMATS).toEqual(['image/jpeg', 'image/png', 'image/webp']);
        });
    });
});