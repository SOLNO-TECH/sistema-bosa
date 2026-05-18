import axios from 'axios';
import { requestPermission, isEnabled, setEnabled, getPermission } from './pushNotify';

const SUB_KEY = 'bosa_push_subscribed';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSubscribed() {
  return localStorage.getItem(SUB_KEY) === '1';
}

export function canUseWebPush() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    window.isSecureContext
  );
}

/**
 * Registra el service worker y la suscripción en el servidor.
 * Necesario para notificaciones en pantalla de bloqueo con la app cerrada.
 */
export async function registerPushSubscription() {
  if (!canUseWebPush()) return false;
  if (!isEnabled() && getPermission() === 'denied') return false;

  const permission = await requestPermission();
  if (permission !== 'granted') return false;

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;

    const { data } = await axios.get('/api/push/vapid-public-key');
    if (!data?.publicKey) return false;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });
    }

    await axios.post('/api/push/subscribe', { subscription: sub.toJSON() });
    localStorage.setItem(SUB_KEY, '1');
    setEnabled(true);
    return true;
  } catch (err) {
    console.warn('registerPushSubscription:', err);
    localStorage.removeItem(SUB_KEY);
    return false;
  }
}

export async function unregisterPushSubscription() {
  if (!canUseWebPush()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = reg && (await reg.pushManager.getSubscription());
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      try {
        await axios.post('/api/push/unsubscribe', { endpoint });
      } catch (_) { /* noop */ }
    }
  } catch (err) {
    console.warn('unregisterPushSubscription:', err);
  }
  localStorage.removeItem(SUB_KEY);
  setEnabled(false);
}
