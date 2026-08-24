import { create } from 'zustand';

const setupConfigs = {
  '01': {
    id: '01',
    name: 'Винил',
    components: ['turntable', 'phono', 'a90', 'arcam', 'speakers'],
    connections: [
      { from: 'turntable', to: 'phono', label: 'RCA' },
      { from: 'phono', to: 'a90', label: 'RCA' },
      { from: 'a90', to: 'arcam', label: 'RCA' },
      { from: 'arcam', to: 'speakers', label: 'Speaker' },
    ],
    settings: [
      { component: 'a90', param: 'Режим', value: 'PRE' },
      { component: 'a90', param: 'Вход', value: 'RCA' },
      { component: 'arcam', param: 'Вход', value: 'AUX / CD' },
      { component: 'arcam', param: 'Громкость', value: '65–70%' },
    ],
    recommendations: [
      { type: 'ok', text: 'Оптимальный порядок включения соблюдается' },
      { type: 'tip', text: 'Земля: при гуле — переключатель GND/LIFT на A90' },
    ],
    maxSpl: '100–103 дБ @ 3м',
    limiter: 'Arcam SA10, 42 Вт / 8Ω',
  },
  '02': {
    id: '02',
    name: 'FiiO WARMER R2R',
    components: ['dac_fiio', 'a90', 'arcam', 'speakers'],
    connections: [
      { from: 'dac_fiio', to: 'a90', label: 'XLR' },
      { from: 'a90', to: 'arcam', label: 'RCA' },
      { from: 'arcam', to: 'speakers', label: 'Speaker' },
    ],
    settings: [
      { component: 'dac_fiio', param: 'Выход', value: 'XLR 3.8V' },
      { component: 'a90', param: 'Режим', value: 'PRE' },
      { component: 'a90', param: 'Вход', value: 'XLR' },
      { component: 'a90', param: 'Gain', value: 'High ⚠️' },
      { component: 'arcam', param: 'Громкость', value: '65–70%' },
    ],
    recommendations: [
      { type: 'fix', text: 'A90 → Gain Low для XLR. С WARMER приходит 3.8В — горячий уровень' },
      { type: 'fix', text: 'Processor Mode на Arcam SA10 — фиксирует громкость усилителя' },
      { type: 'tip', text: 'WiiM с оптики на коаксиал — поднимет до 192/24' },
    ],
    maxSpl: '100–103 дБ @ 3м',
    limiter: 'Arcam SA10, 42 Вт / 8Ω',
  },
  '03': {
    id: '03',
    name: 'Cayin RU7',
    components: ['dac_cayin', 'a90', 'arcam', 'speakers'],
    connections: [
      { from: 'dac_cayin', to: 'a90', label: 'XLR' },
      { from: 'a90', to: 'arcam', label: 'RCA' },
      { from: 'arcam', to: 'speakers', label: 'Speaker' },
    ],
    settings: [
      { component: 'dac_cayin', param: 'Громкость', value: '100%' },
      { component: 'dac_cayin', param: 'Gain', value: 'уточнить' },
      { component: 'dac_cayin', param: 'Фильтр', value: 'DSD256' },
      { component: 'a90', param: 'Gain', value: 'High ⚠️' },
    ],
    recommendations: [
      { type: 'warning', text: 'Противоречие: RU7 Gain указан двумя способами — проверить (High или Low?)' },
      { type: 'fix', text: 'При Vol 100% и Gain High на A90 уровень очень горячий — Low логичнее' },
      { type: 'tip', text: 'Skoll: нагрузка 47 кΩ, ёмкость ~200 пФ суммарно с кабелем' },
    ],
    maxSpl: '100–103 дБ @ 3м',
    limiter: 'Arcam SA10, 42 Вт / 8Ω',
  },
};

const components = {
  turntable: { id: 'turntable', name: 'Pro-Ject E1', category: 'Источник', width: 80, height: 60, color: '#D4C5B9', hasBack: false },
  phono: { id: 'phono', name: 'Schiit Skoll F', category: 'Фонокорректор', width: 70, height: 45, color: '#D4B5A0', hasBack: true },
  dac_fiio: { id: 'dac_fiio', name: 'FiiO WARMER R2R', category: 'ЦАП', width: 85, height: 50, color: '#C4A5A0', hasBack: true },
  dac_cayin: { id: 'dac_cayin', name: 'Cayin RU7', category: 'ЦАП', width: 75, height: 45, color: '#B5A5A0', hasBack: true },
  a90: { id: 'a90', name: 'Topping A90', category: 'Преамп', width: 90, height: 55, color: '#A59585', hasBack: true },
  arcam: { id: 'arcam', name: 'Arcam SA10', category: 'Усилитель', width: 95, height: 60, color: '#9A8575', hasBack: true },
  speakers: { id: 'speakers', name: 'Acoustic Energy AE320', category: 'Акустика', width: 100, height: 100, color: '#8A7565', hasBack: false },
};

export const useSetupStore = create((set, get) => ({
  selectedRig: '01',
  selectedView: 'front',
  selectedComponent: null,

  setSelectedRig: (rigId) => set({ selectedRig: rigId, selectedComponent: null }),
  setSelectedView: (view) => set({ selectedView: view }),
  setSelectedComponent: (componentId) => set({ selectedComponent: componentId }),

  getConfig: (rigId) => {
    const id = rigId || get().selectedRig;
    return setupConfigs[id];
  },

  getComponent: (componentId) => components[componentId],

  getAllConfigs: () => setupConfigs,
  getAllComponents: () => components,

  exportConfig: (rigId) => {
    const config = setupConfigs[rigId];
    return JSON.stringify(config, null, 2);
  },

  importConfig: (rigData) => {
    try {
      const config = JSON.parse(rigData);
      return config;
    } catch (e) {
      console.error('Failed to parse config:', e);
      return null;
    }
  },
}));
