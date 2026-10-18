import { useMemo, useRef, useState } from 'react';
import { ROOM_DEVICES, ROOM_PORTS, ROOM_PORT_MAP } from '../data/roomEquipment';
import { auditRoom, portLabel } from '../data/roomIntelligence';
import { PATCH_KINDS, roomPatchRows } from '../data/roomPatchView';
import { connectionCheck } from '../data/roomWiring';
import { useRoomWiring } from '../store/roomWiringStore';
import RoomPatchInspector from './RoomPatchInspector';
import RoomComponentSummary from './RoomComponentSummary';
import RoomServiceLink from './RoomServiceLink';
import RoomRackView from './RoomRackView';
import { roomCableStyle } from '../data/roomRackLayout';
import '../roomPatchPanel.css';
import '../roomService.css';

const routeLabels = { possible: 'По кабелям', ready: 'Входы совпадают', unknown: 'Уточнить входы', blocked: 'Другой вход', missing: 'Нет пути' };
const portsByDevice = Object.fromEntries(ROOM_DEVICES.map(d => [d.id, ROOM_PORTS.filter(p => p.device === d.id)]));

export default function PatchPanel() {
  const s = useRoomWiring();
  const [device, setDevice] = useState(() => s.components.preamp || 'a90');
  const [view, setView] = useState('diagram');
  const [kind, setKind] = useState('audio'), [query, setQuery] = useState(''), [target, setTarget] = useState('');
  const inspector = useRef(null);
  const report = useMemo(() => auditRoom(s.cables, s.listening.source, s.listening), [s.cables, s.listening]);
  const route = report.routes.find(r => r.id === target);
  const rows = useMemo(() => roomPatchRows(s.cables, { kind, query, path: route?.path ?? null }), [s.cables, kind, query, route]);
  const selected = s.cables.find(c => c.id === s.selectedCable);
  const filters = <div className="patch-directory-tools"><label>Найти кабель<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Аппарат или разъём" /></label><label>Тип кабеля<select value={kind} onChange={e => setKind(e.target.value)}>{Object.entries(PATCH_KINDS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><span role="status">Показано: {rows.length} / {s.cables.length}</span></div>;
  const used = new Map();
  for (const c of s.cables) for (const id of [c.from, c.to]) if (id) used.set(id, (used.get(id) || 0) + 1);
  function inspectCable(c, scroll = true) {
    s.selectCable(c.id);
    setDevice(ROOM_PORT_MAP[c.to || c.from].device);
    if (scroll) inspector.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  return <section className="room-patch-panel" aria-labelledby="patch-panel-title">
    <header className="patch-panel-heading"><div><small>РОУТИНГ · 0.5.1</small><h1 id="patch-panel-title">Патч-панель</h1><p>Аппараты, разъёмы и кабели. Та же схема, что в комнате и каталоге.</p></div><RoomServiceLink /></header>
    <RoomComponentSummary />
    <button className="patch-inspector-jump" onClick={() => inspector.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Аппарат, входы и действия ↓</button>
    <div className="patch-route-tabs" role="group" aria-label="Проследить путь до акустики">
      <button aria-pressed={!target} onClick={() => { setTarget(''); setKind('all'); setQuery(''); }}>Вся схема <b>{s.cables.length} кабелей</b></button>
      {report.routes.map(r => <button key={r.id} aria-pressed={target === r.id} onClick={() => { setTarget(r.id); setKind('all'); setQuery(''); }}><span>{r.name}</span><b className={r.connected ? 'route-ok' : 'route-gap'}>{routeLabels[r.status]}</b></button>)}
    </div>
    <div className="patch-view-toggle" role="group" aria-label="Вид роутинга"><span>Вид</span><button aria-pressed={view === 'diagram'} onClick={() => setView('diagram')}>Схема</button><button aria-pressed={view === 'list'} onClick={() => setView('list')}>Список</button><button disabled={!s.past.length} onClick={s.undo}>↶ Назад</button><button disabled={!s.future.length} onClick={s.redo}>↷ Вперёд</button></div>
    {view === 'diagram' && <div className="patch-diagram-filters">{filters}</div>}
    {view === 'diagram' && <RoomRackView rows={rows} kind={kind} device={device} onDevice={setDevice} onCable={c => inspectCable(c, false)} />}
    <div className="patch-panel-workspace"><div className="patch-panel-main">
      <section className="patch-cable-directory" aria-label="Кабели общей схемы">
        {view === 'list' && filters}
        {route && <p className="patch-route-description">{route.name}: {routeLabels[route.status]}. {route.wired ? 'Ниже кабели этого пути. Питание и GND смотри во всей схеме.' : 'Полного пути от выбранного источника нет. Вернись ко всей схеме, чтобы найти разрыв.'}</p>}
        {view === 'diagram' ? <div className="patch-table-scroll"><table className="patch-cable-table"><caption>Патч-лист · {rows.length} кабелей</caption><thead><tr><th scope="col">Тип</th><th scope="col">Откуда</th><th scope="col">Куда</th><th scope="col">Действие</th></tr></thead><tbody>{rows.map(c => { const style = roomCableStyle(c); return <tr key={c.id} data-selected={s.selectedCable === c.id}><td><span className="patch-table-type"><i style={{ borderColor: style.color, borderTopStyle: style.dash ? 'dashed' : 'solid' }} />{style.name}</span></td><td>{c.fromLabel}</td><td>{c.toLabel}{c.loose && <small>Свободный конец</small>}{c.issue && <small>{c.issue}</small>}</td><td><button onClick={() => inspectCable(c)} aria-label={`Открыть кабель: ${c.fromLabel} → ${c.toLabel}`}>Открыть</button></td></tr>; })}</tbody></table></div> : <div className="patch-directory-list">{rows.map(c => <button key={c.id} aria-label={`Кабель: ${c.fromLabel} → ${c.toLabel}`} aria-pressed={s.selectedCable === c.id} onClick={() => inspectCable(c)}><span className={`patch-kind kind-${c.kind}`}>{PATCH_KINDS[c.kind]}{c.loose ? ' · свободный конец' : ''}{c.issue ? ' · конфликт' : ''}</span><span>{c.fromLabel}</span><span className="patch-cable-arrow">↓ {c.toLabel}</span>{c.issue && <small>{c.issue}</small>}</button>)}</div>}
        {!rows.length && <p className="patch-empty">По этим условиям кабели не найдены. <button onClick={() => { setQuery(''); setKind('all'); setTarget(''); }}>Показать всю схему</button></p>}
      </section>
      <details className="patch-view-ports" open={view === 'list'}><summary>Все аппараты и разъёмы списком</summary><section className="patch-device-directory" aria-label="Разъёмы аппаратов">
        <h2>Соединить разъёмы</h2><p>Нажми выход, затем вход. Совместимые разъёмы подсветятся. Занятый разъём открывает кабель; свободный конец можно переставить.</p>
        {s.selectedPort && <div className="patch-connection-prompt" role="status"><span>Выбран: {portLabel(s.selectedPort)}</span><button onClick={s.cancel}>Отменить выбор · Esc</button></div>}
        <div className="patch-device-grid">{ROOM_DEVICES.map(d => <article key={d.id} className={device === d.id ? 'device-focused' : ''}>
          <button className="patch-device-name" onClick={() => { setDevice(d.id); inspector.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }} aria-label={`Открыть аппарат ${d.name}`}><b>{d.name}</b><small>{d.status || 'В проекте'}</small></button>
          <div className="patch-device-ports">{portsByDevice[d.id].map(p => {
            const check = s.selectedPort && s.selectedPort !== p.id ? connectionCheck(s.selectedPort, p.id, s.cables, selected && (!selected.from || !selected.to) ? selected.id : null) : null;
            const count = (used.get(p.id) || 0) + (p.reserved ? 1 : 0);
            return <button key={p.id} aria-label={`${d.name} · ${p.label}`} aria-pressed={s.selectedPort === p.id} title={p.reserved || check?.reason || p.label} className={check?.ok ? 'port-compatible' : ''} onClick={() => { setDevice(d.id); s.pickPort(p.id); }}><span>{p.direction === 'out' ? '↗' : '↙'} {p.label}</span><small>{p.reserved ? 'Лампа' : count ? `${count} / ${p.capacity}` : 'Свободен'}{check?.ok ? ' · можно' : ''}</small></button>;
          })}</div>
        </article>)}</div>
      </section></details>
    </div><div className="patch-panel-inspector" ref={inspector}><RoomPatchInspector device={device} onDevice={setDevice} /></div></div>
    <footer>Стереопары показаны как одно соединение. Это схема проекта, не управление реальными аппаратами. <a href="#intelligence">Полная проверка ↗</a><details><summary>Прежние схемы с A90</summary><p>Старые примеры с наушниками, Cayin и MacBook доступны отдельно. Они не меняют комнату, не сохраняются между перезагрузками и не переносятся автоматически: для части аппаратов ещё нет портов в общей модели.</p><a href="#legacy-patch">Открыть прежнюю панель ↗</a></details></footer>
  </section>;
}
