// ========== 配置 ==========
// WebSocket 与网页同源（部署后自动指向你的域名，无需改端口）
const SYNC_SERVER = (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host;

const LS_KEY = 'tianxin_shop_v1';

// ========== 菜单数据 ==========
const MENU = {
    menu: [
        { id: 'm1', emoji: '🥺', name: '撒娇券', desc: '对 Ta 生效 5 分钟', price: 1 },
        { id: 'm2', emoji: '🌟', name: '夸夸卡', desc: '每个 3 句才有效', price: 1 },
        { id: 'm3', emoji: '😴', name: '哄睡券', desc: '讲故事讲到睡着', price: 2 },
        { id: 'm4', emoji: '💋', name: '晚安吻', desc: '今日份的晚安吻', price: 1 },
        { id: 'm5', emoji: '☀️', name: '起床叫醒', desc: '温柔一点别太吵', price: 1 },
        { id: 'm6', emoji: '🤝', name: '牵手券', desc: '10 分钟起步', price: 1 },
        { id: 'm7', emoji: '🤗', name: '拥抱券', desc: '想抱多久抱多久', price: 1 },
    ],
    cook: [
        { id: 'c1', emoji: '🥩', name: '烤肉', desc: '滋滋冒油那种', price: 3 },
        { id: 'c2', emoji: '🧋', name: '奶茶', desc: '三分糖少冰', price: 1 },
        { id: 'c3', emoji: '🎬', name: '陪看电影', desc: '你选片我买票', price: 3 },
        { id: 'c4', emoji: '🍰', name: '小蛋糕', desc: '草莓味最好', price: 2 },
    ],
    play: [
        { id: 'p1', emoji: '🎡', name: '游乐园', desc: '坐遍所有项目', price: 5 },
        { id: 'p2', emoji: '🏖️', name: '海边散步', desc: '看日落吹海风', price: 4 },
        { id: 'p3', emoji: '🍿', name: '逛街拍拍', desc: '陪我拍 100 张', price: 2 },
    ],
    limited: [
        { id: 'l1', emoji: '💍', name: '限定纪念日', desc: '一年仅一次的仪式', price: 9 },
        { id: 'l2', emoji: '🌹', name: '限定玫瑰', desc: '99 朵红玫瑰', price: 8 },
        { id: 'l3', emoji: '💝', name: '限定惊喜', desc: '内容保密', price: 6 },
    ],
};

// ========== 状态 ==========
function todayStr() { return new Date().toISOString().slice(0, 10); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

let myId = localStorage.getItem('tianxin_myid') || uid();
localStorage.setItem('tianxin_myid', myId);

function defaultState() {
    return { balance: 48, checkedIn: false, dailyCheckinDate: '', orders: [], room: '' };
}
let state = loadState();
let cart = {};
let ws = null;
let connected = false;
let lastOrderLen = (state.orders || []).length;

function loadState() {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) return Object.assign(defaultState(), JSON.parse(raw));
    } catch (e) {}
    return defaultState();
}
function saveState() {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
}

// ========== DOM ==========
const $ = (s) => document.querySelector(s);
const menuList = $('#menuList');
const coinCount = $('#coinCount');
const balanceCount = $('#balanceCount');
const cartBadge = $('#cartBadge');
const cartDrawer = $('#cartDrawer');
const cartItems = $('#cartItems');
const cartCountTitle = $('#cartCountTitle');
const cartTotalEl = $('#cartTotal');
const checkoutBtn = $('#checkoutBtn');
const successModal = $('#successModal');
const ordersList = $('#ordersList');
const syncBar = $('#syncBar');
const syncIcon = $('#syncIcon');
const syncText = $('#syncText');
const connectModal = $('#connectModal');
const msgModal = $('#msgModal');
const notifyBanner = $('#notifyBanner');

// ========== 渲染菜单 ==========
function renderMenu(category) {
    const list = MENU[category] || MENU.menu;
    menuList.innerHTML = list.map(item => `
        <div class="menu-card">
            <div class="item-emoji">${item.emoji}</div>
            <div class="item-info">
                <div class="item-name">${item.name}</div>
                <div class="item-desc">${item.desc}</div>
                <div class="item-price">💖 ${item.price}</div>
            </div>
            <button class="add-btn" onclick="addToCart('${item.id}')">+</button>
        </div>
    `).join('');
}

// ========== 购物车 ==========
function addToCart(id) {
    let item;
    for (const cat in MENU) {
        const f = MENU[cat].find(i => i.id === id);
        if (f) { item = f; break; }
    }
    if (!item) return;
    if (cart[id]) cart[id].qty += 1;
    else cart[id] = { item, qty: 1 };
    updateCartUI();
    bump(cartBadge);
}
function changeQty(id, d) {
    if (!cart[id]) return;
    cart[id].qty += d;
    if (cart[id].qty <= 0) delete cart[id];
    updateCartUI();
}
function clearCart() { cart = {}; updateCartUI(); }
function cartTotal() { return Object.values(cart).reduce((s, c) => s + c.item.price * c.qty, 0); }
function cartCount() { return Object.values(cart).reduce((s, c) => s + c.qty, 0); }

function updateCartUI() {
    const count = cartCount(), total = cartTotal();
    coinCount.textContent = state.balance;
    balanceCount.textContent = state.balance;
    cartBadge.textContent = count;
    cartBadge.classList.toggle('show', count > 0);
    cartCountTitle.textContent = count;
    cartTotalEl.textContent = total;
    checkoutBtn.disabled = count === 0;
    if (count === 0) {
        cartItems.innerHTML = '<div class="cart-empty">购物车还是空的呀～<br>去点几张甜心券吧 💕</div>';
        return;
    }
    cartItems.innerHTML = Object.values(cart).map(c => `
        <div class="cart-row">
            <span class="cart-emoji">${c.item.emoji}</span>
            <span class="cart-name">${c.item.name}${c.qty > 1 ? ' ×' + c.qty : ''}</span>
            <span class="cart-price">💖 ${c.item.price * c.qty}</span>
            <div class="cart-qty">
                <button class="qty-btn" onclick="changeQty('${c.item.id}', -1)">−</button>
                <span class="qty-num">${c.qty}</span>
                <button class="qty-btn" onclick="changeQty('${c.item.id}', 1)">+</button>
            </div>
        </div>
    `).join('');
}

// ========== 订单视图 ==========
function fmtTime(t) {
    const d = new Date(t);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function renderOrders() {
    const orders = state.orders || [];
    if (orders.length === 0) {
        ordersList.innerHTML = '<div class="orders-empty">还没有订单哦～<br>去点单或给 Ta 发消息试试 💕</div>';
        return;
    }
    ordersList.innerHTML = orders.map(o => `
        <div class="order-card">
            <span class="order-emoji">${o.emoji}</span>
            <div class="order-info">
                <div class="order-name">${o.name}${o.qty > 1 ? ' ×' + o.qty : ''}</div>
                <div class="order-meta">${o.from === myId ? '我点的' : 'Ta 点的'} · ${fmtTime(o.time)}</div>
            </div>
            <span class="order-price">💖 ${o.price * (o.qty || 1)}</span>
        </div>
    `).join('');
}

// ========== 通用渲染 ==========
function renderAll() {
    coinCount.textContent = state.balance;
    balanceCount.textContent = state.balance;
    renderOrders();
    updateCartUI();
    // 签到按钮状态
    const cb = $('#checkInBtn');
    if (state.checkedIn && state.dailyCheckinDate === todayStr()) {
        cb.querySelector('span').textContent = '今日已签';
        cb.style.opacity = '0.6';
    } else {
        cb.querySelector('span').textContent = '签到';
        cb.style.opacity = '1';
    }
}

// ========== 动作：点单 ==========
function checkout() {
    const total = cartTotal();
    if (total === 0) return;
    if (total > state.balance) { toast('甜心币不够啦，先去签到赚币吧 🪙'); return; }
    const items = Object.values(cart).map(c => ({
        name: c.item.name, emoji: c.item.emoji, price: c.item.price, qty: c.qty
    }));
    if (connected) {
        ws.send(JSON.stringify({ type: 'order', items, total, from: myId }));
    } else {
        state.balance -= total;
        items.forEach(it => state.orders.unshift({
            id: uid(), name: it.name, emoji: it.emoji, price: it.price,
            qty: it.qty, from: myId, time: Date.now()
        }));
        saveState();
        renderAll();
    }
    cart = {};
    updateCartUI();
    cartDrawer.classList.remove('show');
    successModal.classList.add('show');
}

// ========== 动作：签到 ==========
function doCheckin() {
    if (state.checkedIn && state.dailyCheckinDate === todayStr()) { toast('今天已经签到过啦～'); return; }
    if (connected) {
        ws.send(JSON.stringify({ type: 'checkin' }));
    } else {
        state.balance += 5;
        state.checkedIn = true;
        state.dailyCheckinDate = todayStr();
        saveState();
        renderAll();
        toast('签到成功 +5 💖');
    }
}

// ========== 动作：发消息给 Ta ==========
function openMsg() {
    if (!connected) { toast('先连接另一半才能发消息哦'); openConnect(); return; }
    msgModal.classList.add('show');
    $('#msgInput').value = '';
    setTimeout(() => $('#msgInput').focus(), 200);
}
function sendMsg(text) {
    text = (text || '').trim();
    if (!text) return;
    if (connected) {
        ws.send(JSON.stringify({ type: 'notify', text, emoji: '💌', from: myId }));
        msgModal.classList.remove('show');
        toast('已发送给 Ta 💕');
    }
}

// ========== 通知横幅 ==========
let notifyTimer = null;
function showNotify(title, text, emoji) {
    $('#notifyTitle').textContent = title;
    $('#notifyText').textContent = text;
    $('#notifyEmoji').textContent = emoji || '💌';
    notifyBanner.classList.add('show');
    beep();
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        try { new Notification(title, { body: text }); } catch (e) {}
    }
    clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => notifyBanner.classList.remove('show'), 4000);
}
function beep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine'; o.frequency.value = 880;
        g.gain.setValueAtTime(0.001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        o.start(); o.stop(ctx.currentTime + 0.26);
    } catch (e) {}
}

// ========== 连接另一半 ==========
function openConnect() { connectModal.classList.add('show'); $('#roomInput').focus(); }
function closeConnect() { connectModal.classList.remove('show'); }
function joinRoom() {
    const room = $('#roomInput').value.trim();
    if (!room) { toast('请输入房间号'); return; }
    state.room = room; saveState();
    connectModal.classList.remove('show');
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
    }
    connectWS();
}
function connectWS() {
    if (!state.room) return;
    try { ws && ws.close(); } catch (e) {}
    ws = new WebSocket(SYNC_SERVER);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'join', room: state.room, from: myId }));
    ws.onmessage = (e) => {
        let m; try { m = JSON.parse(e.data); } catch (e) { return; }
        if (m.type === 'state') {
            state.balance = m.state.balance;
            state.checkedIn = m.state.checkedIn;
            state.dailyCheckinDate = m.state.dailyCheckinDate;
            state.orders = m.state.orders || [];
            saveState();
            renderAll();
            updateSyncUI(m.peers);
            // 订单变多 → 说明对方点了单，弹通知
            if (state.orders.length > lastOrderLen) {
                const newest = state.orders[0];
                if (newest.from !== myId) {
                    const summary = `${newest.emoji} ${newest.name}${newest.qty > 1 ? ' ×' + newest.qty : ''}`;
                    showNotify('💕 Ta 给你点了一单', summary, newest.emoji);
                }
            }
            lastOrderLen = state.orders.length;
        } else if (m.type === 'peers') {
            updateSyncUI(m.peers);
        } else if (m.type === 'ready') {
            setupPush(m.vapidPublicKey);
        } else if (m.type === 'notify' && m.from !== myId) {
            showNotify('💌 Ta 给你发了消息', m.text, m.emoji || '💌');
        }
    };
    ws.onclose = () => {
        connected = false;
        updateSyncUI(0);
        setTimeout(() => { if (state.room) connectWS(); }, 2500); // 断线重连
    };
    ws.onerror = () => { try { ws.close(); } catch (e) {} };
}
function updateSyncUI(peers) {
    connected = peers > 0;
    syncBar.classList.toggle('connected', peers > 0);
    if (peers >= 2) {
        syncIcon.textContent = '💕';
        syncText.textContent = `已连接 · 双方在线 · 房间 ${state.room}`;
    } else if (peers === 1) {
        syncIcon.textContent = '💞';
        syncText.textContent = `已连接 · 等待 Ta 加入 · 房间 ${state.room}`;
    } else {
        syncIcon.textContent = '💔';
        syncText.textContent = state.room ? '连接中断，重连中…' : '点此连接另一半，开启实时同步';
    }
}

// ========== Web Push（iOS 真机推送）==========
function urlBase64ToUint8Array(b64) {
    const pad = '='.repeat((4 - b64.length % 4) % 4);
    const s = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(s), arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
}
async function setupPush(publicKey) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !publicKey) return;
    try {
        const reg = await navigator.serviceWorker.register('sw.js');
        await navigator.serviceWorker.ready;
        let perm = Notification.permission;
        if (perm === 'default') perm = await Notification.requestPermission();
        if (perm !== 'granted') return;
        const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey)
        });
        if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'subscribe', subscription: sub.toJSON ? sub.toJSON() : sub, from: myId }));
        }
    } catch (e) { console.warn('Web Push 订阅失败（不影响应用内通知）:', e); }
}

// ========== 工具 ==========
function bump(el) {
    el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.4)' }, { transform: 'scale(1)' }],
        { duration: 250, easing: 'ease' });
}
function toast(msg) {
    let t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.style.cssText =
        'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:rgba(120,60,80,0.9);color:#fff;padding:10px 18px;border-radius:14px;font-size:13px;font-weight:700;z-index:90;pointer-events:none;transition:opacity .3s;';
        document.body.appendChild(t); }
    t.textContent = msg; t.style.opacity = '1';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.style.opacity = '0', 1500);
}

// ========== 事件绑定 ==========
$('#floatingCart').addEventListener('click', () => cartDrawer.classList.add('show'));
$('#cartOverlay').addEventListener('click', () => cartDrawer.classList.remove('show'));
$('#clearCart').addEventListener('click', clearCart);
$('#checkoutBtn').addEventListener('click', checkout);
$('#successBtn').addEventListener('click', () => successModal.classList.remove('show'));
$('#checkInBtn').addEventListener('click', doCheckin);
$('#floatingMsg').addEventListener('click', openMsg);
$('#sendMsgBtn').addEventListener('click', () => sendMsg($('#msgInput').value));
$('#joinRoomBtn').addEventListener('click', joinRoom);
$('#roomInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom(); });
$('#msgInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMsg($('#msgInput').value); });
syncBar.addEventListener('click', () => { if (!state.room || !connected) openConnect(); });

document.querySelectorAll('.quick-chip').forEach(chip => {
    chip.addEventListener('click', () => { $('#msgInput').value = chip.textContent; $('#msgInput').focus(); });
});

document.querySelectorAll('.side-item').forEach(el => {
    el.addEventListener('click', () => {
        document.querySelectorAll('.side-item').forEach(s => s.classList.remove('active'));
        el.classList.add('active');
        renderMenu(el.dataset.category);
    });
});

document.querySelectorAll('.main-tab').forEach(el => {
    el.addEventListener('click', () => {
        document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
        el.classList.add('active');
        const view = el.dataset.view;
        $('#shopView').classList.toggle('hide', view !== 'shop');
        $('#ordersView').classList.toggle('show', view === 'orders');
        if (view === 'orders') renderOrders();
    });
});

// ========== 初始化 ==========
renderMenu('menu');
renderAll();
if (state.room) { connectWS(); }
else { updateSyncUI(0); }
