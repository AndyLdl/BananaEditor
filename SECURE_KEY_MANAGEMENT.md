# 🔐 安全密钥管理指南

## ⚠️ 重要安全原则

**永远不要将密钥直接写在代码中！** 这会导致密钥泄漏，任何人都可以在代码仓库中看到你的密钥。

## 🛡️ 正确的密钥管理方式

### 1. 开发环境

#### 使用 .env 文件（本地开发）

```bash
# 创建环境变量文件
cp env.example .env

# 编辑 .env 文件
PUBLIC_ENCRYPTION_KEY=your-64-character-hex-key-here
PUBLIC_FIREBASE_FUNCTION_URL=https://your-function-url
```

#### 确保 .env 文件不被提交到代码仓库

```bash
# 在 .gitignore 中添加
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
echo ".env.production" >> .gitignore
```

### 2. 生产环境

#### 方法一：部署平台环境变量

**Vercel 部署**：

```bash
# 在 Vercel Dashboard 中设置环境变量
PUBLIC_ENCRYPTION_KEY=your-production-key
PUBLIC_FIREBASE_FUNCTION_URL=https://your-production-function-url
```

**Netlify 部署**：

```bash
# 在 Netlify Dashboard 中设置环境变量
PUBLIC_ENCRYPTION_KEY=your-production-key
PUBLIC_FIREBASE_FUNCTION_URL=https://your-production-function-url
```

#### 方法二：使用密钥管理服务

**AWS Secrets Manager**：

```javascript
// 在运行时获取密钥
const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");

const client = new SecretsManagerClient({ region: "us-east-1" });
const command = new GetSecretValueCommand({ SecretId: "your-secret-name" });
const response = await client.send(command);
const ENCRYPTION_KEY = JSON.parse(response.SecretString).encryption_key;
```

**Azure Key Vault**：

```javascript
// 使用 Azure Key Vault
const { DefaultAzureCredential } = require("@azure/identity");
const { SecretClient } = require("@azure/keyvault-secrets");

const credential = new DefaultAzureCredential();
const client = new SecretClient(
  "https://your-vault.vault.azure.net/",
  credential,
);
const secret = await client.getSecret("encryption-key");
const ENCRYPTION_KEY = secret.value;
```

## 🔧 密钥轮换策略

### 1. 定期轮换密钥

```bash
# 生成新密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 更新云函数环境变量
firebase functions:config:set app.encryption_key="new-key-here"

# 更新前端环境变量
# 在部署平台中更新 PUBLIC_ENCRYPTION_KEY

# 部署更新
firebase deploy --only functions
```

### 2. 密钥版本管理

```javascript
// 支持多个密钥版本
const ENCRYPTION_KEYS = {
  v1: import.meta.env.PUBLIC_ENCRYPTION_KEY_V1,
  v2: import.meta.env.PUBLIC_ENCRYPTION_KEY_V2,
  current: import.meta.env.PUBLIC_ENCRYPTION_KEY,
};
```

## 🚨 安全最佳实践

### 1. 密钥生成

```bash
# 使用强随机密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 或者使用 OpenSSL
openssl rand -hex 32
```

### 2. 密钥存储

- ✅ 使用环境变量
- ✅ 使用密钥管理服务
- ✅ 定期轮换密钥
- ❌ 不要写在代码中
- ❌ 不要提交到代码仓库
- ❌ 不要在日志中输出密钥

### 3. 访问控制

```bash
# 限制密钥访问权限
# 只有必要的服务和人员才能访问密钥
```

## 🔍 安全检查清单

- [ ] 密钥不在代码中硬编码
- [ ] .env 文件在 .gitignore 中
- [ ] 生产环境使用环境变量
- [ ] 密钥定期轮换
- [ ] 访问权限最小化
- [ ] 密钥不在日志中输出
- [ ] 使用强随机密钥

## 📊 安全对比

| 方式         | 安全性  | 易用性  | 推荐度    |
| ------------ | ------- | ------- | --------- |
| 代码中硬编码 | ❌ 极低 | ✅ 简单 | ❌ 不推荐 |
| 环境变量     | ✅ 高   | ✅ 简单 | ✅ 推荐   |
| 密钥管理服务 | ✅ 极高 | ⭐ 中等 | ✅ 推荐   |

## 🆘 密钥泄漏处理

如果密钥泄漏了：

1. **立即轮换密钥**
2. **更新所有环境变量**
3. **检查访问日志**
4. **通知相关团队**
5. **更新安全策略**

## 📞 支持

如果遇到密钥管理问题：

1. 检查环境变量是否正确设置
2. 确认密钥格式是否正确
3. 验证密钥是否与云函数匹配
4. 检查部署平台的环境变量配置

记住：**安全第一，密钥管理是安全的基础！** 🔐
