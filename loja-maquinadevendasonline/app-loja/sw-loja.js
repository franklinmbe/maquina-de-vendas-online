// Service worker do marketplace (app instalável). Rede primeiro; sem cache de páginas de compra.
// Notificação no celular (Franklin, 24/11/2026): o servidor manda um "toque" sem conteúdo; aqui o app
// busca o aviso mais recente da conta do cliente e mostra na tela, mesmo com o app fechado.
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
self.addEventListener('push', e => {
  e.waitUntil(
    fetch('/wp-admin/admin-ajax.php?action=mvo_push_ultima', { credentials: 'include', cache: 'no-store' })
      .then(r => r.json())
      .catch(() => null)
      .then(j => {
        const n = (j && j.success && j.data) ? j.data : { txt: 'Você tem um novo aviso do seu pedido.', link: '/minha-conta/orders/' };
        return self.registration.showNotification('Máquina de Vendas Online', {
          body: n.txt, icon: '/app-loja/loja-icon-192.png', badge: '/app-loja/loja-icon-192.png',
          tag: n.id || 'mvo', renotify: true, data: { link: n.link || '/minha-conta/orders/' }
        });
      })
  );
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.link) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) { c.navigate(url); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
