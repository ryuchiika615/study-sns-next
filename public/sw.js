self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  const { title, body, icon, url, vibrate } = data;

  event.waitUntil(
    self.registration.showNotification(title || "リュッター", {
      body: body || "",
      icon: icon || "/icon-192.png",
      badge: "/icon-192.png",
      vibrate: vibrate ? [200, 100, 200] : undefined,
      data: { url: url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
