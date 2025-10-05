#!/usr/bin/env node

/**
 * 简化的 Firebase 云函数配置脚本
 * 避免复杂的命令执行，提供更可靠的配置体验
 */

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

// 颜色输出
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

const log = {
    info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
    success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
    error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
    warning: (msg) => console.log(`${colors.yellow}⚠️${colors.reset} ${msg}`)
};

// 创建环境变量文件
const createEnvFile = async () => {
    const envPath = join(__dirname, 'functions', '.env');
    const envExamplePath = join(__dirname, 'functions', '.env.example');

    if (existsSync(envPath)) {
        const overwrite = await question('⚠️  .env 文件已存在，是否覆盖? (y/N): ');
        if (overwrite.toLowerCase() !== 'y') {
            log.info('⏭️  跳过创建 .env 文件');
            return true;
        }
    }

    log.info('📝 创建环境变量文件...');

    // 读取示例文件
    if (!existsSync(envExamplePath)) {
        log.error('未找到 .env.example 文件');
        return false;
    }

    let envContent = readFileSync(envExamplePath, 'utf8');

    // 询问项目配置
    console.log('\n请输入你的 Firebase 项目配置:');

    const projectId = await question('🔥 Firebase 项目 ID: ');
    if (!projectId.trim()) {
        log.error('项目 ID 不能为空');
        return false;
    }

    const region = await question('🌍 Vertex AI 区域 (默认: us-central1): ') || 'us-central1';
    const bucketName = await question(`🪣 Storage 存储桶名称 (默认: ${projectId}.appspot.com): `) || `${projectId}.appspot.com`;

    // 替换配置
    envContent = envContent.replace(/your-firebase-project-id/g, projectId);
    envContent = envContent.replace(/us-central1/g, region);
    envContent = envContent.replace(/your-firebase-project-id\.appspot\.com/g, bucketName);

    // 写入文件
    writeFileSync(envPath, envContent);
    log.success('环境变量文件创建成功');

    return { projectId, region, bucketName };
};

// 更新前端配置
const updateFrontendConfig = async (projectId, region = 'us-central1') => {
    const frontendEnvPath = join(__dirname, '..', '.env');
    const functionUrl = `https://${region}-${projectId}.cloudfunctions.net/bananaAIGenerator`;

    log.info('🔧 更新前端配置...');

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
    log.success('前端配置更新成功');
    log.info(`🔗 函数 URL: ${functionUrl}`);

    return functionUrl;
};

// 验证配置
const validateConfiguration = () => {
    log.info('🔍 验证配置...');

    const requiredFiles = [
        { path: join(__dirname, '..', 'firebase.json'), name: 'firebase.json' },
        { path: join(__dirname, 'functions', 'package.json'), name: 'functions/package.json' },
        { path: join(__dirname, 'functions', '.env'), name: 'functions/.env' },
        { path: join(__dirname, 'functions', 'index.js'), name: 'functions/index.js' }
    ];

    for (const file of requiredFiles) {
        if (!existsSync(file.path)) {
            log.error(`缺少文件: ${file.name}`);
            return false;
        }
    }

    log.success('配置验证通过');
    return true;
};

// 主配置流程
const main = async () => {
    console.log(`${colors.cyan}🚀 Firebase 云函数简化配置向导${colors.reset}`);
    console.log('================================\n');

    try {
        log.info('这个脚本将帮助你配置 Firebase 云函数环境变量');
        log.warning('请确保你已经:');
        console.log('  1. 安装了 Firebase CLI: npm install -g firebase-tools');
        console.log('  2. 登录了 Firebase: firebase login');
        console.log('  3. 在 Firebase Console 创建了项目');
        console.log('');

        const proceed = await question('是否继续配置? (Y/n): ');
        if (proceed.toLowerCase() === 'n') {
            log.info('配置已取消');
            process.exit(0);
        }

        // 1. 创建环境变量文件
        const config = await createEnvFile();
        if (!config) {
            process.exit(1);
        }

        // 2. 更新前端配置
        const functionUrl = await updateFrontendConfig(config.projectId, config.region);

        // 3. 验证配置
        if (!validateConfiguration()) {
            process.exit(1);
        }

        console.log('\n🎉 配置完成！');
        console.log('\n📋 接下来的步骤:');
        console.log('1. 设置 Firebase 项目:');
        console.log(`   firebase use ${config.projectId}`);
        console.log('2. 安装云函数依赖:');
        console.log('   cd firebase-functions/functions && npm install');
        console.log('3. 部署云函数:');
        console.log('   firebase deploy --only functions');
        console.log('4. 测试云函数:');
        console.log('   npm run test:firebase');
        console.log('');
        console.log(`📊 监控面板: https://console.firebase.google.com/project/${config.projectId}/functions`);
        console.log(`🔗 函数 URL: ${functionUrl}`);

    } catch (error) {
        log.error(`配置过程中出现错误: ${error.message}`);
        process.exit(1);
    } finally {
        rl.close();
    }
};

// 运行配置
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}