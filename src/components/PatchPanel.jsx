import { useMemo, useState } from 'react';
import { ROOM_DEVICE_MAP, ROOM_PORT_MAP } from '../data/roomEquipment';
import { auditRoom } from '../data/roomIntelligence';
import { roomPatchRows } from '../data/roomPatchView';
import { roomCableStyle } from '../data/roomRackLayout';
import { useRoomWiring } from '../store/roomWiringStore';
import WorkspaceHeader from './WorkspaceHeader';
import RoomPatchInspector from './RoomPatchInspector';
import RoomServiceLink from './RoomServiceLink';
import RoomRackView from './RoomRackView';
import '../roomService.css';
import '../roomPatchPanel.css';

const routeLabels = { possible: 'по кабелям', ready: 'входы совпадают', unknown: 'уточнить входы', blocked: 'другой вход', missing: 'нет пути' };
const layers = { audio: 'Аудио', power: 'Питание', ground: 'GND', all: 'Все', loose: 'Обрывы' };

export default function PatchPanel() {
  const s = useRoomWiring();
  const [device, setDevice] = useState(() => s.components.preamp || 'a90');
  const [view, setView] = useState('diagram'), [inspectorTab, setInspectorTab] = useState('device');
  const [kind, setKind] = useState('audio'), [query, setQuery] = useState(''), [target, setTarget] = useState('');
  const [mobilePanel, setMobilePanel] = useState(false);
  const report = useMemo(() => auditRoom(s.cables, s.listening.source, s.listening), [s.cables, s.listening]);
  const route = report.routes.find(r => r.id === target);
  const rows = useMemo(() => roomPatchRows(s.cables, { kind, query, path: route?.path ?? null }), [s.cables, kind, query, route]);
  const chooseDevice = id => { setDevice(id); setInspectorTab('device'); setMobilePanel(true); };
  const inspectCable = c => { s.selectCable(c.id); chooseDevice(ROOM_PORT_MAP[c.to || c.from].device); };
  const clearFilters = () => { setQuery(''); setKind('audio'); setTarget(''); };
  return <section className="room-patch-panel patch-studio" aria-labelledby="patch-panel-title" data-mobile-panel={mobilePanel}>
    <WorkspaceHeader id="patch-panel-title" title="Роутинг" subtitle={<>{ROOM_DEVICE_MAP[s.components.dac]?.name || 'ЦАП не выбран'} <span>→</span> {ROOM_DEVICE_MAP[s.components.preamp]?.name || 'Предусилитель не выбран'}</>}>
      <span className={'studio-health ' + (report.connected < 4 ? 'needs-check' : '')}><i />Пути {report.connected}/4 <small>{s.listening.mode === 'selected' ? 'по входам' : 'по кабелям'}</small></span><RoomServiceLink>Комната ↗</RoomServiceLink><a href="#intelligence">Проверка ↗</a>
    </WorkspaceHeader>
    <div className="studio-toolbar">
      <div className="studio-segments" role="group" aria-label="Вид роутинга"><button aria-pressed={view === 'diagram'} onClick={() => { setView('diagram'); setMobilePanel(false); }}>Схема</button><button aria-pressed={view === 'list'} onClick={() => { setView('list'); setMobilePanel(false); }}>Кабели <span>{s.cables.length}</span></button></div>
      <div className="studio-layers" role="group" aria-label="Слой схемы">{Object.entries(layers).map(([id, label]) => <button key={id} aria-pressed={kind === id} onClick={() => { setKind(id); setTarget(''); }}>{label}</button>)}</div>
      <label className="studio-search"><span aria-hidden="true">⌕</span><input type="search" aria-label="Найти кабель" value={query} onChange={e => setQuery(e.target.value)} placeholder="Аппарат или кабель" /></label>
      <div className="studio-history"><button disabled={!s.past.length} onClick={s.undo} aria-label="Отменить действие" title="Отменить действие">↶</button><button disabled={!s.future.length} onClick={s.redo} aria-label="Повторить действие" title="Повторить действие">↷</button></div>
      <button className="studio-inspector-jump" aria-pressed={mobilePanel} onClick={() => setMobilePanel(!mobilePanel)}>{mobilePanel ? 'К схеме' : 'Инспектор'}</button>
    </div>
    <div className="studio-grid">
      <div className="studio-canvas">
        <div className="studio-context"><label>Источник<select aria-label="Источник схемы" value={s.listening.source} onChange={e => s.setListening({ source: e.target.value })}><option value="wiim">WiiM Pro Plus</option><option value="e1">Винил · E1</option></select></label><span className="context-divider" /><label>Путь<select aria-label="Путь до акустики" value={target} onChange={e => { setTarget(e.target.value); setKind('audio'); setQuery(''); }}><option value="">Вся система</option>{report.routes.map(r => <option key={r.id} value={r.id}>{r.name} · {routeLabels[r.status]}</option>)}</select></label><span className="studio-visible-count">{rows.length} кабелей</span></div>
        {route && !route.wired && <p className="studio-route-warning">Полного пути от источника нет. <button onClick={clearFilters}>Найти разрыв во всей схеме</button></p>}
        {view === 'diagram' ? <RoomRackView rows={rows} kind={kind} device={device} onDevice={chooseDevice} onCable={inspectCable} /> : <section className="studio-table" aria-label="Кабели общей схемы"><table className="patch-cable-table"><thead><tr><th scope="col">Соединение</th><th scope="col">Откуда</th><th scope="col">Куда</th><th scope="col">Действие</th></tr></thead><tbody>{rows.map(c => { const style = roomCableStyle(c); return <tr key={c.id} data-selected={s.selectedCable === c.id}><td><span className="patch-table-type"><i style={{ borderColor: style.color, borderTopStyle: style.dash ? 'dashed' : 'solid' }} />{style.name}</span></td><td>{c.fromLabel}</td><td>{c.toLabel}{c.loose && <small>Свободный конец</small>}{c.issue && <small>{c.issue}</small>}</td><td><button onClick={() => inspectCable(c)} aria-label={'Открыть кабель: ' + c.fromLabel + ' → ' + c.toLabel}>Выбрать</button></td></tr>; })}</tbody></table>{!rows.length && <p className="patch-empty">Кабели не найдены. <button onClick={clearFilters}>Сбросить фильтры</button></p>}</section>}
        <div className="studio-status" role="status" aria-live="polite"><span>{s.message}</span>{s.selectedPort && <button onClick={s.cancel}>Отмена · Esc</button>}{(query || target || kind !== 'audio') && <button onClick={clearFilters}>Сбросить фильтры</button>}</div>
      </div>
      <div className="studio-inspector"><RoomPatchInspector device={device} onDevice={chooseDevice} compact section={inspectorTab} onSection={setInspectorTab} /></div>
    </div>
    {s.storageError && <p role="alert" className="patch-import-error">{s.storageError}</p>}
    <footer className="studio-footer"><span>Одна схема с комнатой · стереопара показана одной линией</span><details><summary>О схеме</summary><p>Это проект подключений, не управление аппаратами. Геометрия схемы не задаёт длину кабеля. Разъёмы выбранного аппарата доступны в инспекторе.</p><a href="#legacy-patch">Архивные сетапы с наушниками / Cayin / MacBook ↗</a></details></footer>
  </section>;
}
