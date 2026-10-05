import { Component, lazy, Suspense, useState } from 'react';
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
  return <section className={`listening-room ${compact ? 'listening-room-compact' : ''}`} aria-label="Комната аудиосистемы">
    {!compact && <header className="room-heading"><p className="share-eyebrow">AUDIO SETUP · LISTENING ROOM</p><h1>Место для музыки.</h1><p>Чёрный лак, белая шерсть и тёплый свет.</p></header>}
    <div className="room-toolbar">
      <div role="group" aria-label="Режим просмотра">{[['photo', 'Фото'], ['3d', 'Открыть 3D']].map(([id, label]) => <button key={id} aria-pressed={mode === id} onClick={() => setMode(id)}>{label}</button>)}</div>
      {mode === '3d' && <div role="group" aria-label="Ракурс камеры"><button aria-pressed={view === 'room'} onClick={() => setView('room')}>Комната</button><button aria-pressed={view === 'system'} onClick={() => setView('system')}>Система</button></div>}
      <span>BLENDER SCENE · 05.10.2026</span>
    </div>
    <div className="room-stage">
      <img className="room-poster" src={LISTENING_ROOM.poster} alt="Аудиосистема с чёрными глянцевыми AE320, двумя REL Quake, белым ковром и двумя лампами в светлой комнате" />
      {mode === '3d' && !unavailable && <div className="room-canvas"><RoomBoundary><Suspense fallback={<p className="room-loading" role="status">Готовим 3D…</p>}><RoomView3D view={view} onUnavailable={() => setUnavailable(true)} /></Suspense></RoomBoundary></div>}
      {unavailable && mode === '3d' && <p className="room-error" role="status">3D недоступно — показываем рендер комнаты.</p>}
      <div className="room-caption"><b>AE320 · Piano Gloss Black</b><span>2 × REL Quake · серые корпуса · Quincey 200 × 300 см</span></div>
    </div>
    <p className="share-footnote">{mode === '3d' ? 'Вращайте мышью или пальцем. Колесо или жест двумя пальцами — приблизить.' : 'Рендер из Blender. Кнопка «Открыть 3D» включает вращение и приближение.'}</p>
    <div className="room-facts">
      <article><span className="share-eyebrow">АКУСТИКА</span><h3>Чёрный рояльный лак</h3><p>Acoustic Energy AE320, два корпуса. Световые отражения показывают глянец; диффузоры и подвесы остаются матовыми.</p><a href={LISTENING_ROOM.speakerSource} target="_blank" rel="noreferrer">Паспорт AE320 ↗</a></article>
      <article><span className="share-eyebrow">НИЗКИЕ ЧАСТОТЫ</span><h3>Два серых REL Quake</h3><p>253 × 294 × 272 мм · 7,4 кг каждый. Закрытый корпус, 200-мм динамик направлен вниз. Серый цвет — по уточнению владельца.</p><a href={REL_QUAKE.source} target="_blank" rel="noreferrer">Руководство REL ↗</a></article>
      <article><span className="share-eyebrow">ФАКТУРА</span><h3>Quincey · 200 × 300 см</h3><p>Белый ковёр с рельефными дугами, окантовкой и бахромой по твоим фотографиям. Кабели проходят за системой, вне ковра.</p></article>
    </div>
    <div className="room-power-grid">{SIDE_POWER_STRIPS.map(strip => <article key={strip.id}><h3>{strip.name} · 3 розетки</h3><p>{strip.outlets.join(' · ')}</p><small>{strip.note}</small></article>)}</div>
    <div className="room-lighting-link"><div><b>Освещение · Govee</b><p>Модели выбираем из каталога. Лампы в рендере пока показывают только места установки.</p></div><a href="/#lighting">Открыть каталог ↗</a></div>
    <p className="share-note">{REL_QUAKE.connection.note} В схеме эти два соединения отмечены как неподтверждённые.</p>
    <p className="room-truth">{LISTENING_ROOM.notes} В сцене восемь аппаратов, включая планируемые Freya 2, WARMER и Bifrost 3. Сцена комнаты — сохранённая визуализация; изменения стойки в редакторе не перестраивают её автоматически.</p>
  </section>;
}
