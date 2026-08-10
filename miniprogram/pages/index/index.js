const app = getApp();
// 本地调试可填电脑局域网 IP，例如 ws://192.168.1.10:3001
// 正式部署改成 wss://你的服务器地址/ws
const WS_URL = 'ws://localhost:3001';
const LS_KEY = 'tianxin_shop_v1';

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

function todayStr() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate(); }
function fmtTime(t) { const d = new Date(t); return ('0'+d.getHours()).slice(-2) + ':' + ('0'+d.getMinutes()).slice(-2); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function defaultState() { return { balance: 48, checkedIn: false, dailyCheckinDate: '', orders: [], room: '' }; }

Page({
    data: {
        balance: 48, checkedIn: false, dailyCheckinDate: '', orders: [],
        activeCategory: 'menu', menuList: [],
        cart: {}, cartList: [], cartCount: 0, cartTotal: 0,
        connected: false, peers: 0, room: '', myId: '',
        currentView: 'shop',
        showCart: false, showConnect: false, showMsg: false,
        roomInput: '', msgInput: '',
        notify: { show: false, title: '', text: '', emoji: '💌' },
        quickMsgs: ['想你啦 💕', '在干嘛呀～', '么么哒 😘', '快回来陪我', '吃饭了没 🍚', '戳一下 👉'],
        sidebar: [
            { cat: 'cook', icon: '🍳', label: '点菜' },
            { cat: 'menu', icon: '💕', label: '点单' },
            { cat: 'play', icon: '✈️', label: '想去玩' },
            { cat: 'limited', icon: '⭐', label: '限定' },
        ],
    },

    onLoad() {
        this.setData({ myId: app.globalData.myId });
        const st = Object.assign(defaultState(), wx.getStorageSync(LS_KEY) || {});
        this.applyState(st);
        this.renderMenu('menu');
        if (st.room) this.connectWS();
        else this.updateSyncUI(0);
    },

    applyState(st) {
        this._state = st;
        const orders = (st.orders || []).map(o => Object.assign({}, o, { time: fmtTime(o.time) }));
        wx.setStorageSync(LS_KEY, st);
        this.setData({
            balance: st.balance, checkedIn: st.checkedIn,
            dailyCheckinDate: st.dailyCheckinDate, orders,
            room: st.room || '',
        });
        this.refreshCheckinBtn();
    },

    refreshCheckinBtn() {
        const done = this._state.checkedIn && this._state.dailyCheckinDate === todayStr();
        this.setData({ checkinLabel: done ? '今日已签' : '签到', checkinDim: done });
    },

    renderMenu(cat) {
        this.setData({ activeCategory: cat, menuList: MENU[cat] || MENU.menu });
    },

    // ===== 菜单 / 购物车 =====
    onSideTap(e) {
        const cat = e.currentTarget.dataset.cat;
        this.setData({ activeCategory: cat });
        this.renderMenu(cat);
    },
    onAdd(e) {
        const id = e.currentTarget.dataset.id;
        let item;
        for (const k in MENU) { const f = MENU[k].find(i => i.id === id); if (f) { item = f; break; } }
        if (!item) return;
        const cart = Object.assign({}, this.data.cart);
        if (cart[id]) cart[id].qty += 1; else cart[id] = { item, qty: 1 };
        this.setData({ cart });
        this.updateCartUI();
    },
    onQty(e) {
        const id = e.currentTarget.dataset.id, d = Number(e.currentTarget.dataset.d);
        const cart = Object.assign({}, this.data.cart);
        if (!cart[id]) return;
        cart[id].qty += d;
        if (cart[id].qty <= 0) delete cart[id];
        this.setData({ cart });
        this.updateCartUI();
    },
    clearCart() { this.setData({ cart: {} }); this.updateCartUI(); },
    updateCartUI() {
        const cart = this.data.cart;
        const list = Object.keys(cart).map(id => ({
            id, emoji: cart[id].item.emoji, name: cart[id].item.name,
            price: cart[id].item.price, qty: cart[id].qty,
            subtotal: cart[id].item.price * cart[id].qty,
        }));
        const count = list.reduce((s, c) => s + c.qty, 0);
        const total = list.reduce((s, c) => s + c.subtotal, 0);
        this.setData({ cartList: list, cartCount: count, cartTotal: total, cartDisabled: count === 0 });
    },

    // ===== 点单 =====
    checkout() {
        const total = this.data.cartTotal;
        if (total === 0) return;
        if (total > this.data.balance) { wx.showToast({ title: '甜心币不够啦', icon: 'none' }); return; }
        const items = this.data.cartList.map(c => ({ name: c.name, emoji: c.emoji, price: c.price, qty: c.qty }));
        if (this.data.connected && this.task) {
            this.task.send({ data: JSON.stringify({ type: 'order', items, total, from: this.data.myId }) });
        } else {
            const st = Object.assign({}, this._state);
            st.balance -= total;
            items.forEach(it => st.orders.unshift({ id: uid(), name: it.name, emoji: it.emoji, price: it.price, qty: it.qty, from: this.data.myId, time: Date.now() }));
            this.applyState(st);
        }
        this.setData({ cart: {}, showCart: false });
        this.updateCartUI();
        wx.showModal({ title: '点单成功！', content: '你的甜蜜订单已发送给 Ta 啦～', showCancel: false, confirmText: '好哒' });
    },

    // ===== 签到 =====
    doCheckin() {
        if (this._state.checkedIn && this._state.dailyCheckinDate === todayStr()) { wx.showToast({ title: '今天已签到过啦', icon: 'none' }); return; }
        if (this.data.connected && this.task) {
            this.task.send({ data: JSON.stringify({ type: 'checkin' }) });
        } else {
            const st = Object.assign({}, this._state);
            st.balance += 5; st.checkedIn = true; st.dailyCheckinDate = todayStr();
            this.applyState(st);
            wx.showToast({ title: '签到 +5 💖', icon: 'none' });
        }
    },

    // ===== 发消息 =====
    openMsg() {
        if (!this.data.connected) { wx.showToast({ title: '先连接另一半哦', icon: 'none' }); this.openConnect(); return; }
        this.setData({ showMsg: true, msgInput: '' });
    },
    onMsgInput(e) { this.setData({ msgInput: e.detail.value }); },
    onQuick(e) { this.setData({ msgInput: e.currentTarget.dataset.t }); },
    sendMsg() {
        const text = (this.data.msgInput || '').trim();
        if (!text) return;
        if (this.data.connected && this.task) {
            this.task.send({ data: JSON.stringify({ type: 'notify', text, emoji: '💌', from: this.data.myId }) });
            this.setData({ showMsg: false });
            wx.showToast({ title: '已发送给 Ta 💕', icon: 'none' });
        }
    },

    // ===== 通知横幅 =====
    showNotify(title, text, emoji) {
        this.setData({ notify: { show: true, title, text, emoji: emoji || '💌' } });
        if (this._notifyTimer) clearTimeout(this._notifyTimer);
        this._notifyTimer = setTimeout(() => this.setData({ 'notify.show': false }), 4000);
    },

    // ===== 连接 =====
    openConnect() { this.setData({ showConnect: true }); },
    onRoomInput(e) { this.setData({ roomInput: e.detail.value }); },
    joinRoom() {
        const room = (this.data.roomInput || '').trim();
        if (!room) { wx.showToast({ title: '请输入房间号', icon: 'none' }); return; }
        const st = Object.assign({}, this._state); st.room = room; this.applyState(st);
        this.setData({ showConnect: false });
        this.connectWS();
    },
    connectWS() {
        if (!this._state.room) return;
        if (this.task) { try { this.task.close(); } catch (e) {} }
        const that = this;
        this.task = wx.connectSocket({ url: WS_URL });
        this.task.onOpen(() => {
            that.task.send({ data: JSON.stringify({ type: 'join', room: that._state.room, from: that.data.myId }) });
        });
        this.task.onMessage((res) => {
            let m; try { m = JSON.parse(res.data); } catch (e) { return; }
            if (m.type === 'state') {
                const st = Object.assign({}, that._state, {
                    balance: m.state.balance, checkedIn: m.state.checkedIn,
                    dailyCheckinDate: m.state.dailyCheckinDate, orders: m.state.orders || [],
                });
                that.applyState(st);
                that.updateSyncUI(m.peers);
                if ((st.orders || []).length > (that._lastOrderLen || 0)) {
                    const nw = st.orders[0];
                    if (nw.from !== that.data.myId) that.showNotify('💕 Ta 给你点了一单', `${nw.emoji} ${nw.name}${nw.qty > 1 ? ' ×' + nw.qty : ''}`, nw.emoji);
                }
                that._lastOrderLen = (st.orders || []).length;
            } else if (m.type === 'peers') {
                that.updateSyncUI(m.peers);
            } else if (m.type === 'notify' && m.from !== that.data.myId) {
                that.showNotify('💌 Ta 给你发了消息', m.text, m.emoji || '💌');
            }
        });
        this.task.onClose(() => {
            that.updateSyncUI(0);
            setTimeout(() => { if (that._state.room) that.connectWS(); }, 2500);
        });
    },
    updateSyncUI(peers) {
        let icon = '💔', text = '点此连接另一半，开启实时同步';
        if (peers >= 2) { icon = '💕'; text = `已连接 · 双方在线 · 房间 ${this._state.room}`; }
        else if (peers === 1) { icon = '💞'; text = `已连接 · 等待 Ta 加入 · 房间 ${this._state.room}`; }
        else if (this._state.room) { text = '连接中断，重连中…'; }
        this.setData({ connected: peers > 0, peers, syncIcon: icon, syncText: text });
    },
    onSyncTap() { if (!this._state.room || !this.data.connected) this.openConnect(); },

    // ===== 视图切换 =====
    onTab(e) {
        const view = e.currentTarget.dataset.view;
        this.setData({ currentView: view });
    },

    // ===== 弹窗开关 =====
    openCart() { this.setData({ showCart: true }); },
    closeCart() { this.setData({ showCart: false }); },
    closeConnect() { this.setData({ showConnect: false }); },
    closeMsg() { this.setData({ showMsg: false }); },
    closeNotify() { this.setData({ 'notify.show': false }); },
    noop() {},
});
