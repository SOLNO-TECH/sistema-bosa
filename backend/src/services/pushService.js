const webpush = require('web-push');
const fs = require('fs');
const path = require('path');
const { getDb } = require('../database/init');

const VAPID_FILE = path.join(__dirname, '../../data/vapid.json');

let vapidPublicKey = null;

function loadOrCreateVapidKeys() {
  let pub = process.env.VAPID_PUBLIC_KEY;
  let priv = process.env.VAPID_PRIVATE_KEY;

  if ((!pub || !priv) && fs.existsSync(VAPID_FILE)) {
    try {
      const stored = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8'));
      pub = stored.publicKey;
      priv = stored.privateKey;
    } catch (_) { /* ignore */ }
  }

  if (!pub || !priv) {
    const keys = webpush.generateVAPIDKeys();
    pub = keys.publicKey;
    priv = keys.privateKey;
    try {
      const dir = path.dirname(VAPID_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(VAPID_FILE, JSON.stringify({ publicKey: pub, privateKey: priv }, null, 2));
      console.log('[PUSH] Claves VAPID generadas en data/vapid.json (guárdalas también en .env en producción).');
    } catch (err) {
      console.warn('[PUSH] No se pudo guardar vapid.json:', err.message);
    }
  }

  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@bosa.mx';
  webpush.setVapidDetails(subject, pub, priv);
  vapidPublicKey = pub;
  return pub;
}

function getVapidPublicKey() {
  if (!vapidPublicKey) loadOrCreateVapidKeys();
  return vapidPublicKey;
}

function initPushService() {
  try {
    loadOrCreateVapidKeys();
    console.log('[PUSH] Web Push listo (pantalla de bloqueo / PWA).');
  } catch (err) {
    console.warn('[PUSH] Web Push no disponible:', err.message);
  }
}

function saveSubscription(userId, subscription, userAgent = '') {
  if (!userId || !subscription?.endpoint || !subscription?.keys) return false;
  const db = getDb();
  db.prepare(`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      user_id = excluded.user_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      user_agent = excluded.user_agent
  `).run(
    userId,
    subscription.endpoint,
    subscription.keys.p256dh,
    subscription.keys.auth,
    userAgent.slice(0, 500)
  );
  return true;
}

function removeSubscription(endpoint) {
  if (!endpoint) return;
  const db = getDb();
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
}

function removeSubscriptionsForUser(userId) {
  const db = getDb();
  db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').run(userId);
}

/**
 * Envía Web Push a todos los dispositivos del usuario (funciona con app cerrada / bloqueo).
 */
async function sendPushToUser(userId, { title, message, type = 'system', module = null, related_id = null, link_id = null, notificationId = null }) {
  if (!userId || !title) return 0;
  if (!vapidPublicKey) {
    try { loadOrCreateVapidKeys(); } catch (_) { return 0; }
  }

  const db = getDb();
  const subs = db.prepare('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?').all(userId);
  if (!subs.length) return 0;

  const payload = JSON.stringify({
    title,
    body: message || '',
    icon: '/logo.png',
    badge: '/logo.png',
    tag: notificationId ? `srv-${notificationId}` : `bosa-${type}-${Date.now()}`,
    data: {
      url: '/',
      module,
      related_id,
      link_id: link_id ?? related_id,
      type,
      notificationId,
    },
  });

  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      );
      sent += 1;
    } catch (err) {
      const code = err.statusCode || err.status;
      if (code === 404 || code === 410) {
        db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
      } else {
        console.warn('[PUSH] fallo envío:', code, err.message);
      }
    }
  }
  return sent;
}

module.exports = {
  initPushService,
  getVapidPublicKey,
  saveSubscription,
  removeSubscription,
  removeSubscriptionsForUser,
  sendPushToUser,
};
