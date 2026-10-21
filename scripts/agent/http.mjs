import { createServer } from 'node:http';
import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export const BRIDGE_PORT = 5188;
const secureEqual = (a, b) => typeof a === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export function createAgentServer({ workshop, port = BRIDGE_PORT, middleware, code = String(randomInt(10000000, 100000000)), localOrigins = [] }) {
  const origins = new Set(['https://audio-setup-app.vercel.app', `http://127.0.0.1:${port}`, ...localOrigins]);
  const tokens = new Set(); let failures = []; let pairingUsed = false;
  const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
  const server = createServer(async (req, res) => {
    const origin = req.headers.origin;
    const localOrigin = `http://127.0.0.1:${server.address().port}`;
    const allowedOrigin = origin === localOrigin || origins.has(origin);
    // Exact host + origin checks prevent DNS rebinding and arbitrary websites controlling the runner.
    if (req.headers.host !== new URL(localOrigin).host || (origin && !allowedOrigin)) return json(res, 403, { error: 'Источник не разрешён.' });
    res.setHeader('Vary', 'Origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      if (req.headers['access-control-request-private-network'] === 'true') res.setHeader('Access-Control-Allow-Private-Network', 'true');
    }
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    if (url.pathname === '/connect' && req.method === 'GET') {
      if (origin && origin !== localOrigin) return json(res, 403, { error: 'Открой эту страницу напрямую на своём компьютере.' });
      if (pairingUsed) { code = String(randomInt(10000000, 100000000)); pairingUsed = false; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'" });
      return res.end(`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Audio Setup · подключение агента</title><style>body{font:16px system-ui;color:#28465a;background:#eef2f3;max-width:560px;margin:12vh auto;padding:24px}main{background:white;border:1px solid #d5dfe5;border-radius:16px;padding:30px}code{display:block;font-size:40px;letter-spacing:8px;margin:24px 0}a{color:#305f80}p{line-height:1.6}</style><main><h1>Audio Setup Agent</h1><p>Введи этот одноразовый код в разделе «Проверка системы → Замечания».</p><code>${code}</code><p>Доступ только с этого компьютера. Для подключения другой вкладки открой эту страницу ещё раз — она выдаст новый код. Уже подключённые вкладки продолжат работать.</p><p><a href="https://audio-setup-app.vercel.app/#intelligence">Открыть Audio Setup</a> · <a href="/#intelligence">Локальная версия с живыми правками</a></p></main></html>`);
    }
    if (!url.pathname.startsWith('/__agent/')) return middleware ? middleware(req, res) : json(res, 404, { error: 'Not found' });
    if (url.pathname === '/__agent/health' && req.method === 'GET') return json(res, 200, { service: 'audio-setup-agent', version: 1, state: workshop.starting ? 'starting' : workshop.ready ? 'ready' : 'unavailable' });
    let body;
    try {
      if (req.method === 'POST') {
        if (!origin || !allowedOrigin || !String(req.headers['content-type']).startsWith('application/json')) return json(res, 403, { error: 'Нужен запрос из подключённого интерфейса.' });
        let bytes = 0; const chunks = [];
        for await (const chunk of req) { bytes += chunk.length; if (bytes > 160000) return json(res, 413, { error: 'Слишком большой запрос.' }); chunks.push(chunk); }
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      }
      if (url.pathname === '/__agent/pair' && req.method === 'POST') {
        failures = failures.filter(t => Date.now() - t < 60000);
        if (pairingUsed) return json(res, 409, { error: 'Код уже использован. Открой страницу подключения ещё раз для нового кода.' });
        if (failures.length >= 5) return json(res, 429, { error: 'Слишком много попыток. Подожди минуту.' });
        if (!secureEqual(body?.code, code)) { failures.push(Date.now()); return json(res, 401, { error: 'Неверный код подключения.' }); }
        const token = randomBytes(32).toString('hex'); tokens.add(token); pairingUsed = true;
        return json(res, 200, { token });
      }
      const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
      if (![...tokens].some(t => secureEqual(token, t))) return json(res, 401, { error: 'Подключи этот браузер к локальному агенту.' });
      const role = body?.role || url.searchParams.get('role') || 'system';
      workshop.get(role);
      if (url.pathname === '/__agent/session' && req.method === 'GET') return json(res, 200, workshop.snapshot(role));
      if (url.pathname === '/__agent/events' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
        let timer;
        const send = () => { timer = null; if (!res.destroyed) res.write(`data: ${JSON.stringify(workshop.snapshot(role))}\n\n`); };
        const changed = () => { if (!timer) timer = setTimeout(send, 80); };
        const heartbeat = setInterval(() => { if (!res.destroyed) res.write(': alive\n\n'); }, 15000);
        workshop.on('change', changed); send();
        res.on('close', () => { clearTimeout(timer); clearInterval(heartbeat); workshop.off('change', changed); });
        return;
      }
      if (req.method !== 'POST') return json(res, 404, { error: 'Маршрут не найден.' });
      if (url.pathname === '/__agent/message') {
        // Do not keep the browser's HTTP request open for the inference turn.
        if (workshop.busy) return json(res, 409, { error: 'Агент уже работает. Дождись ответа или останови его.' });
        workshop.validateMessage(role, body.text, body.context);
        const work = workshop.message(role, body.text, body.context);
        work.catch(error => { workshop.get(role).error = error.message; workshop.changed(); });
        return json(res, 202, { accepted: true });
      }
      if (url.pathname === '/__agent/interrupt') await workshop.interrupt(role);
      else if (url.pathname === '/__agent/answer') workshop.answer(role, body.requestId, body.value);
      else if (url.pathname === '/__agent/proposal') workshop.proposalStatus(role, body.id, body.status);
      else return json(res, 404, { error: 'Маршрут не найден.' });
      return json(res, 200, { ok: true });
    } catch (error) { if (!res.headersSent) json(res, 400, { error: error.message || 'Не удалось выполнить действие.' }); else res.end(); }
  });
  server.requestTimeout = 15000;
  return { server, code };
}
