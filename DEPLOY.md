# 部署与发布教程 🚀

本项目是**单服务架构**：一个 Node 进程同时托管前端网页、WebSocket 同步、SQLite 数据库。
部署到任意支持 Node ≥ 22 的平台即可，前端和 `wss` 同源，无需分开托管。

---

## 一、公网部署（让异地情侣也能同步）

### 方案 A：Render（强烈推荐 · 免费 · 自带 HTTPS）
Render 对个人项目免费，自动签发 HTTPS 证书，WebSocket 同源，部署最简单。

**前置**：一个 GitHub 账号，把整个 `情侣小软件` 文件夹推成一个 Git 仓库。

**步骤**：
1. 打开 https://render.com ，用 GitHub 登录。
2. 右上角 **New + → Web Service** → 选择你的仓库。
3. 关键配置：
   - **Name**：`tianxin-shop`
   - **Root Directory**：填 `server`（因为启动命令在 server 目录）
   - **Runtime**：Node
   - **Build Command**：`npm install`
   - **Start Command**：`node --experimental-sqlite sync-server.js`
   - 展开 **Advanced → Add Environment Variable**：
     - `NODE_VERSION` = `22`（必须用 22，因为用到了内置 `node:sqlite`）
4. 点击 **Create Web Service**，等待几分钟构建完成。
5. 部署成功后，Render 给你一个地址，例如 `https://tianxin-shop.onrender.com`。

**使用**：
- 手机/电脑浏览器打开这个 HTTPS 地址，就是完整的小店。
- 两人各填**相同房间号** → 实时同步、互发消息。
- WebSocket 自动走 `wss://`（同源，无需改代码）。
- 因为是 HTTPS，iPhone 的 **Web 推送**也能用（见第三节）。

> 嫌连 GitHub 麻烦？也可以在 Render 里选 "Deploy from existing repo" 用拖拽/手动上传，或用 `render.yaml`（仓库里已提供）一键部署。

### 方案 B：国内云服务器（腾讯云轻量 / 阿里云 ECS）
适合想要国内稳定访问、或后续做更多功能的场景。

1. 买一台轻量应用服务器（1 核 1G 够用），系统选 Ubuntu。
2. 装 Node 22：
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt install -y nodejs
   ```
3. 把 `情侣小软件` 整个目录上传到服务器（scp / git clone）。
4. 用 `pm2` 守护进程（不会因退出而停）：
   ```bash
   npm i -g pm2
   cd server && npm install
   pm2 start "node --experimental-sqlite sync-server.js" --name tianxin
   pm2 save
   ```
5. 用 Nginx 反代 + HTTPS（Let's Encrypt 免费证书）：
   ```nginx
   server {
     listen 443 ssl;
     server_name 你的域名;
     ssl_certificate     /path/fullchain.pem;
     ssl_certificate_key /path/privkey.pem;
     location / {
       proxy_pass http://127.0.0.1:3001;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;   # WebSocket 必须
       proxy_set_header Connection "upgrade";
       proxy_set_header Host $host;
     }
   }
   ```
6. 浏览器访问 `https://你的域名` 即可。

---

## 二、微信小程序怎么连到公网
小程序不能同源，需要显式填地址：
1. 打开 `miniprogram/pages/index/index.js`，把顶部 `WS_URL` 改成 `wss://你的域名`（或 Render 的 `wss://tianxin-shop.onrender.com`）。
2. 登录微信公众平台 → 开发 → 开发管理 → **开发设置 → socket 合法域名**，添加 `wss://你的域名`。
3. 开发阶段不想配域名，可在微信开发者工具右上角「详情 → 本地设置」勾选**不校验合法域名**。

---

## 三、iPhone 真机 Web 推送（App 关了也能收到）
本服务**已内置** Web Push（VAPID + Service Worker），前提是：
- 网页通过 **HTTPS** 访问（部署后满足）；
- 在 iPhone 的 Safari 里把网页**「添加到主屏幕」**，从主屏幕图标打开（iOS 16.4+ 才支持 Web Push）；
- 首次打开会请求通知权限，点「允许」。

之后哪怕小店在后台或已关闭，对方点单/发消息时，你的 iPhone 也会收到**系统级通知**（带 App 图标横幅 + 提示音）。
（两人都打开着小店时，用应用内横幅提示，不会重复弹系统通知。）

---

## 四、微信小程序「提审发布」是什么？（你问的流程）
微信小程序**不能像 App 一样直接发给对方安装**，必须发布到微信平台，对方在微信里搜索或扫码打开。流程如下：

1. **注册账号**：去 https://mp.weixin.qq.com 注册「小程序」账号（用邮箱，个人身份即可实名；某些类目需企业资质）。
2. **拿到 AppID**：在后台「开发 → 开发管理 → 开发设置」复制 AppID，填到 `miniprogram/project.config.json` 的 `appid` 字段（替换 `touristappid`）。
3. **本地预览**：下载「微信开发者工具」，导入 `miniprogram/` 目录，编译即可在模拟器/真机预览。
4. **上传代码**：在开发者工具点「上传」，填版本号（如 1.0.0）→ 代码进入微信后台「版本管理」的**开发版本**。
5. **完善信息**：后台填小程序名称、头像、简介，选择**类目**（情侣类可选「工具-情侣」或「生活服务」，注意部分类目要资质，个人主体尽量选无资质要求的）。
6. **提交审核**：点「提交审核」，微信团队审核（通常几小时到 1–2 天，期间可能打回要求补充类目资质或截图）。
7. **发布上线**：审核通过后点「发布」，小程序正式上线；对方在微信搜索名字或扫你的小程序码即可打开。

**和本项目的关系**：
- 应用内实时通知（两人都开着小程序时互收消息）由本项目的 WebSocket 实现，发布后即可用。
- 若要做到「小程序完全关闭后也收到提醒」，需改用微信**订阅消息**能力（服务端调微信接口下发模板消息），属于进阶功能，本版未集成，需要可再加。

---

## 五、数据说明
- 所有房间状态（余额/签到/订单）和推送订阅都存在服务器上的 `server/tianxin.db`（SQLite 文件），重启不丢。
- 没有账号系统；房间号即身份。要换数据库（如 PostgreSQL/Redis）改 `server/sync-server.js` 里的存储函数即可。
