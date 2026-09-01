// ============================================================
// ТУМБА (Hi-Fi стойка) — реальные физические данные
// Источники: см. verifiedSources в devicePorts.js для тех же устройств.
// Размеры мм: Ш×В×Г (внешние габариты корпуса устройства).
// ============================================================

import { DEVICE_SPECS as DEVICE_SPECS_REF } from './devicePorts.js';

export const MATERIALS = {
  alder: {
    id: 'alder',
    name: 'Ольха (массив/шпон)',
    color: '#C9A876',
    roughness: 0.75,
    metalness: 0.02,
    density: 500, // кг/м3
    note: 'Лёгкая, дешёвая, легко обрабатывается, ~500 кг/м3. С Авито.',
  },
  cld_core: {
    id: 'cld_core',
    name: 'CLD-сэндвич: жёсткий слой (МДФ/фанера/ольха)',
    color: '#B89968',
    roughness: 0.8,
    metalness: 0,
    density: 650,
  },
  cld_damping: {
    id: 'cld_damping',
    name: 'CLD-сэндвич: вязкоупругий слой (клей/MLV)',
    color: '#2B2B2B',
    roughness: 0.9,
    metalness: 0,
    density: 1700,
  },
  rubber_foot: {
    id: 'rubber_foot',
    name: 'Резиновая/эластомерная опора (виброразвязка)',
    color: '#1A1A1A',
    roughness: 0.95,
    metalness: 0,
  },
  steel_leg: {
    id: 'steel_leg',
    name: 'Регулируемая металлическая ножка 140мм',
    color: '#8A8D91',
    roughness: 0.4,
    metalness: 0.8,
  },
};

export const FASTENER_SPECS = {
  screw_4x50: {
    id: 'screw_4x50',
    name: 'Шуруп 4×50мм',
    kind: 'screw',
    diameter: 4,
    length: 50,
    note: 'Основной крепёж каркаса, шаг ~150мм, отступ от краёв ~40мм.',
  },
  pocket_hole: {
    id: 'pocket_hole',
    name: 'Pocket hole (карманное соединение)',
    kind: 'pocket',
    diameter: 8,
    length: 32,
    note: 'Для скрытого соединения полок с боковинами.',
  },
  glue_titebond: {
    id: 'glue_titebond',
    name: 'Клей Titebond Original / костный',
    kind: 'glue',
    note: '⚠️ НЕ Titebond II/III — ползучесть под нагрузкой. Всегда клей + шурупы вместе.',
  },
};

// ============================================================
// РЕАЛЬНЫЕ ФИЗИЧЕСКИЕ ХАРАКТЕРИСТИКИ ТЕХНИКИ (мм, кг)
// Ключи совпадают с id из devicePorts.js DEVICE_SPECS, чтобы модуль
// «Тумба» и модуль «Патч-панель» ссылались на одно и то же устройство.
// ============================================================
export const EQUIPMENT_PHYSICAL = {
  turntable: {
    dims: { w: 420, h: 112, d: 330 },
    weight: 3.5,
    heat: 'low',
    openTop: true, // пылезащитная крышка открывается вверх
    photo: '/photos/turntable.jpg',
    source: 'project-audio.com/en/product/e1-phono (420×112×330мм, 3.5кг)',
  },
  phono: {
    dims: { w: 229, h: 38, d: 152 },
    weight: 0.9,
    heat: 'medium', // 'top gets moderately warm', 7W
    photo: '/photos/phono.jpg',
    source: 'schiit.com/products/skoll-f (9×1.5×6", 2lb, 7W)',
  },
  a90: {
    dims: { w: 222, h: 45, d: 160 },
    weight: 2.0, // источники расходятся 1.3–2.5кг — открытый вопрос §7
    weightVerified: false,
    heat: 'low',
    photo: '/photos/a90.jpg',
    source: 'ревью-замеры (офиц. страница отдаёт 404 на вес — см. открытые вопросы)',
  },
  dac_fiio: {
    dims: { w: 223.5, h: 66.8, d: 213 }, // с ножками
    weight: 2.87,
    heat: 'high', // 4×JJ E88CC лампы, вент. сверху и с боков
    ventTop: true,
    ventSides: true,
    photo: '/photos/dac_fiio.jpg',
    source: 'fiio.com/WARMERR2R_parameters',
  },
  streamer_wiim: {
    dims: { w: 140, h: 42, d: 140 },
    weight: 0.4,
    heat: 'low',
    photo: '/photos/streamer_wiim.jpg',
    source: 'wiimhome.com specs',
  },
  arcam: {
    dims: { w: 433, h: 87, d: 310 },
    weight: 8.4,
    heat: 'medium',
    photo: '/photos/arcam.jpg',
    source: 'hifichoice.com, audioguru.com',
  },
  speakers: {
    dims: { w: 175, h: 1000, d: 320 },
    weight: 26,
    heat: 'none',
    notOnRack: true,
    photo: '/photos/speakers.jpg',
    source: 'napольники — стоят на полу рядом со стойкой, НЕ на стойке',
  },
};

// ============================================================
// КОНСТРЕЙНТЫ (инженерные правила из бриф §3)
// ============================================================
export const CLEARANCE_RULES = {
  heatHigh: 150, // мм над компонентами heat=high
  heatMedium: 100, // мм над компонентами heat=medium (эмпирически половина от high)
  rear: 55,
  side: 40,
  turntableOpenTop: 350, // мм для открытия крышки вертушки вверх
};

export const ROBOT_VACUUM_CLEARANCE = {
  legHeight: 140, // мм ножки стойки
  knownModels: {
    roborock: 96.5,
    roomba: 92,
  },
  note: 'Модель робота-пылесоса пользователя не названа — см. открытые вопросы §6.',
};

// ============================================================
// КОМПОНОВКА MAIN RACK (бриф §4, v2)
// Внутренняя ширина 500мм, глубина полки 420мм.
// Каждый ярус: shelfThickness (CLD 40мм) + высота техники + зазор вентиляции.
// x-позиции — центр устройства от левого края внутренней ширины (500мм).
// ============================================================
export const MAIN_RACK = {
  id: 'main_rack',
  name: 'Основная стойка',
  innerWidth: 500,
  shelfDepth: 420,
  legHeight: 140,
  plinthHeight: 40,
  shelfThickness: 40,
  tiers: [
    {
      id: 'tier_turntable',
      label: 'Ярус 1 — Винил (открытый верх)',
      clearanceAbove: 350, // крышка вертушки
      items: [{ equipmentId: 'turntable', x: 250 }], // по центру
    },
    {
      id: 'tier_phono_wiim',
      label: 'Ярус 2 — Фонокорректор + Стример',
      clearanceAbove: 40,
      items: [
        { equipmentId: 'phono', x: 130 },
        { equipmentId: 'streamer_wiim', x: 380 },
      ],
    },
    {
      id: 'tier_fiio_a90',
      label: 'Ярус 3 — DAC (лампы) + Усилитель для наушников',
      clearanceAbove: 150, // heat=high (лампы)
      items: [
        { equipmentId: 'dac_fiio', x: 125 },
        { equipmentId: 'a90', x: 375 },
      ],
    },
    {
      id: 'tier_arcam',
      label: 'Ярус 4 — Интегральный усилитель',
      clearanceAbove: 150,
      items: [{ equipmentId: 'arcam', x: 250 }],
    },
  ],
};

// ============================================================
// VINYL TOWER (бриф §4)
// ============================================================
export const VINYL_TOWER = {
  id: 'vinyl_tower',
  name: 'Виниловая башня',
  legHeight: 140,
  floorHeight: 40,
  compartmentInnerSize: 330, // мм, ≥330×330 под конверт 314×314
  shelfThickness: 30,
  compartments: 2,
  capacityPer100mm: 100 / 4.2, // ~100 LP на 420мм ширины (эмпирика бриф §3)
};

// ============================================================
// ПАТЧ-ЛИСТ ДЛЯ 3D-СЦЕНЫ — зеркалит дефолтный пресет патч-панели
// (rig '01' Винил + mode 'speakers' из routingStore.js), но с явными
// portId, чтобы кабели в 3D могли крепиться к реальным координатам
// разъёмов (см. portGeometry.js), а не к центру бокса устройства.
// ⚠️ Если патч-лист в routingStore.js меняется — синхронизируй вручную,
// validateCablePorts() ниже упадёт в dev-консоль, если portId устарел.
// ============================================================
export const RACK_CABLES = [
  { id: 'r1', from: 'turntable', fromPort: 'tt_out', to: 'phono', toPort: 'phono_in_rca', type: 'RCA', length: 0.5 },
  { id: 'r1g', from: 'turntable', fromPort: 'tt_ground', to: 'phono', toPort: 'phono_ground', type: 'GROUND', length: 0.3 },
  { id: 'r4', from: 'phono', fromPort: 'phono_out_rca', to: 'a90', toPort: 'a90_in_rca', type: 'RCA', length: 0.5 },
  { id: 'r2', from: 'streamer_wiim', fromPort: 'wiim_out_optical', to: 'dac_fiio', toPort: 'fiio_optical', type: 'OPTICAL', length: 0.5 },
  { id: 'r3', from: 'dac_fiio', fromPort: 'fiio_out_xlr', to: 'a90', toPort: 'a90_in_xlr', type: 'XLR', length: 0.4 },
  { id: 'r5', from: 'a90', fromPort: 'a90_out_rca', to: 'arcam', toPort: 'arcam_cd', type: 'RCA', length: 0.5 },
];

// Дефолтная проверка целостности (не выдумывать — падать явно при рассинхроне)
export function validateCablePorts() {
  const issues = [];
  RACK_CABLES.forEach((cable) => {
    const fromSpec = DEVICE_SPECS_REF[cable.from];
    const toSpec = DEVICE_SPECS_REF[cable.to];
    if (!fromSpec || !fromSpec.ports.find((p) => p.id === cable.fromPort)) {
      issues.push(`Кабель ${cable.id}: порт ${cable.fromPort} не найден на ${cable.from}`);
    }
    if (!toSpec || !toSpec.ports.find((p) => p.id === cable.toPort)) {
      issues.push(`Кабель ${cable.id}: порт ${cable.toPort} не найден на ${cable.to}`);
    }
  });
  return issues;
}

// ============================================================
// ВАЛИДАЦИЯ КОНСТРЕЙНТОВ ДЛЯ MAIN_RACK
// ============================================================
export function validateRackConstraints() {
  const issues = [];
  MAIN_RACK.tiers.forEach((tier) => {
    tier.items.forEach(({ equipmentId, x }) => {
      const eq = EQUIPMENT_PHYSICAL[equipmentId];
      if (!eq) return;
      const requiredClearance =
        eq.heat === 'high' ? CLEARANCE_RULES.heatHigh :
        eq.heat === 'medium' ? CLEARANCE_RULES.heatMedium : 0;
      if (tier.clearanceAbove < requiredClearance) {
        issues.push({
          severity: 'critical',
          tier: tier.id,
          equipmentId,
          message: `${equipmentId}: зазор сверху ${tier.clearanceAbove}мм меньше требуемого ${requiredClearance}мм (heat=${eq.heat}).`,
        });
      }
      if (eq.openTop && tier.clearanceAbove < CLEARANCE_RULES.turntableOpenTop) {
        issues.push({
          severity: 'warning',
          tier: tier.id,
          equipmentId,
          message: `${equipmentId}: для открытия пылезащитной крышки нужно ≥${CLEARANCE_RULES.turntableOpenTop}мм свободного пространства сверху.`,
        });
      }
      // проверка ширины: левый/правый край устройства в пределах innerWidth
      const halfW = eq.dims.w / 2;
      if (x - halfW < CLEARANCE_RULES.side || x + halfW > MAIN_RACK.innerWidth - CLEARANCE_RULES.side) {
        issues.push({
          severity: 'warning',
          tier: tier.id,
          equipmentId,
          message: `${equipmentId}: боковой зазор меньше ${CLEARANCE_RULES.side}мм от края полки.`,
        });
      }
    });
    // проверка суммарной ширины устройств на ярусе
    const totalWidth = tier.items.reduce((sum, { equipmentId }) => {
      const eq = EQUIPMENT_PHYSICAL[equipmentId];
      return sum + (eq ? eq.dims.w : 0);
    }, 0);
    if (totalWidth + (tier.items.length + 1) * 15 > MAIN_RACK.innerWidth) {
      issues.push({
        severity: 'critical',
        tier: tier.id,
        message: `Ярус ${tier.label}: суммарная ширина устройств (${totalWidth}мм) не помещается в ${MAIN_RACK.innerWidth}мм внутренней ширины.`,
      });
    }
  });
  return issues;
}

// ============================================================
// BOM: доски, крепёж (упрощённый расчёт по геометрии MAIN_RACK)
// ============================================================
export function computeBOM() {
  const shelvesCount = MAIN_RACK.tiers.length + 1; // + цоколь
  const shelfArea = (MAIN_RACK.innerWidth / 1000) * (MAIN_RACK.shelfDepth / 1000); // м2
  const totalShelfArea = shelfArea * shelvesCount;
  const screwsPerShelf = Math.ceil((MAIN_RACK.innerWidth / 150)) * 2 + 4; // шаг 150мм, 2 стороны + углы
  const totalScrews = screwsPerShelf * shelvesCount;
  const cableLengthTotal = RACK_CABLES.reduce((sum, c) => sum + c.length, 0);

  return {
    shelves: {
      count: shelvesCount,
      thicknessMm: MAIN_RACK.shelfThickness,
      totalAreaM2: Math.round(totalShelfArea * 1000) / 1000,
      material: MATERIALS.cld_core.name + ' + ' + MATERIALS.cld_damping.name,
    },
    legs: {
      count: 4,
      heightMm: MAIN_RACK.legHeight,
      type: MATERIALS.steel_leg.name,
    },
    fasteners: {
      screws_4x50: totalScrews,
      pocket_holes: shelvesCount * 4,
    },
    cables: {
      count: RACK_CABLES.length,
      totalLengthM: Math.round(cableLengthTotal * 100) / 100,
    },
    glue: MATERIALS ? FASTENER_SPECS.glue_titebond.name : null,
  };
}
