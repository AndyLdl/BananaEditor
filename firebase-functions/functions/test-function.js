import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 测试 Firebase 云函数
 */
async function testBananaAIGenerator() {
    console.log('🧪 开始测试 Banana AI Generator Firebase 云函数...\n');

    // 测试配置
    const functionUrl = process.env.FUNCTION_URL || 'http://localhost:5001/your-project-id/us-central1/bananaAIGenerator';

    // 测试用例 1: JSON 请求
    console.log('📋 测试 1: JSON 请求');
    const jsonTestData = {
        prompt: '一只可爱的橙色小猫坐在花园里',
        style: 'realistic',
        quality: 'high',
        creativity: 70,
        colorTone: 'warm',
        outputFormat: 'jpeg'
    };

    try {
        const jsonResponse = await makeRequest(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(jsonTestData)
        });

        console.log('✅ JSON 请求测试成功');
        console.log('响应数据:', JSON.stringify(jsonResponse, null, 2));
        console.log('');
    } catch (error) {
        console.error('❌ JSON 请求测试失败:', error.message);
        console.log('');
    }

    // 测试用例 2: 简单文本请求
    console.log('📝 测试 2: 简单文本请求');
    const simpleTestData = {
        prompt: '美丽的日落风景'
    };

    try {
        const simpleResponse = await makeRequest(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(simpleTestData)
        });

        console.log('✅ 简单文本请求测试成功');
        console.log('生成的提示词:', simpleResponse.data?.generatedPrompt);
        console.log('处理时间:', simpleResponse.data?.metadata?.processingTime, 'ms');
        console.log('');
    } catch (error) {
        console.error('❌ 简单文本请求测试失败:', error.message);
        console.log('');
    }

    // 测试用例 3: 错误处理
    console.log('🚫 测试 3: 错误处理');
    const invalidTestData = {
        // 缺少必需的 prompt 参数
        style: 'realistic'
    };

    try {
        const errorResponse = await makeRequest(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(invalidTestData)
        });

        console.log('❌ 错误处理测试失败: 应该返回错误但返回了成功响应');
        console.log('');
    } catch (error) {
        if (error.statusCode === 400) {
            console.log('✅ 错误处理测试成功: 正确返回了 400 错误');
            console.log('错误信息:', error.message);
        } else {
            console.log('⚠️ 错误处理测试部分成功: 返回了错误但状态码不是 400');
            console.log('实际状态码:', error.statusCode);
            console.log('错误信息:', error.message);
        }
        console.log('');
    }

    console.log('🎉 测试完成！');
}

/**
 * 发送 HTTP 请求
 * @param {string} url - 请求URL
 * @param {Object} options - 请求选项
 * @returns {Promise} 响应数据
 */
function makeRequest(url, options) {
    return new Promise((resolve, reject) => {
        const isHttps = url.startsWith('https://');
        const client = isHttps ? https : http;

        const req = client.request(url, {
            method: options.method || 'GET',
            headers: options.headers || {}
        }, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);

                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(jsonData);
                    } else {
                        const error = new Error(jsonData.error?.message || `HTTP ${res.statusCode}`);
                        error.statusCode = res.statusCode;
                        error.response = jsonData;
                        reject(error);
                    }
                } catch (parseError) {
                    const error = new Error(`解析响应失败: ${parseError.message}`);
                    error.statusCode = res.statusCode;
                    error.rawData = data;
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            reject(new Error(`请求失败: ${error.message}`));
        });

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
    testBananaAIGenerator().catch(console.error);
}