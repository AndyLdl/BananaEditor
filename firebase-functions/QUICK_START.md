# Firebase 云函数快速开始指南

这个指南将帮助你在 5 分钟内将 Banana AI Generator 部署到 Firebase 云函数。

## 🚀 快速部署（5分钟）

### 第一步：准备 Firebase 项目

1. **访问 [Firebase Console](https://console.firebase.google.com/)**
2. **创建新项目或选择现有项目**
3. **升级到 Blaze 计费计划**（云函数需要）

### 第二步：安装和配置

```bash
# 1. 安装 Firebase CLI
npm install -g firebase-tools

# 2. 登录 Firebase
firebase login

# 3. 设置项目
firebase use your-project-id

# 4. 配置环境变量
cd firebase-functions/functions
cp .env.example .env
# 编辑 .env 文件，设置你的项目 ID
```

### 第三步：一键部署

```bash
# 运行部署脚本
./firebase-functions/deploy.sh
```

就这么简单！🎉

## 📋 详细步骤

### 1. 创建 Firebase 项目

1. 访问 [Firebase Console](https://console.firebase.google.com/)
2. 点击"创建项目"
3. 输入项目名称（例如：`banana-ai-generator`）
4. 选择是否启用 Google Analytics（可选）
5. 等待项目创建完成

### 2. 升级计费计划

1. 在 Firebase Console 中，点击左下角的"升级"
2. 选择 "Blaze" 计费计划
3. 添加付款方式（不用担心，有免费额度）

### 3. 启用必要的 API

Firebase 会自动启用大部分 API，但你可能需要手动启用：

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 选择你的项目
3. 启用以下 API：
   - Cloud Functions API
   - Vertex AI API
   - Cloud Storage API

### 4. 配置环境变量

编辑 `firebase-functions/functions/.env` 文件：

```env
# 你的 Firebase 项目 ID
GOOGLE_CLOUD_PROJECT=your-firebase-project-id

# Vertex AI 区域
VERTEX_AI_LOCATION=us-central1

# Cloud Storage 存储桶（通常是项目ID.appspot.com）
STORAGE_BUCKET_NAME=your-firebase-project-id.appspot.com
```

### 5. 部署云函数

```bash
# 方法一：使用部署脚本（推荐）
./firebase-functions/deploy.sh

# 方法二：手动部署
cd firebase-functions/functions
npm install
cd ..
firebase deploy --only functions
```

### 6. 更新前端配置

在项目根目录的 `.env` 文件中添加：

```env
FIREBASE_FUNCTION_URL=https://us-central1-your-project-id.cloudfunctions.net/bananaAIGenerator
```

## 🧪 测试部署

### 本地测试

```bash
# 启动 Firebase 模拟器
firebase emulators:start --only functions

# 在另一个终端运行测试
cd firebase-functions/functions
npm test
```

### 生产测试

```bash
# 使用 curl 测试
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"prompt":"一只可爱的橙色小猫"}' \
  https://us-central1-your-project-id.cloudfunctions.net/bananaAIGenerator
```

## 📊 监控和管理

### Firebase Console

访问 [Firebase Console](https://console.firebase.google.com/) 查看：

- 函数调用统计
- 错误日志
- 性能指标
- 使用量和费用

### 命令行工具

```bash
# 查看函数日志
firebase functions:log

# 查看特定函数日志
firebase functions:log --only bananaAIGenerator

# 删除函数
firebase functions:delete bananaAIGenerator
```

## 💰 费用估算

Firebase Functions 的费用包括：

1. **调用次数**：前 200 万次调用免费
2. **计算时间**：前 40 万 GB-秒免费
3. **网络出站流量**：前 5GB 免费

**典型使用场景费用估算：**

- **轻度使用**（1000次/月）：免费
- **中度使用**（10000次/月）：$1-5/月
- **重度使用**（100000次/月）：$10-50/月

## 🔧 常见问题

### Q: 部署失败，提示权限错误

**A:** 确保你有项目的编辑权限，并且已经升级到 Blaze 计划。

### Q: 函数调用超时

**A:** 检查 Vertex AI API 是否已启用，网络连接是否正常。

### Q: 图片无法保存到 Storage

**A:** 检查 Storage 规则和存储桶权限配置。

### Q: 本地模拟器无法启动

**A:** 确保端口 5001 没有被占用，或者修改 `firebase.json` 中的端口配置。

## 🚀 性能优化

### 1. 冷启动优化

```javascript
// 在函数外部初始化客户端
const vertexAI = new VertexAI({...});
const storage = getStorage();

export const bananaAIGenerator = onRequest({
    // 配置选项
}, handler);
```

### 2. 内存配置

```javascript
export const bananaAIGenerator = onRequest({
    memory: '1GiB',  // 根据需求调整
    timeoutSeconds: 300
}, handler);
```

### 3. 并发控制

```javascript
export const bananaAIGenerator = onRequest({
    maxInstances: 10  // 防止过度并发
}, handler);
```

## 📚 下一步

1. **集成前端**：更新前端代码调用新的 Firebase 函数
2. **添加认证**：使用 Firebase Auth 保护 API
3. **监控告警**：设置 Cloud Monitoring 告警
4. **性能优化**：根据使用情况调整函数配置
5. **扩展功能**：添加更多 AI 功能

## 🤝 获取帮助

- [Firebase 文档](https://firebase.google.com/docs/functions)
- [Firebase 社区](https://firebase.google.com/support)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/firebase-functions)

---

🎉 恭喜！你已经成功将 Banana AI Generator 部署到 Firebase 云函数！