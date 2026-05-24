// Raven Universe — Service Worker for Web Push notifications
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Raven", body: event.data.text(), url: "/" };
  }

  const title = payload.title ?? "Raven Universe";
  const options = {
    body: payload.body ?? "",
    icon: payload.icon ?? "/icon.png",
    badge: "/icon.png",
    data: { url: payload.url ?? "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const match = list.find((c) => c.url === url && "focus" in c);
      if (match) return match.focus();
      return clients.openWindow(url);
    })
  );
});
