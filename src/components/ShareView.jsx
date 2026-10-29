import { Component, lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { isLegacyShareHash, readLiveShare, sharedRoomScene } from '../data/liveShare';
import { ROOM_DEVICE_MAP, ROOM_PORT_MAP } from '../data/roomEquipment';
import { ROOM_DIMENSIONS } from '../data/roomSceneLayout';
import { auditRoom, portLabel } from '../data/roomIntelligence';
import { equipmentName } from '../data/equipmentProfiles';
import { FREYA_MODES } from '../data/roomPassports';
import '../shareSnapshot.css';

const RoomView3D = lazy(() => import('./RoomView3D'));
const LegacyShareView = lazy(() => import('./LegacyShareView'));
const routeStatus = { ready: 'Входы совпадают', possible: 'Путь по кабелям', missing: 'Нет пути', blocked: 'Другой вход', unknown: 'Вход не указан' };
const sceneFallback = <p className="shared-scene-error" role="status">3D недоступно. Состав, размеры и подключения этого снимка доступны ниже.</p>;

class SharedSceneBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? sceneFallback : this.props.children; }
}

function SnapshotView({ shared }) {
  const [view, setView] = useState('room'), [unavailable, setUnavailable] = useState(false);
  const { snapshot, name } = shared, { room, workshop } = snapshot;
  const scene = useMemo(() => sharedRoomScene(snapshot), [snapshot]);
  const audit = useMemo(() => auditRoom(room.cables, room.listening.source, room.listening), [room]);
  const project = scene.project;
  return <main className="shared-snapshot">
    <header className="shared-heading"><div><small>AUDIO SETUP · СНИМОК · ТОЛЬКО ПРОСМОТР</small><h1>{name}</h1></div><span>{ROOM_DIMENSIONS.width} × {ROOM_DIMENSIONS.depth} м · {workshop.activeVariant === 'tv' ? 'ТВ · два уровня' : 'Высокая стойка'}</span></header>
    <section className="shared-room" aria-label="Комната сохранённого варианта">
      <div className="shared-camera" role="group" aria-label="Ракурс снимка">{[['room', 'Комната'], ['system', 'Стойка'], ['cables', 'Проводка']].map(([id, label]) => <button key={id} aria-pressed={view === id} onClick={() => setView(id)}>{label}</button>)}</div>
      <div className="shared-canvas"><SharedSceneBoundary>{unavailable ? sceneFallback : <Suspense fallback={<p className="shared-scene-error" role="status">Загружаем комнату из снимка…</p>}><RoomView3D scene={scene} view={view} onUnavailable={() => setUnavailable(true)} fallback={sceneFallback} /></Suspense>}</SharedSceneBoundary></div>
      <p className="shared-camera-hint">Вращай мышью или пальцем · колесо / щипок — приблизить</p>
    </section>
    <details className="shared-details"><summary>Состав и подключения <span>{room.cables.length} кабелей · {project.width} × {project.depth} мм</span></summary>
      <div className="shared-detail-body">
        <p><b>Источник:</b> {ROOM_DEVICE_MAP[room.listening.source].name} → <b>ЦАП:</b> {ROOM_DEVICE_MAP[room.components.dac]?.name || 'Не выбран'} → <b>Предусилитель:</b> {ROOM_DEVICE_MAP[room.components.preamp]?.name || 'Не выбран'}</p>
        <p><b>{project.name}</b> · {project.shelves.length} полок · {{ walnut: 'Орех', oak: 'Дуб', alder: 'Ольха' }[project.material]}. На полках: {project.equipment.map(equipmentName).join(' · ')}.</p>
        <div className="shared-routes">{audit.routes.map(r => <span key={r.id}>{r.name} · <b>{routeStatus[r.status]}</b></span>)}</div>
        <details><summary>Входы и проверка · {audit.findings.length} замечаний</summary><p>Режим: {room.listening.mode === 'selected' ? 'С выбранными входами' : 'Только пути по кабелям'}. Freya: {FREYA_MODES[room.listening.freyaMode]?.label || 'режим не указан'}.</p><ul>{Object.entries(room.listening.inputs).map(([id, port]) => <li key={id}>{ROOM_DEVICE_MAP[id].name} — {ROOM_PORT_MAP[port]?.label || 'Вход не указан'}</li>)}</ul><ul>{audit.findings.map(f => <li key={f.id}><b>{f.title}.</b> {f.evidence}</li>)}</ul></details>
        <ul className="shared-cables" aria-label="Кабели сохранённого варианта">{room.cables.map(c => <li key={c.id}><span>{portLabel(c.from)}</span><span aria-hidden="true">→</span><span>{portLabel(c.to)}</span></li>)}</ul>
        <p className="shared-note">Снимок показывает сохранённый проект. Планируемые устройства и неизвестные параметры не подтверждают наличие техники или электрическое согласование.</p>
      </div>
    </details>
    <p className="shared-footer">Этот просмотр не меняет твои сохранённые варианты и настройки.</p>
  </main>;
}

export default function ShareView() {
  const [hash, setHash] = useState(() => window.location.hash);
  const [result, setResult] = useState(null);
  useEffect(() => { const update = () => setHash(window.location.hash); window.addEventListener('hashchange', update); return () => window.removeEventListener('hashchange', update); }, []);
  useEffect(() => {
    let cancelled = false;
    if (!isLegacyShareHash(hash)) readLiveShare(hash).then(shared => { if (!cancelled) setResult({ hash, shared }); }, error => { if (!cancelled) setResult({ hash, error: error.message }); });
    return () => { cancelled = true; };
  }, [hash]);
  if (isLegacyShareHash(hash)) return <Suspense fallback={<p className="page-loading">Открываем демонстрацию…</p>}><LegacyShareView /></Suspense>;
  if (result?.hash !== hash) return <p className="page-loading" role="status">Читаем сохранённый вариант…</p>;
  if (result.error) return <main className="shared-invalid" role="alert"><small>AUDIO SETUP</small><h1>Не удалось открыть вариант</h1><p>{result.error}</p><p>Твои настройки не изменены.</p></main>;
  return <SnapshotView key={hash} shared={result.shared} />;
}
