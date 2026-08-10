// ========== 配置 ==========
// 同源连接：本地开 localhost:3001 自动连本地服务；部署后自动连云端（部署需最新 commit）
const SYNC_SERVER = (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host;
const LS_KEY = 'tianxin_shop_v1';

// ========== 菜单数据 ==========
const MENU = {
    love: [
        { id: 'm1', emoji: '🥺', name: '撒娇券', desc: '对 Ta 生效 5 分钟', price: 1 },
        { id: 'm2', emoji: '🌟', name: '夸夸卡', desc: '每个 3 句才有效', price: 1 },
        { id: 'm3', emoji: '😴', name: '哄睡券', desc: '讲故事讲到睡着', price: 2 },
        { id: 'm4', emoji: '💋', name: '晚安吻', desc: '今日份的晚安吻', price: 1 },
        { id: 'm5', emoji: '☀️', name: '起床叫醒', desc: '温柔一点别太吵', price: 1 },
        { id: 'm6', emoji: '🤝', name: '牵手券', desc: '10 分钟起步', price: 1 },
        { id: 'm7', emoji: '🤗', name: '拥抱券', desc: '想抱多久抱多久', price: 1 },
    ],
    feed: [
        { id: 'c1', emoji: '🧋', name: '奶茶', desc: '三分糖少冰', price: 1 },
        { id: 'c2', emoji: '🥩', name: '烤肉', desc: '滋滋冒油那种', price: 3 },
        { id: 'c3', emoji: '🍰', name: '小蛋糕', desc: '草莓味最好', price: 2 },
        { id: 'c4', emoji: '🎬', name: '陪看电影', desc: '你选片我买票', price: 3 },
        { id: 'c5', emoji: '🍜', name: '煮泡面', desc: '加蛋加肠管饱', price: 1 },
        { id: 'c6', emoji: '🍓', name: '水果切盘', desc: '帮你切好去籽', price: 1 },
    ],
    date: [
        { id: 'p1', emoji: '🎡', name: '游乐园', desc: '坐遍所有项目', price: 5 },
        { id: 'p2', emoji: '🏖️', name: '海边散步', desc: '看日落吹海风', price: 4 },
        { id: 'p3', emoji: '🍿', name: '逛街拍拍', desc: '陪我拍 100 张', price: 2 },
        { id: 'p4', emoji: '🎤', name: '看演唱会', desc: '合唱到破音', price: 6 },
        { id: 'p5', emoji: '🍳', name: '一起做饭', desc: '你切菜我掌勺', price: 2 },
        { id: 'p6', emoji: '🧺', name: '公园野餐', desc: '带你好吃的', price: 3 },
    ],
    limited: [
        { id: 'l1', emoji: '💍', name: '限定纪念日', desc: '一年仅一次的仪式', price: 9 },
        { id: 'l2', emoji: '🌹', name: '99 朵玫瑰', desc: '红玫瑰一大束', price: 8 },
        { id: 'l3', emoji: '💝', name: '限定惊喜', desc: '内容保密', price: 6 },
        { id: 'l4', emoji: '✉️', name: '手写情书', desc: '三页不带重样', price: 3 },
        { id: 'l5', emoji: '🎧', name: '专属歌单', desc: '只写给你听', price: 2 },
    ],
};

// ========== 今日小甜 ==========
const TODAY_LIST = [
    { text: '今天也要好好疼爱对方呀', sub: '今日宜：撒娇 · 忌：生闷气' },
    { text: '你是我所有温柔的理由', sub: '今日宜：抱抱 · 忌：手机比我还重要' },
    { text: '想和你虚度所有的黄昏', sub: '今日宜：约会 · 忌：各玩各的' },
    { text: '你的小任性，我都接得住', sub: '今日宜：宠溺 · 忌：讲道理' },
    { text: '世界上最甜的事，是你在身边', sub: '今日宜：投喂 · 忌：饿着对方' },
    { text: '不管多晚，我都等你回家', sub: '今日宜：晚安吻 · 忌：带着情绪睡' },
    { text: '和你吵架也要牵着手吵', sub: '今日宜：和好 · 忌：冷战' },
    { text: '你笑起来的样子最好看', sub: '今日宜：夸夸 · 忌：吝啬赞美' },
    { text: '今天也要说很多次喜欢你', sub: '今日宜：表白 · 忌：害羞不说' },
    { text: '我把偏心都留给了你', sub: '今日宜：独宠 · 忌：公平对待别人' },
    { text: '你的快乐，是我的头等大事', sub: '今日宜：陪伴 · 忌：敷衍' },
    { text: '余生很长，请多指教', sub: '今日宜：规划 · 忌：不敢想象未来' },
];

// ========== 亲密度等级 ==========
const LEVELS = [
    { min: 0, name: '初识期 🌱', next: 30 },
    { min: 30, name: '暧昧期 🌷', next: 100 },
    { min: 100, name: '热恋期 💕', next: 250 },
    { min: 250, name: '如胶似漆 🔥', next: 500 },
    { min: 500, name: '灵魂伴侣 💞', next: Infinity },
];
function levelOf(v) {
    let cur = LEVELS[0], idx = 0;
    for (let i = 0; i < LEVELS.length; i++) { if (v >= LEVELS[i].min) { cur = LEVELS[i]; idx = i; } }
    const progress = cur.next === Infinity ? 1 : (v - cur.min) / (cur.next - cur.min);
    const next = LEVELS[idx + 1];
    const toNext = next ? `再 +${next.min - v} 亲密度，升级到「${next.name}」` : '已达最高级，继续甜蜜吧 💞';
    return { name: cur.name, progress: Math.max(0, Math.min(1, progress)), toNext };
}
const RING_C = 2 * Math.PI * 52;

// ========== 状态 ==========
function todayStr() { return new Date().toISOString().slice(0, 10); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function dayIndex() { const d = new Date(); return Math.floor((Date.now() - new Date(d.getFullYear(),0,0)) / 86400000); }

let myId = localStorage.getItem('tianxin_myid') || uid();
localStorage.setItem('tianxin_myid', myId);

function defaultState() {
    return { balance: 48, checkedIn: false, dailyCheckinDate: '', intimacy: 0, orders: [], room: '' };
}
let state = loadState();
let cart = {};
let ws = null;
let connected = false;
let lastOrderSig = '';   // 用于检测订单新增/完成
let meName = localStorage.getItem('tianxin_me') || '我';
let taName = localStorage.getItem('tianxin_ta') || 'Ta';

function loadState() {
    try { const raw = localStorage.getItem(LS_KEY); if (raw) return Object.assign(defaultState(), JSON.parse(raw)); } catch (e) {}
    return defaultState();
}
function saveState() { localStorage.setItem(LS_KEY, JSON.stringify(state)); }

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
const todoListTa = $('#todoListTa');
const todoListMe = $('#todoListMe');
const todoBadge = $('#todoBadge');

// ========== 今日小甜 ==========
function renderToday() {
    const t = TODAY_LIST[dayIndex() % TODAY_LIST.length];
    $('#todayText').textContent = t.text;
    $('#todaySub').textContent = t.sub;
}

// ========== 渲染菜单 ==========
function renderMenu(cat) {
    const list = MENU[cat] || MENU.love;
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
function findItem(id) {
    for (const cat in MENU) { const f = MENU[cat].find(i => i.id === id); if (f) return f; }
    return null;
}
function addToCart(id) {
    const item = findItem(id); if (!item) return;
    if (cart[id]) cart[id].qty += 1; else cart[id] = { item, qty: 1 };
    updateCartUI(); bump(cartBadge);
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
    if (count === 0) { cartItems.innerHTML = '<div class="cart-empty">购物车还是空的呀～<br>去点几张甜心券吧 💕</div>'; return; }
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

// ========== 亲密度 ==========
function renderIntimacy() {
    const v = state.intimacy || 0;
    const lv = levelOf(v);
    coinCount.textContent = state.balance;
    balanceCount.textContent = state.balance;
    $('#intimacyNum').textContent = v;
    $('#intimacyNum2').textContent = v;
    $('#intimacyLevel').textContent = lv.name;
    $('#intimacyToNext').textContent = lv.toNext;
    $('#intimacyMini').style.width = (lv.progress * 100).toFixed(1) + '%';
    $('#ringFg').style.strokeDashoffset = (RING_C * (1 - lv.progress)).toFixed(1);
    // 我们的页昵称输入框回填
    $('#meNameInput').value = meName === '我' ? '' : meName;
    $('#taNameInput').value = taName === 'Ta' ? '' : taName;
}

// ========== 待办（订单闭环） ==========
function fmtTime(t) { const d = new Date(t); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }

function renderTodo() {
    const orders = state.orders || [];
    // Ta 给我点的
    const taOrders = orders.filter(o => o.from !== myId);
    if (taOrders.length === 0) {
        todoListTa.innerHTML = '<div class="todo-empty">还没有收到 Ta 点的单 🥺<br>去小店给 Ta 点点看吧～</div>';
    } else {
        todoListTa.innerHTML = taOrders.map(o => {
            const q = o.qty > 1 ? ' ×' + o.qty : '';
            if (o.status === 'done') {
                return `<div class="todo-card">
                    <span class="todo-emoji">${o.emoji}</span>
                    <div class="todo-info"><div class="todo-name">${o.name}${q}</div>
                    <div class="todo-meta">${taName} 点的 · ${fmtTime(o.time)}</div></div>
                    <span class="todo-done-tag">✓ 已完成</span></div>`;
            }
            return `<div class="todo-card">
                <span class="todo-emoji">${o.emoji}</span>
                <div class="todo-info"><div class="todo-name">${o.name}${q}</div>
                <div class="todo-meta">${taName} 点的 · ${fmtTime(o.time)}</div></div>
                <button class="complete-btn" onclick="completeOrder('${o.id}')">完成 ✅</button></div>`;
        }).join('');
    }
    // 我点的
    const myOrders = orders.filter(o => o.from === myId);
    if (myOrders.length === 0) {
        todoListMe.innerHTML = '<div class="todo-empty">你还没点单呢 💕<br>去小店挑几样吧～</div>';
    } else {
        todoListMe.innerHTML = myOrders.map(o => {
            const q = o.qty > 1 ? ' ×' + o.qty : '';
            const tag = o.status === 'done'
                ? '<span class="todo-done-tag">💕 Ta 已完成</span>'
                : '<span class="todo-wait-tag">⏳ 等 Ta 接单…</span>';
            return `<div class="todo-card">
                <span class="todo-emoji">${o.emoji}</span>
                <div class="todo-info"><div class="todo-name">${o.name}${q}</div>
                <div class="todo-meta">${meName} 点的 · ${fmtTime(o.time)}</div></div>
                ${tag}</div>`;
        }).join('');
    }
    // 红点：Ta 给我点的未完成数量
    const pending = taOrders.filter(o => o.status !== 'done').length;
    todoBadge.textContent = pending;
    todoBadge.classList.toggle('show', pending > 0);
}

function completeOrder(id) {
    if (connected) {
        ws.send(JSON.stringify({ type: 'complete', orderId: id, from: myId }));
        toast('完成啦，Ta 会被暖到 💞');
    } else {
        const o = (state.orders || []).find(x => x.id === id);
        if (o) { o.status = 'done'; saveState(); renderTodo(); toast('已标记完成（联网后同步）'); }
    }
}

// ========== 通用渲染 ==========
function renderAll() {
    coinCount.textContent = state.balance;
    balanceCount.textContent = state.balance;
    renderIntimacy();
    renderTodo();
    updateCartUI();
    const cb = $('#checkInBtn');
    if (state.checkedIn && state.dailyCheckinDate === todayStr()) {
        cb.querySelector('span').textContent = '今日已签';
        cb.style.opacity = '0.6';
    } else { cb.querySelector('span').textContent = '签到'; cb.style.opacity = '1'; }
}

// ========== 动作：点单 ==========
function checkout() {
    const total = cartTotal();
    if (total === 0) return;
    if (total > state.balance) { toast('甜心币不够啦，先去签到赚币吧 🪙'); return; }
    const items = Object.values(cart).map(c => ({ name: c.item.name, emoji: c.item.emoji, price: c.item.price, qty: c.qty }));
    if (connected) {
        ws.send(JSON.stringify({ type: 'order', items, total, from: myId }));
    } else {
        state.balance -= total;
        items.forEach(it => state.orders.unshift({
            id: uid(), name: it.name, emoji: it.emoji, price: it.price,
            qty: it.qty, from: myId, time: Date.now(), status: 'pending'
        }));
        saveState(); renderAll();
    }
    cart = {}; updateCartUI();
    cartDrawer.classList.remove('show');
    successModal.classList.add('show');
}

// ========== 动作：签到 ==========
function doCheckin() {
    if (state.checkedIn && state.dailyCheckinDate === todayStr()) { toast('今天已经签到过啦～'); return; }
    if (connected) {
        ws.send(JSON.stringify({ type: 'checkin' }));
    } else {
        state.balance += 5; state.checkedIn = true; state.dailyCheckinDate = todayStr();
        saveState(); renderAll(); toast('签到成功 +5 💖');
    }
}

// ========== 动作：发消息 ==========
function openMsg() {
    if (!connected) { toast('先连接另一半才能发消息哦'); openConnect(); return; }
    msgModal.classList.add('show'); $('#msgInput').value = '';
    setTimeout(() => $('#msgInput').focus(), 200);
}
function sendMsg(text) {
    text = (text || '').trim(); if (!text) return;
    if (connected) {
        ws.send(JSON.stringify({ type: 'notify', text, emoji: '💌', from: myId }));
        msgModal.classList.remove('show'); toast('已发送给 Ta 💕');
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

// ========== 连接 ==========
function openConnect() { connectModal.classList.add('show'); $('#roomInput').focus(); }
function closeConnect() { connectModal.classList.remove('show'); }
function joinRoom() {
    const room = $('#roomInput').value.trim();
    if (!room) { toast('请输入房间号'); return; }
    state.room = room; saveState();
    connectModal.classList.remove('show');
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
    connectWS();
}
function connectWS() {
    if (!state.room) return;
    try { ws && ws.close(); } catch (e) {}
    ws = new WebSocket(SYNC_SERVER);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'join', room: state.room, from: myId }));
    ws.onmessage = (e) => {
        let m; try { m = JSON.parse(e.data); } catch (e) { return; }
        if (m.type === 'state') { onState(m.state, m.peers); }
        else if (m.type === 'peers') { updateSyncUI(m.peers); }
        else if (m.type === 'ready') { setupPush(m.vapidPublicKey); }
        else if (m.type === 'notify' && m.from !== myId) { showNotify('💌 Ta 给你发了消息', m.text, m.emoji || '💌'); }
    };
    ws.onclose = () => { connected = false; updateSyncUI(0); setTimeout(() => { if (state.room) connectWS(); }, 2500); };
    ws.onerror = () => { try { ws.close(); } catch (e) {} };
}
function onState(st, peers) {
    const prev = state.orders || [];
    const prevMap = {}; prev.forEach(o => prevMap[o.id] = o.status);
    state.balance = st.balance;
    state.checkedIn = st.checkedIn;
    state.dailyCheckinDate = st.dailyCheckinDate;
    state.intimacy = st.intimacy || 0;
    state.orders = st.orders || [];
    saveState(); renderAll(); updateSyncUI(peers);
    // 检测：新订单（对方点的）
    const incoming = state.orders.filter(o => o.from !== myId && !prevMap[o.id]);
    if (incoming.length) {
        const o = incoming[0];
        showNotify('💕 Ta 给你点了一单', `${taName}给你点了 ${o.emoji} ${o.name}`, o.emoji);
    }
    // 检测：我的订单被完成
    const doneNow = state.orders.filter(o => o.from === myId && o.status === 'done' && prevMap[o.id] && prevMap[o.id] !== 'done');
    if (doneNow.length) {
        const o = doneNow[0];
        showNotify('💞 Ta 完成了你的单', `${taName}完成了你的 ${o.emoji} ${o.name}，亲密度 +5`, o.emoji);
        if (currentView === 'home') switchView('todo');
    }
}
function updateSyncUI(peers) {
    connected = peers > 0;
    syncBar.classList.toggle('connected', peers > 0);
    if (peers >= 2) { syncIcon.textContent = '💕'; syncText.textContent = `已连接 · 双方在线 · 房间 ${state.room}`; }
    else if (peers === 1) { syncIcon.textContent = '💞'; syncText.textContent = `已连接 · 等待 ${taName} 加入 · 房间 ${state.room}`; }
    else { syncIcon.textContent = '💔'; syncText.textContent = state.room ? '连接中断，重连中…' : '点此连接另一半，开启实时同步'; }
}

// ========== Web Push ==========
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
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
        if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'subscribe', subscription: sub.toJSON ? sub.toJSON() : sub, from: myId }));
    } catch (e) { console.warn('Web Push 订阅失败（不影响应用内通知）:', e); }
}

// ========== 视图切换 ==========
let currentView = 'home';
function switchView(view) {
    currentView = view;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
    $('#pageHome').classList.toggle('active', view === 'home');
    $('#pageTodo').classList.toggle('active', view === 'todo');
    $('#pageOurs').classList.toggle('active', view === 'ours');
    if (view === 'todo') renderTodo();
    if (view === 'ours') renderIntimacy();
}

// ========== 纪念日 ==========
function renderAnniversary() {
    const d = localStorage.getItem('tianxin_anniversary');
    if (!d) { $('#anniversaryShow').textContent = '还没设置纪念日哦～'; return; }
    $('#anniversaryInput').value = d;
    const start = new Date(d + 'T00:00:00');
    const today = new Date(); today.setHours(0,0,0,0);
    const days = Math.round((today - start) / 86400000);
    if (days < 0) $('#anniversaryShow').textContent = `距离 ♥ 纪念日还有 ${-days} 天，一起期待吧 💕`;
    else if (days === 0) $('#anniversaryShow').textContent = `今天是你们的纪念日，happy anniversary 💍`;
    else $('#anniversaryShow').textContent = `已经在一起 ${days} 天啦，每一天都算数 💞`;
}
function saveAnniversary() {
    const v = $('#anniversaryInput').value;
    if (!v) { toast('先选个日期呀'); return; }
    localStorage.setItem('tianxin_anniversary', v); renderAnniversary(); toast('纪念日已记住啦 💕');
}
function saveNames() {
    meName = $('#meNameInput').value.trim() || '我';
    taName = $('#taNameInput').value.trim() || 'Ta';
    localStorage.setItem('tianxin_me', meName);
    localStorage.setItem('tianxin_ta', taName);
    renderAll(); toast('称呼已保存 💞');
}

// ========== 工具 ==========
function bump(el) { el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.4)' }, { transform: 'scale(1)' }], { duration: 250, easing: 'ease' }); }
function toast(msg) {
    let t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:rgba(120,60,80,0.9);color:#fff;padding:10px 18px;border-radius:14px;font-size:13px;font-weight:700;z-index:90;pointer-events:none;transition:opacity .3s;'; document.body.appendChild(t); }
    t.textContent = msg; t.style.opacity = '1';
    clearTimeout(t._timer); t._timer = setTimeout(() => t.style.opacity = '0', 1500);
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
$('#saveAnniversary').addEventListener('click', saveAnniversary);
$('#saveNames').addEventListener('click', saveNames);

document.querySelectorAll('.quick-chip').forEach(chip => {
    chip.addEventListener('click', () => { $('#msgInput').value = chip.textContent; $('#msgInput').focus(); });
});
document.querySelectorAll('.cat-chip').forEach(el => {
    el.addEventListener('click', () => {
        document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
        el.classList.add('active'); renderMenu(el.dataset.cat);
    });
});
document.querySelectorAll('.tab').forEach(el => {
    el.addEventListener('click', () => switchView(el.dataset.view));
});

// ========== 初始化 ==========
renderToday();
renderMenu('love');
renderAnniversary();
renderAll();
if (state.room) connectWS(); else updateSyncUI(0);
