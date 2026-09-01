// ============================================================
// PORT GEOMETRY — вычисляет реальные 3D-координаты разъёмов
// устройства относительно центра его корпуса (в метрах).
//
// Источник истины по портам — devicePorts.js DEVICE_SPECS[id].ports,
// где у каждого порта уже есть position: 'rear'|'front'|'side'|'cable'
// (взято с реальных мануалов/фото задних панелей — см. verifiedSources).
// Точная высота разъёма на панели в исходных данных не задокументирована
// производителями (ни один мануал не даёт координаты в мм) — поэтому
// вертикальное смещение — инженерная аппроксимация (нижняя треть задней
// панели, где обычно сосредоточены разъёмы), а не выдуманная точность.
// ============================================================

import { DEVICE_SPECS } from './devicePorts';
import { EQUIPMENT_PHYSICAL } from './cabinetSpecs';

const MM_TO_M = 0.001;

export function getEquipmentBoxSize(equipmentId) {
  const phys = EQUIPMENT_PHYSICAL[equipmentId];
  if (!phys) return null;
  return {
    w: phys.dims.w * MM_TO_M,
    h: phys.dims.h * MM_TO_M,
    d: phys.dims.d * MM_TO_M,
  };
}

// Возвращает [x, y, z] порта относительно центра бокса устройства.
// z+ смотрит вперёд (лицевая панель), z- назад; x+ вправо; y+ вверх.
export function getPortLocalAnchor(equipmentId, portId) {
  const spec = DEVICE_SPECS[equipmentId];
  const size = getEquipmentBoxSize(equipmentId);
  if (!spec || !size) return [0, 0, 0];
  const port = spec.ports.find((p) => p.id === portId);
  if (!port) return [0, 0, 0];

  const { w, h, d } = size;

  const zByPosition = {
    rear: -d / 2 - 0.002,
    front: d / 2 + 0.002,
    cable: d / 2 + 0.002,
    side: 0,
  };
  const z = zByPosition[port.position] ?? -d / 2;

  // Горизонтальный разброс среди портов на одной грани — по порядку в массиве.
  const samePosition = spec.ports.filter((p) => p.position === port.position);
  const idx = samePosition.findIndex((p) => p.id === portId);
  const spreadWidth = w * 0.7;
  const x =
    port.position === 'side'
      ? (w / 2 + 0.002) * (idx % 2 === 0 ? 1 : -1)
      : samePosition.length > 1
      ? (idx / (samePosition.length - 1) - 0.5) * spreadWidth
      : 0;

  // Аппроксимация: разъёмы сосредоточены в нижней трети задней панели.
  const y = -h / 2 + h * 0.25;

  return [x, y, z];
}
