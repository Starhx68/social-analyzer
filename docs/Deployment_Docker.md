# 国补订单资料上传系统 - 全 Docker 部署手册 (新手友好版)

本文档旨在帮助对 Docker 不熟悉的用户，通过最简单的步骤完成系统的私有化部署。

## 1. 准备工作

### 1.1 上传代码到服务器

将整个项目文件夹 `guobu` 上传到服务器的任意目录（例如 `/opt/guobu`）。

### 1.2 确认 Docker 环境

在服务器终端执行以下命令，确保 Docker 已正确安装并运行：

```bash
docker version
docker compose version
```

> 如果提示命令不存在，请联系运维人员安装 Docker (v20.10+) 和 Docker Compose (v2.0+)。

## 2. 核心配置 (最重要的一步)

系统所有的敏感配置（如密码、API Key）都通过 `.env` 文件管理。

### 2.1 创建配置文件

进入项目目录，复制示例配置文件：

```bash
cd /opt/guobu
cp backend/.env.example .env
```

### 2.2 修改配置文件

使用 `vim` 或其他编辑器修改 `.env` 文件：

```bash
vim .env
```

**必须修改的配置项**：

1. **SiliconFlow OCR 配置** (用于识别身份证和发票)

   ```ini
   OCR_SERVICE_PROVIDER=siliconflow
   SILICONFLOW_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx  <-- 填入你的 API Key
   ```
2. **JWT 密钥** (用于用户登录安全)

   ```ini
   JWT_SECRET=设置一个复杂的随机字符串
   ```
3. **Oracle 数据库配置** (如果不连接 Oracle 可忽略)

   ```ini
   ORACLE_ENABLED=true
   ORACLE_USER=your_username
   ORACLE_PASSWORD=your_password
   ORACLE_CONNECT_STRING=192.168.1.100:1521/ORCL
   ```

**无需修改的默认项** (Docker 内部会自动处理)：

- `DATABASE_URL` (已自动指向 Docker 内置数据库)
- `REDIS_HOST`
- `MINIO_ENDPOINT`

## 3. 启动系统

### 3.1 一键启动

在项目根目录 (`/opt/guobu`) 执行以下命令：

```bash
# -d 表示后台运行
# --build 表示重新构建镜像
docker compose up -d --build
```

**首次启动可能需要几分钟**，因为需要：

1. 下载基础镜像 (Postgres, Redis, MinIO 等)
2. 编译后端 Node.js 代码
3. 编译前端 React 代码

### 3.2 检查状态

等待几分钟后，查看服务运行状态：

```bash
docker compose ps
```

正常情况下，你应该看到 5 个服务 (postgres, redis, minio, backend, frontend) 的状态都是 `Up` (或 `healthy`)。

### 3.3 查看日志 (如果启动失败)

如果发现某个服务状态是 `Exit` 或 `Restarting`，可以查看日志：

```bash
# 查看后端日志
docker compose logs -f backend

# 查看数据库日志
docker compose logs -f postgres
```

## 4. 访问验证

假设服务器 IP 为 `192.168.1.100`：

- **用户端/管理端**: 访问 `http://192.168.1.100`
- **接口文档/API**: 访问 `http://192.168.1.100/api/health` (应返回 `{"status":"ok"}`)
- **文件存储控制台**: 访问 `http://192.168.1.100:9001`
  - 账号: `admin` (或 .env 中配置的 MINIO_ROOT_USER)
  - 密码: `Guobu@Minio2025` (或 .env 中配置的 MINIO_ROOT_PASSWORD)

## 5. 常用维护操作

### 更新代码后重启

如果你修改了代码或配置文件，执行：

```bash
docker compose down
docker compose up -d --build
```

### 数据备份

所有数据都存储在 Docker 数据卷中，即使删除容器数据也不会丢失。
如需备份数据库：

```bash
docker compose exec postgres pg_dump -U guobu guobu > backup_$(date +%Y%m%d).sql
```

### 常见问题排查

**Q: 启动时提示端口被占用 (Address already in use)?**
A: 检查服务器上是否已经运行了 nginx (占用 80) 或 postgres (占用 5432)。

- 解决方法 1: 停止服务器原本的服务。
- 解决方法 2: 修改 `docker-compose.yml` 中的端口映射，例如将 `80:80` 改为 `8080:80`。

**Q: 后端报错 "Connection refused" 连接不上数据库?**
A: 数据库初始化需要时间。Docker Compose 配置了健康检查，后端会自动等待数据库就绪。如果一直失败，请检查 `docker compose logs postgres` 是否有报错。

**Q: OCR 识别失败?**
A: 检查 `.env` 中的 `SILICONFLOW_API_KEY` 是否正确，以及服务器是否能访问外网 (api.siliconflow.cn)。
