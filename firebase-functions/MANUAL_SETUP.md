# Firebase 云函数手动配置指南

如果自动配置脚本遇到问题，你可以按照以下步骤手动配置 Firebase 云函数。

## 🚀 快速手动配置（5分钟）

### 第一步：设置 Firebase 项目

```bash
# 1. 确保已登录 Firebase
firebase login

# 2. 设置你的项目（替换为你的项目ID）
firebase use bananaeditor-927be
```

### 第二步：配置环境变量

```bash
# 1. 进入函数目录
cd firebase-functions/functions

# 2. 复制环境变量模板
cp .env.example .env

# 3. 编辑 .env 文件
nano .env  # 或使用你喜欢的编辑器
```

在 `.env` 文件中设置以下内容：

```env
# Firebase 项目配置
GOOGLE_CLOUD_PROJECT=bananaeditor-927be

# Vertex AI 配置
VERTEX_AI_LOCATION=us-central1

# Cloud Storage 配置
STORAGE_BUCKET_NAME=bananaeditor-927be.appspot.com
```

### 第三步：安装依赖

```bash
# 在 firebase-functions/functions 目录中
npm install
```

### 第四步：部署云函数

```bash
# 返回项目根目录
cd ../..

# 部署云函数
firebase deploy --only functions
```

### 第五步：更新前端配置

在项目根目录的 `.env` 文件中添加或更新：

```env
FIREBASE_FUNCTION_URL=https://us-central1-bananaeditor-927be.cloudfunctions.net/bananaAIGenerator
CLOUD_FUNCTION_URL=https://us-central1-bananaeditor-927be.cloudfunctions.net/bananaAIGenerator
```

### 第六步：测试部署

```bash
# 测试云函数
npm run test:firebase

# 或手动测试
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"prompt":"一只可爱的橙色小猫"}' \
  https://us-central1-bananaeditor-927be.cloudfunctions.net/bananaAIGenerator
```

## 🔧 故障排除

### 常见问题

1. **权限错误**
   ```bash
   # 确保项目已升级到 Blaze 计划
   # 在 Firebase Console 中检查计费设置
   ```

2. **API 未启用**
   ```bash
   # 在 Google Cloud Console 中启用以下 API：
   # - Cloud Functions API
   # - Vertex AI API
   # - Cloud Storage API
   ```

3. **部署失败**
   ```bash
   # 检查 firebase.json 配置
   # 确保在正确的目录中运行命令
   ```

### 验证部署

部署成功后，你应该能看到：

1. **Firebase Console**: https://console.firebase.google.com/project/bananaeditor-927be/functions
2. **函数 URL**: https://us-central1-bananaeditor-927be.cloudfunctions.net/bananaAIGenerator
3. **日志**: `firebase functions:log`

## 📊 监控

### 查看日志
```bash
# 实时日志
firebase functions:log --follow

# 特定函数日志
firebase functions:log --only bananaAIGenerator
```

### Firebase Console
访问 [Firebase Console](https://console.firebase.google.com/project/bananaeditor-927be/functions) 查看：
- 函数调用统计
- 错误率和延迟
- 资源使用情况

## 🎉 完成！

配置完成后，你的 Firebase 云函数就可以正常工作了。前端会自动使用新的 Firebase 函数 URL 来处理 AI 图片生成请求。

如果遇到任何问题，请查看：
- [Firebase 文档](https://firebase.google.com/docs/functions)
- [项目 README](../README.md#-firebase-云函数集成)
- [快速开始指南](./QUICK_START.md)