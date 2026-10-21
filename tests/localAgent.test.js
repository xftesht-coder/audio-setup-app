import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { request as httpRequest } from 'node:http';
import { Workshop } from '../scripts/agent/workshop.mjs';
import { createAgentServer } from '../scripts/agent/http.mjs';
import { applyListeningProposal } from '../src/data/agentContext.js';
import { defaultListening } from '../src/data/roomListening.js';

class FakeRpc {
  constructor(options) { this.options = options; this.calls = []; this.responses = []; this.threadCount = 0; }
  async initialize() { return true; }
  async request(method, params) {
    this.calls.push({ method, params });
    if (method === 'thread/start') return { thread: { id: `thread-${++this.threadCount}` } };
    if (method === 'thread/resume') return { thread: { id: params.threadId } };
    if (method === 'turn/start') return { turn: { id: `turn-${this.calls.length}` } };
    if (method === 'turn/interrupt') this.options.onNotification({ method: 'turn/completed', params: { threadId: params.threadId, turn: { status: 'interrupted' } } });
    return {};
  }
  respond(id, result) { this.responses.push({ id, result }); }
  reject(id) { this.responses.push({ id, rejected: true }); }
  close() {}
}
const context = () => ({ version: 1, listening: defaultListening(), finding: null });
async function fixture(t) {
  const stateDir = await mkdtemp(join(tmpdir(), 'audio-agent-test-'));
  const workshop = new Workshop({ cwd: resolve('.'), stateDir, Rpc: FakeRpc });
  await workshop.start();
  t.after(async () => { await workshop.close(); await rm(stateDir, { recursive: true, force: true }); });
  return workshop;
}
function complete(workshop, role = 'system') { workshop.notify({ method: 'turn/completed', params: { threadId: workshop.get(role).threadId, turn: { status: 'completed' } } }); }

test('local agent scopes Codex to the repository, separates roles and blocks concurrent edits', async t => {
  const w = await fixture(t);
  await w.message('system', 'Разберём замечание', context());
  assert.equal(w.snapshot('designer').busyRole, 'system');
  await assert.rejects(w.message('designer', 'Изменить интерфейс', context()), /уже работает/);
  const thread = w.rpc.calls.find(c => c.method === 'thread/start').params;
  assert.equal(thread.sandbox, 'workspace-write'); assert.equal(thread.approvalPolicy, 'on-request');
  assert.equal(thread.cwd, resolve('.')); assert.ok(!Object.hasOwn(thread, 'model'));
  assert.equal(thread.dynamicTools[0].name, 'propose_listening');
  assert.deepEqual(w.rpc.calls.find(c => c.method === 'turn/start').params.sandboxPolicy, { type: 'workspaceWrite', writableRoots: [resolve('.')], networkAccess: false });
  complete(w); await w.message('designer', 'Проверить компактность', context());
  assert.notEqual(w.get('designer').threadId, w.get('system').threadId);
  assert.equal(w.get('system').messages.length, 1);
  assert.match(w.rpc.calls.filter(c => c.method === 'thread/start')[1].params.developerInstructions, /дизайнер интерфейса/);
  await w.interrupt('designer'); assert.equal(w.busy, null); assert.equal(w.get('designer').status, 'interrupted');
});

test('streaming messages settle once and repeated context is not sent again', async t => {
  const w = await fixture(t); const ctx = context(); await w.message('system', 'Привет', ctx);
  const p = { threadId: w.get('system').threadId, itemId: 'm1' };
  w.notify({ method: 'item/agentMessage/delta', params: { ...p, delta: 'Чем ' } });
  w.notify({ method: 'item/agentMessage/delta', params: { ...p, delta: 'помочь?' } });
  w.notify({ method: 'item/completed', params: { ...p, item: { type: 'agentMessage', id: 'm1', text: 'Чем помочь?' } } });
  assert.equal(w.get('system').messages.filter(m => m.id === 'm1').length, 1);
  assert.equal(w.get('system').messages[1].text, 'Чем помочь?');
  complete(w); await w.message('system', 'Продолжай', ctx);
  const sent = w.rpc.calls.filter(c => c.method === 'turn/start').at(-1).params.input[0].text;
  assert.match(sent, /Контекст интерфейса не изменился/); assert.ok(!sent.includes('"listening"'));
});

test('questions and approvals are explicit, role-scoped and answered only once', async t => {
  const w = await fixture(t); await w.message('system', 'Вопрос', context());
  const params = { threadId: w.get('system').threadId, questions: [{ id: 'input', question: 'Какой вход?' }, { id: 'secret', question: 'Скрытый ответ?', isSecret: true }] };
  await w.serverRequest({ id: 11, method: 'item/tool/requestUserInput', params });
  assert.equal(w.get('system').status, 'waiting');
  assert.throws(() => w.answer('designer', 11, {}), /закрыт/);
  assert.throws(() => w.answer('system', 11, { input: 'Оптика' }), /каждый/);
  w.answer('system', 11, { input: 'Оптика', secret: 'private-example' });
  assert.equal(w.rpc.responses[0].result.answers.input.answers[0], 'Оптика');
  assert.ok(!w.get('system').messages.at(-1).text.includes('private-example'));
  assert.throws(() => w.answer('system', 11, {}), /закрыт/);
  await w.serverRequest({ id: 12, method: 'item/commandExecution/requestApproval', params: { threadId: params.threadId, command: 'example', reason: 'Сеть' } });
  assert.equal(w.rpc.responses.length, 1);
  w.answer('system', 12, 'decline'); assert.deepEqual(w.rpc.responses.at(-1).result, { decision: 'decline' });
  await w.serverRequest({ id: 13, method: 'item/permissions/requestApproval', params });
  assert.equal(w.rpc.responses.at(-1).rejected, true);
});

test('settings proposals never silently mutate the browser and stale or invalid proposals fail', async t => {
  const w = await fixture(t), ctx = context(); await w.message('system', 'Слушаю винил', ctx);
  await w.serverRequest({ id: 1, method: 'item/tool/call', params: { threadId: w.get('system').threadId, tool: 'propose_listening', arguments: { reason: 'Ответ владельца', patch: { source: 'e1' } } } });
  const proposal = w.get('system').proposals[0];
  assert.equal(proposal.status, 'proposed'); assert.equal(ctx.listening.source, 'wiim');
  assert.equal(applyListeningProposal(ctx.listening, proposal).source, 'e1');
  assert.throws(() => applyListeningProposal({ ...ctx.listening, mode: 'selected' }, proposal), /уже изменились/);
  assert.throws(() => applyListeningProposal(ctx.listening, { ...proposal, patch: { inputs: { freya: 'wiim.optical' } } }), /не принадлежит/);
  assert.throws(() => applyListeningProposal(ctx.listening, { ...proposal, patch: { unsafe: 'x' } }), /Некорректное/);
  w.proposalStatus('system', proposal.id, 'dismissed');
  assert.throws(() => w.proposalStatus('system', proposal.id, 'applied'), /закрыто/);
  complete(w); await w.message('system', 'Продолжаем', ctx);
  assert.match(w.rpc.calls.filter(c => c.method === 'turn/start').at(-1).params.input[0].text, /"status":"dismissed"/);
});

test('restart restores separate transcripts and resumes the existing Codex thread', async t => {
  const w = await fixture(t); await w.message('designer', 'Сделай компактнее', context());
  assert.equal(w.get('designer').status, 'working', w.get('designer').error);
  await w.persist();
  const restored = new Workshop({ cwd: w.cwd, stateDir: w.stateDir, Rpc: FakeRpc }); await restored.start();
  t.after(() => restored.close());
  assert.equal(restored.get('designer').status, 'interrupted');
  assert.equal(restored.get('designer').messages[0].text, 'Сделай компактнее');
  await restored.message('designer', 'Продолжай', context());
  assert.ok(restored.rpc.calls.some(c => c.method === 'thread/resume'));
  assert.ok(!restored.rpc.calls.some(c => c.method === 'thread/start'));
  await restored.close();
});

test('corrupt transcript is preserved before starting fresh', async t => {
  const w = await fixture(t); await w.close();
  const bad = '{"version":1,"sessions":{"system":{"messages":[{}],"operations":[]}}}';
  await writeFile(join(w.stateDir, 'conversations.json'), bad);
  const restored = new Workshop({ cwd: w.cwd, stateDir: w.stateDir, Rpc: FakeRpc }); await restored.start();
  const backup = (await readdir(w.stateDir)).find(f => f.startsWith('conversations-recovery-'));
  assert.equal(await readFile(join(w.stateDir, backup), 'utf8'), bad);
  assert.equal(restored.get('system').messages.length, 0); assert.match(restored.persistenceError, /копия сохранена/);
  await restored.close();
});

async function httpFixture(t) {
  const workshop = await fixture(t);
  const { server } = createAgentServer({ workshop, port: 0, code: '12345678' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const url = `http://127.0.0.1:${server.address().port}`;
  const post = (path, data, token = '') => fetch(`${url}/__agent/${path}`, { method: 'POST', headers: { Origin: url, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(data) });
  return { workshop, server, url, post };
}
test('HTTP rejects untrusted origins, DNS rebinding, unpaired clients and duplicate pairing', async t => {
  const { url, post } = await httpFixture(t);
  assert.equal((await (await fetch(url + '/__agent/health')).json()).state, 'ready');
  assert.equal((await fetch(url + '/__agent/health', { headers: { Origin: 'https://attacker.invalid' } })).status, 403);
  const reboundStatus = await new Promise((resolve, reject) => {
    httpRequest(url + '/__agent/health', { headers: { Host: 'attacker.invalid' } }, response => { response.resume(); resolve(response.statusCode); }).on('error', reject).end();
  });
  assert.equal(reboundStatus, 403);
  assert.equal((await fetch(url + '/__agent/session')).status, 401);
  assert.equal((await fetch(url + '/connect', { headers: { Origin: 'https://audio-setup-app.vercel.app' } })).status, 403);
  assert.equal((await fetch(url + '/connect', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 200);
  assert.equal((await post('pair', { code: 'éééééééé' })).status, 401);
  const paired = await (await post('pair', { code: '12345678' })).json();
  assert.equal(paired.token.length, 64);
  assert.equal((await post('pair', { code: '12345678' })).status, 409);
  assert.equal((await fetch(url + '/__agent/session', { headers: { Authorization: `Bearer ${paired.token}` } })).status, 200);
  assert.equal((await fetch(url + '/__agent/session?role=__proto__', { headers: { Authorization: `Bearer ${paired.token}` } })).status, 400);
  const nextPage = await (await fetch(url + '/connect')).text();
  const nextCode = nextPage.match(/<code>(\d{8})<\/code>/)[1];
  assert.equal((await post('pair', { code: nextCode })).status, 200);
  assert.equal((await fetch(url + '/__agent/session', { headers: { Authorization: `Bearer ${paired.token}` } })).status, 200);
});

test('HTTP enforces message validation and one active task; SSE returns the actual transcript', async t => {
  const { workshop, url, post } = await httpFixture(t);
  const { token } = await (await post('pair', { code: '12345678' })).json();
  assert.equal((await post('message', { role: 'designer', text: '', context: context() }, token)).status, 400);
  assert.equal(workshop.get('designer').messages.length, 0);
  assert.equal((await post('message', { role: 'designer', text: 'Компактный экран', context: context() }, token)).status, 202);
  assert.equal((await post('message', { role: 'system', text: 'Второй запрос', context: context() }, token)).status, 409);
  const controller = new AbortController();
  const response = await fetch(url + '/__agent/events?role=designer', { signal: controller.signal, headers: { Authorization: `Bearer ${token}` } });
  assert.match(response.headers.get('content-type'), /event-stream/);
  const reader = response.body.getReader();
  const event = new TextDecoder().decode((await reader.read()).value);
  assert.equal(JSON.parse(event.slice(6).trim()).messages[0].text, 'Компактный экран');
  controller.abort();
  await assert.rejects(reader.read());
});

test('HTTP pairing attempts are rate limited and oversized requests are rejected', async t => {
  const { post } = await httpFixture(t);
  for (let i = 0; i < 5; i++) assert.equal((await post('pair', { code: '00000000' })).status, 401);
  assert.equal((await post('pair', { code: '12345678' })).status, 429);
  assert.equal((await post('pair', { code: 'x'.repeat(160001) })).status, 413);
});

test('a stopped Codex child is reflected in health without losing its transcript', async t => {
  const { workshop, url } = await httpFixture(t);
  await workshop.message('system', 'Сохранить вопрос', context());
  workshop.rpc.options.onExit(new Error('test child exit'));
  const health = await (await fetch(url + '/__agent/health')).json();
  assert.equal(health.state, 'unavailable'); assert.equal(workshop.busy, null);
  assert.equal(workshop.get('system').status, 'interrupted');
  assert.equal(workshop.get('system').messages[0].text, 'Сохранить вопрос');
});
