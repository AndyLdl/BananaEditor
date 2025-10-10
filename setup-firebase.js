#!/usr/bin/env node

/**
 * Firebase 项目设置脚本
 * 帮助快速配置 Firebase 项目和环境变量
 */

import {
    execSync
} from 'child_process';
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

// 主配置流程
const main = async () => {
    console.log('🚀 Firebase 项目设置向导');
    console.log('========================\n');

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

        // 3. 获取项目列表
        console.log('📋 获取 Firebase 项目列表...');
        const projectsResult = execCommand('firebase projects:list --json', {
            silent: true
        });
        if (!projectsResult) {
            console.log('❌ 无法获取项目列表');
            process.exit(1);
        }

        let projects = [];
        try {
            const data = JSON.parse(projectsResult);
            projects = data.result || [];
        } catch (error) {
            console.log('❌ 解析项目列表失败');
            process.exit(1);
        }

        if (projects.length === 0) {
            console.log('❌ 未找到 Firebase 项目');
            console.log('请先在 Firebase Console 创建项目: https://console.firebase.google.com/');
            process.exit(1);
        }

        // 4. 显示项目列表
        console.log('\n📋 可用的 Firebase 项目:');
        projects.forEach((project, index) => {
            console.log(`${index + 1}. ${project.projectId} (${project.displayName})`);
        });

        // 5. 选择项目
        const choice = await question('\n请选择项目编号 (或输入项目ID): ');

        let selectedProject;
        if (/^\d+$/.test(choice)) {
            const index = parseInt(choice) - 1;
            if (index >= 0 && index < projects.length) {
                selectedProject = projects[index];
            }
        } else {
            selectedProject = projects.find(p => p.projectId === choice);
        }

        if (!selectedProject) {
            console.log('❌ 无效的选择');
            process.exit(1);
        }

        console.log(`✅ 选择项目: ${selectedProject.projectId}`);

        // 6. 设置活跃项目
        console.log('🔧 设置活跃项目...');
        const useResult = execCommand(`firebase use ${selectedProject.projectId}`);
        if (useResult === null) {
            console.log('❌ 设置活跃项目失败');
            process.exit(1);
        }
        console.log('✅ 活跃项目设置成功');

        // 7. 配置环境变量
        console.log('\n🔐 配置安全环境变量...');

        // 生成加密密钥
        const encryptionKey = require('crypto').randomBytes(32).toString('hex');
        console.log(`🔑 生成加密密钥: ${encryptionKey}`);

        // 设置加密密钥
        const setEncryptionKey = execCommand(`firebase functions:config:set app.encryption_key="${encryptionKey}"`);
        if (setEncryptionKey === null) {
            console.log('❌ 设置加密密钥失败');
            process.exit(1);
        }
        console.log('✅ 加密密钥设置成功');

        // 设置允许的来源
        const allowedOrigins = await question('请输入允许的来源（用逗号分隔，* 表示允许所有）: ');
        if (!allowedOrigins.trim()) {
            console.log('❌ 必须指定允许的来源');
            process.exit(1);
        }

        const setAllowedOrigins = execCommand(`firebase functions:config:set app.allowed_origins="${allowedOrigins}"`);
        if (setAllowedOrigins === null) {
            console.log('❌ 设置允许来源失败');
            process.exit(1);
        }
        console.log('✅ 允许来源设置成功');

        // 8. 部署云函数
        console.log('\n🚀 部署云函数...');
        const deployResult = execCommand('firebase deploy --only functions');
        if (deployResult === null) {
            console.log('❌ 部署失败');
            process.exit(1);
        }
        console.log('✅ 云函数部署成功');

        // 9. 显示配置摘要
        console.log('\n📋 配置摘要:');
        console.log('================================');
        console.log(`🔑 加密密钥: ${encryptionKey}`);
        console.log(`🌐 允许来源: ${allowedOrigins}`);
        console.log(`📦 项目: ${selectedProject.projectId}`);
        console.log('================================');

        // 10. 测试建议
        console.log('\n🧪 测试建议:');
        console.log('1. 检查云函数日志: firebase functions:log');
        console.log('2. 测试 CORS 配置: 使用不同来源访问');
        console.log('3. 测试加密功能: 使用加密客户端调用');

        console.log('\n🎉 Firebase 项目配置完成！');

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
