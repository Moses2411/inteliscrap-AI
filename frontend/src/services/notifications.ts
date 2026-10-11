import { authHeaders, getRole } from "./auth";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "";

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Convert base64 string to Uint8Array for VAPID key
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/**
 * Check if notifications permission is granted
 */
export function getNotificationPermission(): NotificationPermission {
  if (!("Notification" in window)) return "denied";
  return Notification.permission;
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  return Notification.requestPermission();
}

/**
 * Register service worker and set up push notifications
 */
export async function registerPushNotifications(): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    console.warn("Push notifications not supported");
    return null;
  }

  try {
    // Register service worker
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });

    console.log("Service Worker registered:", registration.scope);

    // Wait for service worker to be ready
    await navigator.serviceWorker.ready;

    // Check existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      console.log("Existing push subscription found");
      await sendSubscriptionToServer(subscription);
      return subscription;
    }

    // Request permission
    const permission = await requestNotificationPermission();
    if (permission !== "granted") {
      console.log("Notification permission denied");
      return null;
    }

    // Subscribe to push
    if (!VAPID_PUBLIC_KEY) {
      console.warn("VAPID public key not configured");
      return null;
    }

    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as BufferSource,
    });

    console.log("New push subscription created");
    await sendSubscriptionToServer(subscription);

    return subscription;
  } catch (error) {
    console.error("Push notification registration failed:", error);
    return null;
  }
}

/**
 * Send push subscription to backend
 */
async function sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
  try {
    const subscriptionData: PushSubscriptionData = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: arrayBufferToBase64(subscription.getKey("p256dh")!),
        auth: arrayBufferToBase64(subscription.getKey("auth")!),
      },
    };

    await fetch(`${API_BASE}/api/v1/notifications/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(subscriptionData),
    });
  } catch (error) {
    console.error("Failed to send subscription to server:", error);
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unregisterPushNotifications(): Promise<void> {
  if (!isPushSupported()) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      console.log("Push subscription removed");

      // Notify backend
      await fetch(`${API_BASE}/api/v1/notifications/unsubscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
    }
  } catch (error) {
    console.error("Push unsubscription failed:", error);
  }
}

/**
 * Show local notification (works when app is open)
 */
export function showLocalNotification(payload: NotificationPayload): void {
  if (!("Notification" in window)) return;

  const permission = Notification.permission;
  if (permission !== "granted") return;

  // Check user preference
  if (localStorage.getItem("is_notify") === "0") return;

  try {
    const options: NotificationOptions = {
      body: payload.body,
      icon: payload.icon ?? "/icons/icon-192x192.png",
      badge: payload.badge ?? "/icons/badge-72x72.png",
      tag: payload.tag,
      data: payload.data,
      requireInteraction: true,
    };

    const notification = new Notification(payload.title, options);

    notification.onclick = () => {
      window.focus();
      if (payload.data?.url) {
        window.location.href = payload.data.url as string;
      }
      notification.close();
    };

    // Auto-close after 10 seconds
    setTimeout(() => notification.close(), 10000);
  } catch (error) {
    console.error("Local notification failed:", error);
  }
}

/**
 * Show notification for new pickup offer
 */
export function notifyNewOffer(offer: {
  pickup_id: string;
  material_name: string;
  estimated_weight_kg?: number;
  estimated_value_naira?: number;
  distance_m?: number;
}): void {
  const weight = offer.estimated_weight_kg ? ` ${offer.estimated_weight_kg}kg` : "";
  const distance = offer.distance_m
    ? offer.distance_m < 1000
      ? ` ${Math.round(offer.distance_m)}m`
      : ` ${(offer.distance_m / 1000).toFixed(1)}km`
    : "";
  const value = offer.estimated_value_naira ? ` ₦${offer.estimated_value_naira.toLocaleString()}` : "";

  showLocalNotification({
    title: "🆕 New Pickup Offer",
    body: `${offer.material_name}${weight}${value} — ${distance} away`,
    tag: `offer-${offer.pickup_id}`,
    data: { url: `/pickups`, pickup_id: offer.pickup_id },
  });
}

/**
 * Show notification for pickup status update
 */
export function notifyPickupUpdate(pickup: {
  pickup_id: string;
  status: string;
  material_name: string;
}): void {
  const statusMessages: Record<string, string> = {
    accepted: "✅ Offer accepted",
    en_route: "🚛 Collector en route",
    arrived: "📍 Collector arrived",
    verified: "✅ Pickup verified",
    completed: "🎉 Pickup completed",
    cancelled: "❌ Pickup cancelled",
  };

  showLocalNotification({
    title: statusMessages[pickup.status] ?? "Pickup Update",
    body: pickup.material_name,
    tag: `pickup-${pickup.pickup_id}-${pickup.status}`,
    data: { url: `/pickups`, pickup_id: pickup.pickup_id },
  });
}

/**
 * Register background sync for fetching offers when online
 */
export async function registerOffersSync(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("sync" in window.ServiceWorkerRegistration.prototype)) {
    console.log("Background sync not supported");
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await (registration as any).sync.register("fetch-offers");
    console.log("Background sync registered for offers");
  } catch (error) {
    console.error("Background sync registration failed:", error);
  }
}

/**
 * Helper: ArrayBuffer to base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Initialize notifications for collector role
 */
export async function initCollectorNotifications(): Promise<void> {
  const role = getRole();
  if (role !== "collector") return;

  const permission = getNotificationPermission();
  if (permission === "granted" && localStorage.getItem("is_notify") !== "0") {
    await registerPushNotifications();
    await registerOffersSync();
  }
}

/**
 * Handle notification permission change
 */
export function onNotificationPermissionChange(callback: (permission: NotificationPermission) => void): () => void {
  if (!("Notification" in window)) return () => {};

  const handleChange = () => callback(Notification.permission);

  if ("permissions" in navigator) {
    navigator.permissions.query({ name: "notifications" as PermissionName }).then((permissionStatus) => {
      permissionStatus.onchange = handleChange;
    });
  }

  return () => {
    // Cleanup would go here if we had a direct reference
  };
}