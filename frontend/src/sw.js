// Service worker source (injectManifest). vite-plugin-pwa bundles this into
// dist/sw.js and injects the precache manifest at self.__WB_MANIFEST.
//
// NOTE: the previous public/sw-template.js was never used — the project was in
// workbox `generateSW` mode, so this file's push / background-sync / navigation
// logic never ran. It now runs as a real module service worker.
import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
} from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { BackgroundSyncPlugin } from "workbox-background-sync";
import { clientsClaim } from "workbox-core";

// Activate new versions immediately and take control of open clients so the
// PWA `registerType: "autoUpdate"` flow applies updates without a hard reload.
self.skipWaiting();
clientsClaim();

// Precache build assets and drop caches from previous releases.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ---------------------------------------------------------------------------
// API: network-first with background sync for queued writes
// ---------------------------------------------------------------------------
registerRoute(
  ({ url }) => url.pathname.startsWith("/api/v1/pickups/offers"),
  new NetworkFirst({
    cacheName: "offers-cache",
    plugins: [
      new BackgroundSyncPlugin("offers-queue", { maxRetentionTime: 24 * 60 }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 3600 }),
    ],
    networkTimeoutSeconds: 5,
  }),
);

registerRoute(
  ({ url }) => url.pathname.startsWith("/api/v1/pickups/active"),
  new NetworkFirst({
    cacheName: "pickups-cache",
    plugins: [
      new BackgroundSyncPlugin("pickups-queue", { maxRetentionTime: 24 * 60 }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 3600 }),
    ],
    networkTimeoutSeconds: 5,
  }),
);

registerRoute(
  ({ url }) => url.pathname.startsWith("/api/v1/prices"),
  new NetworkFirst({
    cacheName: "price-cache",
    plugins: [new ExpirationPlugin({ maxEntries: 1, maxAgeSeconds: 86400 })],
    networkTimeoutSeconds: 5,
  }),
);

// ---------------------------------------------------------------------------
// On-device model + runtime: download once, then serve from cache offline
// ---------------------------------------------------------------------------
registerRoute(
  ({ url }) => /\.(?:onnx|wasm)$/i.test(url.pathname),
  new CacheFirst({
    cacheName: "model-cache",
    plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 31536000 })],
  }),
);

// ---------------------------------------------------------------------------
// Static assets: stale-while-revalidate
// ---------------------------------------------------------------------------
registerRoute(
  ({ request }) =>
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "image" ||
    request.destination === "font",
  new StaleWhileRevalidate({
    cacheName: "static-assets",
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 604800 })],
  }),
);

// ---------------------------------------------------------------------------
// App shell: serve the precached index.html for in-app navigations so the SPA
// boots while offline. Registered last so API/asset routes take precedence.
// ---------------------------------------------------------------------------
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("index.html"), {
    denylist: [/^\/api\//],
  }),
);

// ---------------------------------------------------------------------------
// Push notifications
// ---------------------------------------------------------------------------
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();

    const options = {
      body: data.body || "New notification",
      icon: data.icon || "/icons/icon-192x192.png",
      badge: data.badge || "/icons/badge-72x72.png",
      tag: data.tag || "inteliscrap-notification",
      data: data.data || {},
      actions: data.actions || [],
      requireInteraction: true,
      vibrate: [200, 100, 200],
    };

    event.waitUntil(
      self.registration.showNotification(data.title || "InteliScrap AI", options),
    );
  } catch (error) {
    console.error("Push notification error:", error);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const action = event.action;

  if (action === "accept" && data.pickup_id) {
    event.waitUntil(clients.openWindow(`/pickups?accept=${data.pickup_id}`));
    return;
  }

  if (action === "dismiss") {
    return;
  }

  const url = data.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    }),
  );
});

self.addEventListener("notificationclose", (event) => {
  console.log("Notification closed:", event.notification.tag);
});

// ---------------------------------------------------------------------------
// Background / periodic sync
// ---------------------------------------------------------------------------
self.addEventListener("sync", (event) => {
  if (event.tag === "fetch-offers") {
    event.waitUntil(syncOffers());
  } else if (event.tag === "sync-pickups") {
    event.waitUntil(syncPickups());
  }
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "periodic-offers-check") {
    event.waitUntil(syncOffers());
  }
});

async function syncOffers() {
  try {
    const token = await getAuthTokenFromClient();
    if (!token) return;

    const response = await fetch("/api/v1/pickups/offers", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const offers = await response.json();

      const clients = await self.clients.matchAll({ includeUncontrolled: true });
      clients.forEach((client) => {
        client.postMessage({ type: "OFFERS_SYNCED", offers });
      });

      if (offers.length > 0) {
        const permission = await getNotificationPermission();
        if (permission === "granted") {
          await self.registration.showNotification("New Offers Available", {
            body: `${offers.length} new pickup offer${offers.length > 1 ? "s" : ""} found`,
            icon: "/icons/icon-192x192.png",
            badge: "/icons/badge-72x72.png",
            tag: "offers-synced",
            data: { url: "/pickups" },
          });
        }
      }
    }
  } catch (error) {
    console.error("Offers sync failed:", error);
  }
}

async function syncPickups() {
  try {
    const token = await getAuthTokenFromClient();
    if (!token) return;

    const response = await fetch("/api/v1/pickups/active", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const pickups = await response.json();

      const clients = await self.clients.matchAll({ includeUncontrolled: true });
      clients.forEach((client) => {
        client.postMessage({ type: "PICKUPS_SYNCED", pickups });
      });
    }
  } catch (error) {
    console.error("Pickups sync failed:", error);
  }
}

// ---------------------------------------------------------------------------
// Client messaging
// ---------------------------------------------------------------------------
self.addEventListener("message", (event) => {
  const { type, payload } = event.data || {};

  switch (type) {
    case "SKIP_WAITING":
      self.skipWaiting();
      break;

    case "REGISTER_SYNC":
      if (payload?.tag && "sync" in self.registration) {
        self.registration.sync.register(payload.tag).catch(console.error);
      }
      break;

    case "GET_AUTH_TOKEN":
      event.ports[0].postMessage({ token: getStoredToken() });
      break;
  }
});

function getAuthTokenFromClient() {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => {
      resolve(event.data.token);
    };
    self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
      if (clients.length > 0) {
        clients[0].postMessage({ type: "GET_AUTH_TOKEN" }, [channel.port2]);
      } else {
        resolve(getStoredToken());
      }
    });
  });
}

function getStoredToken() {
  return null;
}

function getNotificationPermission() {
  return new Promise((resolve) => {
    if ("permissions" in navigator) {
      navigator.permissions.query({ name: "notifications" }).then((status) => {
        resolve(status.state);
      });
    } else {
      resolve(Notification.permission);
    }
  });
}
