# Banana AI Generator Firebase 云函数

这个项目将原有的 Google Cloud Functions 迁移到 Firebase Functions，提供更好的集成和管理体验。

## 🚀 快速开始

### 前置要求

1. **Node.js 18+**
2. **Firebase CLI**
   ```bash
   npm install -g firebase-tools
   ```
3. **Firebase 项目**
   - 在 [Firebase Console](https://console.firebase.google.com/) 创建项目
   - 启用 Blaze 计费计划（云函数需要）

### 初始化和配置

1. **登录 Firebase**
   ```bash
   firebase login
   ```

2. **初始化项目**
   ```bash
   firebase init
   # 选择 Functions, Hosting, Storage
   ```

3. **设置项目**
   ```bash
   firebase use your-project-id
   ```

4. **配置环境变量**
   ```bash
   cd firebase-functions/functions
   cp .env.example .env
   # 编辑 .env 文件，设置你的项目配置
   ```

5. **安装依赖**
   ```bash
   npm install
   ```

## 🛠️ 开发和部署

### 本地开发

1. **启动模拟器**
   ```bash
   firebase emulators:start
   ```
   
   这将启动：
   - Functions 模拟器: http://localhost:5001
   - Hosting 模拟器: http://localhost:5000
   - Storage 模拟器: http://localhost:9199
   - Firebase UI: http://localhost:4000

2. **测试云函数**
   ```bash
   cd firebase-functions/functions
   npm test
   ```

### 部署到生产环境

1. **部署云函数**
   ```bash
   firebase deploy --only functions
   ```

2. **部署存储规则**
   ```bash
   firebase deploy --only storage
   ```

3. **完整部署**
   ```bash
   firebase deploy
   ```

## 📋 API 接口

### POST /bananaAIGenerator

生成 AI 图片的主要接口。

#### 请求格式

**JSON 请求（推荐）:**
```json
{
  "prompt": "一只可爱的橙色小猫坐在花园里",
  "style": "realistic",
  "quality": "high",
  "creativity": 70,
  "colorTone": "warm",
  "outputFormat": "jpeg"
}
```

**Multipart/Form-data 请求（支持图片上传）:**
```
POST /bananaAIGenerator
Content-Type: multipart/form-data

prompt: 基于这张图片生成新的创意图片
style: artistic
quality: high
creativity: 80
image: [图片文件]
```

#### 响应格式

**成功响应:**
```json
{
  "success": true,
  "data": {
    "imageUrl": "https://storage.googleapis.com/...",
    "thumbnailUrl": "https://storage.googleapis.com/...",
    "generatedPrompt": "使用nano banana AI技术生成的增强提示词...",
    "metadata": {
      "requestId": "banana_fb_1234567890_abcd",
      "processingTime": 2500,
      "model": "gemini-pro",
      "style": "realistic",
      "quality": "high",
      "dimensions": {
        "width": 1024,
        "height": 1024
      },
      "fileSize": 245760,
      "format": "jpeg"
    },
    "suggestions": [
      "尝试在realistic风格基础上添加更多细节描述",
      "可以指定具体的光线效果，如柔和的自然光或戏剧性的侧光",
      "考虑添加情感色彩，如温馨、神秘或活力四射"
    ]
  }
}
```

**错误响应:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST_PARAMS",
    "message": "请求参数验证失败: 提示词是必需的",
    "requestId": "banana_fb_1234567890_abcd",
    "processingTime": 150
  }
}
```

## 🔧 配置说明

### 环境变量

在 `firebase-functions/functions/.env` 文件中配置：

```env
# Firebase 项目 ID（自动设置）
GOOGLE_CLOUD_PROJECT=your-firebase-project-id

# Vertex AI 区域
VERTEX_AI_LOCATION=us-central1

# Cloud Storage 存储桶名称
STORAGE_BUCKET_NAME=your-firebase-project-id.appspot.com
```

### Firebase 配置

`firebase.json` 文件包含了完整的 Firebase 配置：

- **Functions**: 云函数配置
- **Hosting**: 静态网站托管
- **Storage**: 文件存储规则
- **Emulators**: 本地开发模拟器

### 存储规则

`storage.rules` 文件定义了 Cloud Storage 的安全规则：

- 允许公开读取生成的图片
- 只允许云函数写入生成的图片
- 支持用户上传临时图片（需要身份验证）

## 🔍 监控和调试

### 查看日志

```bash
# 实时日志
firebase functions:log

# 特定函数日志
firebase functions:log --only bananaAIGenerator

# 本地模拟器日志
# 在模拟器运行时，日志会直接显示在终端
```

### 性能监控

在 [Firebase Console](https://console.firebase.google.com/) 中：

1. 进入 Functions 页面
2. 查看函数调用统计
3. 监控错误率和延迟
4. 设置告警规则

### 调试技巧

1. **本地测试**
   ```bash
   # 启动模拟器
   firebase emulators:start --only functions
   
   # 运行测试
   cd firebase-functions/functions
   npm test
   ```

2. **使用 Firebase Console**
   - 查看函数执行日志
   - 监控资源使用情况
   - 分析错误报告

3. **自定义日志**
   ```javascript
   console.log('调试信息:', data);
   console.error('错误信息:', error);
   ```

## 🔒 安全最佳实践

### 1. 输入验证
- 严格验证所有用户输入
- 限制提示词长度和内容
- 验证文件类型和大小

### 2. 访问控制
- 考虑添加 API 密钥验证
- 实现速率限制
- 使用 Firebase Auth 进行用户身份验证

### 3. 数据保护
- 不记录敏感用户数据
- 定期清理临时文件
- 使用 HTTPS 加密传输

### 4. 资源限制
```javascript
export const bananaAIGenerator = onRequest({
    timeoutSeconds: 300,    // 5分钟超时
    memory: '1GiB',         // 1GB 内存
    maxInstances: 10,       // 最大并发实例
    cors: true
}, handler);
```

## 💰 成本优化

### 1. 函数配置优化
- 根据实际需求调整内存分配
- 设置合理的超时时间
- 限制最大并发实例数

### 2. 存储优化
- 设置文件生命周期策略
- 使用适当的图片压缩
- 定期清理旧文件

### 3. 监控使用情况
- 定期检查 Firebase 使用报告
- 设置预算告警
- 优化高频调用的代码路径

## 🚀 从 Google Cloud Functions 迁移

如果你正在从 Google Cloud Functions 迁移，主要变化包括：

### 1. 导入方式
```javascript
// 旧版 (Google Cloud Functions)
const functions = require('@google-cloud/functions-framework');

// 新版 (Firebase Functions)
import { onRequest } from 'firebase-functions/v2/https';
```

### 2. 函数定义
```javascript
// 旧版
functions.http('functionName', handler);

// 新版
export const functionName = onRequest(options, handler);
```

### 3. 配置方式
```javascript
// 新版支持更丰富的配置选项
export const bananaAIGenerator = onRequest({
    timeoutSeconds: 300,
    memory: '1GiB',
    maxInstances: 10,
    cors: true
}, handler);
```

### 4. 部署命令
```bash
# 旧版
gcloud functions deploy functionName

# 新版
firebase deploy --only functions
```

## 📚 相关文档

- [Firebase Functions 文档](https://firebase.google.com/docs/functions)
- [Vertex AI 文档](https://cloud.google.com/vertex-ai/docs)
- [Cloud Storage 文档](https://cloud.google.com/storage/docs)
- [Firebase CLI 参考](https://firebase.google.com/docs/cli)

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](../LICENSE) 文件了解详情。