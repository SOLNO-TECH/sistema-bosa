const os = require('os');

/** IPv4 de interfaces activas (Wi‑Fi/Ethernet), sin loopback. */
function getLanIPv4Addresses() {
  const addrs = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addrs.push({ name, address: iface.address });
      }
    }
  }
  return addrs;
}

module.exports = { getLanIPv4Addresses };
