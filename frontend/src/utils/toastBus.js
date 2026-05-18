// Bus de eventos simple para emitir toasts in-app desde cualquier parte de la app.
// El componente <ToastContainer/> escucha estos eventos y renderiza los pop-ups.

let listeners = [];
let nextId = 1;
const recentDedupe = new Map();

export function onToast(cb) {
  listeners.push(cb);
  return () => { listeners = listeners.filter(l => l !== cb); };
}

export function emitToast(toast) {
  if (toast.dedupeKey) {
    const last = recentDedupe.get(toast.dedupeKey);
    if (last && Date.now() - last < 15000) return null;
    recentDedupe.set(toast.dedupeKey, Date.now());
  }

  const id = nextId++;
  const payload = { id, ...toast };
  listeners.forEach(cb => {
    try { cb(payload); } catch (_) {}
  });
  return id;
}
