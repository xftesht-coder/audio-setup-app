import { useMemo } from 'react';
import { auditRoom, portLabel } from '../data/roomIntelligence';
import { ROOM_DEVICE_MAP, ROOM_PORT_MAP } from '../data/roomEquipment';
import { downloadJson, roomSnapshot } from '../data/roomBackup';
import { useRoomWiring } from '../store/roomWiringStore';
import RoomListeningControls from './RoomListeningControls';
import RoomComponentSummary from './RoomComponentSummary';
import RoomElectrical from './RoomElectrical';
import { assessRoomElectrical } from '../data/roomElectrical';
import '../intelligence.css';

const levels = { issue: 'Исправить', attention: 'Проверить', unknown: 'Нет данных' };
const routeLabels = { possible: 'Путь по кабелям', ready: 'Входы совпадают', unknown: 'Уточнить входы', blocked: 'Другой вход', missing: 'Нет пути' };
export default function SystemIntelligence() {
  const s = useRoomWiring(), { cables, listening } = s, { source, mode } = listening;
  const report = useMemo(() => auditRoom(cables, source, listening), [cables, source, listening]);
  const electrical = useMemo(() => assessRoomElectrical(cables, listening), [cables, listening]);
  const issues = report.findings.filter(f => f.level === 'issue').length;
  const devices = [...new Set(report.routes.flatMap(r => r.path.flatMap(c => [ROOM_PORT_MAP[c.from].device, ROOM_PORT_MAP[c.to].device])))];
  return <section className="system-intelligence" aria-labelledby="intelligence-title">
    <header className="intelligence-header"><div><span className="intelligence-eyebrow">SYSTEM INTELLIGENCE · 0.5</span><h1 id="intelligence-title">Проверка системы</h1><p>Что соединено, какой вход выбран и где обрыв.</p></div><a href="#patch">Открыть подключения ↗</a></header>
    <div className="intelligence-scope"><strong>Одна схема с комнатой и заменой аппаратов</strong><p>Каталожные замены A90 / Freya и Bifrost / WARMER меняют эти же подключения. Состав, провода, входы и режим Freya сохраняются вместе. Патч-панель показывает тот же граф. Архивные примеры, черновики других моделей и мебель пока отдельно.</p></div>
    <RoomComponentSummary />
    <RoomListeningControls />
    <div className="intelligence-controls"><div className="intelligence-actions"><button disabled={!s.past.length} onClick={s.undo}>↶ Отменить</button><button disabled={!s.future.length} onClick={s.redo}>↷ Повторить</button></div><div className="intelligence-actions"><button onClick={() => downloadJson('audio-setup-room-wiring.json', { ...roomSnapshot(s), createdAt: new Date().toISOString() })}>Скачать схему</button><button onClick={() => downloadJson('audio-setup-check.json', { ...report, ...roomSnapshot(s), electrical, createdAt: new Date().toISOString() })}>Скачать отчёт</button></div></div>
    <div className="intelligence-summary" role="status"><b>{report.connected} / 4</b><span>{mode === 'selected' ? 'путей с указанными входами' : 'путей по кабелям'}</span><strong>{report.unresolved ? `Нужно уточнить входы: ${report.unresolved} пути. ` : ''}{issues ? `Замечаний: ${issues}` : report.unresolved ? 'См. настройки выше.' : 'Пути найдены; питание аппаратов показано'}</strong><small>Это проверка проекта: включение, громкость, режим усиления и электрическое согласование не подтверждены.</small></div>
    <h2>От источника до акустики</h2><div className="intelligence-routes">{report.routes.map(route => <article key={route.id} className={route.connected ? 'route-found' : 'route-missing'}><header><h3>{route.name}</h3><span>{routeLabels[route.status]}</span></header>{route.wired ? <><p className="intelligence-chain">{[source, ...route.path.map(c => ROOM_PORT_MAP[c.to].device)].map(id => ROOM_DEVICE_MAP[id].name).join(' → ')}</p>{route.inputs.length > 0 && <p className="intelligence-route-note">Кабели соединены. {route.status === 'blocked' ? 'Выбранный вход прерывает этот путь.' : 'Укажи рабочие входы, чтобы проверить этот путь.'}</p>}<details><summary>Разъёмы и кабели</summary><ol>{route.path.map(c => <li key={c.id}>{portLabel(c.from)}<br />→ {portLabel(c.to)}</li>)}</ol></details></> : <p>Проверь подключения «За стойкой». Неиспользуемую ветку можно оставить отключённой.</p>}</article>)}</div>
    <RoomElectrical report={electrical} />
    <h2>Основания и следующий шаг</h2><div className="intelligence-findings">{report.findings.map(f => <article key={f.id} className={`finding-${f.level}`}><span>{levels[f.level]}</span><h3>{f.title}</h3><p>{f.evidence}</p><p className="finding-next"><b>Дальше:</b> {f.next}</p></article>)}</div>
    <details className="intelligence-references"><summary>Паспорта устройств в найденных путях</summary>{devices.length ? devices.map(id => {const d = ROOM_DEVICE_MAP[id];return <p key={id}><b>{d.name}</b> — {d.accuracy} {d.source && <a href={d.source} target="_blank" rel="noreferrer">Источник ↗</a>}</p>;}) : <p>Полные пути пока не найдены.</p>}</details>
    <footer>Следующий этап: единая схема во всех разделах → паспорта с измерениями → сравнение замен → цены рынка. <a href="https://github.com/xftesht-coder/audio-setup-app/blob/main/ROADMAP.md" target="_blank" rel="noreferrer">Roadmap проекта ↗</a></footer>
  </section>;
}
