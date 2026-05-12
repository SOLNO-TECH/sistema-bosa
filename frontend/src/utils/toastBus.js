// Bus de eventos simple para emitir toasts in-app desde cualquier parte de la app.
// El componente <ToastContainer/> escucha estos eventos y renderiza los pop-ups.

let listeners = [];
let nextId = 1;

export function onToast(cb) {
  listeners.push(cb);
  return () => { listeners = listeners.filter(l => l !== cb); };
}

export function emitToast(toast) {
  const id = nextId++;
  const payload = { id, ...toast };
  listeners.forEach(cb => {
    try { cb(payload); } catch (_) {}
  });
  return id;
}
