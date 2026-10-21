import { create } from 'zustand';
import { tvConsoleProject } from '../data/workshopTv.js';
import { defaultProject, migrateLegacyProject, projectSchema } from '../data/workshop.js';
import { completeListeningRack } from '../data/equipmentProfiles.js';
import { recoverableStorage } from '../data/recoverableStorage.js';

export const WORKSHOP_STORAGE_KEY = 'audio_workshop_variants_v2';
const LEGACY_KEY = 'audio_workshop_v1';
function restore(persistence) {
  let storageError = '';
  try {
    const saved = persistence.read(raw => {
      const parsed = JSON.parse(raw);
      if (parsed.workspaceVersion === 2) {
        if (!['rack', 'tv'].includes(parsed.activeVariant)) throw new Error('Неизвестный вариант');
        const variants = { rack: projectSchema.parse(migrateLegacyProject(parsed.variants.rack)) };
        if (parsed.variants.tv) variants.tv = projectSchema.parse(migrateLegacyProject(parsed.variants.tv));
        if (!variants[parsed.activeVariant]) throw new Error('Вариант не найден');
        return { project: variants[parsed.activeVariant], variants, activeVariant: parsed.activeVariant };
      }
      const project = projectSchema.parse(migrateLegacyProject(parsed));
      return { project, variants: { rack: project }, activeVariant: 'rack' };
    }, LEGACY_KEY);
    if (saved) return { ...saved, storageError };
  } catch { storageError = 'Сохранённую стойку не удалось прочитать. Исходная запись сохранена; сейчас открыт базовый проект.'; }
  const project = projectSchema.parse(completeListeningRack(defaultProject()));
  return { project, variants: { rack: project }, activeVariant: 'rack', storageError };
}
export function createWorkshopStore(storage = () => globalThis.localStorage, makeId = () => crypto.randomUUID()) {
 const persistence = recoverableStorage(WORKSHOP_STORAGE_KEY, storage, makeId);
 return create((set, get) => {
  const save = project => {
    const variants = { ...get().variants, [get().activeVariant]: project };
    set({ variants });
    try { persistence.write({ workspaceVersion: 2, activeVariant: get().activeVariant, variants }); set({ storageError: '' }); }
    catch { set({ storageError: 'Браузер не сохранил проект. Скачайте JSON, чтобы не потерять изменения.' }); }
  };
  const commit = candidate => {
    const result = projectSchema.safeParse(candidate);
    if (!result.success) { set({ editError: `Изменение отклонено: ${result.error.issues[0].message}` }); return false; }
    if (JSON.stringify(result.data) === JSON.stringify(get().project)) return true;
    set({ project: result.data, past: [...get().past, get().project].slice(-50), future: [], editError: '' });
    save(result.data); return true;
  };
  return {
    ...restore(persistence), past: [], future: [], mode: 'structure', selection: null, cameraView: 'perspective', cameraRevision: 0,
    showEquipment: true, showCables: true, showDimensions: true, dragging: false, snap: 5, editError: '',
    commit,
    switchVariant: id => {
      if (!['rack', 'tv'].includes(id) || id === get().activeVariant) return;
      try {
        const variants = { ...get().variants, [get().activeVariant]: get().project };
        const project = variants[id] || tvConsoleProject(get().project);
        set({ project, variants, activeVariant: id, past: [], future: [], selection: null, mode: 'structure', editError: '', cameraView: 'perspective', cameraRevision: get().cameraRevision + 1 });
        save(project);
      } catch (error) { set({ editError: error.message }); }
    },
    editTelevision: changes => get().project.television && commit({ ...get().project, television: { ...get().project.television, ...changes } }),
    update: changes => commit({ ...get().project, ...changes }),
    resize: (key, value) => {
      const p = get().project, delta = value - p[key];
      return commit({ ...p, [key]: value, shelves: p.shelves.map(s => ({ ...s, [key]: s[key] + delta })) });
    },
    editShelf: (id, changes) => commit({ ...get().project, shelves: get().project.shelves.map(s => s.id === id ? { ...s, ...changes } : s) }),
    addShelf: () => {
      const p = get().project, top = Math.max(...p.shelves.map(s => s.y + s.thickness));
      const s = { id: `s_${Date.now()}`, name: `Полка ${p.shelves.length + 1}`, y: Math.min(2200, top + 200), thickness: 32, width: p.width, depth: p.depth, x: 0, z: 0, holes: [] };
      if (commit({ ...p, shelves: [...p.shelves, s] })) set({ selection: { type: 'shelf', id: s.id } });
    },
    removeShelf: id => {
      const p = get().project;
      if (p.shelves.length <= 1 || p.equipment.some(e => e.shelfId === id)) { set({ editError: 'Сначала перенесите аппараты. В проекте должна остаться хотя бы одна полка.' }); return; }
      if (commit({ ...p, shelves: p.shelves.filter(s => s.id !== id) })) set({ selection: null });
    },
    editEquipment: (id, changes) => commit({ ...get().project, equipment: get().project.equipment.map(e => e.id === id ? { ...e, ...changes } : e) }),
    editCable: (id, changes) => commit({ ...get().project, cables: get().project.cables.map(c => c.id === id ? { ...c, ...changes } : c) }),
    select: selection => set({ selection, ...(selection ? { mode: selection.type === 'cable' ? 'cables' : selection.type === 'equipment' ? 'equipment' : get().mode === 'production' ? 'production' : 'structure' } : {}) }),
    setMode: mode => set({ mode, selection: null }),
    view: cameraView => set({ cameraView, cameraRevision: get().cameraRevision + 1 }),
    toggle: key => { if (['showEquipment', 'showCables', 'showDimensions'].includes(key)) set({ [key]: !get()[key] }); },
    setDragging: dragging => set({ dragging }),
    undo: () => {
      if (!get().past.length) return;
      const project = get().past.at(-1);
      set({ project, past: get().past.slice(0, -1), future: [get().project, ...get().future], selection: null, editError: '' }); save(project);
    },
    redo: () => {
      if (!get().future.length) return;
      const project = get().future[0];
      set({ project, past: [...get().past, get().project], future: get().future.slice(1), selection: null, editError: '' }); save(project);
    },
  };
});
}
export const useWorkshopStore = createWorkshopStore();
