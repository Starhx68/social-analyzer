# 移动端应用开发指南

## 概述

本项目使用 [Taro](https://taro.zone/) 框架开发，支持一套代码编译到多个平台：
- **H5 网页**（当前主要使用的平台）
- 微信小程序
- 支付宝小程序

## 技术栈

- **框架**: Taro 3.6.20 + React 18
- **UI 组件**: Taro UI
- **样式**: SCSS
- **构建工具**: Webpack 5
- **路由**: Hash 模式（H5）

## 开发命令

### H5 开发（默认）

```bash
# 启动 H5 开发服务器
npm run dev:h5

# 访问地址：http://localhost:5174
```

### 小程序开发

```bash
# 微信小程序
npm run dev:weapp

# 支付宝小程序
npm run dev:alipay
```

### 生产构建

```bash
# 构建 H5
npm run build:h5

# 构建微信小程序
npm run build:weapp

# 构建支付宝小程序
npm run build:alipay
```

## 项目结构

```
miniprogram/
├── config/              # Taro 配置
│   ├── index.js         # 主配置文件
│   ├── dev.js           # 开发环境配置
│   └── prod.js          # 生产环境配置
├── src/
│   ├── pages/           # 页面
│   │   ├── index/       # 首页
│   │   └── login/       # 登录页
│   ├── components/      # 组件
│   ├── services/        # API 服务
│   ├── utils/           # 工具函数
│   ├── app.js           # 应用入口
│   ├── app.scss         # 全局样式
│   └── app.config.js    # 应用配置
├── dist/                # 编译输出目录
├── babel.config.js      # Babel 配置
└── package.json         # 依赖配置
```

## 配置说明

### H5 开发服务器配置

在 `config/index.js` 中配置：

```javascript
h5: {
  devServer: {
    port: 5174,
    host: 'localhost',
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  router: {
    mode: 'hash'  // 使用 hash 路由模式
  }
}
```

### 环境变量

开发环境使用 `http://localhost:3000/api`，生产环境使用 `/api`。

## API 调用示例

```javascript
import Taro from '@tarojs/taro'

// 发起请求
Taro.request({
  url: '/api/orders',
  method: 'GET'
}).then(res => {
  console.log(res.data)
})
```

## 页面路由

```javascript
// 跳转到新页面
Taro.navigateTo({
  url: '/pages/detail/index?id=123'
})

// 返回上一页
Taro.navigateBack()

// 切换 Tab 页
Taro.switchTab({
  url: '/pages/index/index'
})
```

## 注意事项

### H5 平台特定

1. **路由模式**: H5 使用 hash 路由，不需要服务器配置
2. **样式适配**: 使用 `750px` 设计稿宽度，Taro 会自动转换
3. **API 限制**: 某些小程序专属 API 在 H5 不可用

### 跨平台开发建议

1. 使用 Taro 提供的组件和 API，避免直接使用平台特定代码
2. 使用条件编译处理平台差异：
```javascript
// #ifdef H5
// H5 特定代码
// #endif

// #ifdef WEAPP
// 微信小程序特定代码
// #endif
```

3. 测试时在多个平台验证功能

## 常见问题

### Q: 端口被占用怎么办？

A: Taro 会自动切换到下一个可用端口（如 5175、5176）。

### Q: 如何调试 H5？

A: 使用浏览器开发者工具（F12）进行调试。

### Q: 如何在小程序中预览？

A: 运行 `npm run build:weapp`，然后使用微信开发者工具打开 `dist` 目录。

## 相关资源

- [Taro 官方文档](https://taro-docs.jd.com/)
- [Taro UI 组件库](https://taro-ui.jd.com/)
- [React 官方文档](https://react.dev/)
