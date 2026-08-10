// 甜心小店 Service Worker：接收 Web Push 并在 App 后台/关闭时弹系统通知
self.addEventListener('push', (event) => {
    let data = { title: '💕 甜心小店', body: '', emoji: '💌' };
    try { data = Object.assign(data, event.data.json()); } catch (e) {}

    event.waitUntil((async () => {
        // 如果网页前台正打开，应用内横幅已提示，避免重复弹窗
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const focused = clients.some(c => c.focused);
        if (focused) return;

        await self.registration.showNotification(data.title, {
            body: data.body,
            icon: 'icon.svg',
            badge: 'icon.svg',
            tag: 'tianxin',
            renotify: true,
        });
    })());
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil((async () => {
        const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        if (list.length) { list[0].focus(); return; }
        return self.clients.openWindow('/');
    })());
});
