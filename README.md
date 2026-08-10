# 我们的甜心小店 🌸

复刻小红书「情侣点单小店」的移动端应用：点甜心券、加购物车、发起点单，**两台手机实时同步、互发消息/通知**。

## 🚀 一键部署到 Render（免费 · 自带 HTTPS）
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/xudokongiu/tianxin-shop)

点上面按钮 → 用 GitHub 登录授权一次 → 自动按仓库里的 `render.yaml` 部署，得到 `https://xxx.onrender.com`。
> 免费计划即可用；若想让数据（房间余额/订单）在重新部署后也不丢，需升级 Starter 计划并启用 `render.yaml` 里的磁盘配置。详见 `DEPLOY.md`。

## 功能
- 🛒 分类点单（点菜 / 点单 / 想去玩 / 限定），甜心币余额 + 每日签到
- 💕 购物车、合计、发起点单
- 💞 **情侣实时同步**：两台手机填同一个「情侣房间号」即可配对
- 💌 **跨手机消息通知**：一方点单 / 发消息，另一方手机实时弹出通知横幅
- 💾 localStorage 本地持久化（离线也能用，联网后与服务端合并）

## 目录结构
```
情侣小软件/
├── index.html / styles.css / app.js   # 手机 H5 版（iPhone 可"添加到主屏幕"当 App）
├── manifest.json / icon.svg           # PWA 安装资源（iPhone 主屏幕图标）
├── server/
│   ├── sync-server.js                 # WebSocket 实时同步服务（Node.js）
│   └── package.json
└── miniprogram/                       # 微信小程序源码（iPhone 微信里直接用）
```

## 一、本地运行（单服务，一条命令）
同步服务**同时托管前端网页**，所以只需启动它一个进程：
```bash
cd server && npm install && npm start
# 打开 http://localhost:3001 即可（WebSocket 与网页同源）
```
手机和电脑连同一个 WiFi，手机浏览器打开 `http://电脑局域网IP:3001`，
点顶部「💔 连接另一半」→ 双方输入**相同房间号** → 实时同步开启。
（同一台电脑开两个浏览器标签、填相同房间号也可模拟双端。）

> 需要 Node ≥ 22（用到内置 `node:sqlite`）。WebSocket 地址在 `app.js` 里已改为同源，
> 本地和部署都**不用改端口**。

## 二、在 iPhone 上使用（两种最推荐方式）
1. **添加到主屏幕（PWA + Web 推送）**：用 Safari 打开网页 → 分享 →「添加到主屏幕」。
   之后像原生 App 全屏打开；在 **HTTPS + iOS 16.4+** 下还能收系统级推送（App 关了也提醒）。
2. **微信小程序**：用微信开发者工具打开 `miniprogram/` 目录，点「编译」即可预览；
   正式发布需在微信公众平台注册小程序并填入自己的 AppID（流程见 `DEPLOY.md` 第四节）。

## 三、部署到公网（让异地情侣也能同步）
详见 **`DEPLOY.md`**，包含：
- Render 一键免费部署（自带 HTTPS，最省事）
- 国内云服务器（Nginx + HTTPS）部署
- 小程序如何连公网、iPhone Web 推送条件
- **微信小程序提审发布流程**的完整解释

要点：把 `server/` 整包部署（需 Node ≥ 22），前端和 `wss` 同源自动可用；
小程序需把 `miniprogram/pages/index/index.js` 的 `WS_URL` 改成 `wss://你的域名` 并在微信后台配 socket 合法域名。

## 四、打包成 App（Android / iOS）
iOS 无法装 APK。要生成原生 App：
- **Android APK**：用 Capacitor 把本 H5 包成安卓应用（见下）。
- **iOS App**：Capacitor 同样支持 iOS，但需一台 Mac + Xcode + 苹果开发者账号（`npx cap add ios`）。
```bash
npm init -y
npm i @capacitor/core @capacitor/cli
npx cap init 甜心小店 com.you.tianxin
npx cap add android        # 安卓；iOS 用 add ios（需 Mac）
npx cap sync
npx cap build android      # 安卓打包；iOS 用 build ios（需 Xcode）
```
> 本机无 Android SDK / Mac，故仅提供工程与步骤；真机打包请在你自己电脑按上面命令执行。

## 数据说明
- 余额、签到、订单、房间号、设备 ID 都存在本地（H5: localStorage；小程序: wx.storage）。
- 连接后，服务端是「共享状态」的唯一真源，双方改动实时广播。
- 服务端状态已用 **SQLite（`server/tianxin.db`）持久化**，重启不丢；推送订阅也存库。
- 这是一对情侣的轻量玩具项目，**没有账号系统**，房间号即身份。
