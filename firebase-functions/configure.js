#!/usr/bin/env node

/**
 * Firebase 云函数配置脚本
 * 帮助用户快速配置 Firebase 项目和环境变量
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

// 执行命令并返回结果
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

// 检查命令是否存在
const commandExists = (command) => {
    try {
        execSync(`which ${command}`, { stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
};

// 检查 Firebase CLI
const checkFirebaseCLI = () => {
    console.log('🔍 检查 Firebase CLI...');

    if (!commandExists('firebase')) {
        console.log('❌ Firebase CLI 未安装');
        console.log('📦 正在安装 Firebase CLI...');

        const result = execCommand('npm install -g firebase-tools');
        if (result === null) {
            console.log('❌ Firebase CLI 安装失败');
            console.log('请手动安装: npm install -g firebase-tools');
            return false;
        }
    }

    console.log('✅ Firebase CLI 已安装');
    return true;
};

// 检查 Firebase 登录状态
const checkFirebaseLogin = async () => {
    console.log('🔍 检查 Firebase 登录状态...');

    const result = execCommand('firebase projects:list', { silent: true });
    if (result === null) {
        console.log('❌ 未登录 Firebase');
        console.log('🔐 请登录 Firebase...');

        const loginResult = execCommand('firebase login');
        if (loginResult === null) {
            console.log('❌ Firebase 登录失败');
            return false;
        }
    }

    console.log('✅ Firebase 已登录');
    return true;
};

// 获取 Firebase 项目列表
const getFirebaseProjects = () => {
    console.log('📋 获取 Firebase 项目列表...');

    const result = execCommand('firebase projects:list --json', { silent: true });
    if (result === null) {
        return [];
    }

    try {
        const data = JSON.parse(result);
        return data.result || [];
    } catch {
        return [];
    }
};

// 选择或创建 Firebase 项目
const selectFirebaseProject = async () => {
    const projects = getFirebaseProjects();

    if (projects.length === 0) {
        console.log('❌ 未找到 Firebase 项目');
        console.log('请先在 Firebase Console 创建项目: https://console.firebase.google.com/');
        return null;
    }

    console.log('\n📋 可用的 Firebase 项目:');
    projects.forEach((project, index) => {
        console.log(`${index + 1}. ${project.projectId} (${project.displayName})`);
    });

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
        return null;
    }

    console.log(`✅ 选择项目: ${selectedProject.projectId}`);
    return selectedProject;
};

// 设置 Firebase 项目
const setFirebaseProject = (projectId) => {
    console.log(`🔧 设置 Firebase 项目: ${projectId}`);

    const result = execCommand(`firebase use ${projectId}`);
    if (result === null) {
        console.log('❌ 设置 Firebase 项目失败');
        return false;
    }

    console.log('✅ Firebase 项目设置成功');
    return true;
};

// 创建环境变量文件
const createEnvFile = async (projectId) => {
    const envPath = join(__dirname, 'functions', '.env');
    const envExamplePath = join(__dirname, 'functions', '.env.example');

    if (existsSync(envPath)) {
        const overwrite = await question('⚠️  .env 文件已存在，是否覆盖? (y/N): ');
        if (overwrite.toLowerCase() !== 'y') {
            console.log('⏭️  跳过创建 .env 文件');
            return true;
        }
    }

    console.log('📝 创建环境变量文件...');

    // 读取示例文件
    if (!existsSync(envExamplePath)) {
        console.log('❌ 未找到 .env.example 文件');
        return false;
    }

    let envContent = readFileSync(envExamplePath, 'utf8');

    // 替换项目ID
    envContent = envContent.replace(/your-firebase-project-id/g, projectId);

    // 询问其他配置
    const region = await question('🌍 Vertex AI 区域 (默认: us-central1): ') || 'us-central1';
    envContent = envContent.replace(/us-central1/g, region);

    const bucketName = await question(`🪣 Storage 存储桶名称 (默认: ${projectId}.appspot.com): `) || `${projectId}.appspot.com`;
    envContent = envContent.replace(/your-firebase-project-id\.appspot\.com/g, bucketName);

    // 写入文件
    writeFileSync(envPath, envContent);
    console.log('✅ 环境变量文件创建成功');

    return true;
};

// 安装依赖
const installDependencies = () => {
    console.log('📦 安装云函数依赖...');

    const functionsDir = join(__dirname, 'functions');
    const result = execCommand('npm install', { cwd: functionsDir });

    if (result === null) {
        console.log('❌ 依赖安装失败');
        return false;
    }

    console.log('✅ 依赖安装成功');
    return true;
};

// 验证配置
const validateConfiguration = () => {
    console.log('🔍 验证配置...');

    const requiredFiles = [
        'firebase.json',
        'functions/package.json',
        'functions/.env',
        'functions/index.js'
    ];

    for (const file of requiredFiles) {
        const filePath = join(__dirname, file);
        if (!existsSync(filePath)) {
            console.log(`❌ 缺少文件: ${file}`);
            return false;
        }
    }

    console.log('✅ 配置验证通过');
    return true;
};

// 更新前端配置
const updateFrontendConfig = async (projectId, region = 'us-central1') => {
    const frontendEnvPath = join(__dirname, '..', '.env');
    const functionUrl = `https://${region}-${projectId}.cloudfunctions.net/bananaAIGenerator`;

    console.log('🔧 更新前端配置...');

    let envContent = '';
    if (existsSync(frontendEnvPath)) {
        envContent = readFileSync(frontendEnvPath, 'utf8');
    }

    // 更新或添加 Firebase 函数 URL
    const firebaseUrlPattern = /^FIREBASE_FUNCTION_URL=.*$/m;
    const cloudUrlPattern = /^CLOUD_FUNCTION_URL=.*$/m;

    if (firebaseUrlPattern.test(envContent)) {
        envContent = envContent.replace(firebaseUrlPattern, `FIREBASE_FUNCTION_URL=${functionUrl}`);
    } else {
        envContent += `\nFIREBASE_FUNCTION_URL=${functionUrl}`;
    }

    if (cloudUrlPattern.test(envContent)) {
        envContent = envContent.replace(cloudUrlPattern, `CLOUD_FUNCTION_URL=${functionUrl}`);
    } else {
        envContent += `\nCLOUD_FUNCTION_URL=${functionUrl}`;
    }

    writeFileSync(frontendEnvPath, envContent);
    console.log('✅ 前端配置更新成功');
    console.log(`🔗 函数 URL: ${functionUrl}`);
};

// 主配置流程
const main = async () => {
    console.log('🚀 Firebase 云函数配置向导');
    console.log('================================\n');

    try {
        // 1. 检查 Firebase CLI
        if (!checkFirebaseCLI()) {
            process.exit(1);
        }

        // 2. 检查登录状态
        if (!await checkFirebaseLogin()) {
            process.exit(1);
        }

        // 3. 选择项目
        const project = await selectFirebaseProject();
        if (!project) {
            process.exit(1);
        }

        // 4. 设置项目
        if (!setFirebaseProject(project.projectId)) {
            process.exit(1);
        }

        // 5. 创建环境变量文件
        if (!await createEnvFile(project.projectId)) {
            process.exit(1);
        }

        // 6. 安装依赖
        if (!installDependencies()) {
            process.exit(1);
        }

        // 7. 验证配置
        if (!validateConfiguration()) {
            process.exit(1);
        }

        // 8. 更新前端配置
        await updateFrontendConfig(project.projectId);

        console.log('\n🎉 配置完成！');
        console.log('\n📋 接下来的步骤:');
        console.log('1. 运行部署脚本: ./firebase-functions/deploy.sh');
        console.log('2. 或手动部署: firebase deploy --only functions');
        console.log('3. 测试云函数: cd firebase-functions/functions && npm test');
        console.log('\n📊 监控面板:', `https://console.firebase.google.com/project/${project.projectId}/functions`);

    } catch (error) {
        console.error('❌ 配置过程中出现错误:', error.message);
        process.exit(1);
    } finally {
        rl.close();
    }
};

// 运行配置
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}