import { useEffect, useMemo, useRef, useState } from 'react';
import CabinetView3D from './CabinetView3D';
import MaterialPicker from './MaterialPicker';
import { useCabinetStore } from '../stores/useCabinetStore';
import { useWorkshopStore } from '../stores/useWorkshopStore';
import { CABINET_FINISHES, EQUIPMENT_PHYSICAL } from '../data/cabinetSpecs';
import { DEVICE_SPECS } from '../data/devicePorts';
import { ENGINEERING_SOURCES, manufacturingBOM, migrateLegacyProject, sortedShelves, shelfHoles, validateConstruction } from '../data/workshop';
import { routeAllCables } from '../data/cableRouting';
import { bomCSV, drillingCSV, panelSVG, projectDXF, reviewHTML, REVIEW_NOTES, downloadText } from '../data/workshopExport';

function NumberField({ label, value, onChange, unit = 'мм', min = -4000, max = 4000, step = 1 }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return <label className="cad-field"><span>{label}</span><div><input type="number" value={draft} min={min} max={max} step={step} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} onBlur={e => {
    if (draft.trim() && e.currentTarget.validity.valid && Number.isFinite(Number(draft))) { if (onChange(Number(draft)) === false) setDraft(String(value)); }
    else setDraft(String(value));
  }} /><small>{unit}</small></div></label>;
}
function Group({ title, children }) { return <section className="cad-group"><h2>{title}</h2>{children}</section>; }
function ShelfEditor({ state, shelf }) {
  const { project: p, editShelf } = state;
  const edit = changes => editShelf(shelf.id, changes);
  const holes = shelfHoles(p, shelf);
  return <>
    <Group title={shelf.name}>
      <div className="cad-fields">
        {[['y', 'Высота от пола', 60, 2200], ['thickness', 'Толщина', 18, 80], ['width', 'Ширина детали', 300, 1800], ['depth', 'Глубина детали', 250, 1000], ['x', 'Смещение X', -300, 300], ['z', 'Смещение Z', -300, 300]].map(([key, label, min, max]) => <NumberField key={key} label={label} value={shelf[key]} min={min} max={max} step={0.1} onChange={value => edit({ [key]: value })} />)}
      </div>
      <p className="cad-help">Y — низ полки. X вправо, Z к слушателю. Числа применяются по Enter или при выходе из поля. Выбранную деталь можно двигать стрелками в 3D.</p>
      <button className="cad-text-button danger" onClick={() => state.removeShelf(shelf.id)}>Удалить полку</button>
    </Group>
    <Group title={`Сверловка · ${holes.length} отверстий`}>
      <p className="cad-help">4 × Ø18 под шпильки M16 связаны с опорами. Дополнительные отверстия — сквозные, координаты от центра детали.</p>
      {shelf.holes.map(h => <div className="cad-hole" key={h.id}><b>{h.id}</b><div className="cad-fields three">{['x', 'z', 'diameter'].map((key, i) => <NumberField key={key} label={['X', 'Z', 'Диаметр'][i]} value={h[key]} min={i === 2 ? 2 : -1500} max={i === 2 ? 200 : 1500} onChange={value => edit({ holes: shelf.holes.map(a => a.id === h.id ? { ...a, [key]: value } : a) })} />)}</div><button className="cad-text-button" onClick={() => edit({ holes: shelf.holes.filter(a => a.id !== h.id) })}>Убрать отверстие</button></div>)}
      <button className="cad-button" onClick={() => edit({ holes: [...shelf.holes, { id: `H${Date.now().toString().slice(-5)}`, x: 0, z: -shelf.depth / 2 + 45, diameter: 40 }] })}>＋ Добавить отверстие</button>
    </Group>
  </>;
}
function CableEditor({ state, route }) {
  const c = route.cable, edit = changes => state.editCable(c.id, changes);
  return <>
    <div className={`cad-route-status ${route.issues.length ? 'is-error' : ''}`}><b>{route.issues.length ? 'Трассу нужно исправить' : 'Геометрия трассы проходит проверку'}</b><p>{Math.ceil(route.length)} мм + {c.reserve} мм запаса · {(route.mass / 1000).toFixed(2)} кг · {route.supports.length} опор</p>{c.available > route.length && <p>Вне показанной трассы остаётся {Math.floor(c.available - route.length)} мм кабеля, включая запас. Для этой длины нужно место под сервисную петлю; её форма пока не рассчитана.</p>}{route.issues.map(x => <p key={x}>{x}</p>)}</div>
    <Group title="Кабель и доступная длина"><div className="cad-fields">
      {[['diameter', 'Наружный Ø', 1, 40, 'мм'], ['bendRadius', 'Минимальный R', 5, 300, 'мм'], ['massPerM', 'Масса на метр', 1, 2000, 'г/м'], ['available', 'Длина кабеля', 100, 20000, 'мм'], ['reserve', 'Монтажный запас', 0, 1000, 'мм'], ['supportSpan', 'Шаг держателей', 50, 1000, 'мм']].map(([key, label, min, max, unit]) => <NumberField key={key} {...{ label, min, max, unit }} value={c[key]} step={0.1} onChange={value => edit({ [key]: value })} />)}
    </div><p className="cad-help">{c.note}</p><p className="cad-help">Вес одного пролёта: до {route.spanLoad.toFixed(2)} Н. Это вес кабеля между опорами, а не расчёт изгиба или удерживающей силы клипсы.</p></Group>
    <Group title="Разъём и выход из корпуса"><div className="cad-fields">
      {[['connectorLength', 'Вылет разъёма', 5, 180], ['connectorDiameter', 'Габарит разъёма Ø', 2, 70], ['straight', 'Прямой участок', 10, 300], ['depthOffset', 'Сдвиг трассы назад', 0, 1500]].map(([key, label, min, max]) => <NumberField key={key} {...{ label, min, max }} value={c[key]} onChange={value => edit({ [key]: value })} />)}
      <NumberField label="Масса одного разъёма" unit="г" value={c.connectorMass} min={0} max={500} onChange={value => edit({ connectorMass: value })} />
    </div><p className="cad-help">Координаты портов приближённые. Уточните по своему аппарату; смещение задаётся от положения в модели.</p>
      {['fromOffset', 'toOffset'].map((key, k) => <div key={key}><p className="cad-mini-title">{k ? 'Конец: поправка XYZ' : 'Начало: поправка XYZ'}</p><div className="cad-fields three">{c[key].map((v, i) => <NumberField key={i} label={['X', 'Y', 'Z'][i]} value={v} onChange={value => edit({ [key]: c[key].map((a, j) => j === i ? value : a) })} />)}</div></div>)}
    </Group>
    <Group title="Управляющие точки трассы"><p className="cad-help">Автомаршрут выходит назад и огибает заднюю кромку. В ручном режиме задайте углы ломаной: редактор скруглит их заданным радиусом, если хватает места.</p>
      {!c.waypoints.length ? <button className="cad-button" onClick={() => edit({ waypoints: route.vertices.slice(1, -1).map(p => p.map(v => Math.round(v))) })}>Редактировать точки</button> : <>
        {c.waypoints.map((point, i) => <div className="cad-hole" key={i}><b>Точка {i + 1}</b><div className="cad-fields three">{point.map((v, k) => <NumberField key={k} label={['X', 'Y', 'Z'][k]} value={v} onChange={value => edit({ waypoints: c.waypoints.map((a, j) => j === i ? a.map((b, l) => l === k ? value : b) : a) })} />)}</div><button className="cad-text-button" onClick={() => edit({ waypoints: c.waypoints.filter((_, j) => i !== j) })}>Убрать точку</button></div>)}
        <div className="cad-actions"><button className="cad-button" onClick={() => edit({ waypoints: [...c.waypoints, c.waypoints.at(-1).map((v, i) => i === 2 ? v - 150 : v)] })}>＋ Точка</button><button className="cad-button" onClick={() => edit({ waypoints: [] })}>Автомаршрут</button></div>
      </>}
    </Group>
  </>;
}

export default function CabinetPanel() {
  const state = useWorkshopStore();
  const { project: p, mode, selection, setMode, select, update, undo, redo } = state;
  const { xray, exploded, setXray, setExploded } = useCabinetStore();
  const fileRef = useRef();
  const [importError, setImportError] = useState('');
  const shelves = useMemo(() => sortedShelves(p), [p]);
  const routes = useMemo(() => routeAllCables(p), [p]);
  const issues = useMemo(() => [...validateConstruction(p), ...routes.flatMap(r => r.issues.map(message => ({ severity: 'error', message: `${r.cable.name}: ${message}` })))], [p, routes]);
  const shelf = p.shelves.find(s => selection?.type === 'shelf' && s.id === selection.id) || shelves[0];
  const eq = p.equipment.find(e => selection?.type === 'equipment' && e.id === selection.id) || p.equipment[0];
  const route = routes.find(r => selection?.type === 'cable' && r.cable.id === selection.id) || routes.find(r => r.cable.id === 'p_rusich_a2') || routes[0];
  const height = Math.max(...p.shelves.map(s => s.y + s.thickness));
  const routingDepth = Math.ceil(p.depth / 2 - Math.min(...routes.flatMap(r => r.points.map(pt => pt[2]))));
  useEffect(() => {
    const keydown = e => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || !(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      if (e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  }, [undo, redo]);
  return <section className="cabinet-workspace cad-workspace">
    <header className="cabinet-heading">
      <div><p className="cabinet-eyebrow">AUDIO SETUP / DESIGN WORKSHOP</p><h1>Мастерская стойки</h1><p>Конструкция, сверловка и кабельные трассы в одном проекте.</p></div>
      <div className="cad-actions"><span className="cad-draft">Проект · на согласование</span><button className="cad-button" onClick={() => downloadText('audio-rack.json', JSON.stringify(p, null, 2), 'application/json')}>Сохранить JSON</button><button className="cad-button" onClick={() => fileRef.current.click()}>Открыть</button></div>
      <input hidden ref={fileRef} type="file" accept=".json,application/json" onChange={async e => {
        const file = e.target.files?.[0]; if (!file) return;
        try { if (file.size > 500000) throw new Error('Файл больше 500 КБ'); const ok = state.commit(migrateLegacyProject(JSON.parse(await file.text()))); if (!ok) throw new Error('Формат проекта не прошёл проверку'); select(null); setImportError(''); } catch (err) { setImportError(err.message); }
        e.target.value = '';
      }} />
    </header>
    <nav className="cad-modes" aria-label="Разделы редактора">{[['structure', '01', 'Конструкция'], ['equipment', '02', 'Аппараты'], ['cables', '03', 'Кабели'], ['production', '04', 'Чертежи и детали']].map(([id, no, label]) => <button key={id} aria-pressed={mode === id} onClick={() => setMode(id)}><small>{no}</small>{label}</button>)}</nav>
    <div className="cad-topbar"><div className="cad-actions"><button className="cad-button" disabled={!state.past.length} onClick={undo} title="Ctrl+Z">↶ Отменить</button><button className="cad-button" disabled={!state.future.length} onClick={redo} title="Ctrl+Y">↷ Вернуть</button></div><div className="cad-actions">{[['perspective', '3D'], ['front', 'Спереди'], ['rear', 'Сзади'], ['side', 'Сбоку'], ['top', 'Сверху']].map(([id, label]) => <button className="cad-button" key={id} aria-pressed={state.cameraView === id} onClick={() => state.view(id)}>{label}</button>)}</div></div>
    {(state.editError || state.storageError || importError) && <p role="alert" className="cad-alert">{state.editError || state.storageError || importError}</p>}
    <div className="cabinet-layout cad-layout"><div className="cabinet-main">
      <CabinetView3D />
      <div className="cad-view-options">{[['showEquipment', 'Аппараты'], ['showCables', 'Кабели'], ['showDimensions', 'Размеры']].map(([key, label]) => <label key={key}><input type="checkbox" checked={state[key]} onChange={() => state.toggle(key)} />{label}</label>)}<label><input type="checkbox" checked={xray} onChange={() => setXray()} />X-ray</label><label><input type="checkbox" checked={exploded} onChange={() => setExploded()} />Разнести детали</label></div>
      <div className="cad-stats"><div><small>СТОЙКА, Ш × В × Г</small><b>{p.width} × {Math.round(height)} × {p.depth}<i> мм</i></b></div><div><small>С КАБЕЛЬНОЙ ЗОНОЙ</small><b>{routingDepth}<i> мм в глубину</i></b></div><div><small>В ПРОЕКТЕ</small><b>{p.shelves.length}<i> полки · </i>{p.cables.length}<i> линий</i></b></div></div>
      <details className={`cad-validation ${issues.length ? 'has-issues' : ''}`} open={issues.some(i => i.severity === 'error')}><summary>{issues.length ? `${issues.length} замечаний к компоновке` : 'Геометрия: пересечений с мебелью и техникой не найдено'}</summary><p>Проверяются отверстия, размещение аппаратов, заданные зазоры, длина и изгибы трасс. Размеры разъёмов и профили кабелей требуют измерений.</p>{issues.map((issue, i) => <p key={i}>• {issue.message}</p>)}</details>
      {mode === 'production' && <div className="cad-drawing"><h2>{shelf.name} · карта сверловки</h2><div dangerouslySetInnerHTML={{ __html: panelSVG(p, shelf) }} /><p>DXF — 1:1 в миллиметрах. Все отверстия сквозные. Просмотр не задаёт допуски изготовления.</p></div>}
    </div>
    <aside className="cabinet-inspector cad-inspector">
      {mode === 'structure' && <>
        <Group title="Габарит и опоры"><div className="cad-fields"><NumberField label="Ширина стойки" value={p.width} min={400} max={1600} onChange={v => state.resize('width', v)} /><NumberField label="Глубина стойки" value={p.depth} min={300} max={900} onChange={v => state.resize('depth', v)} /><NumberField label="Ось опоры от боковины" value={p.postInsetX} min={25} max={180} onChange={v => update({ postInsetX: v })} /><NumberField label="Ось опоры от торца" value={p.postInsetZ} min={25} max={180} onChange={v => update({ postInsetZ: v })} /><NumberField label="Наружный Ø втулки" value={p.postDiameter} min={30} max={80} onChange={v => update({ postDiameter: v })} /></div></Group>
        <MaterialPicker materials={CABINET_FINISHES} selectedId={p.material} onSelect={material => update({ material })} />
        <Group title="Детали · сверху вниз"><div className="cad-part-list">{[...shelves].reverse().map(s => <button key={s.id} aria-pressed={selection?.id === s.id} onClick={() => select({ type: 'shelf', id: s.id })}><b>{s.name}</b><span>{s.width} × {s.depth} × {s.thickness} · Y {s.y}</span></button>)}</div><button className="cad-button" onClick={state.addShelf} disabled={p.shelves.length >= 10}>＋ Добавить полку</button></Group>
        <ShelfEditor state={state} shelf={shelf} />
        <Group title="Узел опоры M16"><p className="cad-help">Полка зажата между шайбами и гайками. Сквозная шпилька M16×2, отверстие Ø18; шайбы 17×30×3; гайки S24, H14,8. Чёрные втулки закрывают шпильку между полками. Резьба показана условно.</p><p className="cad-help">Подбор класса прочности, опорной площади и затяжки — после расчёта нагрузки и выбора древесины.</p></Group>
      </>}
      {mode === 'equipment' && <>
        <Group title="Выберите аппарат"><div className="cad-part-list">{p.equipment.map(e => <button key={e.id} aria-pressed={eq?.id === e.id} onClick={() => select({ type: 'equipment', id: e.id })}><b>{DEVICE_SPECS[e.id].name}</b><span>{p.shelves.find(s => s.id === e.shelfId).name}</span></button>)}</div></Group>
        {eq && <Group title={DEVICE_SPECS[eq.id].name}>{EQUIPMENT_PHYSICAL[eq.id].photo && <img className="cad-device-photo" src={EQUIPMENT_PHYSICAL[eq.id].photo} alt={DEVICE_SPECS[eq.id].name} />}<p className="cad-help">{EQUIPMENT_PHYSICAL[eq.id].dims.w} × {EQUIPMENT_PHYSICAL[eq.id].dims.h} × {EQUIPMENT_PHYSICAL[eq.id].depthIsPlaceholder ? 'глубина неизвестна' : EQUIPMENT_PHYSICAL[eq.id].dims.d} мм · {EQUIPMENT_PHYSICAL[eq.id].weight == null ? 'масса неизвестна' : `${EQUIPMENT_PHYSICAL[eq.id].weight} кг`}</p>{EQUIPMENT_PHYSICAL[eq.id].geometryNote && <p className="cad-alert">{EQUIPMENT_PHYSICAL[eq.id].geometryNote}</p>}{eq.id === 'rusich_a2' && <p className="cad-help">Источник: {DEVICE_SPECS[eq.id].sourceDoc}</p>}<label className="cad-select">Полка<select value={eq.shelfId} onChange={e => state.editEquipment(eq.id, { shelfId: e.target.value })}>{shelves.map(s => <option key={s.id} value={s.id}>{s.name} · Y {s.y}</option>)}</select></label><div className="cad-fields"><NumberField label="X на полке" value={eq.x} min={-1000} max={1000} onChange={v => state.editEquipment(eq.id, { x: v })} /><NumberField label="Z на полке" value={eq.z} min={-600} max={600} onChange={v => state.editEquipment(eq.id, { z: v })} /></div><p className="cad-help">Аппарат стоит на выбранной полке. При перемещении кабельные трассы пересчитываются.</p></Group>}
      </>}
      {mode === 'cables' && <>
        <Group title="Задняя кабельная зона"><div className="cad-fields"><NumberField label="Вылет за кромку" value={p.rearGap} min={80} max={700} onChange={v => update({ rearGap: v })} /><NumberField label="Разнос зон питания" value={p.powerGap} min={60} max={400} onChange={v => update({ powerGap: v })} /></div><p className="cad-help">Чёрный — сигнал, синий — сеть, серый — низковольтное питание. Золотистые точки — держатели; линии — эскиз их опор. Внешние БП и распределитель требуют отдельной компоновки.</p></Group>
        <label className="cad-select">Кабель<select value={route.cable.id} onChange={e => select({ type: 'cable', id: e.target.value })}>{routes.map(r => <option key={r.cable.id} value={r.cable.id}>{r.cable.name}</option>)}</select></label>
        <CableEditor state={state} route={route} />
      </>}
      {mode === 'production' && <>
        <Group title="Файлы для согласования"><div className="cad-downloads"><button onClick={() => downloadText('rack-panels.dxf', projectDXF(p), 'application/dxf')}>↓ DXF · контуры и отверстия</button><button onClick={() => downloadText('rack-bom.csv', bomCSV(p), 'text/csv;charset=utf-8')}>↓ CSV · детали и крепёж</button><button onClick={() => downloadText('rack-drilling.csv', drillingCSV(p), 'text/csv;charset=utf-8')}>↓ CSV · координаты сверловки</button><button onClick={() => downloadText('rack-review.html', reviewHTML(p), 'text/html;charset=utf-8')}>↓ Альбом · чертежи и проверки</button><button onClick={() => downloadText('rack-project.json', JSON.stringify(p, null, 2), 'application/json')}>↓ JSON · редактируемый проект</button></div></Group>
        <Group title="Чертёж детали"><label className="cad-select">Полка<select value={shelf.id} onChange={e => select({ type: 'shelf', id: e.target.value })}>{shelves.map(s => <option value={s.id} key={s.id}>{s.name}</option>)}</select></label><button className="cad-button" onClick={() => downloadText(`${shelf.id}.svg`, panelSVG(p, shelf), 'image/svg+xml')}>↓ SVG этой полки</button></Group>
        <Group title="Перед изготовлением">{REVIEW_NOTES.map((note, i) => <p className="cad-help" key={i}>{note}</p>)}</Group>
        <Group title="Спецификация"><div className="cad-bom">{manufacturingBOM(p, routes).map((r, i) => <div key={i}><b>{r.quantity} × {r.part}</b><span>{r.description}{r.length ? ` · L ${r.length} мм` : ''}</span></div>)}</div></Group>
      </>}
      <details className="cabinet-reference"><summary>Инженерные источники</summary>{ENGINEERING_SOURCES.map(s => <p key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.name}</a></p>)}<p>Радиус по паспорту — для конкретной модели. Масса, шаг опор и разнос зон здесь задаются проектом. Редактор не утверждает улучшения звука от материалов кабеля.</p></details>
    </aside></div>
  </section>;
}
