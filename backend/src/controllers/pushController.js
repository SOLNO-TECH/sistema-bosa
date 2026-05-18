const {
  getVapidPublicKey,
  saveSubscription,
  removeSubscription,
} = require('../services/pushService');

const getPublicKey = (req, res) => {
  try {
    const publicKey = getVapidPublicKey();
    if (!publicKey) return res.status(503).json({ error: 'Push no configurado' });
    res.json({ publicKey });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener clave pública' });
  }
};

const subscribe = (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const { subscription } = req.body || {};
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: 'Suscripción push inválida' });
    }

    saveSubscription(userId, subscription, req.headers['user-agent'] || '');
    res.json({ message: 'Suscripción registrada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar suscripción' });
  }
};

const unsubscribe = (req, res) => {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: 'Endpoint requerido' });
    removeSubscription(endpoint);
    res.json({ message: 'Suscripción eliminada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar suscripción' });
  }
};

module.exports = { getPublicKey, subscribe, unsubscribe };
