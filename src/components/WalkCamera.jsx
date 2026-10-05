import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Euler } from 'three';
import { moveInRoom, WALK_ROOM, walkingDelta } from '../data/roomNavigation';

const KEYS = { KeyW:'forward', ArrowUp:'forward', KeyS:'back', ArrowDown:'back', KeyA:'left', ArrowLeft:'left', KeyD:'right', ArrowRight:'right' };
export default function WalkCamera({ controller, onStatus, onPosition }) {
  const { camera, gl, invalidate } = useThree();
  const input = useRef({ keys:new Set(), active:false, yaw:0, pitch:0, drag:null, lastReport:0 });
  useEffect(() => {
    const state=input.current, canvas=gl.domElement, euler=new Euler(0,0,0,'YXZ');
    onStatus('ready');
    camera.position.set(WALK_ROOM.start.x,WALK_ROOM.eyeHeight,WALK_ROOM.start.z);
    camera.fov=62; camera.updateProjectionMatrix(); camera.lookAt(0,1.1,0);
    euler.setFromQuaternion(camera.quaternion); state.yaw=euler.y;state.pitch=euler.x;
    canvas.tabIndex=0; canvas.setAttribute('aria-label','Прогулка по комнате. WASD или стрелки — движение, Esc — пауза.');
    const report=()=>onPosition({x:camera.position.x,z:camera.position.z});
    const move=(forward,right,seconds=.05)=>{
      const {dx,dz}=walkingDelta(forward,right,state.yaw,seconds);
      const pos=moveInRoom(camera.position,dx,dz);
      camera.position.set(pos.x,WALK_ROOM.eyeHeight,pos.z);invalidate();report();
    };
    const activate=()=>{ state.active=true;canvas.focus({preventScroll:true});onStatus('drag');invalidate(); };
    const pause=()=>{state.keys.clear();state.drag=null;state.active=false;onStatus('ready');if(document.pointerLockElement===canvas)document.exitPointerLock();};
    const enter=()=>{
      activate();
      try { const promise=canvas.requestPointerLock?.();promise?.catch(()=>{if(state.active)onStatus('drag');}); } catch { if(state.active)onStatus('drag'); }
    };
    const lockChange=()=>{
      if(document.pointerLockElement===canvas){state.active=true;onStatus('locked');}
      else {state.keys.clear();state.active=false;onStatus('ready');}
    };
    const lockError=()=>{if(state.active)onStatus('drag');};
    const rotate=(dx,dy)=>{
      state.yaw-=dx*.0022;state.pitch=Math.max(-1.25,Math.min(1.25,state.pitch-dy*.0022));
      camera.quaternion.setFromEuler(euler.set(state.pitch,state.yaw,0));invalidate();
    };
    const mouseMove=e=>{if(document.pointerLockElement===canvas)rotate(e.movementX,e.movementY);};
    const keyDown=e=>{
      if(e.code==='Escape'){pause();return;}
      if(e.code==='Tab'){pause();return;}
      if(!state.active || document.activeElement!==canvas && document.pointerLockElement!==canvas || e.altKey || e.ctrlKey || e.metaKey)return;
      const key=KEYS[e.code];if(!key)return;
      e.preventDefault();
      // A single accessible key press produces a small step; holding it continues per frame.
      if(!state.keys.has(key))move(key==='forward'?1:key==='back'?-1:0,key==='right'?1:key==='left'?-1:0,1/60);
      state.keys.add(key);invalidate();
    };
    const keyUp=e=>state.keys.delete(KEYS[e.code]);
    const down=e=>{if(document.pointerLockElement===canvas)return;activate();state.drag={x:e.clientX,y:e.clientY,id:e.pointerId};canvas.setPointerCapture(e.pointerId);};
    const pointerMove=e=>{if(!state.drag || state.drag.id!==e.pointerId)return;rotate(e.clientX-state.drag.x,e.clientY-state.drag.y);state.drag={x:e.clientX,y:e.clientY,id:e.pointerId};};
    const up=()=>{state.drag=null;};
    const visibility=()=>{if(document.hidden)pause();};
    const focusOut=e=>{if(e.relatedTarget!==canvas && document.pointerLockElement!==canvas){state.keys.clear();state.active=false;onStatus('ready');}};
    controller.current={ enter, pause, step:(f,r)=>{activate();for(let i=0;i<4;i++)move(f,r,.05);}, reset:()=>{pause();camera.position.set(WALK_ROOM.start.x,WALK_ROOM.eyeHeight,WALK_ROOM.start.z);camera.lookAt(0,1.1,0);euler.setFromQuaternion(camera.quaternion);state.yaw=euler.y;state.pitch=euler.x;invalidate();report();} };
    const events=[[document,'keydown',keyDown],[document,'keyup',keyUp],[document,'mousemove',mouseMove],[document,'pointerlockchange',lockChange],[document,'pointerlockerror',lockError],[document,'visibilitychange',visibility],[window,'blur',pause],[canvas,'pointerdown',down],[canvas,'pointermove',pointerMove],[canvas,'pointerup',up],[canvas,'pointercancel',up],[canvas,'lostpointercapture',up],[canvas,'blur',focusOut]];
    events.forEach(([target,name,fn])=>target.addEventListener(name,fn));invalidate();report();
    return ()=>{events.forEach(([target,name,fn])=>target.removeEventListener(name,fn));if(document.pointerLockElement===canvas)document.exitPointerLock();controller.current=null;state.keys.clear();state.active=false;canvas.removeAttribute('tabindex');canvas.removeAttribute('aria-label');};
  },[camera,gl,invalidate,controller,onStatus,onPosition]);
  useFrame((_,delta)=>{
    const state=input.current;if(!state.active || !state.keys.size)return;
    const forward=Number(state.keys.has('forward'))-Number(state.keys.has('back'));
    const right=Number(state.keys.has('right'))-Number(state.keys.has('left'));
    const {dx,dz}=walkingDelta(forward,right,state.yaw,delta);
    const pos=moveInRoom(camera.position,dx,dz);camera.position.set(pos.x,WALK_ROOM.eyeHeight,pos.z);
    state.lastReport+=delta;if(state.lastReport>.15){onPosition(pos);state.lastReport=0;}
    invalidate();
  });
  return null;
}
