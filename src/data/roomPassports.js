// Electrical facts are separate from artistic geometry and device ownership.
// Published specifications are not measurements of the owner's individual unit.
export const PASSPORT_DATE = '2026-10-15';
export const ELECTRICAL_SOURCES = {
  bifrost: { name: 'Schiit · Bifrost 3', url: 'https://www.schiit.com/products/bifrost-3', checkedAt: PASSPORT_DATE },
  freya: { name: 'Schiit · Freya 2', url: 'https://www.schiit.com/products/freya-2', checkedAt: PASSPORT_DATE },
  warmer: { name: 'FiiO · WARMER R2R', url: 'https://www.fiio.com/WARMERR2R_parameters', checkedAt: PASSPORT_DATE },
};
export const FREYA_MODES = {
  'solid-low': { label: 'Транзисторный · 0 дБ', gain: 1, outputVerified: true },
  'solid-high': { label: 'Транзисторный · 12 дБ', gain: 4, outputVerified: true },
  'tube-low': { label: 'Все лампы · 0 дБ', gain: 1, outputVerified: true },
  'tube-high': { label: 'Все лампы · 12 дБ', gain: 4, outputVerified: true },
  'tube-input-low': { label: 'Ламповый вход · 0 дБ', gain: 1 },
  'tube-input-high': { label: 'Ламповый вход · 12 дБ', gain: 4 },
  'tube-output-low': { label: 'Ламповый выход · 0 дБ', gain: 1 },
  'tube-output-high': { label: 'Ламповый выход · 12 дБ', gain: 4 },
  passive: { label: 'Пассивный', gain: null },
};
const revisions = { bifrost: 'Bifrost 3', freya: 'Freya 2', warmer: 'WARMER R2R' };
export function electricalFact(device, key, value, unit, conditions, reason = '') {
  return { device, key, value, unit, conditions, revision: revisions[device] || null,
    status: value === null ? 'unknown' : 'published', source: ELECTRICAL_SOURCES[device] || null,
    checkedAt: ELECTRICAL_SOURCES[device]?.checkedAt || null, reason };
}
export function portElectricalFacts(port, freyaMode = null) {
  const { device, direction, connector } = port;
  const mode = FREYA_MODES[freyaMode];
  const condition = connector === 'XLR' ? 'Балансная стереопара XLR' : connector === 'RCA' ? 'Небалансная стереопара RCA' : port.label;
  let resistance = null, voltage = null, voltageConditions = condition;
  let reason = 'Параметр для этого аппарата и разъёма пока не проверен.';
  if (device === 'a90') reason = 'Нужно подтвердить ревизию A90 / A90 Discrete. Параметры соседней модели не подставляются.';
  if (device === 'rusich') reason = 'Чертёж владельца подтверждает разъёмы, но не входное сопротивление и предельный уровень.';
  if (port.signal === 'line') {
    if (device === 'bifrost' && direction === 'out') { resistance = 75; voltage = connector === 'XLR' ? 4 : 2; voltageConditions += '; максимальный выход по спецификации, нагрузка не указана'; }
    if (device === 'warmer' && direction === 'out') { voltage = connector === 'XLR' ? 3.3 : 1.8; voltageConditions += '; 1 кГц, нагрузка 10 кΩ, OS'; reason = '10 кΩ в таблице FiiO — нагрузка измерения, не выходное сопротивление.'; }
    if (device === 'freya') {
      if (direction === 'in' && mode && freyaMode !== 'passive') resistance = 10000;
      else if (mode?.outputVerified) resistance = connector === 'XLR' ? 150 : 75;
      else reason = !mode ? 'Укажи режим Freya: активный и пассивный тракт требуют разных моделей нагрузки.' : freyaMode === 'passive' ? 'Выходное сопротивление пассивного тракта зависит от регулятора и источника; модель не подтверждена.' : 'Для гибридного режима отдельное выходное сопротивление не опубликовано в проверенной таблице.';
    }
  }
  const resistanceCondition = device === 'freya' ? `${condition}; ${mode?.label || 'режим не указан'}` : condition;
  return {
    impedance: electricalFact(device, direction === 'out' ? 'outputImpedance' : 'inputImpedance', resistance, 'Ω', resistanceCondition, resistance === null ? reason : ''),
    level: electricalFact(device, direction === 'out' ? 'outputLevel' : 'maxInputLevel', voltage, 'Vrms', voltageConditions, voltage === null ? 'Допустимый уровень для этих условий не подтверждён. Чувствительность не заменяет порог перегрузки.' : ''),
  };
}
export const PASSPORT_GAPS = {
  a90: 'Подтвердить A90 или A90 Discrete; затем проверить паспорт именно этой ревизии.',
  rusich: 'Уточнить у изготовителя входные сопротивления RCA/XLR, чувствительность и предельный входной уровень, усиление, мощность и допустимую нагрузку.',
  warmer: 'Найти выходное сопротивление RCA/XLR; не использовать нагрузку измерения 10 кΩ вместо него.',
  freya: 'Проверить предельный входной/выходной уровень и поведение выбранного режима. Положение регулятора и mute не измеряются приложением.',
  bifrost: 'Паспорт относится к Bifrost 3; конкретная плата, прошивка и настройки громкости/DSP аппарата не подтверждены.',
};
