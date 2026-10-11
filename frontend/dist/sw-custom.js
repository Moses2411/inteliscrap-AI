// Custom Service Worker for InteliScrap AI
// Handles push notifications, background sync, and offline caching

const CACHE_NAME = "inteliscrap-v1";
const OFFLINE_URL = "/offline.html";

// Install event - cache critical assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        "/",
        "/offline.html",
        "/manifest.webmanifest",
        "/icons/icon-192x192.png",
        "/icons/icon-512x512.png",
      ]);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first with cache fallback
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Handle API requests with network-first strategy
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Handle static assets with cache-first strategy
  event.respondWith(cacheFirstStrategy(request));
});

// Network-first strategy for API calls
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);

    // Cache successful GET responses
    if (response.ok && request.method === "GET") {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    // Network failed - try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline page for navigation requests
    if (request.mode === "navigate") {
      return caches.match(OFFLINE_URL);
    }

    // Return offline response for API
    return new Response(
      JSON.stringify({ error: "Offline", message: "No cached data available" }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// Cache-first strategy for static assets
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    if (request.mode === "navigate") {
      return caches.match(OFFLINE_URL);
    }
    throw error;
  }
}

// Push event - handle push notifications
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();

    const options: NotificationOptions = {
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
      self.registration.showNotification(data.title || "InteliScrap AI", options)
    );
  } catch (error) {
    console.error("Push notification error:", error);
  }
});

// Notification click event
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const action = event.action;

  // Handle action buttons
  if (action === "accept" && data.pickup_id) {
    event.waitUntil(
      clients.openWindow(`/pickups?accept=${data.pickup_id}`)
    );
    return;
  }

  if (action === "dismiss") {
    return;
  }

  // Default click - open the app
  const url = data.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Notification close event
self.addEventListener("notificationclose", (event) => {
  console.log("Notification closed:", event.notification.tag);
});

// Background sync event
self.addEventListener("sync", (event) => {
  if (event.tag === "fetch-offers") {
    event.waitUntil(syncOffers());
  } else if (event.tag === "sync-pickups") {
    event.waitUntil(syncPickups());
  }
});

// Sync offers when coming back online
async function syncOffers() {
  try {
    // Get auth token from indexedDB or localStorage
    const token = await getAuthToken();
    if (!token) return;

    const response = await fetch("/api/v1/pickups/offers", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const offers = await response.json();

      // Notify all open clients
      const clients = await self.clients.matchAll({ includeUncontrolled: true });
      clients.forEach((client) => {
        client.postMessage({
          type: "OFFERS_SYNCED",
          offers,
        });
      });

      // Show notification if new offers
      if (offers.length > 0) {
        await self.registration.showNotification("New Offers Available", {
          body: `${offers.length} new pickup offer${offers.length > 1 ? "s" : ""} found`,
          icon: "/icons/icon-192x192.png",
          badge: "/icons/badge-72x72.png",
          tag: "offers-synced",
          data: { url: "/pickups" },
        });
      }
    }
  } catch (error) {
    console.error("Offers sync failed:", error);
  }
}

// Sync pickups status
async function syncPickups() {
  try {
    const token = await getAuthToken();
    if (!token) return;

    const response = await fetch("/api/v1/pickups/active", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const pickups = await response.json();

      const clients = await self.clients.matchAll({ includeUncontrolled: true });
      clients.forEach((client) => {
        client.postMessage({
          type: "PICKUPS_SYNCED",
          pickups,
        });
      });
    }
  } catch (error) {
    console.error("Pickups sync failed:", error);
  }
}

// Periodic background sync (if supported)
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "periodic-offers-check") {
    event.waitUntil(syncOffers());
  }
});

// Message event - communicate with clients
self.addEventListener("message", (event) => {
  const { type, payload } = event.data || {};

  switch (type) {
    case "SKIP_WAITING":
      self.skipWaiting();
      break;

    case "REGISTER_SYNC":
      if (payload?.tag) {
        self.registration.sync.register(payload.tag).catch(console.error);
      }
      break;

    case "GET_AUTH_TOKEN":
      // Forward auth token request to main thread
      event.ports[0].postMessage({ token: getStoredToken() });
      break;
  }
});

// Helper: Get auth token from storage
async function getAuthToken(): Promise<string | null> {
  // Try to get from IndexedDB (more reliable in SW context)
  return new Promise((resolve) => {
    const request = indexedDB.open("InteliScrapAuth", 1);
    request.onerror = () => resolve(getStoredToken());
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction("tokens", "readonly");
      const store = transaction.objectStore("tokens");
      const getRequest = store.get("access_token");
      getRequest.onsuccess = () => resolve(getRequest.result || getStoredToken());
      getRequest.onerror = () => resolve(getStoredToken());
    };
    request.onupgradeneeded = () => {
      request.result.createObjectStore("tokens");
    };
  });
}

function getStoredToken(): string | null {
  // Fallback - in practice, token would be passed via message from main thread
  return null;
}

// Handle fetch for offline page
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
  }
});