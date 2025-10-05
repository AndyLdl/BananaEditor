# 从 Google Cloud Functions 迁移到 Firebase Functions 指南

本指南将帮助你将现有的 Google Cloud Functions 迁移到 Firebase Functions。

## 🎯 迁移概述

### 主要变化

1. **运行时环境**: 从 Google Cloud Functions 迁移到 Firebase Functions v2
2. **部署方式**: 使用 Firebase CLI 而不是 gcloud CLI
3. **配置管理**: 使用 Firebase 项目配置
4. **监控集成**: 更好的 Firebase Console 集成

### 优势

- **更好的集成**: 与 Firebase 生态系统无缝集成
- **简化部署**: 统一的 Firebase CLI 工具
- **增强监控**: Firebase Console 提供更直观的监控界面
- **版本管理**: 更好的函数版本控制
- **本地开发**: 完整的本地模拟器支持

## 📋 迁移步骤

### 第一步：准备 Firebase 项目

1. **创建 Firebase 项目**
   ```bash
   # 如果还没有 Firebase 项目
   # 访问 https://console.firebase.google.com/ 创建项目
   ```

2. **安装 Firebase CLI**
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

3. **初始化 Firebase 项目**
   ```bash
   firebase init functions
   # 选择现有项目或创建新项目
   # 选择 JavaScript/TypeScript
   # 选择 ESLint（可选）
   # 安装依赖
   ```

### 第二步：迁移代码

#### 原始 Google Cloud Functions 代码结构
```
cloud-functions/
├── banana-ai-generator/
│   ├── index.js
│   ├── package.json
│   └── deploy.sh
```

#### 新的 Firebase Functions 代码结构
```
firebase-functions/
├── functions/
│   ├── index.js
│   ├── package.json
│   ├── .env.example
│   └── test-function.js
├── firebase.json
└── README.md
```

#### 代码迁移对比

**原始代码 (Google Cloud Functions):**
```javascript
const functions = require('@google-cloud/functions-framework');

functions.http('bananaAIGenerator', async (req, res) => {
    // 处理逻辑
});
```

**迁移后代码 (Firebase Functions):**
```javascript
import { onRequest } from 'firebase-functions/v2/https';

export const bananaAIGenerator = onRequest({
    timeoutSeconds: 300,
    memory: '1GiB',
    maxInstances: 10,
    cors: true
}, async (req, res) => {
    // 相同的处理逻辑
});
```

### 第三步：更新依赖

**原始 package.json:**
```json
{
  "dependencies": {
    "@google-cloud/functions-framework": "^3.0.0",
    "@google-cloud/vertexai": "^1.7.0",
    "@google-cloud/storage": "^7.7.0"
  }
}
```

**新的 package.json:**
```json
{
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^5.0.0",
    "@google-cloud/vertexai": "^1.7.0",
    "@google-cloud/storage": "^7.7.0"
  }
}
```

### 第四步：配置环境变量

**原始配置方式:**
```bash
export GOOGLE_CLOUD_PROJECT_ID="your-project-id"
export VERTEX_AI_LOCATION="us-central1"
export STORAGE_BUCKET_NAME="your-bucket-name"
```

**新的配置方式:**
```bash
# firebase-functions/functions/.env
GOOGLE_CLOUD_PROJECT=your-firebase-project-id
VERTEX_AI_LOCATION=us-central1
STORAGE_BUCKET_NAME=your-firebase-project-id.appspot.com
```

### 第五步：更新部署脚本

**原始部署方式:**
```bash
gcloud functions deploy banana-ai-generator \
  --runtime nodejs18 \
  --trigger-http \
  --allow-unauthenticated \
  --memory 1GB \
  --timeout 300s
```

**新的部署方式:**
```bash
firebase deploy --only functions
```

## 🔧 配置迁移

### Firebase 配置文件

创建 `firebase.json`:
```json
{
  "functions": [
    {
      "source": "firebase-functions/functions",
      "codebase": "default",
      "ignore": [
        "node_modules",
        ".git",
        "firebase-debug.log",
        "firebase-debug.*.log"
      ]
    }
  ],
  "storage": {
    "rules": "storage.rules"
  }
}
```

### 存储规则

创建 `storage.rules`:
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /banana-generated/{imageId} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

## 🧪 测试迁移

### 本地测试

1. **启动模拟器**
   ```bash
   firebase emulators:start --only functions
   ```

2. **运行测试**
   ```bash
   cd firebase-functions/functions
   npm test
   ```

### 生产测试

1. **部署到测试环境**
   ```bash
   firebase use test-project-id
   firebase deploy --only functions
   ```

2. **验证功能**
   ```bash
   curl -X POST \
     -H "Content-Type: application/json" \
     -d '{"prompt":"测试提示词"}' \
     https://your-region-your-project.cloudfunctions.net/bananaAIGenerator
   ```

## 📊 性能对比

### 冷启动时间
- **Google Cloud Functions**: ~2-3 秒
- **Firebase Functions v2**: ~1-2 秒

### 内存使用
- **优化前**: 512MB 默认
- **优化后**: 1GB 配置，更好的性能

### 并发处理
- **原始**: 默认并发限制
- **新版**: 可配置 maxInstances

## 🔍 监控和日志

### 原始监控方式
```bash
gcloud functions logs read banana-ai-generator
```

### 新的监控方式
```bash
firebase functions:log
```

**Firebase Console 优势:**
- 图形化界面
- 实时监控
- 错误追踪
- 性能分析

## 🚨 常见问题和解决方案

### 1. 导入错误
**问题**: `require is not defined`
**解决**: 使用 ES6 模块语法
```javascript
// 错误
const { onRequest } = require('firebase-functions/v2/https');

// 正确
import { onRequest } from 'firebase-functions/v2/https';
```

### 2. 环境变量问题
**问题**: 环境变量未加载
**解决**: 确保 `.env` 文件在正确位置
```bash
firebase-functions/functions/.env  # 正确位置
```

### 3. CORS 问题
**问题**: 跨域请求被阻止
**解决**: 在函数配置中启用 CORS
```javascript
export const bananaAIGenerator = onRequest({
    cors: true  // 启用 CORS
}, handler);
```

### 4. 超时问题
**问题**: 函数执行超时
**解决**: 增加超时时间
```javascript
export const bananaAIGenerator = onRequest({
    timeoutSeconds: 300  // 5分钟
}, handler);
```

## 📈 性能优化建议

### 1. 内存配置
```javascript
export const bananaAIGenerator = onRequest({
    memory: '1GiB'  // 根据需求调整
}, handler);
```

### 2. 并发控制
```javascript
export const bananaAIGenerator = onRequest({
    maxInstances: 10  // 防止过度并发
}, handler);
```

### 3. 冷启动优化
- 使用 Firebase Functions v2
- 减少依赖包大小
- 优化初始化代码

## 🔄 回滚计划

如果迁移出现问题，可以快速回滚：

1. **保留原始代码**
   ```bash
   # 不要删除原始的 cloud-functions 目录
   mv cloud-functions cloud-functions-backup
   ```

2. **快速回滚**
   ```bash
   # 重新部署原始函数
   cd cloud-functions-backup/banana-ai-generator
   ./deploy.sh
   ```

3. **更新前端配置**
   ```javascript
   // 切换回原始 URL
   const FUNCTION_URL = 'https://your-region-your-project.cloudfunctions.net/banana-ai-generator';
   ```

## ✅ 迁移检查清单

- [ ] Firebase 项目创建完成
- [ ] Firebase CLI 安装和登录
- [ ] 代码迁移完成
- [ ] 依赖更新完成
- [ ] 环境变量配置完成
- [ ] 本地测试通过
- [ ] 生产部署成功
- [ ] 功能验证通过
- [ ] 监控配置完成
- [ ] 文档更新完成

## 📚 参考资源

- [Firebase Functions 迁移指南](https://firebase.google.com/docs/functions/migrate)
- [Firebase Functions v2 文档](https://firebase.google.com/docs/functions/2nd-gen)
- [Google Cloud Functions 对比](https://cloud.google.com/functions/docs/concepts/version-comparison)

## 🤝 获取帮助

如果在迁移过程中遇到问题：

1. 查看 [Firebase 社区论坛](https://firebase.google.com/support)
2. 参考 [Stack Overflow](https://stackoverflow.com/questions/tagged/firebase-functions)
3. 查看项目 Issues 或创建新的 Issue