import { AUDIO_MODELS, AUDIO_ROLES } from './audioModels.js';
import { assessSystem, parseSystemPlan } from './systemMatching.js';

export const MAX_VARIANTS = 24;
export const MAX_IMPORT_BYTES = 128 * 1024;
export const samePlan = (a, b) => Object.keys(a).every(key => a[key] === b[key]) && Object.keys(a).length === Object.keys(b).length;
export function variantName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name || name.length > 64) throw new Error('Дай варианту название от 1 до 64 символов.');
  return name;
}
export function validateVariants(input) {
  if (!Array.isArray(input) || input.length > MAX_VARIANTS) throw new Error(`Можно сохранить до ${MAX_VARIANTS} вариантов.`);
  const ids = new Set();
  return input.map(item => {
    if (!item || typeof item.id !== 'string' || !item.id || item.id.length > 80 || ids.has(item.id)) throw new Error('Некорректный или повторяющийся идентификатор варианта.');
    ids.add(item.id);
    return { id: item.id, name: variantName(item.name), plan: parseSystemPlan(item.plan) };
  });
}
export function exportVariants(variants) {
  return JSON.stringify({ type: 'audio-setup-variants', version: 1, variants: validateVariants(variants) }, null, 2);
}
export function importVariants(text, current, makeId = () => crypto.randomUUID()) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) throw new Error('Файл слишком большой: максимум 128 КБ.');
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Файл не читается. Выбери JSON, скачанный из раздела «Варианты».'); }
  if (data?.type !== 'audio-setup-variants' || data.version !== 1) throw new Error('Это не поддерживаемый файл вариантов Audio Setup.');
  const incoming = validateVariants(data.variants), merged = validateVariants(current);
  for (const item of incoming) {
    if (!merged.some(saved => saved.name === item.name && samePlan(saved.plan, item.plan))) merged.push({ ...item, id: makeId() });
  }
  return validateVariants(merged);
}

const SOURCE = { digital: 'WiiM → внешний ЦАП', vinyl: 'Винил → фонокорректор', wiimAnalog: 'WiiM → аналоговый RCA' };
const CONNECTOR = { OPTICAL: 'Оптика · TOSLINK', COAXIAL: 'Коаксиал · S/PDIF' };
export function comparisonValues(plan) {
  const result = assessSystem(plan);
  const rows = [['Источник', SOURCE[plan.sourceMode]]];
  for (const [role, label] of Object.entries(AUDIO_ROLES)) {
    const inactive = (role === 'dac' && plan.sourceMode !== 'digital') || (role === 'phono' && plan.sourceMode !== 'vinyl');
    rows.push([label, plan[role] ? `${AUDIO_MODELS[plan[role]].name}${inactive ? ' · вне тракта' : ''}${role === 'powerAmp' && plan.powerAmpQuantity === 2 ? ' × 2' : ''}` : 'Не используется']);
  }
  rows.push(['WiiM → ЦАП', plan.sourceMode === 'digital' ? CONNECTOR[plan.transport] : 'Не используется']);
  rows.push(['Вход предусилителя', plan.sourceMode === 'digital' ? plan.lineConnector : plan.sourceMode === 'vinyl' ? plan.phonoConnector : 'RCA']);
  rows.push(['Выход на усиление', plan.ampConnector]);
  rows.push(['Режим предусилителя', plan.preampMode === 'passive' || AUDIO_MODELS[plan.preamp].passive ? 'Пассивный' : 'Активный']);
  const issues = [...result.links, ...result.notes];
  rows.push(['Проверка тракта', result.hasErrors ? `Ошибок: ${issues.filter(x => x.status === 'error').length}` : 'Прямых конфликтов не найдено']);
  rows.push(['Требуют уточнения', `${issues.filter(x => ['unknown', 'warning'].includes(x.status)).length} соединений и условий`]);
  return rows;
}
