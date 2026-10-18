import { ROOM_DEVICE_MAP, ROOM_PORTS, ROOM_PORT_MAP } from './roomEquipment.js';
import { getCableStyle } from './cableStyles.js';

export const RACK_CARD_WIDTH = 204;
const GAP = 88, ROW = 25, HEADER = 36;
const stages = [['wiim', 'e1'], ['bifrost', 'warmer', 'skoll'], ['a90', 'freya'], ['rusich'], ['ae0', 'ae1'], ['rel0', 'rel1']];
const powerStage = ['pdu', 'side0', 'side1'];
export function roomCableStyle(cable) {
  const from = ROOM_PORT_MAP[cable.from], to = ROOM_PORT_MAP[cable.to];
  const type = to?.connector || cable.toType || from?.connector || cable.fromType;
  if ((from || to)?.signal === 'power') return { color: '#9b7137', width: 2.5, name: 'Питание', cap: 'power' };
  const key = ({ BINDING: 'SPEAKER', XLR_HIGH: 'XLR_HIGH_LEVEL', COAX: 'COAXIAL' })[type] || type;
  return getCableStyle(key);
}
// Diagram coordinates only: these are not physical cable lengths or rack positions.
export function roomRackLayout(cables, { kind = 'audio', showIdle = false } = {}) {
  const included = new Set(cables.flatMap(c => [ROOM_PORT_MAP[c.from]?.device, ROOM_PORT_MAP[c.to]?.device]).filter(Boolean));
  const accepts = p => kind === 'audio' ? !['power', 'ground'].includes(p.signal) : ['power', 'ground'].includes(kind) ? p.signal === kind : true;
  const groups = [...(kind === 'power' || kind === 'all' || kind === 'loose' ? [powerStage] : []), ...stages];
  const cards = [], ports = {};
  let column = 0;
  for (const ids of groups) {
    const devices = ids.filter(id => (showIdle || included.has(id)) && ROOM_PORTS.some(p => p.device === id && accepts(p)));
    if (!devices.length) continue;
    let y = 16;
    const x = 24 + column * (RACK_CARD_WIDTH + GAP);
    for (const id of devices) {
      const devicePorts = ROOM_PORTS.filter(p => p.device === id && accepts(p));
      const height = HEADER + devicePorts.length * ROW + 10;
      const card = { ...ROOM_DEVICE_MAP[id], x, y, height, column, ports: devicePorts };
      cards.push(card);
      devicePorts.forEach((p, index) => { ports[p.id] = { x: x + (p.direction === 'out' ? RACK_CARD_WIDTH : 0), y: y + HEADER + ROW * (index + .5), column }; });
      y += height + 24;
    }
    column++;
  }
  const bottom = Math.max(100, ...cards.map(c => c.y + c.height));
  let bus = 0;
  const wires = cables.map((c, index) => {
    const start = ports[c.from], end = ports[c.to];
    if (!start && !end) return null;
    const a = start || { x: end.x - 45, y: end.y + 16 }, b = end || { x: start.x + 45, y: start.y + 16 };
    const stub = 18 + (index % 5) * 8;
    let d;
    if (!start || !end) d = `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
    else if (end.column === start.column + 1) {
      const mid = a.x + stub;
      d = `M ${a.x} ${a.y} H ${mid} V ${b.y} H ${b.x}`;
    } else {
      const lane = bottom + 28 + bus++ * 14;
      d = `M ${a.x} ${a.y} H ${a.x + stub} V ${lane} H ${b.x - stub} V ${b.y} H ${b.x}`;
    }
    return { ...c, start: a, end: b, d, loose: !start || !end, style: roomCableStyle(c) };
  }).filter(Boolean);
  return { cards, ports, wires, width: Math.max(300, column * (RACK_CARD_WIDTH + GAP) - GAP + 70), height: bottom + 55 + bus * 14 };
}

