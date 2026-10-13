import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment, Html, Lightformer, OrbitControls, useGLTF } from '@react-three/drei';
import { LISTENING_ROOM } from '../data/listeningRoom';
import { WALK_ROOM } from '../data/roomNavigation';
import WalkCamera from './WalkCamera';
import RoomWiring3D from './RoomWiring3D';
import { ROOM_DEVICE_MAP } from '../data/roomEquipment';

function ContextLifecycle({ onUnavailable }) {
  const { gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = event => { event.preventDefault(); onUnavailable?.(); };
    canvas.addEventListener('webglcontextlost', lost);
    return () => canvas.removeEventListener('webglcontextlost', lost);
  }, [gl, onUnavailable]);
  return null;
}

function RoomModel({ walking, view, lighting, onReady }) {
  const { scene } = useGLTF(LISTENING_ROOM.model, '/draco/');
  const { gl, invalidate } = useThree();
  const model = useMemo(() => {
    const copy = scene.clone(true);
    const owned = new Map();
    const anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    copy.traverse(object => {
      if (!object.isMesh) return;
      const cloneMaterial = material => { if (!owned.has(material)) owned.set(material, material.clone()); return owned.get(material); };
      object.material=Array.isArray(object.material)?object.material.map(cloneMaterial):cloneMaterial(object.material);
      const materials=Array.isArray(object.material)?object.material:[object.material];
      materials.forEach(material => {
        for (const texture of [material.map, material.normalMap, material.roughnessMap]) {
          if (texture && texture.anisotropy !== anisotropy) {
            texture.anisotropy = anisotropy;
            texture.needsUpdate = true;
          }
        }
      });
      // Large bevelled room shells self-shadow with seams in a finite shadow map.
      // Keep their received furniture shadows; the window key supplies interior light.
      object.castShadow = !materials.some(m => m.transmission > 0 || /Limewash|chalk white/.test(m.name)) && !object.name.includes('daylight');
      object.receiveShadow = true;
    });
    return { scene:copy, materials:[...owned.values()] };
  }, [scene, gl]);
  useLayoutEffect(() => {
    model.scene.traverse(object => {
      if (!object.isMesh) return;
      object.visible = walking || !/^Architecture[ _]cutaway/.test(object.name);
      if (!walking && ['cables','service'].includes(view) && /^Cable[ _]access/.test(object.name)) object.visible = false;
    });
    for (const material of model.materials) {
      if (material.name === 'Window | soft garden daylight') {
        if (!material.userData.dayColor) {
          material.userData.dayColor = material.color.toArray();
          material.userData.dayEmissive = material.emissive.toArray();
        }
        material.color.fromArray(lighting === 'evening' ? [.015,.025,.05] : material.userData.dayColor);
        material.emissive.fromArray(lighting === 'evening' ? [.025,.05,.10] : material.userData.dayEmissive);
      }
      if (/warm opal|warm diffuser/.test(material.name)) {
        if (material.userData.dayEmission === undefined) material.userData.dayEmission = material.emissiveIntensity;
        material.emissiveIntensity = material.userData.dayEmission * (lighting === 'evening' ? 2.4 : 1);
      }
    }
    gl.toneMappingExposure = lighting === 'evening' ? 1.08 : .98;
    invalidate();
  }, [model, walking, view, lighting, gl, invalidate]);
  useEffect(() => () => { for (const material of model.materials) material.dispose(); }, [model]);
  useEffect(() => { onReady(true); }, [onReady]);
  return <primitive object={model.scene} dispose={null} />;
}

function Camera({ view, device, front }) {
  const controls = useRef();
  const { camera, invalidate, size } = useThree();
  useEffect(() => {
    const d=ROOM_DEVICE_MAP[device];
    const target = view==='seat' ? [0,.36,3.79] : view==='service' ? [d.center[0],d.center[2],-d.center[1]] : view === 'cables' ? [0, .32, -.40] : view === 'system' ? [0, .64, 0] : [0, .48, .55];
    const position = view==='seat' ? [1.25,1.1,2.0] : view==='service' ? [target[0]+(front?.07:0),target[1]+(front?.24:.055),target[2]+(front?1:-1)*Math.max(.55,d.size[0]*1.9)] : view === 'cables' ? [2.5, 1.65, -3.6] : view === 'system' ? [1.8, 1.5, 4.5] : [3.25, 2.45, 5.3];
    if(view==='service'&&/^(pdu|side)/.test(device)){position[0]=target[0]+.15;position[1]=.9;position[2]=target[2]-.20;}
    const fit = Math.max(1, 1.5 / (size.width / size.height));
    camera.position.set(...position.map((v, i) => target[i] + (v - target[i]) * fit));
    camera.fov=['cables','service'].includes(view) ? 43 : 32;camera.updateProjectionMatrix();
    controls.current.target.set(...target);
    controls.current.update();
    invalidate();
  }, [view, device, front, camera, invalidate, size.width, size.height]);
  return <OrbitControls ref={controls} makeDefault enablePan={view==='service'} minDistance={view==='service'?.18:1.5} maxDistance={9}
    minPolarAngle={.2} maxPolarAngle={Math.PI / 2 + (view==='service'?.25:-.015)} minAzimuthAngle={['cables','service','seat'].includes(view) ? -Infinity : -1.3} maxAzimuthAngle={['cables','service','seat'].includes(view) ? Infinity : 1.3} />;
}

export default function RoomView3D({ view = 'room', walking = false, editing=false, device='freya', front=false, lighting='day', onEdit, onUnavailable }) {
  const controller=useRef();
  const [status,setStatus]=useState('ready'),[ready,setReady]=useState(false),[position,setPosition]=useState(WALK_ROOM.start);
  const evening=lighting==='evening';
  return <div className={`room-renderer ${walking?'is-walking':''}`}><Canvas frameloop="demand" shadows dpr={[1, 1.5]} camera={{ position: [3.25, 2.45, 5.3], fov: 32, near: .03, far: 35 }}
    fallback={<p className="room-loading">На этом устройстве доступен вид «Фото».</p>}>
    <ContextLifecycle onUnavailable={onUnavailable} />
    <color attach="background" args={[evening?'#282a30':'#d6d2c8']} />
    <hemisphereLight args={[evening?'#7c94c9':'#edf3ff', '#9b8567', evening?.18:.38]} />
    <directionalLight position={[-3.8, 4, 3]} color={evening?'#8ba7e1':'#f2f5ff'} intensity={evening?.24:2.4} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-3.5} shadow-camera-right={3.5} shadow-camera-top={4} shadow-camera-bottom={-4} shadow-camera-near={.5} shadow-camera-far={14} shadow-bias={-.0001} shadow-normalBias={.001} />
    <pointLight position={[0,2.22,1.65]} intensity={evening?13:3} color="#ffd49a" distance={7} decay={2} />
    <pointLight position={[-1.86,1.15,.05]} intensity={evening?3.2:.65} color="#ffca8a" distance={3.5} decay={2} />
    <pointLight position={[1.86,1.15,.05]} intensity={evening?3.2:.65} color="#ffca8a" distance={3.5} decay={2} />
    <directionalLight position={[2, 2.6, 4]} intensity={evening?.1:.24} color="#ffe9ce" />
    {['cables','service'].includes(view) && !walking && <directionalLight position={[0, 2.5, -3]} intensity={1.1} />}
    <Environment key={lighting} resolution={256}>
      <color attach="background" args={[evening?'#202736':'#77786e']} />
      <Lightformer form="rect" intensity={evening?.12:1.1} scale={[.6, 3, 1]} position={[-1, 1.7, 4]} rotation={[0, Math.PI, 0]} />
      <Lightformer form="rect" intensity={evening?.25:1.1} scale={[.8, 4, 1]} position={[2, 1.7, 4]} rotation={[0, Math.PI, 0]} />
      <Lightformer form="rect" intensity={evening?.22:3} color={evening?'#9cb6f0':'#fff4df'} scale={[3, 4, 1]} position={[-3, 2, 2]} rotation={[0, Math.PI / 3, 0]} />
      <Lightformer form="rect" intensity={evening?.65:1.2} color="#ffdcac" scale={[1, 3, 1]} position={[3, 2, 0]} rotation={[0, -Math.PI / 2, 0]} />
      <Lightformer form="ring" intensity={evening?3:1.5} color="#ffe0b3" scale={[1.1, 1.1, 1]} position={[0, 2.3, 1.65]} rotation={[Math.PI / 2, 0, 0]} />
    </Environment>
    <Suspense fallback={<Html center><span className="room-loading" role="status">Загружаем комнату…</span></Html>}><RoomModel walking={walking} view={view} lighting={lighting} onReady={setReady} />
      <RoomWiring3D editing={editing&&!front} device={device}/>
      {walking ? <WalkCamera controller={controller} onStatus={setStatus} onPosition={setPosition} /> : <Camera view={view} device={device} front={front} />}
    </Suspense>
  </Canvas>
    {walking && ready && <>
      <div className="walk-status" role="status">{status==='locked'?'WASD · мышь · Esc — пауза':status==='drag'?'WASD · тяни изображение для поворота · Esc — пауза':'Прогулка по комнате'}</div>
      {status==='ready' && <div className="walk-start"><button onClick={()=>controller.current?.enter()}>Войти в комнату</button><p>WASD или стрелки · мышь — обзор<br/>Esc — освободить курсор</p></div>}
      {status==='locked' && <span className="walk-crosshair" aria-hidden="true">+</span>}
      <div className="walk-tools"><button onClick={()=>controller.current?.reset()}>К креслу</button><button onClick={()=>controller.current?.behind()}>Зайти за стойку</button><button onClick={()=>{controller.current?.pause();onEdit?.();}}>Подключить кабели</button><button onClick={()=>controller.current?.pause()}>Пауза</button></div>
      <div className="walk-pad" role="group" aria-label="Шаги по комнате"><button aria-label="Шаг вперёд" onClick={()=>controller.current?.step(1,0)}>↑</button><div><button aria-label="Шаг влево" onClick={()=>controller.current?.step(0,-1)}>←</button><button aria-label="Шаг назад" onClick={()=>controller.current?.step(-1,0)}>↓</button><button aria-label="Шаг вправо" onClick={()=>controller.current?.step(0,1)}>→</button></div></div>
      <svg className="walk-map" viewBox="-3 -1.4 6 6.6" role="img" aria-label="Положение в комнате: зелёная точка — вы"><title>План комнаты</title><rect x={WALK_ROOM.minX} y={WALK_ROOM.minZ} width={5.4} height={5.99} rx=".07" className="map-room"/>{WALK_ROOM.obstacles.map((o,i)=><rect key={i} x={o.minX} y={o.minZ} width={o.maxX-o.minX} height={o.maxZ-o.minZ} className="map-furniture"/>)}<circle cx={position.x} cy={position.z} r=".14" className="map-person"/></svg>
    </>}
  </div>;
}
