#!/bin/bash

# Firebase 云函数部署脚本
# 用于部署 Banana AI Generator Firebase 云函数

set -e

echo "🚀 开始部署 Banana AI Generator Firebase 云函数..."

# 检查是否安装了 Firebase CLI
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI 未安装，请先安装："
    echo "npm install -g firebase-tools"
    exit 1
fi

# 检查是否已登录 Firebase
if ! firebase projects:list &> /dev/null; then
    echo "❌ 请先登录 Firebase："
    echo "firebase login"
    exit 1
fi

# 进入函数目录
cd "$(dirname "$0")/functions"

# 检查环境变量文件
if [ ! -f ".env" ]; then
    echo "⚠️  未找到 .env 文件，请从 .env.example 复制并配置："
    echo "cp .env.example .env"
    echo "然后编辑 .env 文件设置你的项目配置"
    exit 1
fi

# 安装依赖
echo "📦 安装依赖..."
npm install

# 返回项目根目录
cd ..

# 检查 Firebase 项目配置
echo "🔍 检查 Firebase 项目配置..."
if ! firebase use --current &> /dev/null; then
    echo "❌ 请先设置 Firebase 项目："
    echo "firebase use your-project-id"
    exit 1
fi

CURRENT_PROJECT=$(firebase use --current)
echo "📋 当前 Firebase 项目: $CURRENT_PROJECT"

# 验证配置
echo "🔧 验证配置..."
if [ ! -f "firebase.json" ]; then
    echo "❌ 未找到 firebase.json 配置文件"
    exit 1
fi

# 部署云函数
echo "🚀 部署云函数..."
firebase deploy --only functions

# 获取部署后的函数 URL
echo "📋 获取函数信息..."
FUNCTION_URL="https://us-central1-$CURRENT_PROJECT.cloudfunctions.net/bananaAIGenerator"
echo "✅ 函数部署成功！"
echo "🔗 函数 URL: $FUNCTION_URL"

# 测试函数
echo "🧪 测试函数..."
cd functions
FUNCTION_URL=$FUNCTION_URL npm test

echo "🎉 部署完成！"
echo ""
echo "📝 接下来的步骤："
echo "1. 更新前端 .env 文件中的 FIREBASE_FUNCTION_URL"
echo "2. 重启前端开发服务器"
echo "3. 测试图片生成功能"
echo ""
echo "🔗 函数 URL: $FUNCTION_URL"
echo "📊 监控面板: https://console.firebase.google.com/project/$CURRENT_PROJECT/functions"