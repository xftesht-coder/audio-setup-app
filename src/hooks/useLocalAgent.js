import { useCallback, useEffect, useState } from 'react';

export const AGENT_URL = 'http://127.0.0.1:5188';
const TOKEN_KEY = 'audio-setup-local-agent-session';
const readToken = () => { try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };
export function useLocalAgent(role) {
  const [token, setToken] = useState(readToken), [session, setSession] = useState(null);
  const [connection, setConnection] = useState(token ? 'connecting' : 'disconnected');
  const [error, setError] = useState('');
  const request = useCallback(async (path, body, auth = token) => {
    const response = await fetch(`${AGENT_URL}/__agent/${path}`, {
      method: body ? 'POST' : 'GET', headers: { ...(auth ? { Authorization: `Bearer ${auth}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(12000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Локальный агент недоступен.');
    return data;
  }, [token]);
  const pair = async code => {
    setError(''); setConnection('connecting');
    try {
      const data = await request('pair', { code: code.trim() }, '');
      try { sessionStorage.setItem(TOKEN_KEY, data.token); } catch { /* Current tab still works. */ }
      setToken(data.token);
    } catch (error) { setConnection('disconnected'); setError(error.message === 'Failed to fetch' ? 'Запусти агента на этом ПК. Если браузер спросит доступ к локальной сети, разреши подключение к своему компьютеру.' : error.message); }
  };
  useEffect(() => {
    setSession(null);
    if (!token) return;
    const controller = new AbortController(); let retry;
    const stream = async () => {
      setConnection('connecting');
      try {
        const response = await fetch(`${AGENT_URL}/__agent/events?role=${role}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
        if (response.status === 401) {
          try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* No storage access. */ }
          setToken(''); setConnection('disconnected'); setError('Агент перезапущен. Введи новый код подключения.'); return;
        }
        if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('Нет соединения с локальным агентом.');
        setConnection('connected'); setError('');
        const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '';
        while (!controller.signal.aborted) {
          const { value, done } = await reader.read();
          if (done) throw new Error('Соединение прервано. Переподключаемся…');
          buffer += decoder.decode(value, { stream: true });
          let boundary;
          while ((boundary = buffer.indexOf('\n\n')) !== -1) {
            const event = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
            if (event.startsWith('data: ')) setSession(JSON.parse(event.slice(6)));
          }
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setConnection('offline'); setError(error.message === 'Failed to fetch' ? 'Нет связи с ПК. Текущий ответ продолжится, если локальный агент ещё работает.' : error.message);
        retry = setTimeout(stream, 3000);
      }
    };
    stream();
    return () => { controller.abort(); clearTimeout(retry); };
  }, [role, token]);
  const action = async (path, body) => {
    setError('');
    try { await request(path, { role, ...body }); return true; }
    catch (error) { setError(error.message); return false; }
  };
  return { session, connection, error, pair, action };
}
