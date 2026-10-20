import { projectSchema } from './workshop.js';
import { equipmentName, equipmentPhysical } from './equipmentProfiles.js';

export function tvConsoleProject(source) {
  const p = structuredClone(source);
  const width = 2300, depth = 560, thickness = 40;
  const shelves = [
    { id: 'tv_lower', name: 'Нижний уровень', y: 110, thickness, width, depth, x: 0, z: 0, holes: [] },
    { id: 'tv_upper', name: 'Верхний уровень', y: 510, thickness, width, depth, x: 0, z: 0, holes: [] },
  ];
  // Two bays per level leave the centre and outer supports unobstructed.
  const bays = [[-1050, -60], [60, 1050]];
  const cursors = [[-1050, 60], [-1050, 60]];
  const placed = new Map();
  const upper = new Map([['turntable', -900], ['dac_fiio', 970]]);
  const ordered = [...p.equipment].sort((a, b) => Number(!!equipmentPhysical(b).openTop) - Number(!!equipmentPhysical(a).openTop) || equipmentPhysical(b).dims.w - equipmentPhysical(a).dims.w);
  for (const e of ordered) {
    const physical = equipmentPhysical(e), { w, h, d } = physical.dims;
    if (upper.has(e.id)) {
      const x = upper.get(e.id);
      if (w > (e.id === 'turntable' ? 420 : 229) || d > depth - 100) throw new Error(equipmentName(e) + ': габарит не подходит для боковой зоны ТВ. Текущий вариант сохранён.');
      placed.set(e.id, { ...e, shelfId: shelves[1].id, x, z: 0 });
      continue;
    }
    const levels = physical.openTop ? [] : [0];
    let position;
    for (const level of levels) {
      if (level === 0 && h + (physical.heat === 'high' ? 150 : physical.heat === 'medium' ? 100 : 20) > 360) continue;
      const bay = bays.findIndex((range, i) => cursors[level][i] + w <= range[1] && d <= depth - 100);
      if (bay < 0) continue;
      position = { ...e, shelfId: shelves[level].id, x: cursors[level][bay] + w / 2, z: 0 };
      cursors[level][bay] += w + 40;
      break;
    }
    if (!position) throw new Error(equipmentName(e) + ': не помещается в две полки 2300 × 560 мм. Текущий проект сохранён; нужен отдельный вариант компоновки.');
    placed.set(e.id, position);
  }
  return projectSchema.parse({ ...p, name: 'TV 65″ · два уровня', width, depth, centerSupports: true, postInsetX: 38, postInsetZ: 38,
    shelves, equipment: p.equipment.map(e => placed.get(e.id)),
    television: { diagonal: 65, standHeight: 60, footSpan: 1000, footDepth: 280, x: 100, z: -70 },
    cables: p.cables.map(c => ({ ...c, waypoints: [] })),
  });
}
