import { create } from 'zustand';
import { DEVICE_SPECS, checkCompatibility } from '../data/devicePorts';
import { checkSystemRules, getCableLengthWarning } from '../data/systemRules';

// ============================================================
// СЕТАПЫ (источники) — общая часть цепи до преампа A90
// ============================================================
const RIGS = {
  '01': {
    id: '01',
    name: 'Винил',
    sourceDevices: ['turntable', 'phono', 'a90'],
    sourceCables: [
      { id: 'c1', from: { device: 'turntable', port: 'tt_out' }, to: { device: 'phono', port: 'phono_in_rca' }, connectorType: 'RCA', length: 0.5 },
      { id: 'c1g', from: { device: 'turntable', port: 'tt_ground' }, to: { device: 'phono', port: 'phono_ground' }, connectorType: 'GROUND', length: 0.3 },
      { id: 'c2', from: { device: 'phono', port: 'phono_out_rca' }, to: { device: 'a90', port: 'a90_in_rca' }, connectorType: 'RCA', length: 0.5 },
    ],
  },
  '02': {
    id: '02',
    name: 'FiiO WARMER R2R',
    sourceDevices: ['dac_fiio', 'a90'],
    sourceCables: [
      { id: 'c1', from: { device: 'dac_fiio', port: 'fiio_out_xlr' }, to: { device: 'a90', port: 'a90_in_xlr' }, connectorType: 'XLR', length: 0.5 },
    ],
  },
  '03': {
    id: '03',
    name: 'Cayin RU7',
    sourceDevices: ['dac_cayin', 'a90'],
    sourceCables: [
      { id: 'c1', from: { device: 'dac_cayin', port: 'cayin_out_44' }, to: { device: 'a90', port: 'a90_in_xlr' }, connectorType: 'ADAPTER_44_XLR', length: 0.3 },
    ],
  },
  '04': {
    id: '04',
    name: 'WiiM Pro Plus (стриминг)',
    sourceDevices: ['streamer_wiim', 'a90'],
    sourceCables: [
      { id: 'c1', from: { device: 'streamer_wiim', port: 'wiim_out_rca' }, to: { device: 'a90', port: 'a90_in_rca' }, connectorType: 'RCA', length: 0.5 },
    ],
  },
};

// ============================================================
// РЕЖИМЫ ПРОСЛУШИВАНИЯ — либо колонки, либо наушники (не одновременно)
// ============================================================
const LISTENING_MODES = {
  speakers: {
    id: 'speakers',
    name: '🔊 Колонки',
    devices: ['arcam', 'speakers'],
    cables: [
      { id: 'm1', from: { device: 'a90', port: 'a90_out_rca' }, to: { device: 'arcam', port: 'arcam_cd' }, connectorType: 'RCA', length: 0.5 },
      { id: 'm2', from: { device: 'arcam', port: 'arcam_speaker' }, to: { device: 'speakers', port: 'speaker_input' }, connectorType: 'SPEAKER', length: 3 },
    ],
  },
  headphones: {
    id: 'headphones',
    name: '🎧 Наушники',
    devices: ['headphones'],
    cables: [
      { id: 'm1', from: { device: 'a90', port: 'a90_hp_44' }, to: { device: 'headphones', port: 'hd650_plug' }, connectorType: 'JACK_4_4', length: 1.5 },
    ],
  },
};

function buildConfig(rigId, modeId) {
  const rig = RIGS[rigId];
  const mode = LISTENING_MODES[modeId];
  return {
    devices: [...rig.sourceDevices, ...mode.devices],
    cables: [...rig.sourceCables, ...mode.cables],
    rigName: rig.name,
    modeName: mode.name,
  };
}

export const useRoutingStore = create((set, get) => ({
  selectedRig: '01',
  selectedMode: 'speakers', // 'speakers' | 'headphones'
  selectedView: 'front',
  selectedDevice: null,
  selectedPort: null,
  customCables: {}, // ключ: `${rigId}_${modeId}`

  setSelectedRig: (rigId) => set({ selectedRig: rigId, selectedDevice: null, selectedPort: null }),
  setSelectedMode: (modeId) => set({ selectedMode: modeId, selectedDevice: null, selectedPort: null }),
  setSelectedView: (view) => set({ selectedView: view }),
  setSelectedDevice: (deviceId) => set({ selectedDevice: deviceId }),

  startCableFrom: (device, port) => set({ selectedPort: { device, port } }),
  cancelCable: () => set({ selectedPort: null }),

  getComboKey: (rigId, modeId) => `${rigId}_${modeId}`,

  finishCableTo: (toDevice, toPort) => {
    const state = get();
    if (!state.selectedPort) return { success: false, error: 'Нет активного соединения' };

    const fromDeviceSpec = DEVICE_SPECS[state.selectedPort.device];
    const toDeviceSpec = DEVICE_SPECS[toDevice];
    const fromPortSpec = fromDeviceSpec.ports.find((p) => p.id === state.selectedPort.port);
    const toPortSpec = toDeviceSpec.ports.find((p) => p.id === toPort);

    const compat = checkCompatibility(fromPortSpec, toPortSpec);
    if (!compat.compatible) {
      return { success: false, error: compat.reason };
    }

    const rules = checkSystemRules(state.selectedPort.device, state.selectedPort.port, toDevice, toPort);
    const criticalIssues = rules.filter((r) => r.severity === 'critical');
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

    const key = state.getComboKey(state.selectedRig, state.selectedMode);
    const existingCustom = state.customCables[key] || [];
    set({
      customCables: {
        ...state.customCables,
        [key]: [...existingCustom, newCable],
      },
      selectedPort: null,
    });

    return { success: true, warnings: rules, hasCritical: criticalIssues.length > 0, cable: newCable };
  },

  removeCable: (rigId, modeId, cableId) => {
    const state = get();
    const key = state.getComboKey(rigId, modeId);
    const preset = buildConfig(rigId, modeId);
    const presetCableIds = preset.cables.map((c) => c.id);
    if (presetCableIds.includes(cableId)) {
      const removedPresets = state.customCables[`${key}_removed`] || [];
      set({
        customCables: {
          ...state.customCables,
          [`${key}_removed`]: [...removedPresets, cableId],
        },
      });
    } else {
      const existing = state.customCables[key] || [];
      set({
        customCables: {
          ...state.customCables,
          [key]: existing.filter((c) => c.id !== cableId),
        },
      });
    }
  },

  updateCableLength: (rigId, modeId, cableId, newLength) => {
    const state = get();
    const key = state.getComboKey(rigId, modeId);
    const existing = state.customCables[key] || [];
    const isCustom = existing.find((c) => c.id === cableId);
    if (isCustom) {
      set({
        customCables: {
          ...state.customCables,
          [key]: existing.map((c) => (c.id === cableId ? { ...c, length: newLength } : c)),
        },
      });
    } else {
      const overrides = state.customCables[`${key}_lengthOverrides`] || {};
      set({
        customCables: {
          ...state.customCables,
          [`${key}_lengthOverrides`]: { ...overrides, [cableId]: newLength },
        },
      });
    }
  },

  getActiveCables: (rigId, modeId) => {
    const state = get();
    const preset = buildConfig(rigId, modeId);
    const key = state.getComboKey(rigId, modeId);
    const removed = state.customCables[`${key}_removed`] || [];
    const lengthOverrides = state.customCables[`${key}_lengthOverrides`] || {};
    const custom = state.customCables[key] || [];

    const presetCables = preset.cables
      .filter((c) => !removed.includes(c.id))
      .map((c) => ({ ...c, length: lengthOverrides[c.id] ?? c.length }));

    return [...presetCables, ...custom];
  },

  getConfig: (rigId, modeId) => buildConfig(rigId, modeId),
  getAllRigs: () => RIGS,
  getAllModes: () => LISTENING_MODES,
  getDeviceSpec: (deviceId) => DEVICE_SPECS[deviceId],
  getAllDeviceSpecs: () => DEVICE_SPECS,

  validateRig: (rigId, modeId) => {
    const state = get();
    const cables = state.getActiveCables(rigId, modeId);
    const allWarnings = [];

    cables.forEach((cable) => {
      const rules = checkSystemRules(cable.from.device, cable.from.port, cable.to.device, cable.to.port);
      rules.forEach((r) => allWarnings.push({ ...r, cableId: cable.id }));

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
