import { useLiveSystemStore } from '../stores/useLiveSystemStore';
import { useMemo } from 'react';
import { ROOM_DEVICE_MAP, ROOM_PORT_MAP } from '../data/roomEquipment';
import { ROOM_COMPONENTS } from '../data/roomComponents';
import { auditRoom, portLabel } from '../data/roomIntelligence';
import { downloadJson, roomSnapshot } from '../data/roomBackup';
import { useRoomWiring } from '../store/roomWiringStore';
import RoomListeningControls from './RoomListeningControls';
import RoomServiceLink from './RoomServiceLink';
import '../roomReplacement.css';

const cableText = c => c ? `${portLabel(c.from)} → ${portLabel(c.to)}` : 'Новый кабель';
const name = id => ROOM_DEVICE_MAP[id]?.name || 'Не определён';
export default function RoomSystemEditor({ compact = false, sidebar = false }) {
  const history = useLiveSystemStore();
  const s = useRoomWiring(), p = s.replacement;
  const report = useMemo(() => auditRoom(s.cables, s.listening.source, s.listening), [s.cables, s.listening]);
  const choices = p?.choices || s.components;
  return <section id={compact ? undefined : 'room-system-editor'} className={`room-system-editor ${compact ? 'room-system-compact' : ''} ${sidebar ? 'room-system-sidebar' : ''}`} aria-label="Замена устройств комнаты">
    <header><div><small>КАТАЛОГ ↔ КОМНАТА · 0.5</small><h2>Тракт в комнате</h2></div>{!compact && <RoomServiceLink />}</header>
    <p>ЦАП и предусилитель меняются вместе с подключениями. Все четыре аппарата остаются на полках; это проект системы, а не подтверждение покупки.</p>
    <div className="room-component-selectors">{Object.entries(ROOM_COMPONENTS).map(([role, options]) => <label key={role}>{role === 'dac' ? 'ЦАП в комнате' : 'Предусилитель в комнате'}<select value={choices[role] || ''} onChange={e => s.previewReplacement({ [role]: e.target.value })}>
      <option value="" disabled>Не определён по старой схеме</option>{options.map(d => <option key={d.id} value={d.id}>{name(d.id)}</option>)}
    </select></label>)}</div>
    {p && p.swaps.length > 0 && <section className="room-replacement-preview" aria-label="Предпросмотр замены">
      <h3>Что изменится</h3><p>{p.swaps.map(change => `${name(change.from)} → ${name(change.to)}`).join(' · ')}</p>
      <div className="replacement-counts"><span>Переставить: {p.changes.filter(c => c.kind === 'move').length}</span><span>Добавить питание: {p.changes.filter(c => c.kind === 'power').length}</span><span>Без изменений: {p.unchanged.length}</span></div>
      <ol className="replacement-cables">{p.changes.map(c => <li key={c.id}><strong>{c.kind === 'power' ? 'Новый кабель питания' : 'Переподключить кабель'}</strong><span><b>Было:</b> {cableText(c.before)}</span><span><b>Будет:</b> {cableText(c.after)}</span></li>)}</ol>
      {p.inputs.length > 0 && <div className="replacement-inputs"><b>Рабочие входы в проекте</b>{p.inputs.map(i => <p key={i.device}>{name(i.device)}: {i.before ? ROOM_PORT_MAP[i.before].label : 'не указан'} → {ROOM_PORT_MAP[i.after].label}</p>)}<p>Переносим указанный вход прежнего аппарата. Реальные переключатели нужно установить вручную.</p></div>}
      <p className="replacement-result">Пути {s.listening.mode === 'possible' ? 'по кабелям' : 'с выбранными входами'}: {p.beforeReport.connected} / 4 → {p.afterReport.connected} / 4. Замечаний после замены: {p.afterReport.findings.filter(f => f.level === 'issue').length}; путей с неуказанными входами: {p.afterReport.unresolved}.</p>
      {p.problems.length > 0 && <div className="replacement-conflicts" role="alert"><b>Сначала устранить конфликт</b><ul>{p.problems.map(problem => <li key={problem}>{problem}</li>)}</ul><RoomServiceLink>Открыть подключения за стойкой ↗</RoomServiceLink></div>}
      {p.notes.map(note => <p key={note} className="replacement-note">{note}</p>)}
      <details><summary>Сохраняемые подключения · {p.unchanged.length}</summary><ul>{p.unchanged.map(c => <li key={c.id}>{cableText(c)}</li>)}</ul></details>
      <p className="replacement-note">Питание прежних аппаратов остаётся. Для наушников A90 отдельная ветка автоматически не добавляется. Совместимость разъёмов не подтверждает уровни сигнала; длину и запас кабелей после перестановки нужно проверить.</p>
      <div className="replacement-actions"><button className="replacement-apply" disabled={p.problems.length > 0} onClick={s.applyReplacement}>Применить замену</button><button onClick={s.cancelReplacement}>Отказаться от замены</button></div>
    </section>}
    {!compact && (sidebar ? <details className="editor-listening"><summary>Источник и рабочие входы</summary><RoomListeningControls /></details> : <RoomListeningControls />)}
    <div className="room-live-path" role="status"><b>Сейчас в схеме: {report.connected} / 4 пути</b><p>{report.routes.find(r => r.path.length)?.path.map((c, i) => `${i ? '' : name(ROOM_PORT_MAP[c.from].device) + ' → '}${name(ROOM_PORT_MAP[c.to].device)}`).join(' → ') || 'Полного пути к акустике нет.'}</p></div>
    <div className="replacement-actions"><button disabled={!history.past.length} onClick={history.undo}>↶ Отменить в комнате</button><button disabled={!history.future.length} onClick={history.redo}>↷ Повторить в комнате</button>{!compact && <button onClick={() => downloadJson('audio-setup-room-wiring.json', { ...roomSnapshot(s), createdAt: new Date().toISOString() })}>Скачать схему комнаты</button>}<a href="#patch">Патч-панель ↗</a><a href="#intelligence">Проверить систему ↗</a></div>
    <p className="replacement-message" role="status">{s.storageError || s.message}</p>
  </section>;
}
