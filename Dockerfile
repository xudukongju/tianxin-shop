# 甜心小店 · 容器镜像（Web + WebSocket 同步 + SQLite 一体）
# 适用于：腾讯云 CloudBase 云托管 / 轻量应用服务器 / Render / 任意容器平台
FROM node:22-alpine

# 工作目录：把整个仓库放进 /app，server 在 /app/server
WORKDIR /app/server

# 先装依赖（利用层缓存）
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev || npm install

# 复制全部源码（server 代码 + 上级前端静态文件）
COPY . /app

# 运行时在 server 目录；服务会从 __dirname/.. (即 /app) 提供 index.html
WORKDIR /app/server

# SQLite 需要写文件，建目录备用
RUN mkdir -p /app/server

ENV NODE_ENV=production
EXPOSE 3001

# 监听端口由平台通过 PORT 环境变量注入（本服务已支持 process.env.PORT）
CMD ["node", "--experimental-sqlite", "sync-server.js"]
