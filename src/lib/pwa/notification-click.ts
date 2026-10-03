/**
 * The service worker's `notificationclick` handler, kept as a string (it runs inside the worker) in
 * its own file so it can also be tested here with a fake worker.
 *
 * Whatever the tabs look like, clicking a notification must visibly take the person to the target
 * page: an open tab already on it is focused; otherwise an open tab of this app is sent there and
 * focused; otherwise a new tab opens. The target is resolved against the app's own address, so a
 * message can only ever open a page of this app.
 */
export const NOTIFICATION_CLICK_HANDLER = `
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = event.notification.data && event.notification.data.url ? event.notification.data.url : "/";
  let target;
  try {
    target = new URL(raw, self.location.origin);
  } catch (e) {
    target = new URL("/", self.location.origin);
  }
  const url = target.origin === self.location.origin ? target.href : self.location.origin + "/";

  event.waitUntil(
    (async () => {
      fetch("/push/opened", { method: "POST" }).catch(() => {});
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const onTarget = windows.find((client) => client.url === url);
      if (onTarget) return onTarget.focus();
      const anyWindow = windows[0];
      if (anyWindow && "navigate" in anyWindow) {
        try {
          const moved = await anyWindow.navigate(url);
          return (moved || anyWindow).focus();
        } catch (e) {
          // An uncontrolled tab can't be navigated; fall through to a new tab.
        }
      }
      return self.clients.openWindow(url);
    })()
  );
});
`;
