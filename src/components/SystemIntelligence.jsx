import { useLiveSystemStore } from '../stores/useLiveSystemStore';
import { useMemo, useState } from 'react';
import { auditRoom, portLabel } from '../data/roomIntelligence';
import { ROOM_DEVICE_MAP, ROOM_PORT_MAP } from '../data/roomEquipment';
import { downloadJson, roomSnapshot } from '../data/roomBackup';
import { useRoomWiring } from '../store/roomWiringStore';
import RoomListeningControls from './RoomListeningControls';
import RoomComponentSummary from './RoomComponentSummary';
import RoomElectrical from './RoomElectrical';
import AgentWorkspace from './AgentWorkspace';
import WorkspaceHeader from './WorkspaceHeader';
import { assessRoomElectrical } from '../data/roomElectrical';
import { routingHref } from '../data/routingNavigation';
import '../intelligence.css';

const routeLabels = { possible: 'Путь по кабелям', ready: 'Входы совпадают', unknown: 'Уточнить входы', blocked: 'Другой вход', missing: 'Нет пути' };

export default function SystemIntelligence() {
  const history = useLiveSystemStore();
  const s = useRoomWiring(), { cables, listening } = s, { source, mode } = listening;
  const [view, setView] = useState(() => ['system', 'designer'].includes(new URLSearchParams(window.location.search).get('agent')) ? 'findings' : 'routes');
  const [mobilePanel, setMobilePanel] = useState(false);
  const report = useMemo(() => auditRoom(cables, source, listening), [cables, source, listening]);
  const electrical = useMemo(() => assessRoomElectrical(cables, listening), [cables, listening]);
  const issues = report.findings.filter(f => f.level === 'issue').length;
  const devices = [...new Set(report.routes.flatMap(r => r.path.flatMap(c => [ROOM_PORT_MAP[c.from].device, ROOM_PORT_MAP[c.to].device])))];
  return <section className="system-intelligence intelligence-studio studio-page liquid-workspace" aria-labelledby="intelligence-title" data-mobile-panel={mobilePanel} data-agent-view={view === 'findings'}>
    <WorkspaceHeader title="Проверка системы" id="intelligence-title" symbol="✓" subtitle="Соединения, рабочие входы и паспортные данные"><a href="#patch">Роутинг ↗</a></WorkspaceHeader>
    <div className="catalog-toolbar">
      <div className="workspace-segments" role="group" aria-label="Вид проверки">{[['routes', 'Пути'], ['electrical', 'Согласование'], ['findings', 'Замечания'], ['passports', 'Паспорта']].map(([id, label]) => <button key={id} aria-pressed={view === id} onClick={() => { setView(id); setMobilePanel(false); }}>{label}{id === 'findings' && <span>{report.findings.length}</span>}</button>)}</div>
      <div className="workspace-history"><button disabled={!history.past.length} onClick={history.undo} aria-label="Отменить действие" title="Отменить действие">↶</button><button disabled={!history.future.length} onClick={history.redo} aria-label="Повторить действие" title="Повторить действие">↷</button></div>
      {view !== 'findings' && <button className="workspace-panel-toggle" aria-pressed={mobilePanel} onClick={() => setMobilePanel(!mobilePanel)}>{mobilePanel ? 'Закрыть панель' : 'Входы и режимы'}</button>}
    </div>
    <div className="intelligence-workspace">
      <div className="intelligence-main">
        <div className="intelligence-summary" role="status">
          <b>{report.connected}<small> / 4</small></b><div><strong>{mode === 'selected' ? 'Пути с указанными входами' : 'Пути по кабелям'}</strong><span>{report.unresolved ? 'Уточнить входы: ' + report.unresolved + ' · ' : ''}{issues ? 'Исправить: ' + issues : 'Ошибок соединения не найдено'}</span></div><a href="#patch">К соединениям ↗</a>
        </div>
        <div className="intelligence-content" key={view}>
          {view === 'routes' && <><div className="workspace-section-heading"><h2>От источника до акустики</h2><span>{ROOM_DEVICE_MAP[source].name}</span></div>
            <div className="intelligence-routes">{report.routes.map(route => <article key={route.id} className={route.connected ? 'route-found' : 'route-missing'}><header><h3>{route.name}</h3><span>{routeLabels[route.status]}</span></header>{route.wired ? <><p className="intelligence-chain">{[source, ...route.path.map(c => ROOM_PORT_MAP[c.to].device)].map(id => ROOM_DEVICE_MAP[id].name).join(' → ')}</p>{route.inputs.length > 0 && <p className="intelligence-route-note">{route.status === 'blocked' ? 'Выбранный вход прерывает путь.' : 'Укажи рабочие входы для проверки.'}</p>}<details><summary>Разъёмы и кабели · {route.path.length}</summary><ol>{route.path.map(c => <li key={c.id}>{portLabel(c.from)}<br />→ {portLabel(c.to)}<br /><a className="route-cable-link" href={routingHref({ cable:c.id })} aria-label={'Открыть соединение: ' + portLabel(c.from) + ' → ' + portLabel(c.to)}>Открыть в роутинге ↗</a></li>)}</ol></details></> : <p>Проверь подключения «За стойкой». Неиспользуемую ветку можно оставить отключённой.</p>}<a className="route-open-link" href={routingHref({ target:route.id })} aria-label={'Показать путь: ' + route.name}>{route.wired ? 'Показать путь' : 'Найти разрыв'} ↗</a></article>)}</div>
            <p className="intelligence-notice">Проверка проекта не подтверждает включение и громкость аппаратов. Согласование оценивается отдельно по доступным паспортам.</p>
          </>}
          {view === 'electrical' && <RoomElectrical report={electrical} />}
          {view === 'findings' && <AgentWorkspace report={report} />}
          {view === 'passports' && <><div className="workspace-section-heading"><h2>Устройства в найденных путях</h2><span>{devices.length} аппаратов</span></div><div className="intelligence-references">{devices.length ? devices.map(id => { const d = ROOM_DEVICE_MAP[id]; return <article key={id}><h3>{d.name}</h3><p>{d.accuracy}</p>{d.source && <a href={d.source} target="_blank" rel="noreferrer">Источник ↗</a>}</article>; }) : <p>Полные пути пока не найдены.</p>}</div><p className="intelligence-notice">Электрические параметры и основания расчётов — во вкладке «Согласование». Неизвестные значения не подменяются данными похожих моделей.</p></>}
        </div>
      </div>
      {view !== 'findings' && <aside className="intelligence-inspector" aria-label="Настройки проверки">
        <h2>Слушаем</h2><RoomComponentSummary /><RoomListeningControls />
        <details className="intelligence-project"><summary>Проект и отчёт</summary><p>Комната, каталог и роутинг используют одну схему. Геометрия стойки проверяется в CAD; архивные примеры независимы.</p><div className="intelligence-actions"><button onClick={() => downloadJson('audio-setup-room-wiring.json', { ...roomSnapshot(s), createdAt: new Date().toISOString() })}>↓ Скачать схему</button><button onClick={() => downloadJson('audio-setup-check.json', { ...report, ...roomSnapshot(s), electrical, createdAt: new Date().toISOString() })}>↓ Скачать отчёт</button></div></details>
      </aside>}
    </div>
    <footer className="workspace-footnote"><span>Изменения сохраняются в этом браузере · не управление реальными аппаратами</span><a href="https://github.com/xftesht-coder/audio-setup-app/blob/main/ROADMAP.md" target="_blank" rel="noreferrer">Roadmap ↗</a></footer>
  </section>;
}
