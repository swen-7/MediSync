import { supabase } from "@/integrations/supabase/client";

/**
 * Web Push subscription helper.
 * - registers /sw.js
 * - asks for Notification permission
 * - subscribes via PushManager
 * - persists endpoint+keys in `push_subscriptions`
 *
 * Background push only works on the published domain (HTTPS).
 */

function urlBase64ToUint8Array(b64: string): Uint8Array {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

function isPreviewHost(): boolean {
  if (typeof window === "undefined") return true;
  const h = window.location.hostname;
  return h.includes("id-preview--") || h.includes("lovableproject.com") || window.self !== window.top;
}

export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;
  if (isPreviewHost()) return null;
  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((e) => {
        console.warn("SW registration failed", e);
        return null;
      });
  }
  return registrationPromise;
}

export async function getVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch("/api/push/vapid");
    if (!res.ok) return null;
    const j = await res.json();
    return typeof j.publicKey === "string" ? j.publicKey : null;
  } catch {
    return null;
  }
}

export async function requestPushPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  return await Notification.requestPermission();
}

export async function subscribeUserToPush(userId: string): Promise<boolean> {
  if (isPreviewHost()) return false;
  const reg = await ensureServiceWorker();
  if (!reg) return false;
  const perm = await requestPushPermission();
  if (perm !== "granted") return false;
  const vapid = await getVapidPublicKey();
  if (!vapid) return false;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid),
    });
  }

  const json = sub.toJSON();
  const p256dh = json.keys?.p256dh ?? arrayBufferToBase64Url(sub.getKey("p256dh") ?? new ArrayBuffer(0));
  const auth = json.keys?.auth ?? arrayBufferToBase64Url(sub.getKey("auth") ?? new ArrayBuffer(0));

  await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent.slice(0, 240),
    },
    { onConflict: "endpoint" },
  );
  return true;
}

/**
 * Best-effort local fallback notification (works while tab is open).
 * Use when background push isn't available (preview/editor) or as immediate UX.
 */
export function showLocalNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/favicon.ico" });
  } catch {
    // Some browsers require a SW for Notification constructor — ignore.
  }
}