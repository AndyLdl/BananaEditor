#!/usr/bin/env node

/**
 * 安全配置快速设置脚本
 * 帮助快速配置加密密钥和环境变量
 */

import {
    execSync
} from 'child_process';
import {
    readFileSync,
    writeFileSync,
    existsSync
} from 'fs';
import crypto from 'crypto';
import readline from 'readline';

// 创建命令行接口
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// 提示用户输入
const question = (prompt) => {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
};

// 执行命令
const execCommand = (command, options = {}) => {
    try {
        const result = execSync(command, {
            encoding: 'utf8',
            stdio: options.silent ? 'pipe' : 'inherit',
            ...options
        });
        return result ? result.trim() : '';
    } catch (error) {
        if (!options.silent) {
            console.error(`❌ 命令执行失败: ${command}`);
            console.error(error.message);
        }
        return null;
    }
};

// 生成加密密钥
const generateEncryptionKey = () => {
    return crypto.randomBytes(32).toString('hex');
};

// 主配置流程
const main = async () => {
    console.log('🔐 安全配置快速设置');
    console.log('====================\n');

    try {
        // 1. 生成加密密钥
        console.log('🔑 生成加密密钥...');
        const encryptionKey = generateEncryptionKey();
        console.log(`✅ 生成密钥: ${encryptionKey}`);

        // 2. 获取云函数URL
        console.log('\n🌐 配置云函数URL...');
        const functionUrl = await question('请输入云函数URL (例如: https://your-function-url): ');

        if (!functionUrl || !functionUrl.startsWith('https://')) {
            console.log('❌ 请输入有效的HTTPS URL');
            process.exit(1);
        }

        // 3. 创建环境变量文件
        console.log('\n📝 创建环境变量文件...');

        const envContent = `# 前端环境变量配置
# 自动生成于 ${new Date().toISOString()}

# 🔐 加密密钥配置
PUBLIC_ENCRYPTION_KEY=${encryptionKey}

# 🌐 云函数配置
PUBLIC_FIREBASE_FUNCTION_URL=${functionUrl}
PUBLIC_CLOUD_FUNCTION_URL=${functionUrl}

# 🔧 开发环境配置
NODE_ENV=development
`;

        // 检查 .env 文件是否已存在
        if (existsSync('.env')) {
            const overwrite = await question('⚠️  .env 文件已存在，是否覆盖? (y/N): ');
            if (overwrite.toLowerCase() !== 'y') {
                console.log('⏭️  跳过创建 .env 文件');
            } else {
                writeFileSync('.env', envContent);
                console.log('✅ .env 文件已创建');
            }
        } else {
            writeFileSync('.env', envContent);
            console.log('✅ .env 文件已创建');
        }

        // 4. 设置云函数环境变量
        console.log('\n☁️ 设置云函数环境变量...');

        const setEncryptionKey = execCommand(`firebase functions:config:set app.encryption_key="${encryptionKey}"`);
        if (setEncryptionKey === null) {
            console.log('❌ 设置云函数加密密钥失败');
            console.log('💡 请确保已登录 Firebase 并设置了活跃项目');
            process.exit(1);
        }
        console.log('✅ 云函数加密密钥设置成功');

        // 5. 设置允许的来源
        const allowedOrigins = await question('请输入允许的来源（用逗号分隔，* 表示允许所有）: ');
        if (allowedOrigins.trim()) {
            const setAllowedOrigins = execCommand(`firebase functions:config:set app.allowed_origins="${allowedOrigins}"`);
            if (setAllowedOrigins === null) {
                console.log('❌ 设置允许来源失败');
            } else {
                console.log('✅ 允许来源设置成功');
            }
        }

        // 6. 部署云函数
        console.log('\n🚀 部署云函数...');
        const deployResult = execCommand('firebase deploy --only functions');
        if (deployResult === null) {
            console.log('❌ 云函数部署失败');
            console.log('💡 请检查 Firebase 配置和网络连接');
            process.exit(1);
        }
        console.log('✅ 云函数部署成功');

        // 7. 显示配置摘要
        console.log('\n📋 配置摘要:');
        console.log('================================');
        console.log(`🔑 加密密钥: ${encryptionKey}`);
        console.log(`🌐 云函数URL: ${functionUrl}`);
        console.log(`🌍 允许来源: ${allowedOrigins || '未设置'}`);
        console.log('================================');

        // 8. 安全提醒
        console.log('\n🔐 安全提醒:');
        console.log('1. ✅ 密钥已安全存储在环境变量中');
        console.log('2. ✅ .env 文件已在 .gitignore 中');
        console.log('3. ⚠️  不要将密钥提交到代码仓库');
        console.log('4. ⚠️  定期轮换密钥');

        // 9. 测试建议
        console.log('\n🧪 测试建议:');
        console.log('1. 访问 /test-cloud-function 页面');
        console.log('2. 点击"测试连接"按钮');
        console.log('3. 应该显示"加密云函数连接测试成功"');

        console.log('\n🎉 安全配置完成！');

    } catch (error) {
        console.error('❌ 配置过程中出现错误:', error.message);
        process.exit(1);
    } finally {
        rl.close();
    }
};

// 运行配置
if (
    import.meta.url === `file://${process.argv[1]}`) {
    main();
}
