/**
 * Túnel temporal para compartir BOSA fuera de la red local.
 * Usa cloudflared si está instalado; si no, localtunnel (npx, sin cuenta).
 */
import { spawn } from 'child_process';
import net from 'net';
import fs from 'fs';

const PORT = Number(process.env.TUNNEL_PORT || 5173);
const waitForApp = process.argv.includes('--wait');
const useHttp = process.env.TUNNEL === '1' || process.argv.includes('--http');

/** cloudflared en PATH o instalación típica de winget en Windows */
function resolveCloudflaredBin() {
  if (process.env.CLOUDFLARED_BIN && fs.existsSync(process.env.CLOUDFLARED_BIN)) {
    return process.env.CLOUDFLARED_BIN;
  }
  const wingetPath = `${process.env.LOCALAPPDATA || ''}/Microsoft/WinGet/Packages/Cloudflare.cloudflared_Microsoft.Winget.Source_8wekyb3d8bbwe/cloudflared.exe`;
  if (process.platform === 'win32' && wingetPath && fs.existsSync(wingetPath)) {
    return wingetPath;
  }
  return 'cloudflared';
}

function waitForPort(port, timeoutMs = 180000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect({ port, host: '127.0.0.1' }, () => {
        socket.end();
        resolve();
      });
      socket.on('error', () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`El puerto ${port} no respondió. ¿Está corriendo npm run dev?`));
          return;
        }
        setTimeout(attempt, 700);
      });
    };
    attempt();
  });
}

function printBanner(url, via) {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  BOSA — enlace público temporal (túnel)                    ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  ${url.padEnd(56)}║`);
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Vía: ${via.padEnd(51)}║`);
  console.log('║  Cierra esta terminal para cortar el acceso externo.       ║');
  if (via.includes('localtunnel')) {
    console.log('║  Nota: la 1ª visita puede pedir confirmar IP en pantalla.  ║');
  }
  console.log('╚══════════════════════════════════════════════════════════╝\n');
}

function runCloudflared() {
  return new Promise((resolve, reject) => {
    const target = useHttp ? `http://127.0.0.1:${PORT}` : `https://127.0.0.1:${PORT}`;
    const args = ['tunnel', '--url', target];
    if (!useHttp) args.push('--no-tls-verify');

    const bin = resolveCloudflaredBin();
    const child = spawn(bin, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let resolved = false;

    const onData = (chunk) => {
      const text = chunk.toString();
      process.stderr.write(text);
      process.stdout.write(text);
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
      if (match && !resolved) {
        resolved = true;
        printBanner(match[0], 'Cloudflare (trycloudflare.com)');
        resolve(child);
      }
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', reject);
    child.on('exit', (code) => {
      if (!resolved) reject(new Error(`cloudflared terminó (código ${code ?? '?'})`));
    });

    setTimeout(() => {
      if (!resolved) reject(new Error('cloudflared no devolvió URL a tiempo'));
    }, 45000);
  });
}

function runLocaltunnel() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'npx',
      ['--yes', 'localtunnel', '--port', String(PORT)],
      { shell: true, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let resolved = false;

    const onData = (chunk) => {
      const text = chunk.toString();
      process.stdout.write(text);
      const match = text.match(/https:\/\/[^\s]+\.loca\.lt/i) || text.match(/https:\/\/[^\s]+localtunnel[^\s]*/i);
      if (match && !resolved) {
        resolved = true;
        printBanner(match[0].trim(), 'localtunnel (npx)');
        resolve(child);
      }
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', (d) => process.stderr.write(d));
    child.on('error', reject);
    child.on('exit', (code) => {
      if (!resolved) reject(new Error(`localtunnel terminó (código ${code ?? '?'})`));
    });

    setTimeout(() => {
      if (!resolved) reject(new Error('localtunnel no devolvió URL a tiempo'));
    }, 60000);
  });
}

async function main() {
  if (waitForApp) {
    process.stdout.write(`Esperando app en puerto ${PORT}…\n`);
    await waitForPort(PORT);
    process.stdout.write('App lista. Abriendo túnel…\n');
  }

  try {
    await runCloudflared();
    return;
  } catch (err) {
    if (err.code !== 'ENOENT' && !String(err.message).includes('ENOENT')) {
      process.stdout.write(`cloudflared no disponible (${err.message}). Usando localtunnel…\n`);
    } else {
      process.stdout.write('cloudflared no instalado. Usando localtunnel (npx)…\n');
    }
  }

  if (!useHttp) {
    console.error('\n❌ Para localtunnel necesitas HTTP local: npm run dev:share\n');
    process.exit(1);
  }

  await runLocaltunnel();
}

main().catch((err) => {
  console.error('\n❌ No se pudo abrir el túnel:', err.message);
  console.error('\nPrueba:  npm run dev:share');
  console.error('O instala cloudflared:  winget install Cloudflare.cloudflared');
  process.exit(1);
});
