import { z } from 'zod';
import { POWER_STRIP } from './powerDistribution.js';
import { MAIN_RACK, EQUIPMENT_PHYSICAL, RACK_CABLES } from './cabinetSpecs.js';
import { computeCabinetLayout } from './cabinetLayout.js';
import { DEVICE_SPECS } from './devicePorts.js';

const number = (min, max) => z.number().finite().min(min).max(max);
const point = z.tuple([number(-4000, 4000), number(-4000, 4000), number(-4000, 4000)]);
const hole = z.object({ id: z.string().max(80), x: number(-1500, 1500), z: number(-1500, 1500), diameter: number(2, 200) });
const cable = z.object({
  id: z.string().max(80), name: z.string().max(120), from: z.string().max(80), to: z.string().max(80),
  fromPort: z.string().optional(), toPort: z.string().optional(), type: z.string(), category: z.enum(['signal', 'power', 'dc']),
  diameter: number(1, 40), bendRadius: number(5, 300), massPerM: number(1, 2000), connectorLength: number(5, 180),
  connectorDiameter: number(2, 70), connectorMass: number(0, 500).default(40), straight: number(10, 300), available: number(100, 20000), reserve: number(0, 1000),
  supportSpan: number(50, 1000), depthOffset: number(0, 1500), fromOffset: point, toOffset: point,
  waypoints: z.array(point).max(20), note: z.string().max(1000),
});
export const projectSchema = z.object({
  version: z.literal(1), units: z.literal('mm'), name: z.string().min(1).max(100),
  material: z.enum(['walnut', 'oak', 'alder']),
  width: number(400, 1600), depth: number(300, 900), postInsetX: number(25, 180), postInsetZ: number(25, 180),
  postDiameter: number(30, 80), rearGap: number(80, 700), powerGap: number(60, 400),
  shelves: z.array(z.object({
    id: z.string().regex(/^[a-zA-Z0-9_-]+$/).max(80), name: z.string().min(1).max(80),
    y: number(60, 2200), thickness: number(18, 80), width: number(300, 1800), depth: number(250, 1000),
    x: number(-300, 300), z: number(-300, 300), holes: z.array(hole).max(30),
  })).min(1).max(10),
  equipment: z.array(z.object({ id: z.string(), shelfId: z.string(), x: number(-1000, 1000), z: number(-600, 600) })).min(1).max(6),
  cables: z.array(cable).min(1).max(30),
}).superRefine((p, ctx) => {
  const fail = message => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  for (const list of [p.shelves, p.equipment, p.cables]) if (new Set(list.map(x => x.id)).size !== list.length) fail('Повторяющиеся идентификаторы');
  if (p.equipment.some(e => !Object.hasOwn(EQUIPMENT_PHYSICAL, e.id) || EQUIPMENT_PHYSICAL[e.id].notOnRack || !p.shelves.some(s => s.id === e.shelfId))) fail('Неизвестный аппарат или полка');
  if (p.cables.some(c => !p.equipment.some(e => e.id === c.from) || (c.to !== 'service' && !p.equipment.some(e => e.id === c.to)))) fail('Неизвестная точка подключения');
  if (p.cables.some(c => (c.fromPort && !DEVICE_SPECS[c.from]?.ports.some(port => port.id === c.fromPort && port.position === 'rear')) || (c.toPort && !DEVICE_SPECS[c.to]?.ports.some(port => port.id === c.toPort && port.position === 'rear')))) fail('Неподдерживаемый порт: выберите существующий задний разъём');
  if (p.shelves.some(s => new Set(s.holes.map(h => h.id)).size !== s.holes.length)) fail('Повторяющиеся отверстия');
});

export const ENGINEERING_SOURCES = [
  { name: 'Supra LoRad 2.5: Ø11 мм (вариант нужно подтвердить)', url: 'https://supracables.se/datasheets/se/Power-cables/lorad-cable-2_5-cs-16-eu-angled-datasheet-se.pdf' },
  { name: 'Furutech FP-3TS20: пример Ø14,3 мм, не идентификация вашего кабеля', url: 'https://furutech.com/ja/product/fp-3ts20/' },
  { name: 'Belden: радиус изгиба задаётся для конкретного кабеля', url: 'https://catalog.belden.com/techdata/EN/5100UP_techdata.pdf' },
  { name: 'Hirschmann / Belden: разнос питания и сигнала, пересечения под 90°', url: 'https://catalog.belden.com/prodimgs/AllAssets-approved/std.lang.all/65/32/PDF_786532.pdf' },
  { name: 'WiiM: USB-C — питание 5 В', url: 'https://www.wiimhome.com/wiimpro/overview' },
  { name: 'Bossard: шайбы M16 ISO 7089, 17 × 30 × 3 мм', url: 'https://bossard.partcommunity.com/3d-cad-models/?info=bossard%2F01%2F01_100%2F01_100_300%2F01_100_300_10%2Fbn_20734%2Fbn_20734.prj' },
];

// Nominal hardware envelope. Threads are represented by their major diameter;
// this is an assembly model, not a machined thread or a strength calculation.
export const HARDWARE = { rod: 16, clearance: 18, washerOD: 30, washerID: 17, washerT: 3, nutAF: 24, nutH: 14.8, footH: 26 };

export function defaultProject() {
  const layout = computeCabinetLayout();
  const base = { diameter: 8, bendRadius: 60, massPerM: 100, connectorLength: 40, connectorDiameter: 14, straight: 35, available: 2000, reserve: 100, supportSpan: 220, depthOffset: 0, fromOffset: [0, 0, 0], toOffset: [0, 0, 0], waypoints: [], note: 'Диаметр, масса, радиус и разъём — проектные допущения. Измерьте кабель и уточните паспорт.' };
  return projectSchema.parse({
    version: 1, units: 'mm', name: 'STUDIO / 01', material: 'walnut', width: 680, depth: 450,
    postInsetX: 38, postInsetZ: 38, postDiameter: 36, rearGap: 170, powerGap: 100,
    shelves: layout.shelves.map((s, i) => ({ id: s.tierId, name: `Полка ${i + 1}`, y: +(s.y * 1000).toFixed(1), thickness: 32, width: 680, depth: 450, x: 0, z: 0, holes: [] })),
    equipment: MAIN_RACK.tiers.flatMap(t => t.items.map(e => ({ id: e.equipmentId, shelfId: t.id, x: e.x - 300, z: 0 }))),
    cables: [
      ...RACK_CABLES.map((c, i) => ({ ...base, ...c, category: 'signal', name: `${c.type} · ${DEVICE_SPECS[c.from].name} → ${DEVICE_SPECS[c.to].name}`, depthOffset: i * 22, ...(c.type === 'GROUND' ? { diameter: 3, bendRadius: 25, massPerM: 20, connectorDiameter: 5 } : {}), ...(c.type === 'OPTICAL' ? { diameter: 5, bendRadius: 40, massPerM: 35 } : {}) })),
      ...['arcam', 'a90', 'dac_fiio', 'phono', 'turntable', 'streamer_wiim'].map((id, i) => ({ ...base, id: `p_${id}`, from: id, to: 'service', type: i >= 4 ? 'DC' : 'AC', category: i >= 4 ? 'dc' : 'power',
        name: id === 'arcam' ? 'Arcam · Supra LoRad' : id === 'streamer_wiim' ? 'WiiM · USB-C 5 В' : id === 'turntable' ? 'Проигрыватель · внешний БП' : `${DEVICE_SPECS[id].name} · кастом Furutech / уточнить`,
        diameter: i >= 4 ? 4 : id === 'arcam' ? 11 : 14.3, bendRadius: i >= 4 ? 40 : 100, massPerM: i >= 4 ? 35 : 220,
        connectorLength: i >= 4 ? 25 : 75, connectorDiameter: i >= 4 ? 10 : 36, connectorMass: i >= 4 ? 8 : 100, available: 2500, depthOffset: i * 28,
        note: id === 'arcam' ? 'Supra LoRad — по словам владельца. Ø11 мм относится к 2.5; вариант, масса, радиус и вилка требуют проверки.' : id === 'turntable' ? 'Внешний БП. Напряжение, полярность и габариты ещё не подтверждены.' : id === 'streamer_wiim' ? 'USB-C 5 В по WiiM. Размер кабеля и адаптера — допущение.' : 'Модель Furutech и тип питания аппарата уточнить. Ø14,3 взят как пример FP-3TS20, остальные размеры — допущения.' })),
    ],
  });
}

export const sortedShelves = p => [...p.shelves].sort((a, b) => a.y - b.y);
export const postCenters = p => [-1, 1].flatMap(a => [-1, 1].map(b => [a * (p.width / 2 - p.postInsetX), b * (p.depth / 2 - p.postInsetZ)]));
export const shelfHoles = (p, s) => [...postCenters(p).map(([x, z], i) => ({ id: `M16-${i + 1}`, x: x - s.x, z: z - s.z, diameter: HARDWARE.clearance, automatic: true })), ...s.holes];
export function equipmentBoxes(p) {
  return p.equipment.map(e => {
    const s = p.shelves.find(s => s.id === e.shelfId);
    const { w, h, d } = EQUIPMENT_PHYSICAL[e.id].dims;
    return { ...e, w, h, d, center: [s.x + e.x, s.y + s.thickness + h / 2, s.z + e.z] };
  });
}
export function boxesOverlap(a, b, margin = 0) {
  return a.center.every((v, i) => Math.abs(v - b.center[i]) < (a.size[i] + b.size[i]) / 2 + margin - 0.001);
}
export function obstacles(p) {
  const height = Math.max(...p.shelves.map(s => s.y + s.thickness)) + 20;
  return [
    ...p.shelves.map(s => ({ id: s.id, name: s.name, center: [s.x, s.y + s.thickness / 2, s.z], size: [s.width, s.thickness, s.depth] })),
    ...equipmentBoxes(p).map(e => ({ id: e.id, name: e.id, center: e.center, size: [e.w, e.h, e.d] })),
    ...postCenters(p).map(([x, z], i) => ({ id: `post${i}`, name: `Опора ${i + 1}`, center: [x, height / 2, z], size: [p.postDiameter, height, p.postDiameter] })),
  ];
}
export function validateConstruction(p) {
  const issues = [];
  const add = (message, severity = 'error') => issues.push({ severity, message });
  const shelves = sortedShelves(p);
  const eqs = equipmentBoxes(p);
  for (const s of shelves) {
    const holes = shelfHoles(p, s);
    for (const h of holes) {
      const edge = Math.min(s.width / 2 - Math.abs(h.x), s.depth / 2 - Math.abs(h.z)) - h.diameter / 2;
      if (edge < 8) add(`${s.name}: отверстие ${h.id} слишком близко к краю (остаток ${edge.toFixed(1)} мм).`);
    }
    for (let i = 0; i < holes.length; i++) for (let j = i + 1; j < holes.length; j++) {
      if (Math.hypot(holes[i].x - holes[j].x, holes[i].z - holes[j].z) < (holes[i].diameter + holes[j].diameter) / 2 + 5) add(`${s.name}: отверстия ${holes[i].id} и ${holes[j].id} пересекаются или слишком близки.`);
    }
    const next = shelves[shelves.indexOf(s) + 1];
    if (next && next.y - (s.y + s.thickness) < 2 * (HARDWARE.nutH + HARDWARE.washerT) + 10) add(`${s.name}: недостаточно места для крепежа и втулки под следующей полкой.`);
  }
  for (const e of eqs) {
    const s = p.shelves.find(s => s.id === e.shelfId);
    if (Math.abs(e.x) + e.w / 2 > s.width / 2 || Math.abs(e.z) + e.d / 2 > s.depth / 2) add(`${e.id}: корпус выступает за свою полку.`);
    const next = shelves.find(s => s.y > e.center[1] - e.h / 2 + 0.1);
    const required = EQUIPMENT_PHYSICAL[e.id].openTop ? 350 : EQUIPMENT_PHYSICAL[e.id].heat === 'high' ? 150 : EQUIPMENT_PHYSICAL[e.id].heat === 'medium' ? 100 : 20;
    if (next && next.y - (e.center[1] + e.h / 2) < required) add(`${e.id}: верхний зазор ${(next.y - e.center[1] - e.h / 2).toFixed(1)} мм; проектный ориентир ${required} мм.`, 'warning');
    for (const o of obstacles(p).filter(o => o.id !== e.id && o.id !== e.shelfId)) if (boxesOverlap({ center: e.center, size: [e.w, e.h, e.d] }, o)) add(`${e.id}: пересечение с ${o.name}.`);
  }
  return issues.filter((x, i, a) => a.findIndex(y => y.message === x.message) === i);
}

export function manufacturingBOM(p, routes = []) {
  const shelves = sortedShelves(p);
  const top = Math.max(...shelves.map(s => s.y + s.thickness));
  const rows = shelves.map(s => ({ part: s.name, quantity: 1, description: `${s.width} × ${s.depth} × ${s.thickness} мм; ${p.material}; ${shelfHoles(p, s).length} сквозных отверстий`, length: s.width, width: s.depth, thickness: s.thickness }));
  rows.push({ part: 'Шпилька M16', quantity: 4, description: 'Резьба M16×2; длина по сборке, класс прочности уточнить', length: +(top + 23).toFixed(1) });
  rows.push({ part: 'Гайка M16, ISO 4032', quantity: shelves.length * 8, description: 'S24; номинальная высота 14,8 мм' });
  rows.push({ part: 'Шайба M16, ISO 7089', quantity: shelves.length * 8, description: '17 × 30 × 3 мм; проверить смятие древесины' });
  shelves.forEach((s, i) => {
    const bottom = i === 0 ? HARDWARE.footH : shelves[i - 1].y + shelves[i - 1].thickness + HARDWARE.nutH + HARDWARE.washerT;
    rows.push({ part: `Декоративная втулка ${i + 1}`, quantity: 4, description: `Наружный Ø${p.postDiameter}; внутренний ≥28 мм, стенку согласовать`, length: +(s.y - HARDWARE.nutH - HARDWARE.washerT - bottom).toFixed(1) });
  });
  rows.push({ part: 'Опора M16 с эластомером', quantity: 4, description: 'Проектный габарит Ø66 × 26 мм; артикул и нагрузку выбрать' });
  const rearReach = routes.length ? Math.ceil(-Math.min(...routes.flatMap(r => r.points.map(pt => pt[2]))) + 30) : Math.ceil(p.depth / 2 + p.rearGap + p.powerGap + 290);
  rows.push({ part: 'Задняя сервисная рама / лоток БП', quantity: 1, description: `Оси задних стоек: X ±${p.width / 2 + 150}, Z −${rearReach} мм; крепление согласовать` });
  rows.push({ part: 'Мягкий кабельный держатель', quantity: routes.reduce((sum, r) => sum + r.supports.length, 0), description: 'Ø по кабелю; площадки на задней раме, без пережатия оболочки' });
  routes.forEach(r => rows.push({ part: r.cable.name, quantity: 1, description: `Трасса ${Math.ceil(r.length)} + запас ${r.cable.reserve} мм; масса ${(r.mass / 1000).toFixed(2)} кг`, length: Math.ceil(r.length + r.cable.reserve) }));
  rows.push({ part: POWER_STRIP.name, quantity: 1, description: `${POWER_STRIP.article} · 8 Schuko · 3 м · 635 × 100 × 65 мм; размещение по отдельной схеме питания` });
  return rows;
}
