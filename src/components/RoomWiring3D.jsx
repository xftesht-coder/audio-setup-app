import { useEffect, useMemo, useState } from 'react';
import { Html, useGLTF } from '@react-three/drei';
import { Curve, Vector3, TubeGeometry } from 'three';
import { ROOM_PORTS, ROOM_PORT_MAP } from '../data/roomEquipment';
import { cablePaths, connectionCheck, toWeb } from '../data/roomWiring';
import { useRoomWiring } from '../store/roomWiringStore';
import { LISTENING_ROOM } from '../data/listeningRoom';

class SampledCurve extends Curve {
  constructor(points){super();this.points=points.map(p=>new Vector3(...toWeb(p)));}
  getPoint(t,target=new Vector3()) {
    const v=Math.min(this.points.length-1,Math.max(0,t)*(this.points.length-1)),i=Math.floor(v);
    return target.copy(this.points[i]).lerp(this.points[Math.min(i+1,this.points.length-1)],v-i);
  }
}
function Lead({path,selected,onClick}) {
  const {materials}=useGLTF(LISTENING_ROOM.model,'/draco/');
  const sleeve=Object.values(materials).find(m=>m.name.includes('graphite woven'));
  const geometry=useMemo(()=>{
    const curve=new SampledCurve(path.points),g=new TubeGeometry(curve,path.points.length-1,path.radius,8,false);
    const uv=g.attributes.uv,scale=curve.getLength()/.035;
    for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*scale,uv.getY(i)*2);
    return g;
  },[path]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <group onClick={onClick}>
    <mesh geometry={geometry} castShadow receiveShadow><meshStandardMaterial color={sleeve&&path.radius>=.003?'#c8ccca':path.color} map={path.radius>=.003?sleeve?.map:null} normalMap={path.radius>=.003?sleeve?.normalMap:null} roughness={.5} metalness={.08} emissive={selected?'#97652c':'#000'} emissiveIntensity={selected ? .7 : 0}/></mesh>
    {[path.start,path.end].map((p,i)=>(i?path.endPlug:path.startPlug)&&<group key={i} position={toWeb(p)} rotation={(i?path.endAxis:path.startAxis)==='Z'?[0,0,0]:[-Math.PI/2,0,0]}>
      <mesh position={[0,(i?path.endAxis:path.startAxis)==='Z'?-.022:.010,0]} castShadow><cylinderGeometry args={[(i?path.endAxis:path.startAxis)==='Z'?.017:path.radius*1.8,(i?path.endAxis:path.startAxis)==='Z'?.017:path.radius*1.8,(i?path.endAxis:path.startAxis)==='Z'?.040:.020,16]}/><meshStandardMaterial color={(i?path.endAxis:path.startAxis)==='Z'?'#202421':'#858989'} metalness={.4} roughness={.3}/></mesh>
      {(i?path.endAxis:path.startAxis)!=='Z'&&<mesh position={[0,.025,0]}><cylinderGeometry args={[path.radius*1.25,path.radius*1.6,.012,12]}/><meshStandardMaterial color="#191c1c" roughness={.56}/></mesh>}
      {!i&&path.adapter&&<mesh position={[0,.01,0]}><boxGeometry args={[.035,.038,.045]}/><meshStandardMaterial color="#232623" roughness={.55}/></mesh>}
    </group>)}
  </group>;
}
function Cable({cable,editing,selected,onSelect}) {
  const paths=useMemo(()=>cablePaths(cable),[cable]);
  return <group>{paths.map((path,i)=><Lead key={i} path={path} selected={selected} onClick={editing?e=>{e.stopPropagation();onSelect(cable.id);}:undefined}/>)}</group>;
}
function Port({port,selected,compatible,onPick}) {
  const [hover,setHover]=useState(false);
  return <group position={toWeb([port.position[0],port.position[1]+(port.axis==='Z'?0:.016),port.position[2]+(port.axis==='Z'?.009:0)])}>
    <mesh onClick={e=>{e.stopPropagation();onPick(port.id);}} onPointerOver={e=>{e.stopPropagation();setHover(true);}} onPointerOut={()=>setHover(false)}>
      <sphereGeometry args={[.014,12,8]}/><meshBasicMaterial color={selected?'#ffd785':compatible?'#7fdfa5':'#b9c7cf'} transparent opacity={hover||selected?.8:.32} depthTest={false}/>
    </mesh>
    {(hover||selected)&&<Html center position={[0,.026,0]} style={{pointerEvents:'none'}}><span className="port-tooltip">{port.label}</span></Html>}
  </group>;
}
export default function RoomWiring3D({editing=false,device='freya'}) {
  const {cables,selectedPort,selectedCable,pickPort,selectCable}=useRoomWiring();
  return <group>
    {cables.map(c=><Cable key={c.id} cable={c} editing={editing} selected={editing&&selectedCable===c.id} onSelect={selectCable}/>)}
    {editing&&ROOM_PORTS.filter(p=>p.device===device).map(port=><Port key={port.id} port={port} selected={selectedPort===port.id} compatible={selectedPort&&connectionCheck(selectedPort,port.id,cables,selectedCable).ok} onPick={pickPort}/>)}
    {editing&&selectedPort&&ROOM_PORT_MAP[selectedPort].device!==device&&<Port port={ROOM_PORT_MAP[selectedPort]} selected onPick={pickPort}/>}
  </group>;
}
