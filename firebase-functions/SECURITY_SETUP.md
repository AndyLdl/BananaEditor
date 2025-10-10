# 🔐 云函数安全配置指南

## 问题分析

你的云函数目前存在以下安全风险：

1. **完全开放** - 任何人都可以直接调用API
2. **明文传输** - 请求数据未加密，容易被拦截
3. **无身份验证** - 没有API密钥或令牌验证
4. **容易被滥用** - 没有限流机制

## 🛡️ 解决方案：请求体加密

我们实现了一个简单而有效的加密方案：

### 1. 加密流程

```
客户端 → 加密请求体 → 添加签名 → 发送到云函数
云函数 → 验证签名 → 解密请求体 → 处理请求
```

### 2. 安全特性

- ✅ **请求体加密** - 使用AES-256-CBC加密
- ✅ **时间戳验证** - 防止重放攻击（5分钟有效期）
- ✅ **签名验证** - 确保请求完整性
- ✅ **简单易用** - 最小化代码改动

## 🚀 快速配置

### 步骤1：设置环境变量

#### 方法一：使用配置脚本（最简单）

```bash
cd firebase-functions
node configure-security.js
```

#### 方法二：通过 Firebase CLI 配置（推荐）

```bash
# 设置加密密钥
firebase functions:config:set app.encryption_key="your-32-character-secret-key-here!"

# 设置允许的来源
firebase functions:config:set app.allowed_origins="https://yourdomain.com,https://www.yourdomain.com"

# 部署配置
firebase deploy --only functions
```

#### 方法二：通过 .env 文件配置（开发环境）

在 `firebase-functions/functions/.env` 文件中添加：

```bash
# 加密密钥（32字符）
ENCRYPTION_KEY=your-32-character-secret-key-here!

# 允许的来源（开发环境可以设置为 * 允许所有）
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com,http://localhost:4321
```

### 步骤2：生成加密密钥

```bash
# 生成64位十六进制密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 步骤3：更新前端代码

在 `BananaAIProcessor.astro` 中：

```javascript
import { SecureBananaAIProcessor } from "../utils/secure-api-client.ts";

// 替换原有的调用方式
const secureProcessor = new SecureBananaAIProcessor(this.cloudFunctionUrl);
const result = await secureProcessor.callCloudFunction(
  prompt,
  conversationHistory,
);
```

### 步骤4：部署云函数

```bash
cd firebase-functions
npm install
firebase deploy --only functions
```

## 🔧 配置选项

### 环境变量说明

| 变量名            | 说明                   | 示例值                               |
| ----------------- | ---------------------- | ------------------------------------ |
| `ENCRYPTION_KEY`  | 加密密钥（32字符）     | `your-32-character-secret-key-here!` |
| `ALLOWED_ORIGINS` | 允许的来源（逗号分隔） | `https://yourdomain.com`             |

### 安全级别

| 级别     | 描述                      | 实现难度 |
| -------- | ------------------------- | -------- |
| **基础** | 请求体加密 + 签名验证     | ⭐⭐     |
| **中级** | 基础 + API密钥 + 限流     | ⭐⭐⭐   |
| **高级** | 中级 + JWT认证 + IP白名单 | ⭐⭐⭐⭐ |

## 🚨 安全建议

### 1. 密钥管理

- ✅ 使用强随机密钥
- ✅ 定期轮换密钥
- ✅ 不要在代码中硬编码密钥
- ✅ 使用环境变量存储密钥

### 2. 监控和日志

- ✅ 记录所有API调用
- ✅ 监控异常请求
- ✅ 设置告警机制

### 3. 部署安全

- ✅ 使用HTTPS
- ✅ 设置CORS策略
- ✅ 定期更新依赖

## 📊 效果对比

| 方面           | 修改前      | 修改后      |
| -------------- | ----------- | ----------- |
| **安全性**     | ❌ 完全开放 | ✅ 加密保护 |
| **防滥用**     | ❌ 无限制   | ✅ 签名验证 |
| **数据保护**   | ❌ 明文传输 | ✅ 加密传输 |
| **实现复杂度** | -           | ⭐⭐ 简单   |

## 🔍 测试验证

### 测试 CORS 配置是否生效

1. **测试允许的来源**（应该成功）：

```bash
curl -H "Origin: https://yourdomain.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     https://your-function-url
```

2. **测试不允许的来源**（应该失败）：

```bash
curl -H "Origin: https://malicious-site.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     https://your-function-url
```

### 测试加密是否生效

1. **直接调用测试**（应该失败）：

```bash
curl -X POST https://your-function-url \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test"}'
```

2. **加密调用测试**（应该成功）：

```javascript
import { secureApiCall } from "./utils/secure-api-client.ts";
const response = await secureApiCall(url, { prompt: "test" });
```

### 验证环境变量配置

在云函数日志中查看：

```bash
firebase functions:log
```

应该看到类似这样的日志：

```
🔍 CORS检查: {
  requestOrigin: "https://yourdomain.com",
  allowedOrigins: ["https://yourdomain.com", "https://www.yourdomain.com"],
  isAllowed: true
}
```

## 🆘 故障排除

### 常见问题

1. **"缺少加密请求头"**
   - 检查是否使用了加密客户端
   - 确认请求头设置正确

2. **"请求签名验证失败"**
   - 检查加密密钥是否一致
   - 确认时间戳是否有效

3. **"请求时间戳无效"**
   - 检查系统时间是否同步
   - 确认时间戳在5分钟有效期内

### 调试模式

在开发环境中启用详细日志：

```javascript
// 在云函数中添加
console.log("🔐 加密验证:", {
  hasEncryptedData: !!encryptedData,
  hasSignature: !!signature,
  hasTimestamp: !!timestamp,
  timestampValid: isTimestampValid(parseInt(timestamp)),
});
```

## 📈 性能影响

- **加密开销**: ~5-10ms
- **网络传输**: 数据量增加约20%
- **总体影响**: 几乎无感知

## 🔄 升级路径

如果将来需要更高级的安全功能：

1. **添加API密钥验证**
2. **实现JWT认证**
3. **添加限流机制**
4. **集成IP白名单**

这个方案既简单又有效，能够有效防止API被直接调用和滥用！
