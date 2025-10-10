#!/usr/bin/env node

/**
 * 安全配置脚本
 * 帮助快速配置云函数的安全环境变量
 */

import {
    execSync
} from 'child_process';
import readline from 'readline';
import crypto from 'crypto';

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
    console.log('🔐 Firebase 云函数安全配置向导');
    console.log('================================\n');

    try {
        // 1. 检查 Firebase CLI
        console.log('🔍 检查 Firebase CLI...');
        const firebaseCheck = execCommand('firebase --version', {
            silent: true
        });
        if (!firebaseCheck) {
            console.log('❌ Firebase CLI 未安装');
            console.log('📦 请先安装: npm install -g firebase-tools');
            process.exit(1);
        }
        console.log('✅ Firebase CLI 已安装');

        // 2. 检查登录状态
        console.log('🔍 检查 Firebase 登录状态...');
        const loginCheck = execCommand('firebase projects:list', {
            silent: true
        });
        if (!loginCheck) {
            console.log('❌ 未登录 Firebase');
            console.log('🔐 请先登录: firebase login');
            process.exit(1);
        }
        console.log('✅ Firebase 已登录');

        // 3. 获取项目信息
        const currentProject = execCommand('firebase use', {
            silent: true
        });
        console.log(`📋 当前项目: ${currentProject}`);

        // 4. 配置加密密钥
        console.log('\n🔑 配置加密密钥...');
        const useGeneratedKey = await question('是否生成新的加密密钥? (y/N): ');

        let encryptionKey;
        if (useGeneratedKey.toLowerCase() === 'y') {
            encryptionKey = generateEncryptionKey();
            console.log(`✅ 生成加密密钥: ${encryptionKey}`);
        } else {
            encryptionKey = await question('请输入32字符的加密密钥: ');
            if (encryptionKey.length !== 64) {
                console.log('❌ 加密密钥长度不正确，应该是64个字符');
                process.exit(1);
            }
        }

        // 5. 配置允许的来源
        console.log('\n🌐 配置允许的来源...');
        const allowedOrigins = await question('请输入允许的来源（用逗号分隔，* 表示允许所有）: ');

        if (!allowedOrigins.trim()) {
            console.log('❌ 必须指定允许的来源');
            process.exit(1);
        }

        // 6. 设置环境变量
        console.log('\n⚙️ 设置环境变量...');

        const setEncryptionKey = execCommand(`firebase functions:config:set app.encryption_key="${encryptionKey}"`);
        if (setEncryptionKey === null) {
            console.log('❌ 设置加密密钥失败');
            process.exit(1);
        }
        console.log('✅ 加密密钥设置成功');

        const setAllowedOrigins = execCommand(`firebase functions:config:set app.allowed_origins="${allowedOrigins}"`);
        if (setAllowedOrigins === null) {
            console.log('❌ 设置允许来源失败');
            process.exit(1);
        }
        console.log('✅ 允许来源设置成功');

        // 7. 部署配置
        console.log('\n🚀 部署配置...');
        console.log('📁 切换到项目根目录...');
        const deployResult = execCommand('cd ../.. && firebase deploy --only functions');
        if (deployResult === null) {
            console.log('❌ 部署失败');
            console.log('💡 请确保在项目根目录下运行: cd ../.. && firebase deploy --only functions');
            process.exit(1);
        }
        console.log('✅ 配置部署成功');

        // 8. 显示配置摘要
        console.log('\n📋 配置摘要:');
        console.log('================================');
        console.log(`🔑 加密密钥: ${encryptionKey}`);
        console.log(`🌐 允许来源: ${allowedOrigins}`);
        console.log(`📦 项目: ${currentProject}`);
        console.log('================================');

        // 9. 测试建议
        console.log('\n🧪 测试建议:');
        console.log('1. 检查云函数日志: firebase functions:log');
        console.log('2. 测试 CORS 配置: 使用不同来源访问');
        console.log('3. 测试加密功能: 使用加密客户端调用');

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
