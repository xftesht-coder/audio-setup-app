import { create } from 'zustand';
import { recoverableStorage } from '../data/recoverableStorage.js';

export const LIGHTING_STORAGE_KEY = 'audio-setup-lighting-plan-v1';
function parsePlan(raw) {
  const data = JSON.parse(raw), planned = data?.state?.planned;
  if (data?.version !== 0 || !Array.isArray(planned) || planned.length > 1000) throw new Error('plan format');
  const ids = new Set();
  return planned.map(item => {
    if (typeof item?.id !== 'string' || !item.id.trim() || item.id.length > 200 || ids.has(item.id) ||
        typeof item.name !== 'string' || !item.name.trim() || item.name.length > 300 ||
        !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) throw new Error('plan item');
    ids.add(item.id);
    return { id: item.id, name: item.name, quantity: item.quantity };
  });
}
// A local shortlist of candidates, never an assertion of owned equipment.
export function createLightingStore(storage = () => globalThis.localStorage, makeId = () => crypto.randomUUID()) {
  const persistence = recoverableStorage(LIGHTING_STORAGE_KEY, storage, makeId);
  let planned = [], storageError = '';
  try { planned = persistence.read(parsePlan) || []; }
  catch { storageError = 'План освещения не удалось прочитать. Исходная запись сохранена; сейчас показан пустой список.'; }
  return create((set, get) => {
    const save = planned => {
      set({ planned });
      try { persistence.write({ state: { planned }, version: 0 }); set({ storageError: '' }); }
      catch { set({ storageError: 'Изменения работают в этой вкладке, но не сохранены. Скачай план перед закрытием.' }); }
    };
    return {
      planned, storageError,
      add: product => {
        if (get().planned.some(item => item.id === product.id)) return;
        const next = [...get().planned, { id: product.id, name: product.name, quantity: 1 }];
        save(parsePlan(JSON.stringify({ state: { planned: next }, version: 0 })));
      },
      remove: id => save(get().planned.filter(item => item.id !== id)),
      setQuantity: (id, quantity) => save(get().planned.map(item => item.id === id ? { ...item, quantity: Math.max(1, Math.min(20, Math.round(Number(quantity) || 1))) } : item)),
    };
  });
}
export const useLightingStore = createLightingStore();
