# 🚀 快速安全配置

## 📋 概述

前端代码已经更新为使用加密客户端，现在只需要配置加密密钥即可。

## 🚀 快速配置

### 方法一：使用自动配置脚本（推荐）

```bash
# 运行安全配置脚本
node setup-security.js
```

脚本会自动：

- ✅ 生成安全的加密密钥
- ✅ 创建 .env 文件
- ✅ 设置云函数环境变量
- ✅ 部署云函数

### 方法二：手动配置

#### 1. 生成加密密钥

```bash
# 生成64位十六进制密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### 2. 设置云函数环境变量

```bash
# 替换为上面生成的密钥
firebase functions:config:set app.encryption_key="your-64-character-hex-key-here"

# 设置允许的来源
firebase functions:config:set app.allowed_origins="https://yourdomain.com,http://localhost:4321"

# 部署配置
firebase deploy --only functions
```

#### 3. 配置前端环境变量

创建 `.env` 文件（复制 `env.example`）：

```bash
# 复制环境变量模板
cp env.example .env
```

编辑 `.env` 文件，设置加密密钥：

```bash
# 🔐 加密密钥配置（使用步骤1生成的密钥）
PUBLIC_ENCRYPTION_KEY=your-64-character-hex-key-here

# 🌐 云函数配置
PUBLIC_FIREBASE_FUNCTION_URL=https://your-function-url
```

**重要**: 不要将密钥直接写在代码中，使用环境变量确保安全！

## 🧪 测试验证

1. **访问测试页面**：`/test-cloud-function`
2. **点击"测试连接"**：应该显示"加密云函数连接测试成功"
3. **测试AI生成**：在编辑器中输入提示词并生成

## ✅ 完成！

现在你的API已经安全了：

- ✅ 请求体加密
- ✅ 时间戳验证
- ✅ 签名验证
- ✅ 防直接调用

如果遇到问题，请检查：

1. 云函数是否已部署
2. 环境变量是否正确设置
3. 前端加密密钥是否匹配
