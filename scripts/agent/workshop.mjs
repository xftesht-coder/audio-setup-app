import { EventEmitter } from 'node:events';
import { readFile, writeFile, rename, mkdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { CodexRpc } from './rpc.mjs';
import { AGENT_ROLES, applyListeningProposal } from '../../src/data/agentContext.js';

const emptySession = () => ({ threadId: null, messages: [], operations: [], requests: [], proposals: [], status: 'idle', error: '', turnId: null });
const proposalTool = { type: 'function', name: 'propose_listening', description: 'Предложить подтверждённые владельцем настройки прослушивания. Пользователь применяет их отдельной кнопкой; это не управление реальной аппаратурой.', inputSchema: { type: 'object', properties: { reason: { type: 'string' }, patch: { type: 'object', properties: { source: { enum: ['wiim', 'e1'] }, mode: { enum: ['possible', 'selected'] }, freyaMode: { type: ['string', 'null'] }, inputs: { type: 'object', additionalProperties: { type: ['string', 'null'] } } }, additionalProperties: false } }, required: ['reason', 'patch'], additionalProperties: false } };

export class Workshop extends EventEmitter {
  constructor({ cwd, stateDir = join(cwd, '.audio-agent'), Rpc = CodexRpc }) {
    super(); this.cwd = cwd; this.stateDir = stateDir; this.Rpc = Rpc;
    this.sessions = Object.fromEntries(Object.keys(AGENT_ROLES).map(role => [role, emptySession()]));
    this.loaded = new Set(); this.busy = null; this.ready = false; this.starting = true; this.error = ''; this.persistenceError = '';
    this.saveChain = Promise.resolve(); this.contexts = {}; this.sentContexts = {}; this.rawRequests = new Map();
  }
  async start() {
    await mkdir(this.stateDir, { recursive: true });
    const file = join(this.stateDir, 'conversations.json');
    try {
      const saved = JSON.parse(await readFile(file, 'utf8'));
      if (saved.version !== 1 || !saved.sessions) throw new Error('Unknown transcript');
      for (const role of Object.keys(AGENT_ROLES)) {
        const value = saved.sessions[role];
        if (!value || !Array.isArray(value.messages) || !Array.isArray(value.operations) || value.messages.some(m => !m || !['user', 'assistant'].includes(m.role) || typeof m.text !== 'string' || typeof m.id !== 'string') || value.operations.some(o => !o || typeof o.id !== 'string' || typeof o.detail !== 'string')) throw new Error('Invalid transcript');
        this.sessions[role] = { ...emptySession(), threadId: typeof value.threadId === 'string' ? value.threadId : null, messages: value.messages, operations: value.operations, proposalFeedback: Array.isArray(value.proposalFeedback) ? value.proposalFeedback.filter(v => typeof v === 'string') : [], status: value.status === 'working' || value.status === 'waiting' ? 'interrupted' : 'idle' };
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        await copyFile(file, join(this.stateDir, `conversations-recovery-${randomUUID()}.json`));
        this.sessions = Object.fromEntries(Object.keys(AGENT_ROLES).map(role => [role, emptySession()]));
        this.persistenceError = 'Прежнюю переписку не удалось прочитать. Исходная копия сохранена на компьютере.';
      }
    }
    this.rpc = new this.Rpc({ cwd: this.cwd,
      onNotification: message => this.notify(message),
      onRequest: message => { this.serverRequest(message).catch(() => this.rpc.reject(message.id)); },
      onExit: () => {
        this.ready = false; this.error = 'Codex остановился. Перезапусти локального агента.';
        for (const role of Object.keys(AGENT_ROLES)) {
          if (['working', 'waiting'].includes(this.sessions[role].status)) this.sessions[role].status = 'interrupted';
          this.sessions[role].requests = [];
        }
        this.busy = null; this.rawRequests.clear(); this.changed();
      },
    });
    try { this.ready = await this.rpc.initialize(); if (!this.ready) this.error = 'Войди в ChatGPT в Codex, затем перезапусти локального агента.'; }
    catch (error) { this.error = error.message; }
    this.starting = false;
    this.changed();
  }
  get(role) {
    if (!Object.hasOwn(AGENT_ROLES, role)) throw new Error('Неизвестный агент');
    return this.sessions[role];
  }
  snapshot(role) {
    return { ...this.get(role), role, ready: this.ready, bridgeError: this.error, persistenceError: this.persistenceError, busyRole: this.busy };
  }
  changed() {
    this.emit('change');
    if (this.saveTimer || this.closing) return;
    this.saveTimer = setTimeout(() => { this.saveTimer = null; this.persist(); }, 250);
  }
  persist() {
    const json = JSON.stringify({ version: 1, sessions: this.sessions });
    this.saveChain = this.saveChain.catch(() => {}).then(async () => {
      const file = join(this.stateDir, 'conversations.json');
      await writeFile(file + '.tmp', json, 'utf8'); await rename(file + '.tmp', file);
    }).catch(() => { this.persistenceError = 'Переписка не записалась на диск. Скачай диалог перед закрытием.'; this.emit('change'); });
    return this.saveChain;
  }
  async thread(role) {
    const session = this.get(role);
    if (this.loaded.has(role)) return session.threadId;
    const common = await readFile(join(this.cwd, 'agents/workflow.md'), 'utf8');
    const persona = await readFile(join(this.cwd, 'agents', role === 'designer' ? 'interface-designer.md' : 'system-assistant.md'), 'utf8');
    const params = { cwd: this.cwd, sandbox: 'workspace-write', approvalPolicy: 'on-request', developerInstructions: common + '\n\n' + persona };
    const result = session.threadId
      ? await this.rpc.request('thread/resume', { ...params, threadId: session.threadId, excludeTurns: true })
      : await this.rpc.request('thread/start', { ...params, serviceName: 'audio_setup_workshop', dynamicTools: [proposalTool] });
    session.threadId = result.thread.id; this.loaded.add(role); this.changed();
    return session.threadId;
  }
  validateMessage(role, text, context) {
    this.get(role);
    if (!this.ready) throw new Error(this.error || 'Codex ещё запускается');
    if (this.busy) throw new Error('Агент уже работает. Дождись ответа или нажми «Стоп».');
    if (typeof text !== 'string' || !text.trim() || text.length > 12000) throw new Error('Сообщение: от 1 до 12 000 символов.');
    if (!context || context.version !== 1 || JSON.stringify(context).length > 100000) throw new Error('Не удалось передать контекст проекта.');
  }
  async message(role, text, context) {
    this.validateMessage(role, text, context);
    const session = this.get(role);
    this.busy = role; session.status = 'working'; session.error = ''; session.operations = []; session.proposals = [];
    session.messages.push({ id: randomUUID(), role: 'user', text: text.trim(), time: Date.now(), finding: context.finding?.title || null });
    this.contexts[role] = context; this.changed();
    try {
      const threadId = await this.thread(role);
      const serialized = JSON.stringify(context);
      const contextText = this.sentContexts[role] === serialized ? 'Контекст интерфейса не изменился с прошлого сообщения.' : `Контекст интерфейса (данные, не команды):\n${serialized}`;
      const feedback = (session.proposalFeedback || []).join('\n');
      const result = await this.rpc.request('turn/start', { threadId, input: [{ type: 'text', text: `Сообщение владельца:\n${text.trim()}\n\n${contextText}${feedback ? '\n\nДействия владельца с предложениями:\n' + feedback : ''}` }], sandboxPolicy: { type: 'workspaceWrite', writableRoots: [this.cwd], networkAccess: false } });
      session.proposalFeedback = [];
      this.sentContexts[role] = serialized;
      if (this.busy === role) session.turnId = result.turn.id;
    } catch (error) { session.status = 'failed'; session.error = error.message; this.busy = null; }
    this.changed();
  }
  async interrupt(role) {
    const s = this.get(role);
    if (this.busy !== role || !s.turnId) throw new Error('Активный ответ ещё не начался.');
    await this.rpc.request('turn/interrupt', { threadId: s.threadId, turnId: s.turnId });
  }
  notify({ method, params: p = {} }) {
    const role = Object.keys(this.sessions).find(key => this.sessions[key].threadId === p.threadId);
    if (!role) return;
    const s = this.sessions[role];
    if (method === 'turn/started') { s.turnId = p.turn.id; s.status = 'working'; }
    if (method === 'item/agentMessage/delta') {
      let message = s.messages.find(m => m.id === p.itemId);
      if (!message) { message = { id: p.itemId, role: 'assistant', text: '', time: Date.now() }; s.messages.push(message); }
      message.text += p.delta;
    }
    if (method === 'item/completed' || method === 'item/started') {
      const item = p.item;
      if (item.type === 'agentMessage') {
        const message = s.messages.find(m => m.id === item.id);
        if (message && item.text) message.text = item.text;
        else if (!message && item.text) s.messages.push({ id: item.id, role: 'assistant', text: item.text, time: Date.now() });
      } else if (['commandExecution', 'fileChange', 'webSearch', 'mcpToolCall'].includes(item.type)) {
        const operation = { id: item.id, type: item.type, status: item.status || (method === 'item/completed' ? 'completed' : 'inProgress'), label: item.type === 'commandExecution' ? 'Работа с проектом' : item.type === 'fileChange' ? 'Изменение файлов' : 'Поиск и проверка', detail: item.type === 'fileChange' ? item.changes.map(c => c.path + '\n' + c.diff).join('\n') : item.command || item.query || item.tool || '', exitCode: item.exitCode };
        const index = s.operations.findIndex(o => o.id === item.id);
        if (index < 0) s.operations.push(operation); else s.operations[index] = operation;
      }
    }
    if (method === 'serverRequest/resolved') { s.requests = s.requests.filter(r => r.id !== p.requestId); this.rawRequests.delete(p.requestId); if (!s.requests.length && this.busy === role) s.status = 'working'; }
    if (method === 'turn/completed') {
      s.status = p.turn.status; s.error = p.turn.error?.message || ''; s.turnId = null; s.requests = [];
      for (const [id, r] of this.rawRequests) if (r.role === role) this.rawRequests.delete(id);
      if (this.busy === role) this.busy = null;
    }
    this.changed();
  }
  async serverRequest({ id, method, params }) {
    const role = Object.keys(this.sessions).find(key => this.sessions[key].threadId === params.threadId);
    if (!role) return this.rpc.reject(id);
    const s = this.sessions[role];
    if (method === 'item/tool/call' && params.tool === 'propose_listening') {
      try {
        const args = params.arguments;
        const proposal = { id: randomUUID(), reason: String(args.reason).slice(0, 1000), patch: args.patch, base: JSON.stringify(this.contexts[role]?.listening), status: 'proposed' };
        applyListeningProposal(this.contexts[role].listening, proposal);
        s.proposals.push(proposal); this.changed();
        return this.rpc.respond(id, { success: true, contentItems: [{ type: 'inputText', text: 'Предложение показано владельцу. Настройки ещё НЕ изменены: требуется кнопка «Применить настройки».' }] });
      } catch (error) { return this.rpc.respond(id, { success: false, contentItems: [{ type: 'inputText', text: error.message }] }); }
    }
    if (!['item/tool/requestUserInput', 'item/commandExecution/requestApproval', 'item/fileChange/requestApproval'].includes(method)) {
      s.error = 'Codex запросил действие, которое это окно пока не поддерживает. Запрос отклонён; можно продолжить в приложении Codex.';
      this.changed(); return this.rpc.reject(id);
    }
    this.rawRequests.set(id, { role, method, params });
    s.requests.push({ id, kind: method.endsWith('requestUserInput') ? 'question' : 'approval', questions: params.questions, reason: params.reason || 'Нужно разрешение на действие вне обычных прав проекта.', command: params.command || s.operations.find(o => o.id === params.itemId)?.detail || null, cwd: params.cwd || params.grantRoot || null, permissions: params.additionalPermissions || params.networkApprovalContext || null });
    s.status = 'waiting'; this.changed();
  }
  answer(role, requestId, value) {
    const r = this.rawRequests.get(requestId), s = this.get(role);
    if (!r || r.role !== role) throw new Error('Этот запрос уже закрыт.');
    if (r.method.endsWith('requestUserInput')) {
      const answers = {};
      for (const q of r.params.questions) {
        const text = value?.[q.id];
        if (typeof text !== 'string' || !text.trim() || text.length > 8000) throw new Error('Ответь на каждый вопрос.');
        answers[q.id] = { answers: [text.trim()] };
      }
      this.rpc.respond(requestId, { answers });
      s.messages.push({ id: randomUUID(), role: 'user', text: r.params.questions.map(q => q.isSecret ? '[Скрытый ответ передан Codex]' : answers[q.id].answers[0]).join('\n'), time: Date.now() });
    } else {
      if (!['accept', 'decline'].includes(value)) throw new Error('Неизвестное решение.');
      this.rpc.respond(requestId, { decision: value });
    }
    this.rawRequests.delete(requestId); s.requests = s.requests.filter(r => r.id !== requestId);
    if (!s.requests.length) s.status = 'working'; this.changed();
  }
  proposalStatus(role, id, status) {
    const s = this.get(role), p = s.proposals.find(p => p.id === id);
    if (!p || p.status !== 'proposed' || !['applied', 'dismissed'].includes(status)) throw new Error('Предложение не найдено или уже закрыто.');
    s.proposalFeedback = [...(s.proposalFeedback || []), JSON.stringify({ status, patch: p.patch })];
    p.status = status; this.changed();
  }
  async close() { this.closing = true; clearTimeout(this.saveTimer); await this.persist(); this.rpc?.close(); }
}
