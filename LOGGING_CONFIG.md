# 日志配置说明

## 概述

本项目配置了环境相关的日志控制，在生产环境中自动移除 console 语句和调试信息。

## 配置说明

### 1. Astro 日志配置

- **开发环境**: 显示 `info` 级别日志
- **生产环境**: 只显示 `warn` 级别日志

### 2. Vite 构建配置

- **开发环境**: 保留所有 console 语句
- **生产环境**: 自动移除 console 和 debugger 语句

## 使用方法

### 开发环境

```bash
npm run dev
# 或
npm run start
```

### 生产环境构建

```bash
# 标准构建（保留日志）
npm run build

# 生产环境构建（移除日志）
npm run build:prod
```

## 环境变量

### 开发环境

```bash
NODE_ENV=development
```

### 生产环境

```bash
NODE_ENV=production
```

## 配置详情

### Astro 配置 (astro.config.mjs)

```javascript
// 日志配置
logging: {
  level: isProduction ? 'warn' : 'info'
},

// Vite 构建配置
vite: {
  build: {
    minify: 'esbuild',
    terserOptions: {
      compress: {
        drop_console: isProduction, // 生产环境移除 console 语句
        drop_debugger: isProduction, // 生产环境移除 debugger 语句
      }
    }
  }
}
```

## 注意事项

1. **开发环境**: 所有 console.log 语句都会保留，方便调试
2. **生产环境**: 所有 console.log 和 debugger 语句会被自动移除
3. **构建优化**: 生产环境构建会启用代码压缩和优化
4. **性能**: 移除 console 语句可以减少生产环境的包大小和运行时性能影响

## 验证配置

### 检查开发环境

```bash
npm run dev
# 在浏览器控制台查看，应该能看到所有 console.log 输出
```

### 检查生产环境

```bash
npm run build:prod
# 构建后的代码中不应该包含 console.log 语句
```

## 自定义配置

如果需要更细粒度的控制，可以修改 `astro.config.mjs` 中的配置：

```javascript
// 自定义日志级别
logging: {
  level: process.env.LOG_LEVEL || (isProduction ? 'warn' : 'info')
},

// 自定义 console 移除规则
terserOptions: {
  compress: {
    drop_console: process.env.REMOVE_CONSOLE === 'true',
    drop_debugger: process.env.REMOVE_DEBUGGER === 'true',
  }
}
```
