import { create } from 'zustand';
import { DEVICE_SPECS, checkCompatibility } from '../data/devicePorts';
import { checkSystemRules, getCableLengthWarning } from '../data/systemRules';

// Пресеты трактов - теперь ссылаются на реальные ID портов
const PRESET_SETUPS = {
  '01': {
    id: '01',
    name: 'Винил',
    devices: ['turntable', 'phono', 'a90', 'arcam', 'speakers', 'headphones'],
    cables: [
      { id: 'c1', from: { device: 'turntable', port: 'tt_out' }, to: { device: 'phono', port: 'phono_in_rca' }, connectorType: 'RCA', length: 0.5 },
      { id: 'c1g', from: { device: 'turntable', port: 'tt_ground' }, to: { device: 'phono', port: 'phono_ground' }, connectorType: 'GROUND', length: 0.3 },
      { id: 'c2', from: { device: 'phono', port: 'phono_out_rca' }, to: { device: 'a90', port: 'a90_in_rca' }, connectorType: 'RCA', length: 0.5 },
      { id: 'c3', from: { device: 'a90', port: 'a90_out_rca' }, to: { device: 'arcam', port: 'arcam_cd' }, connectorType: 'RCA', length: 0.5 },
      { id: 'c4', from: { device: 'arcam', port: 'arcam_speaker' }, to: { device: 'speakers', port: 'speaker_input' }, connectorType: 'SPEAKER', length: 3 },
      { id: 'c5', from: { device: 'a90', port: 'a90_hp_44' }, to: { device: 'headphones', port: 'hd650_plug' }, connectorType: 'JACK_4_4', length: 1.5 },
    ],
  },
  '02': {
    id: '02',
    name: 'FiiO WARMER R2R',
    devices: ['dac_fiio', 'a90', 'arcam', 'speakers', 'headphones'],
    cables: [
      { id: 'c1', from: { device: 'dac_fiio', port: 'fiio_out_xlr' }, to: { device: 'a90', port: 'a90_in_xlr' }, connectorType: 'XLR', length: 0.5 },
      { id: 'c2', from: { device: 'a90', port: 'a90_out_rca' }, to: { device: 'arcam', port: 'arcam_cd' }, connectorType: 'RCA', length: 0.5 },
      { id: 'c3', from: { device: 'arcam', port: 'arcam_speaker' }, to: { device: 'speakers', port: 'speaker_input' }, connectorType: 'SPEAKER', length: 3 },
      { id: 'c4', from: { device: 'a90', port: 'a90_hp_44' }, to: { device: 'headphones', port: 'hd650_plug' }, connectorType: 'JACK_4_4', length: 1.5 },
    ],
  },
  '03': {
    id: '03',
    name: 'Cayin RU7',
    devices: ['dac_cayin', 'a90', 'arcam', 'speakers', 'headphones'],
    cables: [
      { id: 'c1', from: { device: 'dac_cayin', port: 'cayin_out_44' }, to: { device: 'a90', port: 'a90_in_xlr' }, connectorType: 'ADAPTER_44_XLR', length: 0.3 },
      { id: 'c2', from: { device: 'a90', port: 'a90_out_rca' }, to: { device: 'arcam', port: 'arcam_cd' }, connectorType: 'RCA', length: 0.5 },
      { id: 'c3', from: { device: 'arcam', port: 'arcam_speaker' }, to: { device: 'speakers', port: 'speaker_input' }, connectorType: 'SPEAKER', length: 3 },
      { id: 'c4', from: { device: 'a90', port: 'a90_hp_44' }, to: { device: 'headphones', port: 'hd650_plug' }, connectorType: 'JACK_4_4', length: 1.5 },
    ],
  },
};

export const useRoutingStore = create((set, get) => ({
  selectedRig: '01',
  selectedView: 'front',
  selectedDevice: null,
  selectedPort: null, // { device, port } - для drag-and-drop подключения
  customCables: {}, // переопределения кабелей по rigId, если юзер редактировал

  setSelectedRig: (rigId) => set({ selectedRig: rigId, selectedDevice: null, selectedPort: null }),
  setSelectedView: (view) => set({ selectedView: view }),
  setSelectedDevice: (deviceId) => set({ selectedDevice: deviceId }),

  // Начать подключение кабеля с порта
  startCableFrom: (device, port) => set({ selectedPort: { device, port } }),
  cancelCable: () => set({ selectedPort: null }),

  // Завершить подключение - проверить совместимость и добавить кабель
  finishCableTo: (toDevice, toPort) => {
    const state = get();
    if (!state.selectedPort) return { success: false, error: 'Нет активного соединения' };

    const fromDeviceSpec = DEVICE_SPECS[state.selectedPort.device];
    const toDeviceSpec = DEVICE_SPECS[toDevice];
    const fromPortSpec = fromDeviceSpec.ports.find(p => p.id === state.selectedPort.port);
    const toPortSpec = toDeviceSpec.ports.find(p => p.id === toPort);

    const compat = checkCompatibility(fromPortSpec, toPortSpec);
    if (!compat.compatible) {
      return { success: false, error: compat.reason };
    }

    const rules = checkSystemRules(state.selectedPort.device, state.selectedPort.port, toDevice, toPort);
    const criticalIssues = rules.filter(r => r.severity === 'critical');
    if (compat.isAdapter) {
      rules.push({
        id: 'adapter_used',
        severity: 'info',
        message: `🔌 Используется переходной кабель: ${compat.adapterNote}`,
      });
    }

    const newCable = {
      id: `custom_${Date.now()}`,
      from: { device: state.selectedPort.device, port: state.selectedPort.port },
      to: { device: toDevice, port: toPort },
      connectorType: compat.connectorType,
      length: 1,
    };

    const rigId = state.selectedRig;
    const existingCustom = state.customCables[rigId] || [];
    set({
      customCables: {
        ...state.customCables,
        [rigId]: [...existingCustom, newCable],
      },
      selectedPort: null,
    });

    return { success: true, warnings: rules, hasCritical: criticalIssues.length > 0, cable: newCable };
  },

  removeCable: (rigId, cableId) => {
    const state = get();
    const preset = PRESET_SETUPS[rigId];
    const presetCableIds = preset.cables.map(c => c.id);
    if (presetCableIds.includes(cableId)) {
      // помечаем как удалённый пресетный кабель
      const removedPresets = state.customCables[`${rigId}_removed`] || [];
      set({
        customCables: {
          ...state.customCables,
          [`${rigId}_removed`]: [...removedPresets, cableId],
        },
      });
    } else {
      const existing = state.customCables[rigId] || [];
      set({
        customCables: {
          ...state.customCables,
          [rigId]: existing.filter(c => c.id !== cableId),
        },
      });
    }
  },

  updateCableLength: (rigId, cableId, newLength) => {
    const state = get();
    const existing = state.customCables[rigId] || [];
    const isCustom = existing.find(c => c.id === cableId);
    if (isCustom) {
      set({
        customCables: {
          ...state.customCables,
          [rigId]: existing.map(c => c.id === cableId ? { ...c, length: newLength } : c),
        },
      });
    } else {
      // override length пресетного кабеля
      const overrides = state.customCables[`${rigId}_lengthOverrides`] || {};
      set({
        customCables: {
          ...state.customCables,
          [`${rigId}_lengthOverrides`]: { ...overrides, [cableId]: newLength },
        },
      });
    }
  },

  // Получить полный список активных кабелей для текущего рига (пресет + кастом - удалённые)
  getActiveCables: (rigId) => {
    const state = get();
    const preset = PRESET_SETUPS[rigId];
    const removed = state.customCables[`${rigId}_removed`] || [];
    const lengthOverrides = state.customCables[`${rigId}_lengthOverrides`] || {};
    const custom = state.customCables[rigId] || [];

    const presetCables = preset.cables
      .filter(c => !removed.includes(c.id))
      .map(c => ({ ...c, length: lengthOverrides[c.id] ?? c.length }));

    return [...presetCables, ...custom];
  },

  getPreset: (rigId) => PRESET_SETUPS[rigId],
  getAllPresets: () => PRESET_SETUPS,
  getDeviceSpec: (deviceId) => DEVICE_SPECS[deviceId],
  getAllDeviceSpecs: () => DEVICE_SPECS,

  // Валидация всей текущей конфигурации - собрать все warnings
  validateRig: (rigId) => {
    const state = get();
    const cables = state.getActiveCables(rigId);
    const allWarnings = [];

    cables.forEach(cable => {
      const rules = checkSystemRules(cable.from.device, cable.from.port, cable.to.device, cable.to.port);
      rules.forEach(r => allWarnings.push({ ...r, cableId: cable.id }));

      const lengthCheck = getCableLengthWarning(cable.connectorType, cable.length);
      if (lengthCheck.warning) {
        allWarnings.push({
          id: `length_${cable.id}`,
          severity: 'warning',
          message: lengthCheck.message,
          cableId: cable.id,
        });
      }
    });

    return allWarnings;
  },
}));
