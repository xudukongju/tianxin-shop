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
    checked_in INTEGER DEFAULT 0, checkin_date TEXT, updated_at INTEGER
);`);
db.exec(`CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY, room TEXT, name TEXT, emoji TEXT,
    price INTEGER, qty INTEGER, from_id TEXT, time INTEGER
);`);
db.exec(`CREATE TABLE IF NOT EXISTS subscriptions (
    endpoint TEXT PRIMARY KEY, room TEXT, from_id TEXT, p256dh TEXT, auth TEXT
);`);

function todayStr() { return new Date().toISOString().slice(0, 10); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function loadState(code) {
    const row = db.prepare('SELECT * FROM rooms WHERE code = ?').get(code);
    if (!row) {
        db.prepare("INSERT INTO rooms (code, balance, checked_in, checkin_date, updated_at) VALUES (?,48,0,'',?)")
            .run(code, Date.now());
        return { balance: 48, checkedIn: false, dailyCheckinDate: '', orders: [] };
    }
    const orders = db.prepare('SELECT * FROM orders WHERE room = ? ORDER BY time DESC').all(code)
        .map(o => ({ id: o.id, name: o.name, emoji: o.emoji, price: o.price, qty: o.qty, from: o.from_id, time: o.time }));
    return { balance: row.balance, checkedIn: !!row.checked_in, dailyCheckinDate: row.checkin_date || '', orders };
}
function saveRoom(code, st) {
    db.prepare(`INSERT INTO rooms (code, balance, checked_in, checkin_date, updated_at)
        VALUES (?,?,?,?,?)
        ON CONFLICT(code) DO UPDATE SET balance=excluded.balance,
        checked_in=excluded.checked_in, checkin_date=excluded.checkin_date, updated_at=excluded.updated_at`)
        .run(code, st.balance, st.checkedIn ? 1 : 0, st.dailyCheckinDate || '', Date.now());
}
function saveOrder(code, o) {
    db.prepare('INSERT OR IGNORE INTO orders (id, room, name, emoji, price, qty, from_id, time) VALUES (?,?,?,?,?,?,?,?)')
        .run(o.id, code, o.name, o.emoji, o.price, o.qty, o.from, o.time);
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
function sendPush(code, exceptFrom, title, body, emoji) {
    const subs = roomSubs(code, exceptFrom);
    const payload = JSON.stringify({ title, body, emoji: emoji || '💌' });
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
                const o = { id: uid(), name: it.name, emoji: it.emoji, price: it.price, qty: it.qty || 1, from: ws.from, time: Date.now() };
                st.orders.unshift(o); saveOrder(ws.room, o); names.push(`${it.emoji}${it.name}`);
            });
            saveRoom(ws.room, st);
            broadcastState(ws.room);
            sendPush(ws.room, ws.from, '💕 Ta 给你点了一单', '给你点了：' + names.join('、'), '💕');

        } else if (msg.type === 'checkin' && ws.room) {
            const st = loadState(ws.room);
            if (st.dailyCheckinDate !== todayStr()) {
                st.balance += 5; st.checkedIn = true; st.dailyCheckinDate = todayStr();
                saveRoom(ws.room, st); broadcastState(ws.room);
            } else {
                ws.send(JSON.stringify({ type: 'state', state: st, peers: roomClients(ws.room).size }));
            }

        } else if (msg.type === 'notify' && ws.room) {
            sendPush(ws.room, ws.from, '💌 Ta 给你发了消息', msg.text || '', msg.emoji || '💌');
            // 在线设备同时通过 WS 实时收到（应用内横幅）
            const note = JSON.stringify({ type: 'notify', from: ws.from, emoji: msg.emoji || '💌', text: msg.text || '' });
            roomClients(ws.room).forEach(c => { if (c !== ws && c.readyState === 1) c.send(note); });
        }
    });
    ws.on('close', () => {
        if (ws.room && rooms.has(ws.room)) { rooms.get(ws.room).clients.delete(ws); broadcastPeers(ws.room); }
    });
});

server.listen(PORT, () => {
    console.log(`💞 甜心小店服务已启动: http://localhost:${PORT}  (WebSocket 同源)`);
    console.log(`   公钥 VAPID: ${vapidKeys.publicKey.slice(0, 24)}…`);
});
