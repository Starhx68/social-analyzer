FROM node:24-slim

WORKDIR /app

# 使用阿里云的 Debian 镜像源
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || \
    sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list

# 安装 Oracle Instant Client 所需的系统依赖
# libaio1 是必须的
RUN apt-get update && apt-get install -y \
    libaio1 \
    wget \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# 下载并安装 Oracle Instant Client (使用 19.x 版本，兼容性好)
# 使用阿里云镜像或者其他快速源（这里暂时保持原样，因为 Oracle 官网速度尚可，主要是 apt 源慢）
WORKDIR /opt/oracle
RUN wget https://download.oracle.com/otn_software/linux/instantclient/1924000/instantclient-basic-linux.x64-19.24.0.0.0dbru.zip && \
    unzip instantclient-basic-linux.x64-19.24.0.0.0dbru.zip && \
    rm instantclient-basic-linux.x64-19.24.0.0.0dbru.zip

# 设置 Oracle 环境变量
# LD_LIBRARY_PATH 让系统能找到库文件
# ORACLE_CLIENT_LIB_DIR 让 node-oracledb 在代码中显式初始化
ENV LD_LIBRARY_PATH=/opt/oracle/instantclient_19_24:$LD_LIBRARY_PATH
ENV ORACLE_CLIENT_LIB_DIR=/opt/oracle/instantclient_19_24

WORKDIR /app

COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "src/index.js"]
