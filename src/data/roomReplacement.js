import { ROOM_DEVICE_MAP, ROOM_PORT_MAP, ROOM_PORTS } from './roomEquipment.js';
import { parseComponents } from './roomComponents.js';
import { connectionCheck } from './roomWiring.js';
import { auditRoom, portLabel } from './roomIntelligence.js';

const maps = {
  'a90:freya': { xlrIn: 'xlr1', rcaIn: 'rca3', xlrOut: 'xlrOut', rcaOut: 'rcaOut1' },
  'freya:a90': { xlr1: 'xlrIn', xlr2: 'xlrIn', rca3: 'rcaIn', rca4: 'rcaIn', rca5: 'rcaIn', xlrOut: 'xlrOut', rcaOut1: 'rcaOut', rcaOut2: 'rcaOut' },
  'bifrost:warmer': { opt: 'opt', coax: 'coax', usb: 'usb', xlrOut: 'xlrOut', rcaOut: 'rcaOut' },
  'warmer:bifrost': { opt: 'opt', coax: 'coax', usb: 'usb', xlrOut: 'xlrOut', rcaOut: 'rcaOut' },
};
export const replacementBase = s => JSON.stringify({ cables: s.cables, listening: s.listening, components: s.components });

export function previewReplacement(state, choices) {
  const components = parseComponents({ ...state.components, ...choices });
  const swaps = Object.keys(components).filter(role => components[role] !== state.components[role]).map(role => ({ role, from: state.components[role], to: components[role] }));
  if (swaps.some(s => !s.to)) throw new Error('Для замены выбери конкретный аппарат.');
  const problems = [], notes = [], inputs = [], listening = structuredClone(state.listening);
  const replacements = new Map();
  for (const swap of swaps) {
    if (!swap.from) {
      notes.push(`Прежний ${swap.role === 'dac' ? 'ЦАП' : 'предусилитель'} не определён однозначно. Назначаем ${ROOM_DEVICE_MAP[swap.to].name}; существующие аудиокабели не переносим. Проверь тракт вручную.`);
      continue;
    }
    const mapping = maps[`${swap.from}:${swap.to}`];
    if (!mapping) throw new Error('Нет проверенного соответствия разъёмов для этой замены.');
    Object.entries(mapping).forEach(([from, to]) => replacements.set(`${swap.from}.${from}`, `${swap.to}.${to}`));
    const oldInput = listening.inputs[swap.from];
    if (oldInput !== null) {
      const nextInput = replacements.get(oldInput);
      if (nextInput && nextInput !== listening.inputs[swap.to]) {
        inputs.push({ device: swap.to, before: listening.inputs[swap.to], after: nextInput });
        listening.inputs[swap.to] = nextInput;
      }
    }
  }
  const changes = [], unchanged = [];
  let cables = state.cables.map(c => {
    const next = { ...c, from: replacements.get(c.from) || c.from, to: replacements.get(c.to) || c.to };
    if (next.from === c.from && next.to === c.to) { unchanged.push(c); return c; }
    changes.push({ id: c.id, before: c, after: next, kind: 'move' });
    return next;
  });
  // Retain power to devices kept on the shelf; propose a separate feed for the new one.
  for (const { to } of swaps) {
    if (cables.some(c => c.to === `${to}.power` && c.from)) continue;
    if (cables.some(c => c.to === `${to}.power`)) {
      notes.push(`${ROOM_DEVICE_MAP[to].name}: питание имеет свободный конец; подключи его за стойкой.`);
      continue;
    }
    const outlet = ROOM_PORTS.find(p => p.device === 'pdu' && !p.reserved && !cables.some(c => c.from === p.id || c.to === p.id));
    if (!outlet) { problems.push(`Для ${ROOM_DEVICE_MAP[to].name} нет свободной розетки Brennenstuhl. Освободи розетку или подключи питание вручную перед заменой.`); continue; }
    let id = `power-${to}`, suffix = 1;
    while (cables.some(c => c.id === id)) id = `power-${to}-${suffix++}`;
    const cable = { id, from: outlet.id, to: `${to}.power`, fromType: 'SCHUKO', toType: ROOM_PORT_MAP[`${to}.power`].connector };
    cables = [...cables, cable];
    changes.push({ id, before: null, after: cable, kind: 'power' });
  }
  if (cables.length > 100) problems.push('В схеме уже 100 кабелей; освободи место перед добавлением питания.');
  for (const c of cables) {
    if (c.from && c.to) {
      const check = connectionCheck(c.from, c.to, cables, c.id);
      if (!check.ok) problems.push(`${portLabel(c.from)} → ${portLabel(c.to)}: ${check.reason}`);
    } else {
      const p = ROOM_PORT_MAP[c.from || c.to];
      if (cables.filter(k => k.from === p.id || k.to === p.id).length > p.capacity) problems.push(`${portLabel(p.id)}: порт занят, включая свободный кабель.`);
    }
  }
  const next = { cables, listening, components };
  const beforeReport = auditRoom(state.cables, state.listening.source, state.listening);
  const afterReport = auditRoom(cables, listening.source, listening);
  return { base: replacementBase(state), choices: components, swaps, changes, unchanged, inputs, problems: [...new Set(problems)], notes, next, beforeReport, afterReport };
}
