import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

export class CodexRpc {
  constructor({ cwd, command = process.env.AUDIO_CODEX_BIN || 'codex', onNotification, onRequest, onExit }) {
    this.pending = new Map(); this.nextId = 1; this.closed = false;
    this.child = spawn(command, ['app-server', '--listen', 'stdio://'], { cwd, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    // Stderr can contain provider diagnostics. It stays local and is not relayed to the site.
    this.child.stderr.on('data', () => {});
    const lines = createInterface({ input: this.child.stdout });
    lines.on('line', line => {
      let message;
      try { message = JSON.parse(line); } catch { return; }
      if (message.method) {
        if (Object.hasOwn(message, 'id')) onRequest?.(message);
        else onNotification?.(message);
      } else {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        clearTimeout(pending.timer); this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message || 'Codex RPC error'));
        else pending.resolve(message.result);
      }
    });
    const fail = error => {
      if (this.closed) return;
      this.closed = true;
      for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(error); }
      this.pending.clear(); onExit?.(error);
    };
    this.child.on('error', fail);
    this.child.on('exit', () => fail(new Error('Локальный процесс Codex остановился. Перезапусти Audio Setup Agent.')));
    this.child.stdin.on('error', fail);
  }
  send(message) {
    if (this.closed) throw new Error('Codex остановлен');
    this.child.stdin.write(JSON.stringify(message) + '\n');
  }
  request(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Codex не ответил: ${method}`)); }, 90000);
      this.pending.set(id, { resolve, reject, timer });
      try { this.send({ id, method, params }); }
      catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
  }
  respond(id, result) { this.send({ id, result }); }
  reject(id, message = 'Этот запрос не поддерживается локальным окном.') { this.send({ id, error: { code: -32601, message } }); }
  async initialize() {
    await this.request('initialize', { clientInfo: { name: 'audio_setup_workshop', title: 'Audio Setup Workshop', version: '0.6.0' }, capabilities: { experimentalApi: true } });
    this.send({ method: 'initialized', params: {} });
    const result = await this.request('account/read', { refreshToken: false });
    return Boolean(result.account);
  }
  close() { this.child.stdin.end(); this.child.kill(); }
}
