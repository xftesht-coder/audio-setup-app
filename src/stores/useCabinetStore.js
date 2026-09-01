import { create } from 'zustand';
import { MATERIALS } from '../data/cabinetSpecs';

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
      if (parsed.materialId && MATERIALS[parsed.materialId]) {
        return {
          materialId: parsed.materialId,
          xray: Boolean(parsed.xray),
          exploded: Boolean(parsed.exploded),
          selected: parsed.selected || null,
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
  materialId: 'alder',
  ...getInitialState(),
  setXray: (v) => set({ xray: typeof v === 'boolean' ? v : !get().xray }),
  setExploded: (v) => set({ exploded: typeof v === 'boolean' ? v : !get().exploded }),
  setSelected: set,
  setMaterial: (id) => {
    if (!MATERIALS[id]) {
      console.warn(`[useCabinetStore] Неизвестный материал: ${id}`);
      return;
    }
    set({ materialId: id });
    persist(get());
  },
  reset: () => set({ xray: false, exploded: false, selected: null, materialId: 'alder' }),
}));
