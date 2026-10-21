import { Component, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Html, OrbitControls, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { routingScene, ROUTING_NAMES } from '../data/routingScene';
import { portLabel } from '../data/roomIntelligence';

class SceneBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="routing-scene-empty"><b>Объёмный вид недоступен</b><p>Подключения можно редактировать в обычной схеме.</p><button onClick={this.props.onFallback}>Открыть разъёмы</button></div> : this.props.children; }
}

function Camera({ layout, view, reset }) {
  const { camera, size, invalidate } = useThree(), controls = useRef();
  const zoom = Math.min(size.width / (layout.width + .6), size.height / (layout.depth * (view === 'top' ? 1 : .63) + 1.25));
  useEffect(() => {
    const [x, , z] = layout.center;
    camera.position.set(x, view === 'top' ? 22 : 13, z + (view === 'top' ? .01 : 16));
    camera.lookAt(x, 0, z); camera.zoom = zoom; camera.updateProjectionMatrix();
    controls.current?.target.set(x, 0, z); controls.current?.update(); invalidate();
  }, [camera, layout, view, reset, zoom, invalidate]);
  return <OrbitControls ref={controls} makeDefault enableDamping={false} minPolarAngle={.01} maxPolarAngle={Math.PI / 2.6} minZoom={zoom * .65} maxZoom={zoom * 2.8} />;
}

function DeviceModel({ id }) {
  const speaker = id.startsWith('ae'), sub = id.startsWith('rel');
  if (speaker || sub) return <group position={[0, speaker ? .57 : .37, 0]}>
    <RoundedBox args={speaker ? [.42, 1.05, .48] : [.76, .62, .62]} radius={.035} smoothness={3} castShadow receiveShadow><meshPhysicalMaterial color={speaker ? '#1c232c' : '#7c838b'} metalness={.15} roughness={speaker ? .16 : .48} clearcoat={speaker ? 1 : .15} /></RoundedBox>
    {(speaker ? [-.25, .04, .30] : [0]).map((y, i) => <group key={i} position={[0, y, speaker ? .25 : .32]}><mesh><torusGeometry args={[speaker ? i === 2 ? .065 : .135 : .235, .014, 8, 24]} /><meshStandardMaterial color="#38414b" metalness={.65} roughness={.25}/></mesh><mesh rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[speaker ? i === 2 ? .057 : .12 : .22, speaker ? .1 : .18, .02, 24]}/><meshStandardMaterial color="#192029" roughness={.65}/></mesh></group>)}
  </group>;
  const dark = ['wiim', 'rusich', 'e1'].includes(id), power = ['pdu','side0','side1'].includes(id);
  return <group>
    <RoundedBox args={[power ? 1.5 : 1.8, power ? .18 : .42, .76]} radius={.055} smoothness={3} position={[0,power ? .19 : .27,0]} castShadow receiveShadow><meshPhysicalMaterial color={power ? '#444e5e' : dark ? '#343b46' : '#cbd5df'} roughness={dark ? .3 : .24} metalness={.55} clearcoat={.35}/></RoundedBox>
    {!power && id !== 'e1' && <><mesh rotation={[Math.PI/2,0,0]} position={[.55,.2,.395]}><cylinderGeometry args={[.085,.085,.06,24]}/><meshStandardMaterial color="#d2dce4" metalness={.85} roughness={.23}/></mesh><mesh position={[-.62,.2,.39]}><sphereGeometry args={[.022,8,8]}/><meshBasicMaterial color="#93d9ee"/></mesh></>}
    {id === 'freya' && [.3,.62].flatMap(x => [-.18,.18].map(z => <group key={`${x}-${z}`} position={[x,.64,z]}><mesh><cylinderGeometry args={[.073,.075,.29,16]}/><meshPhysicalMaterial color="#e5eff2" transparent opacity={.7} roughness={.1} metalness={.1}/></mesh><mesh><cylinderGeometry args={[.027,.027,.22,10]}/><meshStandardMaterial color="#bd8245" emissive="#b76b25" emissiveIntensity={.18}/></mesh></group>))}
    {id === 'e1' && <group position={[-.3,.5,0]}><mesh><cylinderGeometry args={[.33,.33,.025,40]}/><meshStandardMaterial color="#161b22" metalness={.35} roughness={.28}/></mesh><mesh position={[0,.017,0]}><cylinderGeometry args={[.08,.08,.012,20]}/><meshStandardMaterial color="#789aa6"/></mesh></group>}
    {power && Array.from({length:id === 'pdu' ? 8 : 3},(_,i) => <mesh key={i} position={[-.62+i*1.24/(id === 'pdu' ? 7 : 2),.29,0]} rotation={[-Math.PI/2,0,0]}><torusGeometry args={[.055,.012,8,16]}/><meshStandardMaterial color="#b8c0c8" metalness={.4}/></mesh>)}
  </group>;
}

function Wire({ wire, active, selected, onSelect, label }) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(wire.points.map(p => new THREE.Vector3(...p)), false, 'centripetal'), [wire.points]);
  const arrow = useMemo(() => ({ position: curve.getPoint(.69), rotation: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), curve.getTangent(.69).normalize()) }), [curve]);
  const color = selected ? '#187ac5' : wire.loose ? '#b85f33' : wire.style.color;
  return <group>
    <mesh onClick={e => { e.stopPropagation(); onSelect(wire); }}><tubeGeometry args={[curve,48,.12,6,false]}/><meshBasicMaterial transparent opacity={0} depthWrite={false}/></mesh>
    <mesh castShadow><tubeGeometry args={[curve,48,selected ? .047 : .027,8,false]}/><meshStandardMaterial color={color} metalness={.35} roughness={.3} transparent opacity={active || selected ? 1 : .2}/></mesh>
    {!wire.loose && <mesh position={arrow.position} quaternion={arrow.rotation}><coneGeometry args={[.085,.20,12]}/><meshStandardMaterial color={color} transparent opacity={active || selected ? 1 : .25}/></mesh>}
    {wire.points.filter((_,i) => i === 0 || i === wire.points.length - 1).map((p,i) => <mesh key={i} position={p}><sphereGeometry args={[.055,12,8]}/><meshStandardMaterial color={color} metalness={.55} roughness={.25}/></mesh>)}
    {label && <Html center position={curve.getPoint(.5).toArray()} zIndexRange={[8,0]}><button className="routing-wire-tag" onClick={() => onSelect(wire)}>{wire.style.name} {wire.loose ? '· обрыв' : '→'}</button></Html>}
  </group>;
}

function Scene({ layout, trace, device, selectedCable, onDevice, onCable, view, reset, focusPath }) {
  const [hovered, setHovered] = useState(null);
  return <>
    <color attach="background" args={['#e8f0f3']}/><fog attach="fog" args={['#e8f0f3',35,65]}/>
    <ambientLight intensity={1.15}/><hemisphereLight args={['#f9feff','#b4c5d1',1.5]}/>
    <directionalLight position={[-5,12,6]} intensity={2.8} castShadow shadow-mapSize={[1024,1024]} shadow-camera-left={-15} shadow-camera-right={15} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-normalBias={.025}/>
    <directionalLight position={[8,5,-8]} intensity={1.5} color="#c1e9ff"/>
    <Camera layout={layout} view={view} reset={reset}/>
    <mesh rotation={[-Math.PI/2,0,0]} position={[layout.center[0],-.08,layout.center[2]]} receiveShadow><planeGeometry args={[70,70]}/><meshStandardMaterial color="#e5edf1" roughness={.85}/></mesh>
    {layout.nodes.map(n => <group key={n.id} position={n.position} onClick={e => { e.stopPropagation(); onDevice(n.id); }}>
      <RoundedBox args={[2.1,.07,1.2]} radius={.08} smoothness={3} position={[0,-.015,0]} receiveShadow><meshPhysicalMaterial color={device === n.id ? '#b1dbf0' : '#e8f0f5'} roughness={.2} metalness={.12} clearcoat={1}/></RoundedBox>
      <DeviceModel id={n.id}/>
      <Html center position={[0,.05,.91]} zIndexRange={[10,0]}><button className="routing-device-label" data-active={!focusPath || trace.devices.has(n.id)} aria-pressed={device === n.id} aria-label={`Аппарат в объёмной схеме: ${n.name}`} onClick={() => onDevice(n.id)}><b>{ROUTING_NAMES[n.id] || n.name}</b><span>{n.id.startsWith('rel') ? 'Саб · HIGH LEVEL' : n.id.startsWith('ae') ? 'Колонка · + / −' : n.id === 'skoll' ? 'Фонокорректор' : ['bifrost','warmer'].includes(n.id) ? 'ЦАП' : n.stage}{n.status ? ' · план' : ''}</span></button></Html>
    </group>)}
    {layout.wires.map(w => <group key={w.id} onPointerOver={e => { e.stopPropagation(); setHovered(w.id); }} onPointerOut={() => setHovered(null)}><Wire wire={w} active={!focusPath || trace.cables.has(w.id)} selected={selectedCable === w.id} onSelect={onCable} label={hovered === w.id || selectedCable === w.id}/></group>)}
  </>;
}

export default function RoutingScene3D({ rows, kind, device, selectedCable, onDevice, onCable, trace, onFallback }) {
  const host = useRef(), [portrait,setPortrait] = useState(false), [showIdle,setShowIdle] = useState(false), [view,setView] = useState('volume'), [reset,setReset] = useState(0);
  useEffect(() => { const observer = new ResizeObserver(([entry]) => setPortrait(entry.contentRect.width < 650)); observer.observe(host.current); return () => observer.disconnect(); }, []);
  const layout = useMemo(() => routingScene(rows,{kind,showIdle,portrait}),[rows,kind,showIdle,portrait]);
  const selected = rows.find(c => c.id === selectedCable);
  return <section ref={host} className="routing-volume" data-portrait={portrait} aria-label="Объёмная схема сигнала">
    <div className="routing-volume-controls"><span>ОБЪЁМНЫЙ ТРАКТ</span><div><button aria-pressed={view === 'top'} onClick={() => setView(view === 'top' ? 'volume' : 'top')}>{view === 'top' ? 'Перспектива' : 'Сверху'}</button><button onClick={() => {setView('volume');setReset(n => n+1);}}>Вместить</button><label><input type="checkbox" checked={showIdle} onChange={e => setShowIdle(e.target.checked)}/>Все аппараты</label></div></div>
    {layout.nodes.length ? <SceneBoundary onFallback={onFallback}><Canvas className="routing-webgl" orthographic shadows dpr={[1,1.5]} frameloop="demand" camera={{position:[0,18,12],zoom:45,near:.1,far:100}} gl={{antialias:true,alpha:false}} fallback={<span aria-hidden="true">Объёмная схема; текстовая версия доступна во вкладке «Кабели».</span>}><Scene layout={layout} trace={trace} device={device} selectedCable={selectedCable} onDevice={onDevice} onCable={onCable} view={view} reset={reset} focusPath={kind === 'audio'}/></Canvas></SceneBoundary> : <div className="routing-scene-empty"><b>Нет кабелей по этому фильтру</b><p>Включи все аппараты или выбери другой слой.</p></div>}
    <div className="routing-volume-caption" role="status">{selected ? <span><b>{portLabel(selected.from)}</b> → {portLabel(selected.to)}</span> : <span>Нажми аппарат или кабель · тяни для вращения · щипок / колесо — масштаб</span>}</div>
  </section>;
}
