# 🔐 前端安全配置指南

## 📋 概述

前端代码已经更新为使用加密客户端，现在需要配置加密密钥以确保与云函数的安全通信。

## 🚀 快速配置

### 步骤1：设置云函数环境变量

```bash
# 生成64位十六进制加密密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 设置加密密钥（替换为上面生成的密钥）
firebase functions:config:set app.encryption_key="your-64-character-hex-key-here"

# 设置允许的来源
firebase functions:config:set app.allowed_origins="https://yourdomain.com,http://localhost:4321"

# 部署配置
firebase deploy --only functions
```

### 步骤2：配置前端环境变量

#### 创建环境变量文件

```bash
# 复制环境变量模板
cp env.example .env
```

#### 编辑 .env 文件

```bash
# 🔐 加密密钥配置（使用步骤1生成的密钥）
PUBLIC_ENCRYPTION_KEY=your-64-character-hex-key-here

# 🌐 云函数配置
PUBLIC_FIREBASE_FUNCTION_URL=https://your-function-url
PUBLIC_CLOUD_FUNCTION_URL=https://your-function-url
```

**⚠️ 安全警告**: 不要将密钥直接写在代码中！使用环境变量确保密钥安全。

### 步骤3：验证配置

1. **测试云函数连接**：
   - 访问 `/test-cloud-function` 页面
   - 点击"测试连接"按钮
   - 应该显示"加密云函数连接测试成功"

2. **测试AI生成功能**：
   - 在编辑器中输入提示词
   - 点击生成按钮
   - 应该能正常生成图片

## 🔧 详细配置

### 环境变量配置

| 变量名                | 说明                       | 示例值                   |
| --------------------- | -------------------------- | ------------------------ |
| `app.encryption_key`  | 加密密钥（64字符十六进制） | `a1b2c3d4e5f6...`        |
| `app.allowed_origins` | 允许的来源（逗号分隔）     | `https://yourdomain.com` |

### 前端代码更新

#### 1. BananaAIProcessor.astro

- ✅ 已更新为使用 `SecureBananaAIProcessor`
- ✅ 支持加密请求和响应
- ✅ 保持原有功能不变

#### 2. secure-api-client.ts

- ✅ 提供AES-256-CBC加密
- ✅ 时间戳验证（5分钟有效期）
- ✅ 签名验证确保数据完整性

#### 3. test-cloud-function.astro

- ✅ 已更新为使用加密客户端测试
- ✅ 支持加密连接测试

## 🧪 测试验证

### 1. 直接调用测试（应该失败）

```bash
curl -X POST https://your-function-url \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test"}'
```

预期结果：`403 Forbidden` 或 `缺少加密请求头`

### 2. 加密调用测试（应该成功）

```javascript
import { SecureBananaAIProcessor } from "./utils/secure-api-client.ts";
const processor = new SecureBananaAIProcessor("https://your-function-url");
const result = await processor.callCloudFunction("测试提示词", []);
```

### 3. 前端测试

1. 打开浏览器开发者工具
2. 访问编辑器页面
3. 输入提示词并生成
4. 查看网络请求，应该看到加密的请求头

## 🔍 故障排除

### 常见问题

1. **"缺少加密请求头"**
   - 检查前端是否使用了 `SecureBananaAIProcessor`
   - 确认加密密钥配置正确

2. **"请求签名验证失败"**
   - 检查前后端加密密钥是否一致
   - 确认时间戳在有效期内（5分钟）

3. **"请求时间戳无效"**
   - 检查系统时间是否同步
   - 确认请求在5分钟内发送

### 调试模式

在浏览器控制台中查看详细日志：

```javascript
// 启用详细日志
localStorage.setItem("debug", "true");

// 查看加密过程
console.log("🔐 加密请求头:", {
  "X-Encrypted-Data": "...",
  "X-IV": "...",
  "X-Signature": "...",
  "X-Timestamp": "...",
});
```

## 📊 安全效果

| 方面           | 修改前      | 修改后             |
| -------------- | ----------- | ------------------ |
| **请求加密**   | ❌ 明文传输 | ✅ AES-256-CBC加密 |
| **防重放攻击** | ❌ 无保护   | ✅ 时间戳验证      |
| **数据完整性** | ❌ 无验证   | ✅ 签名验证        |
| **防直接调用** | ❌ 完全开放 | ✅ 需要加密头      |

## 🔄 升级路径

如果将来需要更高级的安全功能：

1. **添加API密钥验证**
2. **实现JWT认证**
3. **添加限流机制**
4. **集成IP白名单**

## 📞 支持

如果遇到问题，请检查：

1. ✅ 云函数是否已部署
2. ✅ 环境变量是否正确设置
3. ✅ 前端加密密钥是否匹配
4. ✅ 网络连接是否正常

现在你的前端已经安全了！🚀
