import { create } from 'zustand';
import { DEFAULT_ROOM_CABLES, ROOM_PORT_MAP } from '../data/roomEquipment.js';
import { connectionCheck, roomPreset } from '../data/roomWiring.js';
import { parseRoomSnapshot, roomSnapshot } from '../data/roomBackup.js';
import { defaultListening, parseListening } from '../data/roomListening.js';

export const ROOM_STORAGE_KEY = 'audio-room-state-v2';
export const LEGACY_ROOM_STORAGE_KEY = 'audio-room-wiring-v1';
const snapshot = s => ({ cables: s.cables, listening: s.listening });

export function createRoomWiringStore(storage = () => globalThis.localStorage, makeId = () => crypto.randomUUID()) {
  let initial = { cables: structuredClone(DEFAULT_ROOM_CABLES), listening: defaultListening() };
  let raw = null, unreadableRaw = null, readFailed = false, readComplete = false, storageError = '';
  let message = 'Выбери разъём на аппарате или в списке.';
  try {
    const target = storage();
    if (!target) throw new Error('storage unavailable');
    raw = target.getItem(ROOM_STORAGE_KEY);
    if (raw !== null) { readComplete = true; initial = parseRoomSnapshot(raw); }
    else {
      const legacy = target.getItem(LEGACY_ROOM_STORAGE_KEY);
      readComplete = true;
      if (legacy !== null) {
        const saved = JSON.parse(legacy);
        if (saved?.version !== 1 || !saved.state) throw new Error('legacy version');
        initial = parseRoomSnapshot(JSON.stringify({ version: 1, cables: saved.state.cables }));
        message = 'Подключения перенесены. Старая копия сохранена; выбранные входы пока неизвестны.';
      }
    }
  } catch {
    unreadableRaw = raw;
    readFailed = !readComplete;
    storageError = 'Сохранённую схему не удалось прочитать. Исходная запись сохранена; сейчас показана базовая схема.';
  }
  return create((set, get) => {
    const persist = changes => {
      set(changes);
      try {
        const target = storage();
        if (!target || readFailed) throw new Error('storage unavailable');
        if (unreadableRaw !== null) {
          const key = `${ROOM_STORAGE_KEY}-recovery-${makeId()}`;
          if (target.getItem(key) !== null) throw new Error('recovery collision');
          target.setItem(key, unreadableRaw);
          unreadableRaw = null;
        }
        target.setItem(ROOM_STORAGE_KEY, JSON.stringify(roomSnapshot(get())));
        set({ storageError: '' });
      } catch { set({ storageError: 'Изменения работают в этой вкладке, но не сохранены. Скачай схему перед закрытием; исходные записи не удалены.' }); }
    };
    return {
  ...initial,storageError,past:[],future:[],selectedPort:null,selectedCable:null,message,
  commit(cables,message,listening=get().listening) {const s=get();persist({cables,listening,past:[...s.past,snapshot(s)].slice(-30),future:[],selectedPort:null,selectedCable:null,message});},
  setListening(changes) {
    const s=get(),listening=parseListening({...s.listening,...changes,inputs:{...s.listening.inputs,...changes.inputs}});
    if(JSON.stringify(listening)===JSON.stringify(s.listening))return;
    s.commit(s.cables,'Настройки прослушивания сохранены. Реальные переключатели аппаратов меняются вручную.',listening);
  },
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
    const cable={id:pending?.id||`patch-${makeId()}`,from:check.from,to:check.to,fromType:ROOM_PORT_MAP[check.from].connector,toType:ROOM_PORT_MAP[check.to].connector};
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
  undo(){const s=get();if(!s.past.length)return;persist({...s.past.at(-1),past:s.past.slice(0,-1),future:[snapshot(s),...s.future],selectedPort:null,selectedCable:null,message:'Действие отменено.'});},
  redo(){const s=get();if(!s.future.length)return;persist({...s.future[0],past:[...s.past,snapshot(s)],future:s.future.slice(1),selectedPort:null,selectedCable:null,message:'Действие повторено.'});},
  preset(name){if(!['a90','bifrost','warmer'].includes(name))return;const s=get();s.commit(roomPreset(name),'Схема применена. Входы не переключались; сверь их с новым трактом.');},
  importFile(text){const {cables,listening}=parseRoomSnapshot(text);get().commit(cables,`Загружено кабелей: ${cables.length}. Схему и настройки можно вернуть кнопкой «Отменить».`,listening);},
    };
  });
}
export const useRoomWiring = createRoomWiringStore();
