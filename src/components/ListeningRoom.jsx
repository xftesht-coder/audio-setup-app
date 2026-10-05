import { Component, lazy, Suspense, useRef, useState } from 'react';
import { LISTENING_ROOM, REL_QUAKE, SIDE_POWER_STRIPS } from '../data/listeningRoom';

const RoomView3D = lazy(() => import('./RoomView3D'));
class RoomBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <p className="room-error" role="status">3D не загрузилось. Вид «Фото» доступен выше.</p> : this.props.children;
  }
}

export default function ListeningRoom({ compact = false }) {
  const [mode, setMode] = useState('photo');
  const [view, setView] = useState('room');
  const [unavailable, setUnavailable] = useState(false);
  const stage=useRef();
  const [fullscreenError,setFullscreenError]=useState('');
  const interactive=mode!=='photo';
  return <section className={`listening-room ${compact ? 'listening-room-compact' : ''}`} aria-label="Комната аудиосистемы">
    {!compact && <header className="room-heading"><p className="share-eyebrow">AUDIO SETUP · LISTENING ROOM</p><h1>Место для музыки.</h1><p>Чёрный лак, белая шерсть и тёплый свет.</p></header>}
    <div className="room-toolbar">
      <div role="group" aria-label="Режим просмотра">{[['photo', 'Фото'], ['3d', 'Открыть 3D'], ['walk', 'Прогулка · WASD']].map(([id, label]) => <button key={id} aria-pressed={mode === id} onClick={() => setMode(id)}>{label}</button>)}</div>
      {mode === 'photo' && <div role="group" aria-label="Ракурс фотографии"><button aria-pressed={view !== 'cables'} onClick={() => setView('room')}>Комната</button><button aria-pressed={view === 'cables'} onClick={() => setView('cables')}>Кабели крупно</button></div>}
      {mode === '3d' && <div role="group" aria-label="Ракурс камеры"><button aria-pressed={view === 'room'} onClick={() => setView('room')}>Комната</button><button aria-pressed={view === 'system'} onClick={() => setView('system')}>Система</button><button aria-pressed={view === 'cables'} onClick={() => setView('cables')}>Кабели</button></div>}
      {interactive && <button className="room-fullscreen" onClick={async()=>{try{await stage.current.requestFullscreen();setFullscreenError('');}catch{setFullscreenError('Полный экран недоступен в этом браузере. Прогулка работает в окне.');}}}>На весь экран</button>}
      <span>ОБНОВЛЁННАЯ КОМНАТА</span>
    </div>
    <div ref={stage} className={`room-stage ${mode==='walk'?'room-stage-walk':''}`}>
      <button className="room-exit-fullscreen" onClick={()=>document.exitFullscreen?.()}>Выйти из полного экрана</button>
      <img className="room-poster" src={mode === 'photo' && view === 'cables' ? LISTENING_ROOM.cablePoster : LISTENING_ROOM.poster} alt={mode === 'photo' && view === 'cables' ? 'Вид за стойкой: свободные кабельные петли, мягкие держатели и напольные опоры; задняя стена скрыта для осмотра' : 'Аудиосистема с чёрными глянцевыми AE320, двумя серыми REL Quake, белым ковром и двумя лампами в светлой комнате'} />
      {interactive && !unavailable && <div className="room-canvas"><RoomBoundary><Suspense fallback={<p className="room-loading" role="status">Готовим 3D…</p>}><RoomView3D view={view} walking={mode==='walk'} onUnavailable={() => setUnavailable(true)} /></Suspense></RoomBoundary></div>}
      {unavailable && interactive && <p className="room-error" role="status">3D недоступно — показываем рендер комнаты.</p>}
      {mode!=='walk' && <div className="room-caption"><b>{view === 'cables' ? 'Свободные петли · мягкие крепления' : 'AE320 · Piano Gloss Black'}</b><span>{view === 'cables' ? 'Общие выходы Rusich → AE320 + REL HIGH LEVEL' : '2 × REL Quake · серые корпуса · Quincey 200 × 300 см'}</span></div>}
    </div>
    <p className="share-footnote">{mode==='walk'?'Нажми «Войти в комнату»: WASD / стрелки — шаг, мышь — обзор, Esc — пауза. На телефоне поворачивай пальцем и используй кнопки шагов.':mode === '3d' ? view === 'cables' ? 'Вид сзади: стена временно скрыта, видны опоры, запас кабеля и общие выходы Rusich. Вращайте мышью или пальцем; колесо — приблизить.' : 'Вращайте мышью или пальцем. Колесо или жест двумя пальцами — приблизить.' : 'Рендер из Blender. Открой 3D или зайди в комнату в режиме прогулки.'}</p>
    {fullscreenError && <p className="share-note" role="status">{fullscreenError}</p>}
    <div className="room-facts">
      <article><span className="share-eyebrow">АКУСТИКА</span><h3>Чёрный рояльный лак</h3><p>Acoustic Energy AE320, два корпуса. Световые отражения показывают глянец; диффузоры и подвесы остаются матовыми.</p><a href={LISTENING_ROOM.speakerSource} target="_blank" rel="noreferrer">Паспорт AE320 ↗</a></article>
      <article><span className="share-eyebrow">НИЗКИЕ ЧАСТОТЫ</span><h3>Два серых REL Quake</h3><p>253 × 294 × 272 мм · 7,4 кг каждый. Закрытый корпус, 200-мм динамик направлен вниз. Серый цвет — по уточнению владельца.</p><a href={REL_QUAKE.source} target="_blank" rel="noreferrer">Руководство REL ↗</a></article>
      <article><span className="share-eyebrow">ФАКТУРА И СВЕТ</span><h3>Quincey · 200 × 300 см</h3><p>Скульптурный ворс, тканая основа и бахрома. Масляный дуб, льняные шторы и мягкий свет из окна; подвесная люстра — проектный вариант.</p></article>
    </div>
    <div className="room-power-grid">{SIDE_POWER_STRIPS.map(strip => <article key={strip.id}><h3>{strip.name} · 3 розетки</h3><p>{strip.outlets.join(' · ')}</p><small>{strip.note}</small></article>)}</div>
    <div className="room-lighting-link"><div><b>Освещение · Govee</b><p>Модели выбираем из каталога. Лампы в рендере пока показывают только места установки.</p></div><a href="/#lighting">Открыть каталог ↗</a></div>
    <div className="room-lighting-link"><div><b>Укладка кабелей</b><p>{LISTENING_ROOM.cabling.note}</p></div><a href={LISTENING_ROOM.cabling.reference} target="_blank" rel="noreferrer">Референс Pinterest ↗</a></div>
    <p className="share-note">{REL_QUAKE.connection.note}</p>
    <p className="room-truth">{LISTENING_ROOM.notes} В сцене восемь аппаратов, включая планируемые Freya 2, WARMER и Bifrost 3. Сцена комнаты — сохранённая визуализация; изменения стойки в редакторе не перестраивают её автоматически.</p>
  </section>;
}
