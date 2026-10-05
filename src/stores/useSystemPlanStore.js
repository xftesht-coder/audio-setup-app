import { create } from 'zustand';
import { DEFAULT_SYSTEM_PLAN } from '../data/audioModels.js';
import { validSystemPlan } from '../data/systemMatching.js';

const KEY = 'audio-system-plan-v1';
function restore() {
  try { return validSystemPlan(JSON.parse(localStorage.getItem(KEY))); }
  catch { return { ...DEFAULT_SYSTEM_PLAN }; }
}
export const useSystemPlanStore = create((set, get) => ({
  plan: restore(), storageError: '',
  update: changes => {
    const plan = validSystemPlan({ ...get().plan, ...changes });
    set({ plan, storageError: '' });
    try { localStorage.setItem(KEY, JSON.stringify(plan)); }
    catch { set({ storageError: 'Браузер не сохранил план. Ссылка «Поделиться» сохраняет выбранную конфигурацию.' }); }
  },
  reset: () => get().update(DEFAULT_SYSTEM_PLAN),
}));
