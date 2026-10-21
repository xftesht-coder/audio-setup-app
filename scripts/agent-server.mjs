import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { createServer as createViteServer } from 'vite';
import { Workshop } from './agent/workshop.mjs';
import { createAgentServer, BRIDGE_PORT } from './agent/http.mjs';

const cwd = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workshop = new Workshop({ cwd });
const vite = await createViteServer({ root: cwd, server: { middlewareMode: true, host: '127.0.0.1', hmr: false, fs: { strict: true, allow: [cwd], deny: ['.env', '.env.*', '**/.git/**', '**/.audio-agent/**', '**/*.{crt,pem,key}'] } }, appType: 'spa' });
const { server } = createAgentServer({ workshop, middleware: vite.middlewares });
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'Audio Setup Agent уже запущен на порту 5188.' : error.message); vite.close(); workshop.close(); process.exitCode = 1; });
server.listen(BRIDGE_PORT, '127.0.0.1', async () => {
  console.log(`Audio Setup Agent: http://127.0.0.1:${BRIDGE_PORT}/connect`);
  try {
    await workshop.start();
    await writeFile(join(cwd, '.audio-agent', 'connection.json'), JSON.stringify({ pid: process.pid, url: `http://127.0.0.1:${BRIDGE_PORT}/connect` }), { mode: 0o600 });
    console.log(workshop.ready ? 'Codex готов. Открой страницу подключения.' : workshop.error);
  } catch (error) { workshop.error = error.message; workshop.changed(); console.error('Не удалось запустить Codex: ' + error.message); }
});
const stop = async () => { server.closeAllConnections(); server.close(); await workshop.close(); await vite.close(); process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
