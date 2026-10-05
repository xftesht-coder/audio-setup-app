import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Lightformer, TransformControls, Html, Line, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import ShelfMesh from './ShelfMesh';
import RackFrame from './RackFrame';
import EquipmentModel from './EquipmentModel';
import RoutedCables from './RoutedCables';
import { useCabinetStore } from '../stores/useCabinetStore';
import { useWorkshopStore } from '../stores/useWorkshopStore';
import { equipmentBoxes, sortedShelves } from '../data/workshop';
import { routeAllCables } from '../data/cableRouting';
import { AUDIO_MODELS } from '../data/audioModels';

function Movable({ selected, position, equipment, onMove, children }) {
  const controls = useRef();
  const snap = useWorkshopStore(state => state.snap);
  if (!selected) return <group position={position}>{children}</group>;
  return <TransformControls ref={controls} position={position} mode="translate" showY={!equipment} translationSnap={snap / 1000} size={1.1}
    onMouseUp={() => {

      const p = controls.current?.object?.position;
      if (p && onMove([p.x * 1000, p.y * 1000, p.z * 1000].map(n => Math.round(n * 10) / 10)) === false) p.set(...position);
    }}><group>{children}</group></TransformControls>;
}

function Scene({ readOnly = false }) {
  const state = useWorkshopStore();
  const { project: p, selection, select, editShelf, editEquipment, cameraView, cameraRevision, showEquipment, showCables, showDimensions, mode } = state;
  const { xray, exploded } = useCabinetStore();
  const shelves = useMemo(() => sortedShelves(p), [p]);
  const equipment = useMemo(() => equipmentBoxes(p), [p]);
  const routes = useMemo(() => routeAllCables(p), [p]);
  const top = Math.max(...p.shelves.map(s => s.y + s.thickness)) / 1000 + (exploded ? (shelves.length - 1) * 0.16 : 0);
  const { camera, size } = useThree();
  const orbit = useRef();
  useEffect(() => {
    const fit = Math.max(1, top / 0.9, p.width / 700) * Math.max(1, size.height / size.width * (size.width < 600 ? 1.12 : 0.85));
    const target = [0, top / 2, showCables ? -0.18 : 0];
    const directions = { perspective: [1.3, 0.75, 1.9], front: [0, 0, 3], rear: [0, 0, -3], side: [3, 0, 0], top: [0, 3, 0.001] };
    const dir = directions[cameraView];
    camera.position.set(...dir.map((v, i) => target[i] + v * fit));
    if (camera.isOrthographicCamera) { camera.zoom = Math.min(size.width / (p.width / 1000 + 0.65), size.height / (top + 0.4)); camera.updateProjectionMatrix(); }
    camera.lookAt(...target); orbit.current?.target.set(...target); orbit.current?.update();
  }, [camera, cameraView, cameraRevision, size.width, size.height, top, p.width, showCables]);
  return <>
    <color attach="background" args={['#e9e5df']} />
    <ambientLight intensity={0.6} /><hemisphereLight args={['#ffffff', '#c5b59c', 0.7]} />
    <directionalLight position={[-2, 4, 3]} intensity={2.2} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-normalBias={0.008} shadow-camera-left={-3} shadow-camera-right={3} shadow-camera-top={3} shadow-camera-bottom={-3} />
    <Environment resolution={128}><Lightformer intensity={3} position={[-3, 3, 2]} scale={[4, 4, 1]} /><Lightformer intensity={1.5} position={[3, 2, 1]} rotation={[0, -Math.PI / 2, 0]} scale={[3, 4, 1]} /></Environment>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow><planeGeometry args={[200, 200]} /><meshStandardMaterial color="#e9e5df" roughness={0.94} /></mesh>
    <gridHelper args={[6, 120, '#b8beb8', '#d4d4cc']} position={[0, 0, 0]} />
    <RackFrame project={p} ghost={xray} exploded={exploded} />
    {shelves.map((s, i) => {
      const position = [s.x / 1000, s.y / 1000 + (exploded ? i * 0.16 : 0), s.z / 1000];
      return <Movable key={`${s.id}-${s.x}-${s.y}-${s.z}`} selected={!readOnly && !exploded && selection?.type === 'shelf' && selection.id === s.id} position={position} onMove={([x, y, z]) => editShelf(s.id, { x, y, z })}>
        <ShelfMesh project={p} shelf={s} xray={xray} selected={!readOnly && selection?.id === s.id} onClick={readOnly ? undefined : e => { e.stopPropagation(); select({ type: 'shelf', id: s.id }); }} />
        {showDimensions && <Html position={[-s.width / 2000 - 0.035, s.thickness / 2000, s.depth / 2000]} center><span className="cad-dimension">{s.name} · {s.y} мм</span></Html>}
      </Movable>;
    })}
    {showEquipment && equipment.map(e => {
      const s = p.shelves.find(s => s.id === e.shelfId), index = shelves.findIndex(s => s.id === e.shelfId);
      const position = e.center.map(v => v / 1000); if (exploded) position[1] += index * 0.16 + 0.06;
      return <Movable key={`${e.id}-${e.center.join(':')}`} equipment selected={!readOnly && !exploded && selection?.type === 'equipment' && selection.id === e.id} position={position} onMove={([x, _y, z]) => editEquipment(e.id, { x: x - s.x, z: z - s.z })}>
        <group onClick={readOnly ? undefined : ev => { ev.stopPropagation(); select({ type: 'equipment', id: e.id }); }}><EquipmentModel equipmentId={e.id} profile={AUDIO_MODELS[e.modelId]} w={e.w / 1000} h={e.h / 1000} d={e.d / 1000} selected={!readOnly && selection?.id === e.id} /></group>
      </Movable>;
    })}
    {showCables && !exploded && <RoutedCables project={p} routes={routes} selection={readOnly ? null : selection} select={readOnly ? () => {} : select} detail={!readOnly && mode === 'cables'} />}
    {showDimensions && <>
      <Line points={[[-p.width / 2000, 0.04, p.depth / 2000 + 0.08], [p.width / 2000, 0.04, p.depth / 2000 + 0.08]]} color="#557363" lineWidth={1} />
      <Html position={[0, 0.04, p.depth / 2000 + 0.08]} center><span className="cad-dimension">{p.width} мм</span></Html>
    </>}
    <OrbitControls ref={orbit} makeDefault enableRotate={cameraView === 'perspective'} minDistance={0.25} maxDistance={10} maxPolarAngle={Math.PI / 2.01} enableDamping />
  </>;
}

export default function CabinetView3D({ readOnly = false }) {
  const { cameraView, select } = useWorkshopStore();
  return <div className="cabinet-stage cad-stage">
    {!readOnly && <div className="cabinet-stage-label"><span>STUDIO / WORKSHOP</span><span>мм · сетка 50 · шаг 5</span></div>}
    <Canvas shadows dpr={[1, 2]} onPointerMissed={readOnly ? undefined : () => select(null)}>
      {cameraView === 'perspective' ? <PerspectiveCamera makeDefault position={[1.3, 1.2, 1.9]} fov={38} /> : <OrthographicCamera makeDefault position={[0, 1, 3]} zoom={500} near={0.01} far={100} />}
      <Suspense fallback={null}><Scene readOnly={readOnly} /></Suspense>
    </Canvas>
    {!readOnly && <div className="cabinet-stage-hint">Клик — выбрать деталь · стрелки — переместить · колесо — масштаб</div>}
  </div>;
}
