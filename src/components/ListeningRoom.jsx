import { Component, lazy, Suspense, useRef, useState } from 'react';
import { LISTENING_ROOM, REL_QUAKE, SIDE_POWER_STRIPS } from '../data/listeningRoom';
import RoomPatchInspector from './RoomPatchInspector';
import PowerDistribution from './PowerDistribution';
import { GLIVER_CHAIR, ROOM_DEVICE_MAP } from '../data/roomEquipment';
import WorkspaceHeader from './WorkspaceHeader';
import { useRoomWiring } from '../store/roomWiringStore';

const RoomView3D = lazy(() => import('./RoomView3D'));
class RoomBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <p className="room-error" role="status">3D не загрузилось. Вид «Фото» доступен выше.</p> : this.props.children;
  }
}

export default function ListeningRoom({ compact = false }) {
  const [mode, setMode] = useState(() => !compact && new URLSearchParams(window.location.search).get('room') === 'patch' ? 'patch' : 'photo');
  const [view, setView] = useState('room');
  const [mobilePanel, setMobilePanel] = useState(false);
  const [lighting, setLighting] = useState('day');
  const components = useRoomWiring(s => s.components);
  const [device,setDevice]=useState(() => components.preamp || 'freya');
  const [inspectorTab,setInspectorTab]=useState('device');
  const [front,setFront]=useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const stage=useRef();
  const [fullscreenError,setFullscreenError]=useState('');
  const interactive=mode!=='photo';
  const photoDetail = mode === 'photo' && view === 'system';
  const photoCables = mode === 'photo' && view === 'cables';
  const poster = photoCables ? LISTENING_ROOM.cablePoster : photoDetail ? LISTENING_ROOM.detailPoster : lighting === 'evening' ? LISTENING_ROOM.eveningPoster : LISTENING_ROOM.poster;
  const cameraControls = <>{mode === 'photo' && <div role="group" aria-label="Ракурс фотографии"><button aria-pressed={!['cables','system'].includes(view)} onClick={() => { setView('room'); setMobilePanel(false); }}>Комната</button><button aria-pressed={view === 'cables'} onClick={() => { setView('cables'); setMobilePanel(false); }}>Кабели крупно</button><button aria-pressed={view === 'system'} onClick={() => { setView('system'); setMobilePanel(false); }}>Аппаратура крупно</button></div>}
      {mode === '3d' && <div role="group" aria-label="Ракурс камеры"><button aria-pressed={view === 'room'} onClick={() => { setView('room'); setMobilePanel(false); }}>Комната</button><button aria-pressed={view === 'system'} onClick={() => { setView('system'); setMobilePanel(false); }}>Система</button><button aria-pressed={view === 'cables'} onClick={() => { setView('cables'); setMobilePanel(false); }}>Кабели</button><button aria-pressed={view === 'seat'} onClick={() => { setView('seat'); setMobilePanel(false); }}>Кресло</button></div>}</>;
  return <section className={`listening-room ${compact ? 'listening-room-compact' : 'room-studio studio-page'}`} aria-label="Комната аудиосистемы" data-mobile-panel={mobilePanel}>
    {!compact && <WorkspaceHeader title="Комната" symbol="⌂" subtitle={<>{ROOM_DEVICE_MAP[components.dac]?.name || 'ЦАП не выбран'} → {ROOM_DEVICE_MAP[components.preamp]?.name || 'Предусилитель не выбран'} · AE320 + 2 × REL</>}><a href="#system">Каталог ↗</a><a href="#patch">Роутинг ↗</a></WorkspaceHeader>}
    <div className="room-toolbar">
      <div role="group" aria-label="Режим просмотра">{[['photo', 'Фото'], ['3d', '3D'], ['walk', 'Прогулка'], ['patch','За стойку']].map(([id, label]) => <button key={id} aria-pressed={mode === id} onClick={() => { setMode(id); setMobilePanel(false); }}>{label}</button>)}</div>
      {mode==='patch'&&<div role="group" aria-label="Сторона аппарата"><button aria-pressed={!front} onClick={()=>setFront(false)}>Разъёмы</button><button aria-pressed={front} onClick={()=>setFront(true)}>Передняя панель</button></div>}
      {compact && cameraControls}
      {(interactive || (!photoDetail && !photoCables)) && <div role="group" aria-label="Освещение">{[['day','День'],['evening','Вечер']].map(([id,label]) => <button key={id} aria-pressed={lighting===id} onClick={()=>setLighting(id)}>{label}</button>)}</div>}
      {interactive && mode!=='patch' && <button className="room-fullscreen" onClick={async()=>{try{await stage.current.requestFullscreen();setFullscreenError('');}catch{setFullscreenError('Полный экран недоступен в этом браузере. Прогулка работает в окне.');}}}>На весь экран</button>}
      {!compact && <button className="workspace-panel-toggle" aria-pressed={mobilePanel} onClick={() => setMobilePanel(!mobilePanel)}>{mobilePanel ? 'К сцене' : mode === 'patch' ? 'Разъёмы и кабели' : 'Настройки сцены'}</button>}
      <span>{mode==='patch'?'СХЕМА СОХРАНЯЕТСЯ АВТОМАТИЧЕСКИ':'ЛИЧНАЯ АУДИОСИСТЕМА'}</span>
    </div>
    <div className={`room-workspace ${!compact?'has-room-inspector':''} ${mode==='patch'?'is-patching':''}`}><div ref={stage} className={`room-stage ${mode==='photo'?'room-stage-photo':''} ${mode==='walk'?'room-stage-walk':''} ${mode==='patch'?'room-stage-patch':''}`}>
      <button className="room-exit-fullscreen" onClick={()=>document.exitFullscreen?.()}>Выйти из полного экрана</button>
      <img className="room-poster" src={poster} alt={photoDetail ? 'Крупный план аппаратуры: металлические панели, лампы Freya и деревянная стойка' : photoCables ? 'Вид за стойкой: свободные кабельные петли, мягкие держатели и напольные опоры; задняя стена скрыта для осмотра' : 'Аудиосистема с чёрными глянцевыми AE320, двумя серыми REL Quake, белым ковром и двумя лампами в светлой комнате'} />
      {interactive && !unavailable && <div className="room-canvas"><RoomBoundary><Suspense fallback={<p className="room-loading" role="status">Готовим 3D…</p>}><RoomView3D view={mode==='patch'?'service':view} walking={mode==='walk'} editing={mode==='patch'} device={device} front={front} lighting={lighting} onEdit={()=>{setFront(false);setMode('patch');setMobilePanel(false);}} onUnavailable={() => setUnavailable(true)} /></Suspense></RoomBoundary></div>}
      {unavailable && interactive && <p className="room-error" role="status">3D недоступно — показываем рендер комнаты. <button onClick={()=>setUnavailable(false)}>Повторить запуск 3D</button></p>}
      {!['walk','patch'].includes(mode) && <div className="room-caption"><b>{photoDetail?'Аппаратура · фактуры и детали':mode==='3d'&&view==='seat'?'Gliver ДеФранс · молочный велюр':view === 'cables' ? 'Свободные петли · мягкие крепления' : 'AE320 · Piano Gloss Black'}</b><span>{photoDetail?'Лампы · шлифованный алюминий · дерево':mode==='3d'&&view==='seat'?'900 × 1080 × 850 мм · по твоей спецификации':view === 'cables' ? 'Общие выходы Rusich → AE320 + REL HIGH LEVEL' : lighting==='evening'?'Вечер · тёплые лампы и мягкие отражения':'День · боковой свет и натуральные фактуры'}</span></div>}
    </div>{!compact&&mode!=='patch'&&<aside className="room-scene-inspector" aria-label="Настройки сцены"><h2>Сцена</h2><p className="scene-mode-label">{mode==='photo'?'Сохранённый рендер Blender':mode==='walk'?'Прогулка · WASD / стрелки':'3D · текущая схема подключений'}</p>{cameraControls}
      <div className="scene-facts"><h3>В комнате</h3><dl><div><dt>Акустика</dt><dd>AE320 × 2 · чёрный глянец</dd></div><div><dt>Сабвуферы</dt><dd>REL Quake × 2 · серые</dd></div><div><dt>Ковёр</dt><dd>Quincey · 200 × 300 см</dd></div><div><dt>Кресло</dt><dd>Gliver ДеФранс · молочный</dd></div></dl></div>
      <div className="scene-links"><button onClick={()=>{setFront(false);setMode('patch');setMobilePanel(false);}}>Подключения за стойкой ↗</button><a href="#lighting">Выбрать свет Govee ↗</a><a href="#cabinet">Настроить стойку ↗</a></div><p className="scene-hint">{mode==='photo'?'Фото не меняется при замене кабелей. Открой 3D, чтобы увидеть текущие подключения.':mode==='walk'?'Мышь — обзор · Esc — пауза. Кнопка «На весь экран» увеличивает пространство для прогулки.':'Вращай мышью или пальцем. Колесо — приблизить. Для работы с разъёмами зайди за стойку.'}</p>
    </aside>}{mode==='patch'&&<div className="studio-inspector room-inspector"><RoomPatchInspector device={device} onDevice={id=>{setDevice(id);setInspectorTab('device');}} compact={!compact} section={inspectorTab} onSection={setInspectorTab}/></div>}</div>
    <p className="share-footnote">{mode==='patch'?'Выход → вход: выбери точки на панели или разъёмы в списке. Кабель можно вынуть с любой стороны; зелёным отмечены совместимые разъёмы.':mode==='walk'?'WASD / стрелки — шаг · мышь — обзор · Esc — пауза. «Зайти за стойку» переносит в проход сзади.':mode === '3d' ? 'Вращай мышью или пальцем. Колесо — приблизить. Для подключения открой «За стойку».' : 'Сохранённый рендер Blender. Изменённые подключения видны в 3D.'}</p>
    {fullscreenError && <p className="share-note" role="status">{fullscreenError}</p>}
    <details className="room-specs"><summary>Состав, размеры и источники</summary><PowerDistribution/><div className="room-facts">
      <article><span className="share-eyebrow">АКУСТИКА</span><h3>Чёрный рояльный лак</h3><p>Acoustic Energy AE320, два корпуса. Световые отражения показывают глянец; диффузоры и подвесы остаются матовыми.</p><a href={LISTENING_ROOM.speakerSource} target="_blank" rel="noreferrer">Паспорт AE320 ↗</a></article>
      <article><span className="share-eyebrow">НИЗКИЕ ЧАСТОТЫ</span><h3>Два серых REL Quake</h3><p>253 × 294 × 272 мм · 7,4 кг каждый. Закрытый корпус, 200-мм динамик направлен вниз. Серый цвет — по уточнению владельца.</p><a href={REL_QUAKE.source} target="_blank" rel="noreferrer">Руководство REL ↗</a></article>
      <article><span className="share-eyebrow">ФАКТУРА И СВЕТ</span><h3>Quincey · 200 × 300 см</h3><p>Скульптурный ворс, тканая основа и бахрома. Масляный дуб, льняные шторы и мягкий свет из окна; подвесная люстра — проектный вариант.</p></article>
    </div>
    <div className="room-chair-fact"><b>{GLIVER_CHAIR.manufacturer} {GLIVER_CHAIR.model}</b><p>900 × 1080 × 850 мм · {GLIVER_CHAIR.fabric} · {GLIVER_CHAIR.color.toLowerCase()}. По спецификации владельца; форма и складки — визуальная реконструкция.</p></div>
    <div className="room-power-grid">{SIDE_POWER_STRIPS.map(strip => <article key={strip.id}><h3>{strip.name} · 3 розетки</h3><p>{strip.outlets.join(' · ')}</p><small>{strip.note}</small></article>)}</div>
    <div className="room-lighting-link"><div><b>Освещение · Govee</b><p>Модели выбираем из каталога. Лампы в рендере пока показывают только места установки.</p></div><a href="/#lighting">Открыть каталог ↗</a></div>
    <div className="room-lighting-link"><div><b>Укладка кабелей</b><p>{LISTENING_ROOM.cabling.note}</p></div><a href={LISTENING_ROOM.cabling.reference} target="_blank" rel="noreferrer">Референс Pinterest ↗</a></div>
    <p className="share-note">{REL_QUAKE.connection.note}</p>
    <p className="room-truth">{LISTENING_ROOM.notes} Восемь аппаратов включают планируемые Freya 2, WARMER и Bifrost 3. Замены ЦАПа и предусилителя в каталоге меняют эту же схему. Черновики других моделей и размеры стойки пока отдельно; изменения мебели не перестраивают комнату автоматически.</p></details>
  </section>;
}
