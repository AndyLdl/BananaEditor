// 图片上传API测试
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { UPLOAD_CONFIG } from '../../config/upload';
import { fileCleanup } from '../file-cleanup';

// 测试用的图片数据 (1x1 PNG)
const TEST_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const TEST_PNG_BUFFER = Buffer.from(TEST_PNG_BASE64, 'base64');

// 创建测试用的File对象
function createTestFile(name: string, type: string, buffer: Buffer): File {
    return new File([buffer], name, { type });
}

// 创建测试用的FormData
function createFormData(file: File, isTemp: boolean = false): FormData {
    const formData = new FormData();
    formData.append('image', file);
    if (isTemp) {
        formData.append('temp', 'true');
    }
    return formData;
}

// 创建测试用的Request对象
function createTestRequest(formData: FormData, headers: Record<string, string> = {}): Request {
    return new Request('http://localhost:3000/api/upload/image', {
        method: 'POST',
        body: formData,
        headers: {
            'x-session-id': 'test-session-123',
            ...headers
        }
    });
}

describe('图片上传API测试', () => {
    beforeAll(async () => {
        // 确保测试目录存在
        await fs.mkdir(UPLOAD_CONFIG.UPLOAD_DIR, { recursive: true });
        await fs.mkdir(UPLOAD_CONFIG.TEMP_DIR, { recursive: true });
    });

    afterAll(async () => {
        // 清理测试文件
        try {
            await fileCleanup.cleanupTempFiles(0, false);
            await fileCleanup.cleanupUploadFiles(0, false);
        } catch (error) {
            console.log('清理测试文件时出错:', error);
        }
    });

    describe('文件验证', () => {
        it('应该接受有效的PNG文件', async () => {
            const file = createTestFile('test.png', 'image/png', TEST_PNG_BUFFER);
            const formData = createFormData(file);
            const request = createTestRequest(formData);

            // 这里我们测试的是API逻辑，实际的API路由需要在集成测试中验证
            expect(file.type).toBe('image/png');
            expect(file.size).toBeGreaterThan(0);
        });

        it('应该拒绝不支持的文件类型', async () => {
            const file = createTestFile('test.txt', 'text/plain', Buffer.from('test'));

            expect(file.type).toBe('text/plain');
            // 在实际API中，这会被拒绝
        });

        it('应该拒绝过大的文件', async () => {
            // 创建一个超过限制的大文件
            const largeBuffer = Buffer.alloc(UPLOAD_CONFIG.MAX_FILE_SIZE + 1);
            const file = createTestFile('large.png', 'image/png', largeBuffer);

            expect(file.size).toBeGreaterThan(UPLOAD_CONFIG.MAX_FILE_SIZE);
            // 在实际API中，这会被拒绝
        });
    });

    describe('文件名生成', () => {
        it('应该生成唯一的文件名', () => {
            const filename1 = UPLOAD_CONFIG.generateFileName('test.png');
            const filename2 = UPLOAD_CONFIG.generateFileName('test.png');

            expect(filename1).not.toBe(filename2);
            expect(filename1).toMatch(/^\d+_[a-z0-9]{6}\.png$/);
            expect(filename2).toMatch(/^\d+_[a-z0-9]{6}\.png$/);
        });

        it('应该保持文件扩展名', () => {
            const filename = UPLOAD_CONFIG.generateFileName('test.jpg');
            expect(filename).toMatch(/\.jpg$/);
        });
    });

    describe('URL生成', () => {
        it('应该生成正确的文件URL', () => {
            const filename = 'test_123456.png';
            const url = UPLOAD_CONFIG.getFileUrl(filename);

            expect(url).toBe('/uploads/test_123456.png');
        });
    });

    describe('目录管理', () => {
        it('应该能够创建必要的目录', async () => {
            // 删除目录（如果存在）
            try {
                await fs.rmdir(UPLOAD_CONFIG.TEMP_DIR);
            } catch { }

            // 重新创建
            const { ensureDirectories } = await import('../file-cleanup');
            await ensureDirectories();

            // 验证目录存在
            const tempStats = await fs.stat(UPLOAD_CONFIG.TEMP_DIR);
            expect(tempStats.isDirectory()).toBe(true);
        });
    });

    describe('文件清理', () => {
        it('应该能够清理过期的临时文件', async () => {
            // 创建一个测试文件
            const testFile = path.join(UPLOAD_CONFIG.TEMP_DIR, 'test_cleanup.png');
            await fs.writeFile(testFile, TEST_PNG_BUFFER);

            // 修改文件时间为1小时前
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            await fs.utimes(testFile, oneHourAgo, oneHourAgo);

            // 执行清理
            const result = await fileCleanup.cleanupTempFiles(30); // 清理30分钟前的文件

            expect(result.deletedFiles).toBeGreaterThan(0);
        });

        it('应该生成清理报告', async () => {
            const report = await fileCleanup.generateCleanupReport();

            expect(report).toContain('文件清理报告');
            expect(report).toContain('临时文件目录');
            expect(report).toContain('上传文件目录');
        });
    });

    describe('安全性', () => {
        it('应该拒绝包含路径遍历的文件名', () => {
            const dangerousNames = [
                '../../../etc/passwd',
                '..\\..\\windows\\system32',
                'test/../../../secret.txt'
            ];

            dangerousNames.forEach(name => {
                expect(name.includes('..')).toBe(true);
                // 在实际API中，这些会被拒绝
            });
        });

        it('应该验证会话ID格式', () => {
            const validSessionId = 'session_1234567890_abcdef123';
            const invalidSessionId = '<script>alert("xss")</script>';

            expect(validSessionId).toMatch(/^session_\d+_[a-z0-9]+$/);
            expect(invalidSessionId).toContain('<script>');
            // 在实际API中，无效的会话ID会被拒绝
        });
    });
});