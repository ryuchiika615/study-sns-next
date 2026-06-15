self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  const { title, body, icon, url } = data;

  event.waitUntil(
    self.registration.showNotification(title || "リュッター", {
      body: body || "",
      icon: icon || "/icon.png",
      badge: "/icon.png",
      data: { url: url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
