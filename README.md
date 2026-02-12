# 国补订单资料上传系统

## 项目简介

国补订单资料上传系统是一个用于湖南省以旧换新活动的订单资料采集平台，支持PC端和小程序双端协同，实现订单管理、资料上传、SN码OCR识别、数据上报等功能。

## 技术栈

### 后端
- **框架**: Node.js + Express
- **数据库**: PostgreSQL (Supabase本地部署)
- **认证**: Supabase Auth (GoTrue)
- **API**: PostgREST + 自定义Express API
- **文件存储**: MinIO / Supabase Storage
- **OCR**: 腾讯云OCR / 百度AI OCR
- **短信**: 腾讯云SMS / 阿里云SMS

### 前端
- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **UI组件**: Ant Design
- **状态管理**: React Context + Hooks
- **HTTP客户端**: Axios

### 小程序
- **框架**: Taro (跨平台)
- **支持平台**: 微信小程序、支付宝小程序
- **UI组件**: Taro UI

### 部署
- **容器化**: Docker + Docker Compose
- **API网关**: Kong
- **数据库**: PostgreSQL (容器化)
- **缓存**: Redis (容器化)

## 项目结构

```
guobu-order-upload/
├── backend/              # 后端服务
│   ├── src/
│   │   ├── config/       # 配置文件
│   │   ├── controllers/  # 控制器
│   │   ├── models/       # 数据模型
│   │   ├── routes/       # 路由
│   │   ├── services/     # 业务服务
│   │   ├── middleware/   # 中间件
│   │   └── utils/        # 工具函数
│   ├── database/         # 数据库脚本
│   │   ├── migrations/   # 迁移文件
│   │   └── seeds/        # 种子数据
│   └── package.json
├── frontend/             # 前端应用
│   ├── src/
│   │   ├── components/   # 组件
│   │   ├── pages/        # 页面
│   │   ├── services/     # API服务
│   │   ├── hooks/        # 自定义Hooks
│   │   ├── utils/        # 工具函数
│   │   └── types/        # TypeScript类型
│   └── package.json
├── miniprogram/          # 小程序
│   ├── src/
│   │   ├── pages/        # 页面
│   │   ├── components/   # 组件
│   │   ├── services/     # API服务
│   │   └── utils/        # 工具函数
│   └── package.json
├── docker/               # Docker配置
│   ├── supabase/         # Supabase配置
│   ├── kong/             # Kong配置
│   └── nginx/            # Nginx配置
├── docker-compose.yml    # Docker Compose编排
├── package.json          # 根package.json
└── README.md             # 项目说明

```

## 快速开始

### 前置要求

- Node.js >= 18.0.0
- Docker >= 20.10.0
- Docker Compose >= 2.0.0
- npm >= 9.0.0

### 安装依赖

```bash
npm install
```

### 启动Docker服务

```bash
npm run docker:up
```

### 初始化数据库

```bash
npm run db:migrate
npm run db:seed
```

### 启动开发服务器

```bash
npm run dev
```

### 访问应用

- **前端**: http://localhost:5173
- **后端API**: http://localhost:3000
- **Supabase Studio**: http://localhost:8000
- **Kong Manager**: http://localhost:8002

## 核心功能

### 1. 用户管理
- 用户注册/登录
- 组织单位管理
- 角色权限管理
- 单位级数据隔离

### 2. 订单管理
- 订单列表查询
- 订单详情查看
- 订单状态管理
- 多品类差异化支持（家电、3C数码、家装、适老化）

### 3. 资料上传
- 多类型图片上传（发票、SN码、送货单等）
- 图片格式转换和压缩
- 水印添加
- 批量上传

### 4. OCR识别
- SN码自动识别
- 图像预处理优化
- 置信度评分
- 人工辅助校对

### 5. 数据上报
- 国补资料审核系统对接
- 中央平台上报
- 上报记录追踪
- 失败重试机制

### 6. 审核管理
- 订单审核
- 资料审核
- 审核意见反馈
- 审核历史记录

## 环境变量

### 后端环境变量 (backend/.env)

```env
NODE_ENV=development
PORT=3000

# 数据库
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/guobu

# Supabase
SUPABASE_URL=http://localhost:8000
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# JWT
JWT_SECRET=your-jwt-secret

# OCR服务
OCR_SERVICE_PROVIDER=tencent
TENCENT_OCR_SECRET_ID=your-secret-id
TENCENT_OCR_SECRET_KEY=your-secret-key

# 文件存储
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=your-access-key
MINIO_SECRET_KEY=your-secret-key
MINIO_BUCKET=guobu-files

# 短信服务
SMS_SERVICE_PROVIDER=tencent
TENCENT_SMS_SECRET_ID=your-secret-id
TENCENT_SMS_SECRET_KEY=your-secret-key
TENCENT_SMS_APP_ID=your-app-id

# 第三方接口
AUDIT_SYSTEM_API_URL=https://audit-system.example.com/api
CENTRAL_PLATFORM_API_URL=https://central-platform.example.com/api
```

### 前端环境变量 (frontend/.env)

```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 小程序环境变量 (miniprogram/.env)

```env
TARO_APP_API_BASE_URL=http://localhost:3000/api
TARO_APP_SUPABASE_URL=http://localhost:8000
TARO_APP_SUPABASE_ANON_KEY=your-anon-key

# 微信小程序
WECHAT_APP_ID=your-wechat-app-id
WECHAT_APP_SECRET=your-wechat-app-secret

# 支付宝小程序
ALIPAY_APP_ID=your-alipay-app-id
ALIPAY_PRIVATE_KEY=your-alipay-private-key
```

## 开发规范

### 代码风格
- 后端: ESLint + Prettier
- 前端: ESLint + Prettier
- 小程序: ESLint + Prettier

### Git提交规范
```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式调整
refactor: 重构
test: 测试相关
chore: 构建/工具相关
```

## 部署

### Docker部署

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 生产环境配置
- 修改docker-compose.yml中的环境变量
- 使用Nginx作为反向代理
- 配置HTTPS证书
- 启用Redis缓存
- 配置日志收集

## 故障排查

### Docker服务无法启动
```bash
# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs [service-name]
```

### 数据库连接失败
```bash
# 检查PostgreSQL容器状态
docker-compose ps postgres

# 进入PostgreSQL容器
docker-compose exec postgres psql -U postgres -d guobu
```

### 端口冲突
修改docker-compose.yml中的端口映射

## 文档

- [产品需求文档](./product_requirements.md)
- [技术架构文档](./technical_architecture.md)
- [API文档](./docs/api.md)
- [部署文档](./docs/deployment.md)

## 许可证

ISC

## 联系方式

如有问题请联系项目负责人。
