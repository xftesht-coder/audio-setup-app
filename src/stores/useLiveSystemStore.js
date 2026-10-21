import { create } from 'zustand';
import { useRoomWiring } from '../store/roomWiringStore.js';
import { useWorkshopStore } from './useWorkshopStore.js';
import { recoverableStorage } from '../data/recoverableStorage.js';
import { captureLiveSystem, mergeLiveVariants, parseLiveJson, parseLiveSnapshot, sameSystem, validateLiveVariants, variantName } from '../data/liveSystem.js';

export const LIVE_SYSTEM_STORAGE_KEY = 'audio-live-system-v1';

// One durable record and one timeline: restoring a variant must never reload
// the wiring from one version and the cabinet from another.
export function createLiveSystemStore(room, workshop, storage = () => globalThis.localStorage, makeId = () => crypto.randomUUID()) {
  const persistence = recoverableStorage(LIVE_SYSTEM_STORAGE_KEY, storage, makeId);
  let applying = false;
  const capture = () => captureLiveSystem(room.getState(), workshop.getState());
  const install = snapshot => {
    applying = true;
    try {
      const { cables, listening, components } = snapshot.room;
      const roomState = { cables, listening, components };
      room.setState({ ...structuredClone(roomState), past: [], future: [], selectedPort: null, selectedCable: null, replacement: null, storageError: '', message: 'Система восстановлена. Изменение можно отменить.' });
      const { activeVariant, variants } = structuredClone(snapshot.workshop);
      workshop.setState({ activeVariant, variants, project: variants[activeVariant], past: [], future: [], selection: null, dragging: false, mode: 'structure', editError: '', storageError: '', cameraRevision: workshop.getState().cameraRevision + 1 });
    } finally { applying = false; }
  };
  const initial = { current: capture(), variants: [], storageError: '' };
  try {
    const saved = persistence.read(text => {
      const data = parseLiveJson(text);
      if (data?.version !== 1) throw new Error('Неизвестная версия');
      return { current: parseLiveSnapshot(data.current), variants: validateLiveVariants(data.variants) };
    });
    if (saved) { Object.assign(initial, saved); install(saved.current); }
  } catch { initial.storageError = 'Общий проект не удалось прочитать. Исходная запись сохранена; открыты прежние данные комнаты и стойки.'; }

  const store = create((set, get) => {
    const write = (current, variants) => {
      try {
        const value = { version: 1, current, variants };
        parseLiveJson(JSON.stringify(value)); // Apply the same size limit on write and reload.
        persistence.write(value);
        set({ storageError: '' });
        return true;
      } catch {
        set({ storageError: 'Браузер не сохранил общий проект. Скачай варианты и текущую систему перед закрытием. Переключение и отмена заблокированы до успешного сохранения.' });
        return false;
      }
    };
    const restore = (current, past, future, message) => {
      if (!write(current, get().variants)) return false;
      install(current);
      set({ current, past, future, message });
      return true;
    };
    const saveLibrary = (variants, changes = {}) => {
      if (!write(get().current, variants)) return false;
      set({ variants, ...changes });
      return true;
    };
    return {
      ...initial, past: [], future: [], deleted: null, message: '',
      record() {
        if (applying) return;
        const current = capture(), s = get();
        if (sameSystem(current, s.current)) return;
        set({ current, past: [...s.past, s.current].slice(-30), future: [], message: 'Изменения текущей системы можно отменить. Сохранённые варианты не меняются.' });
        write(current, s.variants);
      },
      saveVariant(name) {
        const item = { id: makeId(), name: variantName(name), snapshot: structuredClone(get().current) };
        const variants = validateLiveVariants([...get().variants, item]);
        return saveLibrary(variants, { message: `Вариант «${item.name}» сохранён.` }) ? item.id : null;
      },
      loadVariant(id) {
        const s = get(), item = s.variants.find(v => v.id === id);
        if (!item) return false;
        if (sameSystem(item.snapshot, s.current)) return true;
        return restore(item.snapshot, [...s.past, s.current].slice(-30), [], `Открыт «${item.name}». Проводку, входы и стойку можно вернуть кнопкой «Отменить».`);
      },
      undo() { const s = get(); return s.past.length ? restore(s.past.at(-1), s.past.slice(0, -1), [s.current, ...s.future], 'Действие отменено для всей системы.') : false; },
      redo() { const s = get(); return s.future.length ? restore(s.future[0], [...s.past, s.current].slice(-30), s.future.slice(1), 'Действие повторено для всей системы.') : false; },
      deleteVariant(id) {
        const s = get(), deleted = s.variants.find(v => v.id === id);
        return deleted ? saveLibrary(s.variants.filter(v => v.id !== id), { deleted, message: `Удалён «${deleted.name}». Можно вернуть.` }) : false;
      },
      restoreDeleted() {
        const s = get();
        if (!s.deleted) return false;
        return saveLibrary(validateLiveVariants([...s.variants, s.deleted]), { deleted: null, message: 'Вариант возвращён.' });
      },
      renameVariant(id, name) {
        const variants = validateLiveVariants(get().variants.map(v => v.id === id ? { ...v, name: variantName(name) } : v));
        return saveLibrary(variants, { message: 'Название сохранено.' });
      },
      importFile(text) {
        const variants = mergeLiveVariants(text, get().variants, makeId), count = variants.length - get().variants.length;
        return saveLibrary(variants, { message: `Добавлено вариантов: ${count}. Текущая система не менялась.` }) ? count : null;
      },
      retrySave() { return write(get().current, get().variants); },
    };
  });
  // Selection, camera and drag flags do not belong to project history.
  const stopRoom = room.subscribe((next, previous) => {
    if (next.cables !== previous.cables || next.listening !== previous.listening || next.components !== previous.components) store.getState().record();
  });
  const stopWorkshop = workshop.subscribe((next, previous) => {
    if (next.project !== previous.project || next.activeVariant !== previous.activeVariant || next.variants !== previous.variants) store.getState().record();
  });
  store.dispose = () => { stopRoom(); stopWorkshop(); };
  return store;
}

export const useLiveSystemStore = createLiveSystemStore(useRoomWiring, useWorkshopStore);
