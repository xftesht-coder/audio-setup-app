import { useEffect, useMemo, useRef, useState } from 'react';
import { AGENT_ROLES, agentContext, applyListeningProposal } from '../data/agentContext';
import { AGENT_URL, useLocalAgent } from '../hooks/useLocalAgent';
import { useWorkshopStore } from '../stores/useWorkshopStore';
import { useRoomWiring } from '../store/roomWiringStore';
import { downloadJson } from '../data/roomBackup';
import '../agentWorkspace.css';

const levels = { issue: 'Исправить', attention: 'Проверить', unknown: 'Уточнить' };
const statusLabels = { idle: 'Готов к диалогу', working: 'Работает…', waiting: 'Ждёт твой ответ', completed: 'Ответ готов', failed: 'Не удалось завершить', interrupted: 'Остановлен' };
function PendingRequest({ request, onAnswer }) {
  const [answers, setAnswers] = useState({}), [sending, setSending] = useState(false);
  const send = async value => { setSending(true); await onAnswer(value); setSending(false); };
  if (request.kind === 'approval') return <div className="agent-request"><b>Нужно разрешение</b><p>{request.reason}</p>{request.command && <pre>{request.command}</pre>}{request.permissions && <pre>{JSON.stringify(request.permissions, null, 2)}</pre>}{request.cwd && <small>{request.cwd}</small>}<div><button disabled={sending} onClick={() => send('accept')}>Разрешить это действие</button><button disabled={sending} onClick={() => send('decline')}>Отклонить</button></div></div>;
  return <form className="agent-request" onSubmit={e => { e.preventDefault(); send(answers); }}>{request.questions.map(q => <fieldset key={q.id}><legend>{q.question}</legend>{q.options?.map(o => <button key={o.label} type="button" aria-pressed={answers[q.id] === o.label} onClick={() => setAnswers(a => ({ ...a, [q.id]: o.label }))}>{o.label}</button>)}<input aria-label={q.question} required maxLength={8000} type={q.isSecret ? 'password' : 'text'} value={answers[q.id] || ''} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} placeholder="Твой ответ" /></fieldset>)}<button disabled={sending} type="submit">Ответить</button></form>;
}

export default function AgentWorkspace({ report }) {
  const [role, setRole] = useState(() => new URLSearchParams(window.location.search).get('agent') === 'designer' ? 'designer' : 'system'), [selected, setSelected] = useState(null), [listOpen, setListOpen] = useState(false);
  const [draft, setDraft] = useState(''), [code, setCode] = useState(''), [sending, setSending] = useState(false), [notice, setNotice] = useState('');
  const project = useWorkshopStore(s => s.project), wiring = useRoomWiring();
  const { session, connection, error, pair, action } = useLocalAgent(role);
  const finding = report.findings.find(f => f.id === selected);
  const context = useMemo(() => agentContext(report, wiring, project, finding), [report, wiring, project, finding]);
  const log = useRef(), sticky = useRef(true);
  useEffect(() => { if (log.current && sticky.current) log.current.scrollTop = log.current.scrollHeight; }, [session, finding]);
  const busy = Boolean(session?.busyRole), connected = connection === 'connected' && session?.ready;
  const send = async text => {
    if (!text.trim() || sending || busy) return;
    setSending(true); setNotice(''); sticky.current = true;
    if (await action('message', { text, context })) setDraft('');
    setSending(false);
  };
  const choose = id => { setSelected(id); setListOpen(false); setNotice(''); };
  const apply = async proposal => {
    try {
      const next = applyListeningProposal(useRoomWiring.getState().listening, proposal);
      useRoomWiring.getState().setListening(next);
      await action('proposal', { id: proposal.id, status: 'applied' });
      setNotice('Настройки применены. Проверка пересчитана; действие можно отменить сверху.');
    } catch (error) { setNotice(error.message); }
  };
  return <div className="agent-workspace" data-list-open={listOpen}>
    <aside className="agent-findings" aria-label="Замечания для обсуждения"><header><b>Замечания · {report.findings.length}</b><button className="agent-list-toggle" onClick={() => setListOpen(false)}>К диалогу →</button></header><button className={!selected ? 'is-selected' : ''} onClick={() => choose(null)}><span>＋</span><b>Новая задача</b><small>Идея, баг или улучшение</small></button>{report.findings.map(f => <button key={f.id} className={selected === f.id ? 'is-selected' : ''} onClick={() => choose(f.id)}><span className={`agent-level-${f.level}`}>{levels[f.level]}</span><b>{f.title}</b></button>)}{!report.findings.length && <p>Замечаний нет. Можно обсудить новые улучшения.</p>}</aside>
    <section className="agent-chat" aria-label="Диалог с локальным Codex">
      <header className="agent-heading"><div><span className="agent-avatar" aria-hidden="true">✦</span><div><h2>Мастерская с Codex</h2><p><i className={connected ? 'is-online' : ''}/>{connected ? statusLabels[session.status] || 'Подключён' : connection === 'connecting' ? 'Подключаемся…' : 'На твоём компьютере'}</p></div></div><div className="agent-role-switch" role="group" aria-label="Специализация агента">{Object.entries(AGENT_ROLES).map(([id, name]) => <button key={id} aria-pressed={role === id} onClick={() => { setRole(id); setNotice(''); }}>{name}</button>)}</div><button className="agent-list-toggle" onClick={() => setListOpen(!listOpen)}>{listOpen ? 'К диалогу' : 'Замечания'}</button></header>
      <div className="agent-context"><b>{finding ? finding.title : selected ? 'Замечание исчезло из текущей проверки' : role === 'designer' ? 'Интерфейс, который удобно использовать' : 'Новая задача по Audio Setup'}</b>{finding && <details><summary>Основание замечания</summary><p>{finding.evidence}</p><p>{finding.next}</p></details>}<small>В сообщение входят выбранное замечание, текущие подключения и проект стойки.</small></div>
      <div className="agent-log" ref={log} role="log" aria-label="Переписка" aria-live="polite" onScroll={() => { const el = log.current; sticky.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
        {!connected && !session?.messages.length && <div className="agent-welcome"><span aria-hidden="true">✦</span><h3>{role === 'designer' ? 'Твой дизайнер интерфейса' : 'Разберём замечания вместе'}</h3><p>{role === 'designer' ? 'Опиши, что неудобно или как хочется изменить экран. Дизайнер изучит компоненты, сделает правки и проверит результат.' : 'Выбери замечание слева. Codex уточнит данные, поможет с настройками и сможет исправить код приложения.'}</p><ol><li>Запусти «Запустить агента.cmd» в папке проекта.</li><li><a href={`${AGENT_URL}/connect`} target="_blank" rel="noreferrer">Открой код подключения ↗</a></li><li>Введи код ниже — он действует один раз.</li></ol><form onSubmit={e => { e.preventDefault(); pair(code); }}><label>Код подключения<input aria-label="Код подключения" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0,8))} inputMode="numeric" autoComplete="off" placeholder="8 цифр" minLength={8} maxLength={8} required /></label><button type="submit" disabled={code.length !== 8 || connection === 'connecting'}>Подключить Codex</button></form><small>Отдельные диалоги, сохранённые на ПК. Код и доступ к проекту не передаются другим посетителям сайта.</small></div>}
        {connected && !session.messages.length && <div className="agent-empty"><h3>{role === 'designer' ? 'Что сделаем удобнее?' : 'С какого замечания начнём?'}</h3><p>Задай вопрос или опиши задачу. Можно отвечать обычными сообщениями и продолжать диалог здесь.</p><button onClick={() => send(finding ? 'Разбери выбранное замечание. Задай мне один конкретный вопрос, чтобы продвинуться к исправлению.' : role === 'designer' ? 'Изучи интерфейс Audio Setup и предложи одно самое полезное улучшение компактности. Сначала объясни, что изменится.' : 'Посмотри текущие замечания. Выбери самое важное и задай мне один вопрос для его устранения.')} disabled={busy || sending}>{finding ? 'Разобрать это замечание' : role === 'designer' ? 'Посмотреть интерфейс' : 'С чего начать?'}</button></div>}
        {session?.messages.map(m => <article key={m.id} className={`agent-message agent-message-${m.role}`}><span>{m.role === 'user' ? 'Ты' : AGENT_ROLES[role]}</span>{m.finding && <small>{m.finding}</small>}<p>{m.text}</p></article>)}
        {session?.operations.length > 0 && <details className="agent-operations"><summary>Работа с проектом · {session.operations.length}</summary>{session.operations.map(o => <div key={o.id}><b>{o.label}</b><small>{o.status === 'inProgress' ? 'В процессе' : o.exitCode != null ? `Завершено · код ${o.exitCode}` : o.status}</small><pre>{o.detail}</pre></div>)}</details>}
        {session?.requests.map(r => <PendingRequest key={r.id} request={r} onAnswer={value => action('answer', { requestId: r.id, value })} />)}
        {session?.proposals.map(p => <div className="agent-proposal" key={p.id}><b>Настройки прослушивания</b><p>{p.reason}</p><details><summary>Что изменится</summary><pre>{JSON.stringify(p.patch,null,2)}</pre></details>{p.status === 'proposed' ? <div><button onClick={() => apply(p)}>Применить настройки</button><button onClick={() => action('proposal', { id: p.id, status: 'dismissed' })}>Отклонить</button></div> : <small>{p.status === 'applied' ? 'Применено в этой вкладке' : 'Отклонено'}</small>}</div>)}
      </div>
      {(error || session?.bridgeError || session?.error || session?.persistenceError || notice) && <p className="agent-notice" role="status">{error || session?.bridgeError || session?.error || session?.persistenceError || notice}</p>}
      <form className="agent-composer" onSubmit={e => { e.preventDefault(); send(draft); }}><label className="sr-only" htmlFor="agent-message">Сообщение агенту</label><textarea id="agent-message" value={draft} maxLength={12000} onChange={e => setDraft(e.target.value)} placeholder={connected ? 'Ответь на вопрос или напиши, что улучшить…' : 'Сначала подключи Codex на своём ПК'} disabled={!connected} rows={2} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(draft); } }} /><div>{session?.busyRole === role ? <button type="button" onClick={() => action('interrupt', {})} disabled={!session.turnId}>■ Стоп</button> : <button type="submit" disabled={!connected || busy || sending || !draft.trim()}>Отправить ↑</button>}<small>{busy && session.busyRole !== role ? `Сейчас работает ${AGENT_ROLES[session.busyRole].toLowerCase()}` : 'Enter — отправить · Shift+Enter — новая строка'}</small></div></form>
      <footer className="agent-footer"><a href={`${AGENT_URL}/#intelligence`} target="_blank" rel="noreferrer">Локальная версия ↗</a>{session?.messages.length > 0 && <button onClick={() => downloadJson(`audio-setup-${role}-dialog.json`, { role, messages: session.messages })}>Скачать диалог</button>}<span>Публикация — по отдельной команде</span></footer>
    </section>
  </div>;
}
