import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment, Html, Lightformer, OrbitControls, useGLTF } from '@react-three/drei';
import { LISTENING_ROOM } from '../data/listeningRoom';

function RoomModel() {
  const { scene } = useGLTF(LISTENING_ROOM.model, '/draco/');
  const model = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse(object => { if (object.isMesh) { object.castShadow = !object.name.toLowerCase().includes('plaster'); object.receiveShadow = true; } });
    return copy;
  }, [scene]);
  return <primitive object={model} dispose={null} />;
}

function Camera({ view }) {
  const controls = useRef();
  const { camera, invalidate, size } = useThree();
  useEffect(() => {
    const target = view === 'system' ? [0, .54, 0] : [0, .48, .55];
    const position = view === 'system' ? [1.8, 1.5, 4.5] : [3.25, 2.45, 5.3];
    const fit = Math.max(1, 1.5 / (size.width / size.height));
    camera.position.set(...position.map((v, i) => target[i] + (v - target[i]) * fit));
    controls.current.target.set(...target);
    controls.current.update();
    invalidate();
  }, [view, camera, invalidate, size.width, size.height]);
  return <OrbitControls ref={controls} makeDefault enablePan={false} minDistance={1.5} maxDistance={9}
    minPolarAngle={.2} maxPolarAngle={Math.PI / 2 - .015} minAzimuthAngle={-1.3} maxAzimuthAngle={1.3} />;
}

export default function RoomView3D({ view = 'room', onUnavailable }) {
  return <Canvas frameloop="demand" shadows dpr={[1, 1.5]} camera={{ position: [3.25, 2.45, 5.3], fov: 32, near: .03, far: 35 }}
    onCreated={({ gl }) => { gl.domElement.addEventListener('webglcontextlost', onUnavailable, { once: true }); }}
    fallback={<p className="room-loading">На этом устройстве доступен вид «Фото».</p>}>
    <color attach="background" args={['#d6d2c8']} />
    <hemisphereLight args={['#fff9ef', '#ad9f8c', 1.6]} />
    <directionalLight position={[-3, 5, 4]} intensity={2} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={4} shadow-camera-bottom={-4} shadow-bias={-.0003} shadow-normalBias={.015} shadow-radius={3} />
    <directionalLight position={[3, 3, -1]} intensity={.6} />
    <Environment resolution={128}>
      <color attach="background" args={['#77786e']} />
      <Lightformer form="rect" intensity={2} scale={[.6, 3, 1]} position={[-1, 1.7, 4]} rotation={[0, Math.PI, 0]} />
      <Lightformer form="rect" intensity={2} scale={[.8, 4, 1]} position={[2, 1.7, 4]} rotation={[0, Math.PI, 0]} />
      <Lightformer form="rect" intensity={3} color="#fff4df" scale={[3, 5, 1]} position={[-3, 2, 2]} rotation={[0, Math.PI / 3, 0]} />
      <Lightformer form="rect" intensity={2} scale={[1, 4, 1]} position={[3, 2, 0]} rotation={[0, -Math.PI / 2, 0]} />
      <Lightformer form="rect" intensity={1.5} scale={[5, 4, 1]} position={[0, 4, 0]} rotation={[Math.PI / 2, 0, 0]} />
    </Environment>
    <Suspense fallback={<Html center><span className="room-loading" role="status">Загружаем комнату…</span></Html>}><RoomModel /></Suspense>
    <Camera view={view} />
  </Canvas>;
}
