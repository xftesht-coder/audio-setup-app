import { create } from 'zustand';
import { DEFAULT_SYSTEM_PLAN } from '../data/audioModels.js';
import { parseSystemPlan, validSystemPlan } from '../data/systemMatching.js';
import { importVariants, MAX_VARIANTS, samePlan, validateVariants, variantName } from '../data/systemVariants.js';

export const SYSTEM_STORAGE_KEY = 'audio-system-workspace-v2';
const LEGACY_KEY = 'audio-system-plan-v1';
export function createSystemPlanStore(storage = () => globalThis.localStorage, makeId = () => crypto.randomUUID()) {
  const initial = { plan: { ...DEFAULT_SYSTEM_PLAN }, variants: [], storageError: '' };
  try {
    const raw = storage()?.getItem(SYSTEM_STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.version !== 2) throw new Error('version');
      const plan = parseSystemPlan(data.plan), variants = validateVariants(data.variants);
      Object.assign(initial, { plan, variants });
    } else {
      const legacy = storage()?.getItem(LEGACY_KEY);
      if (legacy) initial.plan = parseSystemPlan(JSON.parse(legacy));
    }
  } catch { initial.storageError = 'Сохранённые данные не удалось прочитать. Исходная запись сохранена; можно восстановить варианты из файла.'; }
  return create((set, get) => {
    const persist = changes => {
      set({ ...changes, storageError: '' });
      try {
        const { plan, variants } = get();
        const target = storage();
        if (!target) throw new Error('storage unavailable');
        target.setItem(SYSTEM_STORAGE_KEY, JSON.stringify({ version: 2, plan, variants }));
      } catch { set({ storageError: 'Браузер не сохранил изменения. Скачай варианты в файл или скопируй ссылку на текущую систему.' }); }
    };
    return {
      ...initial, past: [], future: [], deleted: null,
      update: changes => {
        const previous = get().plan, plan = validSystemPlan({ ...previous, ...changes });
        if (samePlan(previous, plan)) return;
        persist({ plan, past: [...get().past, previous].slice(-30), future: [] });
      },
      undo: () => {
        const { past, plan, future } = get();
        if (past.length) persist({ plan: past.at(-1), past: past.slice(0, -1), future: [plan, ...future] });
      },
      redo: () => {
        const { past, plan, future } = get();
        if (future.length) persist({ plan: future[0], past: [...past, plan], future: future.slice(1) });
      },
      saveVariant: name => {
        if (get().variants.length >= MAX_VARIANTS) throw new Error(`Сохранено ${MAX_VARIANTS} вариантов. Скачай резервную копию и удали ненужные.`);
        const item = { id: makeId(), name: variantName(name), plan: { ...get().plan } };
        if (get().variants.some(v => v.name.toLowerCase() === item.name.toLowerCase())) throw new Error('Это название уже занято. Выбери другое, чтобы сохранить оба варианта.');
        persist({ variants: [...get().variants, item] });
        return item.id;
      },
      loadVariant: id => { const item = get().variants.find(v => v.id === id); if (item) get().update(item.plan); },
      deleteVariant: id => {
        const deleted = get().variants.find(v => v.id === id);
        if (deleted) persist({ variants: get().variants.filter(v => v.id !== id), deleted });
      },
      restoreDeleted: () => {
        if (!get().deleted) return;
        if (get().variants.length >= MAX_VARIANTS) throw new Error('Для восстановления освободи место среди вариантов.');
        persist({ variants: [...get().variants, get().deleted], deleted: null });
      },
      importFile: text => {
        const variants = importVariants(text, get().variants, makeId);
        const count = variants.length - get().variants.length;
        persist({ variants });
        return count;
      },
      reset: () => get().update(DEFAULT_SYSTEM_PLAN),
    };
  });
}
export const useSystemPlanStore = createSystemPlanStore();
