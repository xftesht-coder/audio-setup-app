import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_ROOM_CABLES, ROOM_PORT_MAP } from '../data/roomEquipment.js';
import { connectionCheck, restoreRoomCables, roomPreset } from '../data/roomWiring.js';

let storageFailed=false;
const storage=createJSONStorage(()=>({
  getItem(key){try{return localStorage.getItem(key);}catch{storageFailed=true;return null;}},
  setItem(key,value){try{localStorage.setItem(key,value);}catch{storageFailed=true;}},
  removeItem(key){try{localStorage.removeItem(key);}catch{storageFailed=true;}},
}));

export const useRoomWiring=create(persist((set,get)=>({
  cables:structuredClone(DEFAULT_ROOM_CABLES),past:[],future:[],selectedPort:null,selectedCable:null,message:'Выбери разъём на аппарате или в списке.',
  commit(cables,message) {set(s=>({cables,past:[...s.past,s.cables].slice(-30),future:[],selectedPort:null,selectedCable:null,message}));if(storageFailed&&typeof window!=='undefined')set({message:message+' Сохранение в браузере недоступно; скачай схему перед закрытием.'});},
  pickPort(id) {
    const s=get(),port=ROOM_PORT_MAP[id];if(!port)return;
    if(port.reserved){set({message:port.reserved});return;}
    if(!s.selectedPort) {
      const connected=s.cables.filter(c=>c.from===id||c.to===id);
      if(connected.length>=port.capacity){s.selectCable(connected[0].id);return;}
      set({selectedPort:id,selectedCable:null,message:`${port.label}: выбери совместимый ${port.direction==='out'?'вход':'выход'}.`});return;
    }
    if(s.selectedPort===id){get().cancel();return;}
    const pending=s.selectedCable?s.cables.find(c=>c.id===s.selectedCable&&(!c.from||!c.to)):null;
    const check=connectionCheck(s.selectedPort,id,s.cables,pending?.id);
    if(!check.ok){set({message:check.reason});return;}
    const cable={id:pending?.id||`patch-${crypto.randomUUID()}`,from:check.from,to:check.to,fromType:ROOM_PORT_MAP[check.from].connector,toType:ROOM_PORT_MAP[check.to].connector};
    s.commit(pending?s.cables.map(c=>c.id===pending.id?cable:c):[...s.cables,cable],check.note||'Кабель подключён. Схема сохранена в этом браузере.');
  },
  selectCable(id){const c=get().cables.find(c=>c.id===id);if(!c)return;const loose=!c.from||!c.to;set({selectedCable:id,selectedPort:loose?(c.from||c.to):null,message:loose?'Свободный штекер: выбери совместимый разъём.':'Выбери конец кабеля, который нужно отсоединить.'});},
  unplug(id,end) {
    const s=get(),c=s.cables.find(c=>c.id===id);if(!c?.[end])return;
    const other=end==='from'?'to':'from';
    if(!c[other]){s.commit(s.cables.filter(k=>k.id!==id),'Кабель снят.');return;}
    const p=ROOM_PORT_MAP[c[end]].position;
    s.commit(s.cables.map(k=>k.id===id?{...k,[end]:null,loose:[p[0]+.045,.46,Math.max(.022,p[2]-.15)]}:k),'Свободный штекер: выбери новый совместимый разъём.');
    set({selectedCable:id,selectedPort:c[other]});
  },
  remove(id){const s=get();s.commit(s.cables.filter(c=>c.id!==id),'Кабель убран. Действие можно отменить.');},
  cancel(){set({selectedPort:null,selectedCable:null,message:'Выбери разъём или кабель.'});},
  undo(){const s=get();if(!s.past.length)return;set({cables:s.past.at(-1),past:s.past.slice(0,-1),future:[s.cables,...s.future],selectedPort:null,selectedCable:null,message:'Действие отменено.'});},
  redo(){const s=get();if(!s.future.length)return;set({cables:s.future[0],past:[...s.past,s.cables],future:s.future.slice(1),selectedPort:null,selectedCable:null,message:'Действие повторено.'});},
  preset(name){get().commit(roomPreset(name),'Схема применена. Это проект подключения; выбор активных входов выполняется на аппаратах.');},
}),{name:'audio-room-wiring-v1',version:1,storage,partialize:s=>({cables:s.cables}),merge:(saved,current)=>({...current,cables:restoreRoomCables(saved?.cables??DEFAULT_ROOM_CABLES)})}));
