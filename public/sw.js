self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  const { title, body, icon, url, sound_enabled, vibration_enabled } = data;

  const silent = !sound_enabled && !vibration_enabled;
  const options = {
    body: body || "",
    icon: icon || "/icon-192.png",
    badge: "/icon-192.png",
    silent,
    vibrate: vibration_enabled ? [200, 100, 200] : undefined,
    data: { url: url || "/" },
  };

  event.waitUntil(
    self.registration.showNotification(title || "リュッター", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
