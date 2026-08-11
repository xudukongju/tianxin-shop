// 甜心小店 · 情侣实时同步服务（SQLite 持久化 + Web Push）
// 同时托管 H5 静态文件，便于单服务部署与 iOS Web Push（同源）。
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const webpush = require('web-push');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3001;
const ROOT = path.resolve(__dirname, '..');          // 项目根目录（含 index.html）
const DB_PATH = path.join(__dirname, 'tianxin.db');
const VAPID_PATH = path.join(__dirname, 'vapid.json');

// ---------- VAPID 密钥（首次运行自动生成并保存）----------
let vapidKeys;
if (fs.existsSync(VAPID_PATH)) {
    vapidKeys = JSON.parse(fs.readFileSync(VAPID_PATH, 'utf8'));
} else {
    vapidKeys = webpush.generateVAPIDKeys();
    fs.writeFileSync(VAPID_PATH, JSON.stringify(vapidKeys, null, 2));
}
webpush.setVapidDetails('mailto:tianxin@example.com', vapidKeys.publicKey, vapidKeys.privateKey);

// ---------- SQLite ----------
const db = new DatabaseSync(DB_PATH);
db.exec(`CREATE TABLE IF NOT EXISTS rooms (
    code TEXT PRIMARY KEY, balance INTEGER DEFAULT 48,
    checked_in INTEGER DEFAULT 0, checkin_date TEXT, intimacy INTEGER DEFAULT 0, updated_at INTEGER
);`);
db.exec(`CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY, room TEXT, name TEXT, emoji TEXT,
    price INTEGER, qty INTEGER, from_id TEXT, status TEXT DEFAULT 'pending', time INTEGER
);`);
db.exec(`CREATE TABLE IF NOT EXISTS subscriptions (
    endpoint TEXT PRIMARY KEY, room TEXT, from_id TEXT, p256dh TEXT, auth TEXT
);`);

// ---------- 列迁移（兼容旧库）----------
function colExists(table, col) {
    return db.prepare(`PRAGMA table_info(${table})`).all().some(x => x.name === col);
}
if (!colExists('rooms', 'intimacy')) db.exec('ALTER TABLE rooms ADD COLUMN intimacy INTEGER DEFAULT 0');
if (!colExists('orders', 'status')) db.exec("ALTER TABLE orders ADD COLUMN status TEXT DEFAULT 'pending'");
if (!colExists('rooms', 'last_paper_date')) db.exec("ALTER TABLE rooms ADD COLUMN last_paper_date TEXT DEFAULT ''");

function todayStr() { return new Date().toISOString().slice(0, 10); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ---------- 每日报纸（时事新闻）----------
// 多源容错：国内可访问的「知乎日报」+ 全球可访问的「BBC 中文」，任一通即可；
// 都不通时回退到精选文摘，保证报纸永远不空。
const NEWS_CACHE_FILE = path.join(__dirname, 'news_cache.json');
const PAPER_BASE = Date.UTC(2026, 0, 1);
const NEWS_FEEDS = (process.env.NEWS_FEED_URLS ? JSON.parse(process.env.NEWS_FEED_URLS) : [
    { url: 'https://news-at.zhihu.com/api/4/news/latest', type: 'zhihu', category: '每日时事', source: '知乎日报' },
    { url: 'https://feeds.bbci.co.uk/zhongwen/simp/rss.xml', type: 'rss', category: '国际时事', source: 'BBC 中文' },
]);
const FALLBACK_NEWS = [
    { title: '雨天适合慢一点：城市里的六家独立书店', summary: '从旧街转角到河岸边，六间让人愿意安静坐上一下午的小书店。', source: '小铺文摘', category: '生活', url: '#' },
    { title: '为什么一起吃饭，仍是家里重要的小事', summary: '餐桌不只是放下食物的地方，也是一天里重新遇见彼此的时刻。', source: '小铺文摘', category: '家庭', url: '#' },
    { title: '阳台种香草：从一盆薄荷开始', summary: '不需要很大的空间，阳光、清水和一点耐心就能拥有自己的小花园。', source: '小铺文摘', category: '生活', url: '#' },
    { title: '一张唱片的夜晚：适合夏末听的五首歌', summary: '把灯调暗一点，让缓慢的旋律陪你度过雨后的夜晚。', source: '小铺文摘', category: '音乐', url: '#' },
    { title: '散步这件小事，原来这么治愈', summary: '不用去很远的地方，楼下那条路也能走出好心情。', source: '小铺文摘', category: '生活', url: '#' },
];
function paperVol() { return Math.floor((Date.now() - PAPER_BASE) / 86400000); }
function zhDate(d) {
    const w = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${w}`;
}
async function fetchRSS(url, category, source) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (tianxin-paper)' }, signal: ctrl.signal });
        const xml = await res.text();
        const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
        return items.slice(0, 10).map(it => {
            const b = it[1];
            const g = (tag) => {
                const m = b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/\\1>`, 'i'));
                return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
            };
            let title = g('title'), desc = g('description'), link = g('link');
            desc = desc.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
            return { title, summary: desc.slice(0, 150), source, url: link, category };
        }).filter(x => x.title);
    } catch (e) { return []; }
    finally { clearTimeout(timer); }
}
async function fetchZhihu(url, category, source) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (tianxin-paper)' }, signal: ctrl.signal });
        const data = await res.json();
        const stories = (data.stories || []).slice(0, 8);
        return stories.map(s => ({
            title: s.title, summary: (s.hint || '').slice(0, 150), source, url: s.url || ('https://daily.zhihu.com/story/' + s.id), category
        })).filter(x => x.title);
    } catch (e) { return []; }
    finally { clearTimeout(timer); }
}
let newsCache = null;
async function getNews() {
    const today = todayStr();
    if (newsCache && newsCache.date === today) return newsCache;
    if (!newsCache) {
        try { const f = JSON.parse(fs.readFileSync(NEWS_CACHE_FILE, 'utf8')); if (f && f.items && f.items.length) newsCache = f; } catch (e) {}
    }
    let items = [];
    for (const f of NEWS_FEEDS) {
        let r = [];
        if (f.type === 'zhihu') r = await fetchZhihu(f.url, f.category, f.source);
        else if (f.type === 'rss') r = await fetchRSS(f.url, f.category, f.source);
        if (r.length) items = items.concat(r);
        if (items.length >= 7) break;
    }
    const seen = new Set();
    items = items.filter(x => { if (seen.has(x.title)) return false; seen.add(x.title); return true; });
    if (items.length < 3) {
        if (newsCache && newsCache.items.length) items = newsCache.items;
        else items = FALLBACK_NEWS.map((n, i) => ({ ...n, id: 'fb' + i }));
    }
    items = items.slice(0, 7).map((n, i) => ({ id: 'n' + i, ...n }));
    newsCache = { date: today, vol: paperVol(), displayDate: zhDate(new Date()), items };
    try { fs.writeFileSync(NEWS_CACHE_FILE, JSON.stringify(newsCache)); } catch (e) {}
    return newsCache;
}

function loadState(code) {
    const row = db.prepare('SELECT * FROM rooms WHERE code = ?').get(code);
    if (!row) {
        db.prepare("INSERT INTO rooms (code, balance, checked_in, checkin_date, updated_at) VALUES (?,48,0,'',?)")
            .run(code, Date.now());
        return { balance: 48, checkedIn: false, dailyCheckinDate: '', orders: [] };
    }
    const orders = db.prepare('SELECT * FROM orders WHERE room = ? ORDER BY time DESC').all(code)
        .map(o => ({ id: o.id, name: o.name, emoji: o.emoji, price: o.price, qty: o.qty, from: o.from_id, status: o.status || 'pending', time: o.time }));
    return { balance: row.balance, checkedIn: !!row.checked_in, dailyCheckinDate: row.checkin_date || '', intimacy: row.intimacy || 0, orders };
}
function saveRoom(code, st) {
    db.prepare(`INSERT INTO rooms (code, balance, checked_in, checkin_date, intimacy, updated_at)
        VALUES (?,?,?,?,?,?)
        ON CONFLICT(code) DO UPDATE SET balance=excluded.balance,
        checked_in=excluded.checked_in, checkin_date=excluded.checkin_date,
        intimacy=excluded.intimacy, updated_at=excluded.updated_at`)
        .run(code, st.balance, st.checkedIn ? 1 : 0, st.dailyCheckinDate || '', st.intimacy || 0, Date.now());
}
function saveOrder(code, o) {
    db.prepare('INSERT OR IGNORE INTO orders (id, room, name, emoji, price, qty, from_id, status, time) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(o.id, code, o.name, o.emoji, o.price, o.qty, o.from, o.status || 'pending', o.time);
}
function roomClients(code) { return (rooms.get(code) || { clients: new Set() }).clients; }
function roomSubs(code, exceptFrom) {
    return db.prepare('SELECT * FROM subscriptions WHERE room = ? AND from_id != ?').all(code, exceptFrom || '');
}

// ---------- 内存中的在线连接（仅运行时，状态已落库）----------
const rooms = new Map();   // code -> { clients: Set<ws> }
function getRoom(code) {
    if (!rooms.has(code)) rooms.set(code, { clients: new Set() });
    return rooms.get(code);
}
function broadcastState(code) {
    const st = loadState(code);
    const payload = JSON.stringify({ type: 'state', state: st, peers: roomClients(code).size });
    roomClients(code).forEach(c => { if (c.readyState === 1) c.send(payload); });
}
function broadcastPeers(code) {
    const payload = JSON.stringify({ type: 'peers', peers: roomClients(code).size });
    roomClients(code).forEach(c => { if (c.readyState === 1) c.send(payload); });
}
function sendPush(code, exceptFrom, title, body, emoji, kind) {
    const subs = roomSubs(code, exceptFrom);
    const payload = JSON.stringify({ title, body, emoji: emoji || '💌', kind: kind || 'msg' });
    subs.forEach(s => {
        webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
            .catch(err => {
                if (err && err.statusCode === 404 || err && err.statusCode === 410) {
                    db.prepare('DELETE FROM subscriptions WHERE endpoint = ?').run(s.endpoint);
                }
            });
    });
}

// ---------- HTTP：托管静态文件 ----------
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';

    // 每日报纸：实时时事新闻接口
    if (urlPath === '/api/news') {
        getNews().then(data => {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(data));
        }).catch(() => { res.writeHead(500); res.end('{}'); });
        return;
    }
    // 防目录穿越 & 只允许项目根目录下的白名单文件
    const filePath = path.join(ROOT, urlPath);
    if (!filePath.startsWith(ROOT) || urlPath.includes('..') ||
        urlPath.startsWith('/server/') || urlPath.startsWith('/miniprogram/') || urlPath.startsWith('/.workbuddy/')) {
        res.writeHead(403); res.end('Forbidden'); return;
    }
    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
        res.end(data);
    });
});

// ---------- WebSocket ----------
const wss = new WebSocketServer({ server });
wss.on('connection', (ws) => {
    ws.room = null; ws.from = null;
    ws.on('message', (raw) => {
        let msg; try { msg = JSON.parse(raw); } catch (e) { return; }

        if (msg.type === 'join') {
            const room = getRoom(msg.room);
            if (ws.room && rooms.has(ws.room)) { rooms.get(ws.room).clients.delete(ws); broadcastPeers(ws.room); }
            ws.room = msg.room; ws.from = msg.from || uid();
            room.clients.add(ws);
            // 先下发 VAPID 公钥，再下发当前状态
            ws.send(JSON.stringify({ type: 'ready', vapidPublicKey: vapidKeys.publicKey }));
            const st = loadState(msg.room);
            ws.send(JSON.stringify({ type: 'state', state: st, peers: room.clients.size }));
            broadcastPeers(room);

        } else if (msg.type === 'subscribe') {
            const sub = msg.subscription;
            if (sub && sub.endpoint && ws.room) {
                db.prepare(`INSERT OR REPLACE INTO subscriptions (endpoint, room, from_id, p256dh, auth)
                    VALUES (?,?,?,?,?)`).run(sub.endpoint, ws.room, ws.from, sub.keys.p256dh, sub.keys.auth);
            }

        } else if (msg.type === 'order' && ws.room) {
            const st = loadState(ws.room);
            const total = msg.total || 0;
            st.balance = Math.max(0, st.balance - total);
            const names = [];
            (msg.items || []).forEach(it => {
                const o = { id: uid(), name: it.name, emoji: it.emoji, price: it.price, qty: it.qty || 1, from: ws.from, status: 'pending', time: Date.now() };
                st.orders.unshift(o); saveOrder(ws.room, o); names.push(`${it.emoji}${it.name}`);
            });
            saveRoom(ws.room, st);
            broadcastState(ws.room);
            sendPush(ws.room, ws.from, '💕 Ta 给你点了一单', '给你点了：' + names.join('、'), '💕', 'msg');

        } else if (msg.type === 'complete' && ws.room) {
            const row = db.prepare('SELECT * FROM orders WHERE id = ? AND room = ?').get(msg.orderId, ws.room);
            if (row && row.status !== 'done') {
                db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('done', msg.orderId);
                const st = loadState(ws.room);
                st.intimacy = (st.intimacy || 0) + 5;
                st.balance = st.balance + 2;   // 完成方奖励甜心币
                saveRoom(ws.room, st);
                broadcastState(ws.room);
                // 实时通知下单方（ws.from 是完成方，row.from_id 是下单方）
                const note = JSON.stringify({ type: 'notify', from: ws.from, emoji: row.emoji, kind: 'msg', text: `完成了你的 ${row.emoji}${row.name}，亲密度 +5` });
                roomClients(ws.room).forEach(c => { if (c.from === row.from_id && c !== ws && c.readyState === 1) c.send(note); });
                sendPush(ws.room, ws.from, '💞 Ta 完成了你的单', `${row.emoji}${row.name} 已完成，亲密度 +5`, row.emoji, 'msg');
            }

        } else if (msg.type === 'checkin' && ws.room) {
            const st = loadState(ws.room);
            if (st.dailyCheckinDate !== todayStr()) {
                st.balance += 5; st.checkedIn = true; st.dailyCheckinDate = todayStr();
                saveRoom(ws.room, st); broadcastState(ws.room);
            } else {
                ws.send(JSON.stringify({ type: 'state', state: st, peers: roomClients(ws.room).size }));
            }

        } else if (msg.type === 'notify' && ws.room) {
            sendPush(ws.room, ws.from, '💌 Ta 给你发了消息', msg.text || '', msg.emoji || '💌', msg.kind || 'msg');
            // 在线设备同时通过 WS 实时收到（应用内横幅）
            const note = JSON.stringify({ type: 'notify', from: ws.from, emoji: msg.emoji || '💌', kind: msg.kind || 'msg', text: msg.text || '' });
            roomClients(ws.room).forEach(c => { if (c !== ws && c.readyState === 1) c.send(note); });
        }
    });
    ws.on('close', () => {
        if (ws.room && rooms.has(ws.room)) { rooms.get(ws.room).clients.delete(ws); broadcastPeers(ws.room); }
    });
});

// ---------- 每日报纸推送：每 30 分钟，对在线房间且今日未送达的，推送一次 ----------
setInterval(() => {
    const today = todayStr();
    for (const [code, room] of rooms) {
        if (room.clients.size === 0) continue;
        const row = db.prepare('SELECT last_paper_date FROM rooms WHERE code = ?').get(code);
        if (row && row.last_paper_date === today) continue;
        db.prepare('UPDATE rooms SET last_paper_date = ? WHERE code = ?').run(today, code);
        const payload = JSON.stringify({ type: 'notify', kind: 'paper', from: '系统', emoji: '📰', text: '今日报纸已送达，戳开看看今天的时事 📰' });
        room.clients.forEach(c => { if (c.readyState === 1) c.send(payload); });
        sendPush(code, '', '📰 今日报纸', '今天的时事来了，一起看看吧', '📰', 'paper');
    }
}, 30 * 60 * 1000);

server.listen(PORT, () => {
    console.log(`💞 甜心小店服务已启动: http://localhost:${PORT}  (WebSocket 同源)`);
    console.log(`   公钥 VAPID: ${vapidKeys.publicKey.slice(0, 24)}…`);
});
