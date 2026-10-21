import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { ROOM_DEVICE_MAP, ROOM_PORT_MAP } from '../data/roomEquipment';
import { auditRoom } from '../data/roomIntelligence';
import { roomPatchRows } from '../data/roomPatchView';
import { roomCableStyle } from '../data/roomRackLayout';
import { routingTrace, ROUTING_NAMES } from '../data/routingScene';
import { routingLocation } from '../data/routingNavigation';
import { useRoomWiring } from '../store/roomWiringStore';
import { useLiveSystemStore } from '../stores/useLiveSystemStore';
import WorkspaceHeader from './WorkspaceHeader';
import RoomPatchInspector from './RoomPatchInspector';
import RoomServiceLink from './RoomServiceLink';
import RoomRackView from './RoomRackView';
import '../roomService.css';
import '../roomPatchPanel.css';

const RoutingScene3D = lazy(() => import('./RoutingScene3D'));

const routeLabels = { possible: 'по кабелям', ready: 'входы совпадают', unknown: 'уточнить входы', blocked: 'другой вход', missing: 'нет пути' };
const layers = { audio: 'Аудио', power: 'Питание', ground: 'GND', all: 'Все', loose: 'Обрывы' };

export default function PatchPanel() {
  const s = useRoomWiring();
  const history = useLiveSystemStore();
  const [device, setDevice] = useState(() => s.components.preamp || 'a90');
  const [view, setView] = useState('volume'), [inspectorTab, setInspectorTab] = useState('device');
  const [kind, setKind] = useState('audio'), [query, setQuery] = useState(''), [target, setTarget] = useState('');
  const [mobilePanel, setMobilePanel] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [navigationNote, setNavigationNote] = useState('');
  useEffect(() => {
    const follow = () => {
      if (!['', '#patch', '#system'].includes(window.location.hash.split('?')[0])) return;
      const store = useRoomWiring.getState();
      const location = routingLocation(window.location.hash, store.cables);
      setTarget(location.target); setKind(location.kind); setQuery('');
      setDevice(location.device || store.components.preamp || 'a90'); setInspectorTab('device');
      setView(location.cable ? 'diagram' : 'volume');
      setInspectorOpen(!!location.device); setMobilePanel(!!location.device);
      setNavigationNote(location.missingCable ? 'Кабеля из ссылки уже нет в текущей схеме. Показаны актуальные подключения.' : '');
      if (location.cable) store.selectCable(location.cable); else store.cancel();
    };
    follow(); window.addEventListener('hashchange', follow);
    return () => window.removeEventListener('hashchange', follow);
  }, []);
  const report = useMemo(() => auditRoom(s.cables, s.listening.source, s.listening), [s.cables, s.listening]);
  const route = report.routes.find(r => r.id === target);
  const rows = useMemo(() => roomPatchRows(s.cables, { kind, query, path: route?.path ?? null }), [s.cables, kind, query, route]);
  const trace = useMemo(() => routingTrace(report, s.listening.source, target), [report, s.listening.source, target]);
  const primary = route || report.routes.find(r => r.wired);
  const chain = primary?.wired ? [...new Set([s.listening.source, ...primary.path.map(c => ROOM_PORT_MAP[c.to].device)])] : [s.listening.source];
  const chooseDevice = id => { setDevice(id); setInspectorTab('device'); setInspectorOpen(true); setMobilePanel(true); };
  const inspectCable = c => { s.selectCable(c.id); chooseDevice(ROOM_PORT_MAP[c.to || c.from].device); };
  const clearFilters = () => { setQuery(''); setKind('audio'); setTarget(''); };
  return <section className="room-patch-panel patch-studio routing-liquid" aria-labelledby="patch-panel-title" data-mobile-panel={mobilePanel} data-inspector-open={inspectorOpen}>
    <WorkspaceHeader id="patch-panel-title" title="Как идёт сигнал" symbol="⌁" subtitle="Твоя система · от источника до акустики">
      <span className={'studio-health ' + (report.connected < 4 ? 'needs-check' : '')}><i />Пути {report.connected}/4 <small>{s.listening.mode === 'selected' ? 'по входам' : 'по кабелям'}</small></span><RoomServiceLink>Комната ↗</RoomServiceLink><a href="#intelligence">Проверка ↗</a>
    </WorkspaceHeader>
    <div className="studio-toolbar">
      <div className="studio-segments" role="group" aria-label="Вид роутинга">{[['volume','Объём'],['diagram','Разъёмы'],['list','Кабели']].map(([id,label]) => <button key={id} aria-pressed={view === id} onClick={() => { setView(id); setMobilePanel(false); setInspectorOpen(false); }}>{label}</button>)}</div>
      <label className="routing-layer"><span className="sr-only">Слой схемы</span><select aria-label="Слой схемы" value={kind} onChange={e => {setKind(e.target.value);setTarget('');}}>{Object.entries(layers).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label className="studio-search"><span aria-hidden="true">⌕</span><input type="search" aria-label="Найти кабель" value={query} onChange={e => setQuery(e.target.value)} placeholder="Аппарат или кабель" /></label>
      <div className="studio-history"><button disabled={!history.past.length} onClick={history.undo} aria-label="Отменить действие" title="Отменить изменение системы">↶</button><button disabled={!history.future.length} onClick={history.redo} aria-label="Повторить действие" title="Повторить изменение системы">↷</button></div>
      <button className="routing-panel-toggle" aria-pressed={inspectorOpen} onClick={() => {setInspectorOpen(!inspectorOpen);setMobilePanel(!inspectorOpen);}}>{inspectorOpen ? 'Закрыть панель' : 'Настройки'}</button>
    </div>
    <div className="studio-grid">
      <div className="studio-canvas">
        <div className="studio-context"><label>Источник<select aria-label="Источник схемы" value={s.listening.source} onChange={e => s.setListening({ source: e.target.value })}><option value="wiim">WiiM Pro Plus</option><option value="e1">Винил · E1</option></select></label><span className="context-divider" /><label>Путь<select aria-label="Путь до акустики" value={target} onChange={e => { setTarget(e.target.value); setKind('audio'); setQuery(''); }}><option value="">Вся система</option>{report.routes.map(r => <option key={r.id} value={r.id}>{r.name} · {routeLabels[r.status]}</option>)}</select></label><span className="studio-visible-count">{rows.length} кабелей</span></div>
        {route && !route.wired && <p className="studio-route-warning">Полного пути от источника нет. <button onClick={clearFilters}>Найти разрыв во всей схеме</button></p>}
        {kind === 'audio' && <div className="routing-flow" aria-label="Выбранный сигнальный путь">{chain.map((id,i) => <span key={id}>{i > 0 && <i aria-hidden="true">→</i>}<button onClick={() => chooseDevice(id)}>{ROUTING_NAMES[id] || ROOM_DEVICE_MAP[id].name}</button></span>)}<small>{primary?.wired ? !target ? 'и остальные выходы' : routeLabels[primary.status] : 'полный путь не найден'}</small></div>}
        {view === 'volume' ? <Suspense fallback={<p className="routing-scene-empty" role="status">Готовим объёмную схему…</p>}><RoutingScene3D rows={rows} kind={kind} device={device} selectedCable={s.selectedCable} onDevice={chooseDevice} onCable={inspectCable} trace={trace} onFallback={() => setView('diagram')}/></Suspense> : view === 'diagram' ? <RoomRackView rows={rows} kind={kind} device={device} onDevice={chooseDevice} onCable={inspectCable} /> : <section className="studio-table" aria-label="Кабели общей схемы"><table className="patch-cable-table"><thead><tr><th scope="col">Соединение</th><th scope="col">Откуда</th><th scope="col">Куда</th><th scope="col">Действие</th></tr></thead><tbody>{rows.map(c => { const style = roomCableStyle(c); return <tr key={c.id} data-selected={s.selectedCable === c.id}><td><span className="patch-table-type"><i style={{ borderColor: style.color, borderTopStyle: style.dash ? 'dashed' : 'solid' }} />{style.name}</span></td><td>{c.fromLabel}</td><td>{c.toLabel}{c.loose && <small>Свободный конец</small>}{c.issue && <small>{c.issue}</small>}</td><td><button onClick={() => inspectCable(c)} aria-label={'Открыть кабель: ' + c.fromLabel + ' → ' + c.toLabel}>Выбрать</button></td></tr>; })}</tbody></table>{!rows.length && <p className="patch-empty">Кабели не найдены. <button onClick={clearFilters}>Сбросить фильтры</button></p>}</section>}
        <div className="studio-status" role="status" aria-live="polite"><span>{navigationNote || s.message}</span>{navigationNote && <button onClick={() => setNavigationNote('')}>Понятно</button>}{s.selectedPort && <button onClick={s.cancel}>Отмена · Esc</button>}{(query || target || kind !== 'audio') && <button onClick={clearFilters}>Сбросить фильтры</button>}</div>
      </div>
      <div className="studio-inspector"><RoomPatchInspector device={device} onDevice={chooseDevice} compact section={inspectorTab} onSection={setInspectorTab} /></div>
    </div>
    {s.storageError && <p role="alert" className="patch-import-error">{s.storageError}</p>}
    <footer className="studio-footer"><span>Общая схема с комнатой · стрелки показывают направление</span><details><summary>О схеме</summary><p>Объёмные аппараты — условные обозначения тракта. Их расположение и изгибы не задают физическую укладку или длину кабеля. Стереопара показана одной линией. Реальные входы и питание аппаратов проверяются отдельно.</p><a href="#legacy-patch">Архивные сетапы ↗</a></details></footer>
  </section>;
}
