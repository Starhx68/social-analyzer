# 国补订单资料上传系统 - 部署上线手册 (无Docker版)

本文档详细描述系统的生产环境部署步骤，采用**原生安装**方式（不使用 Docker），适用于 CentOS 7.x 环境。

## 1. 环境准备 (Prerequisites)

### 1.1 服务器要求

- **操作系统**: CentOS 7.6+ (内核 3.10+)
- **CPU/内存**: 建议 4核 8G 以上 (OCR服务较消耗资源)
- **磁盘**: 建议 100G 以上 (用于存储图片和日志)

### 1.2 基础软件安装

请以 root 用户执行以下命令：

1. **系统更新与基础工具**:

   ```bash
   yum update -y
   yum install -y git wget curl vim unzip libaio
   ```
2. **安装 Node.js (v18 兼容版)**:

   > **重要**: 本项目依赖 Node.js v18+。由于 CentOS 7 默认 glibc 版本较低 (2.17)，官方 Node.js v18+ 二进制文件无法直接运行。
   > **解决方案**: 我们将使用兼容 glibc 2.17 的非官方构建版 (Unofficial Build)。

   ```bash
   # 1. 移除旧版本/错误的源 (如果有)
   yum remove -y nodejs
   rm -f /etc/yum.repos.d/nodesource*.repo
   yum clean all

   # 2. 下载并安装兼容版 Node.js v18
   cd /usr/local/src
   # 下载 unofficial-builds (glibc-217 版本)
   wget https://unofficial-builds.nodejs.org/download/release/v18.19.0/node-v18.19.0-linux-x64-glibc-217.tar.gz
   tar -xzf node-v18.19.0-linux-x64-glibc-217.tar.gz
   
   # 3. 部署二进制文件
   # 如果目录已存在先删除
   rm -rf /usr/local/node-v18
   mv node-v18.19.0-linux-x64-glibc-217 /usr/local/node-v18
   
   # 4. 配置环境变量
   # 避免重复添加
   if ! grep -q "node-v18/bin" /etc/profile; then
     echo 'export PATH=/usr/local/node-v18/bin:$PATH' >> /etc/profile
   fi
   source /etc/profile

   # 5. 验证版本 (应为 v18.19.0)
   node -v 
   npm install -g pm2
   ```
3. **安装 Oracle Instant Client (必须)**:

   ```bash
   # 下载 RPM 包 (请从官网下载或上传 oracle-instantclient19.8-basic-19.8.0.0.0-1.x86_64.rpm)
   # 假设已上传至 /tmp
   yum install -y /tmp/oracle-instantclient19.8-basic-19.8.0.0.0-1.x86_64.rpm

   # 配置环境变量
   echo /usr/lib/oracle/19.8/client64/lib > /etc/ld.so.conf.d/oracle-instantclient.conf
   ldconfig
   ```
4. **安装 Nginx**:

   ```bash
   yum install -y epel-release
   yum install -y nginx
   systemctl start nginx
   systemctl enable nginx
   ```

---

## 2. 中间件部署 (手动安装)拍摄-

### 2.1 安装 PostgreSQL 14

```bash
# 1. 安装 RPM 源
yum install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-7-x86_64/pgdg-redhat-repo-latest.noarch.rpm

# 2. 安装服务端
yum install -y postgresql14-server

# 3. 初始化数据库
/usr/pgsql-14/bin/postgresql-14-setup initdb

# 4. 启动并设置开机自启
systemctl enable postgresql-14
systemctl start postgresql-14

# 5. 创建数据库和用户
sudo -u postgres psql <<EOF
CREATE DATABASE guobu;
CREATE USER guobu WITH ENCRYPTED PASSWORD 'Guobu@2025';
GRANT ALL PRIVILEGES ON DATABASE guobu TO guobu;
\q
EOF

# 6. 配置访问权限 (允许密码登录)
sed -i "s/ident/md5/g" /var/lib/pgsql/14/data/pg_hba.conf
sed -i "s/peer/md5/g" /var/lib/pgsql/14/data/pg_hba.conf
systemctl restart postgresql-14
```

### 2.2 安装 Redis

```bash
yum install -y redis
systemctl start redis
systemctl enable redis
```

### 2.3 安装 MinIO (对象存储)

```bash
# 1. 下载并安装二进制文件
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio
mv minio /usr/local/bin/

# 2. 创建数据目录
mkdir -p /data/minio
useradd -r minio-user -s /sbin/nologin
chown minio-user:minio-user /data/minio

# 3. 创建系统服务
cat > /etc/systemd/system/minio.service <<EOF
[Unit]
Description=MinIO
Documentation=https://docs.min.io
Wants=network-online.target
After=network-online.target

[Service]
User=minio-user
Group=minio-user
Environment="MINIO_ROOT_USER=admin"
Environment="MINIO_ROOT_PASSWORD=Guobu@Minio2025"
ExecStart=/usr/local/bin/minio server /data/minio --console-address ":9001"
Restart=always
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

# 4. 启动服务
systemctl daemon-reload
systemctl start minio
systemctl enable minio
```

---

## 3. 应用服务部署

### 3.1 后端服务 (Backend)

1. **获取代码**:

   ```bash
   mkdir -p /opt/guobu
   cd /opt/guobu
   # git clone ... (或上传代码包)
   cd backend
   ```
2. **安装依赖**:

   ```bash
   npm install --production
   ```
3. **配置环境变量**:
   复制 `.env.example` 为 `.env` 并修改：

   ```ini
   NODE_ENV=production
   PORT=3000

   # 数据库 (本地)
   DATABASE_URL=postgres://guobu:Guobu@2025@localhost:5432/guobu

   # Redis (本地)
   REDIS_HOST=localhost
   REDIS_PORT=6379

   # MinIO (本地)
   MINIO_ENDPOINT=localhost
   MINIO_PORT=9000
   MINIO_ACCESS_KEY=admin
   MINIO_SECRET_KEY=Guobu@Minio2025
   MINIO_BUCKET=guobu-files

   # OCR (推荐使用 SiliconFlow 在线服务，无需本地部署 PaddleOCR)
   OCR_SERVICE_PROVIDER=siliconflow
   SILICONFLOW_API_KEY=sk-your-api-key-here
   SILICONFLOW_MODEL=deepseek-ai/DeepSeek-Janus
   SILICONFLOW_TEXT_MODEL=deepseek-ai/DeepSeek-V3

   # Oracle 配置 (如有)
   ORACLE_ENABLED=true
   ORACLE_CLIENT_LIB_DIR=/usr/lib/oracle/19.8/client64/lib
   ORACLE_CONNECT_STRING=192.168.1.100:1521/orcl
   ORACLE_USER=system
   ORACLE_PASSWORD=oracle_password_encrypted
   ```
4. **初始化数据库**:

   ```bash
   npm run db:init
   ```
5. **启动服务 (PM2)**:

   ```bash
   pm2 start src/index.js --name "guobu-backend"
   pm2 save
   pm2 startup
   ```

### 3.2 前端服务 (Frontend)

1. **构建静态资源**:

   ```bash
   cd /opt/guobu/frontend
   npm install
   npm run build
   # 构建产物在 dist/ 目录
   ```
2. **配置 Nginx**:
   编辑 `/etc/nginx/nginx.conf` 或 `/etc/nginx/conf.d/guobu.conf`:

   ```nginx
   server {
       listen 80;
       server_name your-domain.com; # 替换为实际域名或IP

       # 前端静态资源
       location / {
           root /opt/guobu/frontend/dist;
           index index.html;
           try_files $uri $uri/ /index.html;
       }

       # 操作手册
       location /manual/ {
           alias /opt/guobu/frontend/public/manual/;
           index index.html;
       }

       # 后端 API 代理
       location /api/ {
           proxy_pass http://localhost:3000/;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       }

       # MinIO 文件访问 (如果需要直接访问)
       location /files/ {
           proxy_pass http://localhost:9000/guobu-files/;
       }
   }
   ```
3. **重启 Nginx**:

   ```bash
   nginx -t
   systemctl restart nginx
   ```

## 4. 验证与维护

- **查看后端日志**: `pm2 logs guobu-backend`
- **查看 MinIO 控制台**: `http://IP:9001` (账号 admin / Guobu@Minio2025)
- **数据库备份**:
  ```bash
  pg_dump -U guobu guobu > backup_$(date +%F).sql
  ```
