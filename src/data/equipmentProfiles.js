import { AUDIO_MODELS } from './audioModels.js';
import { EQUIPMENT_PHYSICAL } from './cabinetSpecs.js';
import { DEVICE_SPECS } from './devicePorts.js';

export function equipmentName(equipment) { return AUDIO_MODELS[equipment.modelId]?.name || DEVICE_SPECS[equipment.id]?.name || equipment.id; }
export function equipmentPhysical(equipment) {
  const model = AUDIO_MODELS[equipment.modelId];
  if (!model || (equipment.modelId?.startsWith('owner-') && EQUIPMENT_PHYSICAL[equipment.id])) return EQUIPMENT_PHYSICAL[equipment.id];
  const weightLb = model.facts?.find(f => /^weight$/i.test(f.name))?.value.match(/[\d.]+/)?.[0];
  return {
    dims: model.envelope, weight: model.weightKg ?? (weightLb ? +(Number(weightLb) * .45359237).toFixed(2) : null),
    heat: model.heat || (model.thermalWatts >= 22 || model.roles.includes('powerAmp') ? 'high' : model.passive ? 'low' : 'medium'),
    photo: model.image, source: model.source,
    approximateHeight: model.envelope?.approximateHeight,
    geometryNote: `Габаритная модель ${model.name}. Детали корпуса и координаты разъёмов не обмерены.${model.envelope?.approximateHeight ? ' Габарит — приблизительная оценка производителя.' : ''}`,
  };
}

export const RACK_MODEL_IDS = { a90: 'owner-a90', dac_fiio: 'schiit-bifrost-3', phono: 'schiit-skoll-f', rusich_a2: 'owner-rusich' };
export const CORE_ADDITIONS = [{ id: 'freya2', modelId: 'schiit-freya_2' }, { id: 'warmer_r2r', modelId: 'fiio-warmer-r2r' }];

// Keep both DAC candidates and both preamps physically present. Selecting an
// active signal path must never remove an apparatus from the furniture plan.
export function completeListeningRack(project) {
  const missing = CORE_ADDITIONS.filter(item => !project.equipment.some(e => e.id === item.id || e.modelId === item.modelId));
  if (!missing.length) return project;
  const top = [...project.shelves].sort((a, b) => b.y - a.y)[0];
  const shelfId = 'planned_tube_shelf';
  if (project.shelves.some(s => s.id === shelfId)) throw new Error('Полка planned_tube_shelf уже существует. Добавьте недостающий аппарат вручную через каталог.');
  return { ...project,
    shelves: [...project.shelves.map(s => s.id === top.id ? { ...s, y: s.y + 310 } : s),
      { ...top, id: shelfId, name: 'Freya 2 + WARMER · план', width: Math.max(780, top.width), holes: [] }],
    equipment: [...project.equipment, ...missing.map(item => ({ ...item, shelfId, x: item.id === 'freya2' ? -140 : 207, z: 0 }))],
  };
}

export function plannedRack(project, plan) {
  let result = structuredClone(completeListeningRack(project));
  for (const role of ['dac', 'preamp', 'phono', 'powerAmp', 'eq', 'headphoneAmp']) {
    const id = plan[role];
    if (!id) continue;
    const quantity = role === 'powerAmp' ? plan.powerAmpQuantity : 1;
    const present = result.equipment.filter(e => (e.modelId || RACK_MODEL_IDS[e.id]) === id).length;
    for (let i = present; i < quantity; i++) {
      const model = AUDIO_MODELS[id];
      if (!model?.envelope || ['w', 'h', 'd'].some(key => !Number.isFinite(model.envelope[key]))) throw new Error(`Для ${model?.name || id} нет полного габарита; перенос в стойку пока невозможен.`);
      if (result.shelves.length >= 10) throw new Error('В стойке уже 10 полок. Для дополнительных аппаратов нужен отдельный проект мебели.');
      // Insert below the top (turntable), retaining every existing placement.
      const top = [...result.shelves].sort((a, b) => b.y - a.y)[0];
      const shelfId = `s_${id}_${i}`;
      const height = model.envelope.h + 200;
      result.shelves = [...result.shelves.map(s => s.id === top.id ? { ...s, y: s.y + height } : s), { ...top, id: shelfId, name: model.name, width: Math.max(top.width, model.envelope.w + 100), depth: Math.max(top.depth, model.envelope.d + 100), holes: [] }];
      result.equipment.push({ id: `device_${id}_${i}`, modelId: id, shelfId, x: 0, z: 0 });
    }
  }
  return result;
}
