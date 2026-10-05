import catalog from './schiitCatalog.js';

export const AUDIO_ROLES = { dac: 'ЦАП', preamp: 'Предусилитель', powerAmp: 'Усилитель мощности', phono: 'Фонокорректор', eq: 'Эквалайзер', headphoneAmp: 'Усилитель наушников' };
export const SCHIIT_CATALOG = catalog;
const byName = name => catalog.products.find(p => p.name === name);
const line = (connector, impedanceOhm = null, maxVrms = null) => ({ connector, signal: 'line', impedanceOhm, maxVrms });
const digital = connector => ({ connector, signal: 'spdif' });
const stereoInputs = (rca = null, xlr = null) => [line('RCA', rca), line('XLR', xlr)];
const stereoOutputs = (rca = null, xlr = null, volts = null) => [line('RCA', rca, volts), line('XLR', xlr, volts == null ? null : volts * 2)];

export function productEnvelope(product) {
  // Lyr's published chassis size does not establish the installed tube envelope.
  if (product?.name === 'Lyr 5') return null;
  const size = product?.facts.findLast(f => /^size$/i.test(f.name) && /\d.*[x×].*\d.*[x×]/i.test(f.value));
  const dimensions = size?.value.match(/([\d.]+)["”]?\s*W?\s*[x×]\s*([\d.]+)["”]?\s*D?\s*[x×]\s*([\d.]+)["”]?/i);
  if (!dimensions) return null;
  const tubeExtra = size.value.match(/about\s+([\d.]+)["”]/i);
  const totalTubeHeight = size.value.match(/about\s+([\d.]+)["”]?\s+tall\s+with\s+tubes/i);
  return { w: +(Number(dimensions[1]) * 25.4).toFixed(1), d: +(Number(dimensions[2]) * 25.4).toFixed(1),
    h: +((totalTubeHeight ? Number(totalTubeHeight[1]) : Number(dimensions[3]) + Number(tubeExtra?.[1] || 0)) * 25.4).toFixed(1), approximateHeight: !!tubeExtra, source: product.source };
}
function model(name, roles, inputs, outputs, extra = {}) {
  const product = byName(name);
  if (!product) throw new Error(`Missing Schiit product: ${name}`);
  return { ...product, name: `Schiit ${name}`, roles, inputs, outputs, envelope: productEnvelope(product), portsVerified: inputs !== null && outputs !== null, ...extra };
}
const models = [
  ...['Bifrost 3', 'Bifrost', 'Gungnir 2', 'Yggdrasil', 'Mimir', 'Modi 5'].map(name => model(name, ['dac'],
    [digital('OPTICAL'), digital('COAXIAL'), { connector: 'USB', signal: 'usb-audio' }],
    name === 'Modi 5' ? [line('RCA', 75, null)] : stereoOutputs(75, 75, name === 'Mimir' ? null : 2),
    { note: name === 'Yggdrasil' ? 'Проверяются общие входы/выходы; версия аналоговой и USB-карты уточняется.' : '' })),
  model('Freya 2', ['preamp'], stereoInputs(10000, 10000), stereoOutputs(75, 150), {
    gainDb: [0, 12], outputPairs: { RCA: 2, XLR: 1 }, hasHeadphoneOutput: false, thermalWatts: 50,
    note: 'Активные режимы: выход 75 Ω RCA / 150 Ω XLR. В пассивном режиме выходное сопротивление зависит от громкости и источника. Высота с лампами приблизительная.',
  }),
  model('Kara F', ['preamp'], stereoInputs(10000, 10000), stereoOutputs(75, 600), { gainDb: [0, 12], outputPairs: { RCA: 2, XLR: 1 }, hasHeadphoneOutput: true, thermalWatts: 22, note: 'Указаны сопротивления линейных выходов активного режима.' }),
  model('Saga 2', ['preamp'], [line('RCA', 10000)], stereoOutputs(75, 75), { gainDb: [0, 12], outputPairs: { RCA: 1, XLR: 1 }, hasHeadphoneOutput: true, thermalWatts: 15, note: 'Входы только RCA. В пассивном режиме выходное сопротивление до 4,8 кΩ; XLR даёт дополнительное усиление.' }),
  model('SYS', ['preamp'], [line('RCA', 10000)], [line('RCA', 5000)], { passive: true, outputPairs: { RCA: 1 }, gainDb: [0], hasHeadphoneOutput: false, thermalWatts: 0, note: 'Пассивный регулятор. Выходное сопротивление до 5 кΩ, зависит от положения ручки.' }),
  model('Gjallarhorn F', ['powerAmp'], [line('RCA', 20000), { ...line('XLR', 40000), monoOnly: true }], [{ connector: 'BINDING_POST', signal: 'speaker' }], { nominalLoads: [4, 8], stereoRcaMonoXlr: true }),
  model('Vidar 2F', ['powerAmp'], [line('RCA', 22000), { ...line('XLR', 44000), monoOnly: true }], [{ connector: 'BINDING_POST', signal: 'speaker' }], { nominalLoads: [4, 8], stereoRcaMonoXlr: true }),
  model('Aegir 2F', ['powerAmp'], [line('RCA', 22000), { ...line('XLR', 44000), monoOnly: true }], [{ connector: 'BINDING_POST', signal: 'speaker' }], { nominalLoads: [4, 8], stereoRcaMonoXlr: true }),
  model('Wotan', ['powerAmp'], stereoInputs(47000, 47000), [{ connector: 'BINDING_POST', signal: 'speaker' }], { nominalLoads: [4, 8] }),
  model('Tyr F', ['powerAmp'], stereoInputs(47000, 47000), [{ connector: 'BINDING_POST', signal: 'speaker' }], { nominalLoads: [4, 8], monoOnly: true }),
  model('Mani', ['phono'], [{ connector: 'RCA', signal: 'phono' }], [line('RCA', 75)], { note: 'MM/MC: коэффициент усиления и нагрузку выбирать под конкретный картридж.' }),
  model('Skoll F', ['phono'], [{ connector: 'RCA', signal: 'phono' }, { connector: 'XLR', signal: 'phono' }], stereoOutputs(10, 10), { note: 'MM/MC: настройка 40/50/60/70 дБ и нагрузка должны соответствовать картриджу.' }),
  model('Loki Mini+', ['eq'], [line('RCA', 47000)], [line('RCA', 75)]),
  model('Lokius', ['eq'], stereoInputs(47000, 47000), stereoOutputs(75, 75)),
  model('Loki Max F', ['eq'], stereoInputs(10000, 10000), stereoOutputs(75, 75)),
];

// Headphone and modular units stay selectable without treating their headphone
// impedance/power as specifications of a line pre-output. Unreviewed ports stay null.
for (const product of catalog.products.filter(p => ['Headphone Amps', 'Modular', 'Gaming'].includes(p.category))) {
  models.push(model(product.name, ['headphoneAmp'], null, null, { hasHeadphoneOutput: true, note: 'Конкретные разъёмы и кабель наушников требуется подтвердить по паспорту выбранной комплектации.' }));
}
models.push(
  { id: 'fiio-warmer-r2r', name: 'FiiO WARMER R2R', manufacturer: 'FiiO', roles: ['dac'], inputs: [digital('OPTICAL'), digital('COAXIAL'), { connector: 'USB', signal: 'usb-audio' }], outputs: [line('RCA', null, 1.8), line('XLR', null, 3.3)], portsVerified: true,
    envelope: { w: 223.5, d: 213, h: 66.8, approximateHeight: true }, weightKg: 2.865, heat: 'high', availability: 'candidate',
    source: 'https://fiio.com/WARMERR2R_parameters', checkedAt: '2026-10-05',
    note: 'Кандидат на ЦАП. Фиксированный выход: 1,8 Vrms RCA / 3,3 Vrms XLR при нагрузке 10 кΩ; это нагрузка измерения, а не выходное сопротивление. Оптика до 24/96, коаксиал до 24/192. Габариты производителя приблизительные, с ножками. Регулятора громкости нет.',
    facts: [{ name: 'Размеры, Ш × Г × В', value: 'около 223,5 × 213 × 66,8 мм, с ножками' }, { name: 'Масса', value: 'около 2865 г' }, { name: 'Питание', value: 'две отдельные версии: 220–240 В или 100–120 В' }],
  },
  { id: 'owner-a90', name: 'Topping A90 · текущий', manufacturer: 'Topping', roles: ['preamp', 'headphoneAmp'], inputs: stereoInputs(), outputs: stereoOutputs(), portsVerified: true, hasHeadphoneOutput: true, envelope: { w: 222, h: 45, d: 160, approximateHeight: false }, source: null, note: 'Ревизия A90 / A90 Discrete не подтверждена. Электрические параметры оставлены неизвестными.' },
  { id: 'owner-rusich', name: 'Rusich ALEPH PASS A2', manufacturer: 'Rusich', roles: ['powerAmp'], inputs: stereoInputs(), outputs: [{ connector: 'BINDING_POST', signal: 'speaker' }], portsVerified: true, envelope: { w: 430, h: 180, d: null }, source: null, note: 'По чертежу владельца: входы RCA/XLR. Входное сопротивление, чувствительность, мощность и глубина неизвестны.' },
  { id: 'owner-current-dac', name: 'Текущий ЦАП · модель уточняется', manufacturer: null, roles: ['dac'], inputs: null, outputs: null, portsVerified: false, envelope: null, note: 'Bifrost 3 — запланированная покупка, не установленный аппарат.' },
);
export const AUDIO_MODELS = Object.fromEntries(models.map(m => [m.id, m]));
export const WIIM = { id: 'wiim', name: 'WiiM Pro Plus', inputs: [], outputs: [digital('OPTICAL'), digital('COAXIAL'), line('RCA')], source: 'https://www.wiimhome.com/wiimpro/overview' };
export const TURNTABLE = { id: 'turntable', name: 'Pro-Ject E1 · PHONO', inputs: [], outputs: [{ connector: 'RCA', signal: 'phono' }] };
export const SPEAKERS = { id: 'ae320', name: 'Acoustic Energy AE320', inputs: [{ connector: 'BINDING_POST', signal: 'speaker' }], nominalOhm: 8 };
export const DEFAULT_SYSTEM_PLAN = {
  dac: 'schiit-bifrost-3', preamp: 'schiit-freya_2', powerAmp: 'owner-rusich', phono: 'schiit-skoll-f', eq: null, headphoneAmp: 'owner-a90',
  sourceMode: 'digital', transport: 'OPTICAL', lineConnector: 'XLR', ampConnector: 'RCA', phonoConnector: 'RCA',
  preampMode: 'active', powerAmpQuantity: 1,
};
