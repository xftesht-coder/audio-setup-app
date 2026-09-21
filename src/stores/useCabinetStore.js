import { create } from 'zustand';
import { CABINET_FINISHES, EQUIPMENT_PHYSICAL } from '../data/cabinetSpecs.js';

/**
 * Глобальный store конфигуратора тумбы. Охватывает состояние UI, которое
 * должно быть доступно нескольким компонентам дерева (CabinetPanel как
 * контроллер ↔ CabinetView3D / ShelfMesh / EquipmentBox как потребители),
 * без прокидывания пропсов через 3-4 уровня вниз.
 *
 * materialId — выбранный пользователем материал для ДЕРЕВЯННЫХ частей
 * тумбы (полки, боковины, каркас). Цвет устройств (spec.color) не
 * зависит от него — аппаратура имеет фирменные цвета.
 *
 * persisted в localStorage — чтобы после F5 не сбрасывался последний
 * выбранный материал.
 */
const STORAGE_KEY = 'hifi_cabinet_config';

const getInitialState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          materialId: Object.hasOwn(CABINET_FINISHES, parsed.materialId) ? parsed.materialId : 'walnut',
          xray: parsed.xray === true,
          exploded: parsed.exploded === true,
        };
      }
    }
  } catch (e) {
    console.warn('[useCabinetStore] Failed to load persisted config:', e.message);
  }
  return {};
};

const persist = (state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      materialId: state.materialId,
      xray: state.xray,
      exploded: state.exploded,
    }));
  } catch (e) {
    console.warn('[useCabinetStore] Failed to persist config:', e.message);
  }
};

export const useCabinetStore = create((set, get) => ({
  xray: false,
  exploded: false,
  selected: null,
  materialId: 'walnut',
  viewRevision: 0,
  ...getInitialState(),
  setXray: (v) => {
    set({ xray: typeof v === 'boolean' ? v : !get().xray });
    persist(get());
  },
  setExploded: (v) => {
    set({ exploded: typeof v === 'boolean' ? v : !get().exploded });
    persist(get());
  },
  setSelected: (id) => {
    if (id === null || Object.hasOwn(EQUIPMENT_PHYSICAL, id)) set({ selected: id });
  },
  setMaterial: (id) => {
    if (!Object.hasOwn(CABINET_FINISHES, id)) {
      console.warn(`[useCabinetStore] Неизвестный материал: ${id}`);
      return;
    }
    set({ materialId: id });
    persist(get());
  },
  reset: () => {
    set({ xray: false, exploded: false, selected: null, materialId: 'walnut', viewRevision: get().viewRevision + 1 });
    persist(get());
  },
}));
