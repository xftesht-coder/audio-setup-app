import { ROOM_DEVICE_MAP, ROOM_PORT_MAP, ROOM_PORTS } from './roomEquipment.js';
import { roomCableStyle } from './roomRackLayout.js';

export const ROUTING_STAGES = [
  { name: 'Питание', ids: ['pdu', 'side0', 'side1'] },
  { name: 'Источник', ids: ['wiim', 'e1'] },
  { name: 'Преобразование', ids: ['bifrost', 'warmer', 'skoll'] },
  { name: 'Предусилитель', ids: ['a90', 'freya'] },
  { name: 'Усилитель', ids: ['rusich'] },
  { name: 'Акустика', ids: ['ae0', 'rel0', 'ae1', 'rel1'] },
];
export const ROUTING_NAMES = { wiim: 'WiiM Pro Plus', e1: 'Pro-Ject E1', bifrost: 'Bifrost 3', warmer: 'FiiO WARMER', skoll: 'Skoll F', a90: 'Topping A90', freya: 'Freya 2', rusich: 'Rusich A2', ae0: 'AE320 · L', ae1: 'AE320 · R', rel0: 'REL Quake · L', rel1: 'REL Quake · R', pdu: 'Brennenstuhl · 8', side0: 'Фильтр · L', side1: 'Фильтр · R' };

// Exploded signal diagram, not physical positions or cable-length calculations.
export function routingScene(rows, { portrait = false, showIdle = false, kind = 'audio' } = {}) {
  const included = new Set(rows.flatMap(c => [ROOM_PORT_MAP[c.from]?.device, ROOM_PORT_MAP[c.to]?.device]).filter(Boolean));
  const accepts = p => kind === 'audio' ? !['power', 'ground'].includes(p.signal) : ['power', 'ground'].includes(kind) ? p.signal === kind : true;
  const stages = ROUTING_STAGES.map(s => ({ ...s, ids: s.ids.filter(id => (included.has(id) || showIdle) && ROOM_PORTS.some(p => p.device === id && accepts(p))) })).filter(s => s.ids.length);
  const nodes = [], ports = {}, occupied = new Set(rows.flatMap(c => [c.from, c.to]).filter(Boolean));
  const stageStep = portrait ? 2.7 : 3.6, slotStep = portrait ? 2.8 : 2.15;
  // Logical u is the signal direction; v separates parallel devices.
  const point = (u, v, y = .26) => portrait ? [v, y, u] : [u, y, v];
  stages.forEach((stage, column) => {
    stage.u = (column - (stages.length - 1) / 2) * stageStep;
    stage.ids.forEach((id, slot) => {
      const v = (slot - (stage.ids.length - 1) / 2) * slotStep;
      const devicePorts = ROOM_PORTS.filter(p => p.device === id && accepts(p) && occupied.has(p.id));
      const node = { ...ROOM_DEVICE_MAP[id], position: point(stage.u, v, 0), u: stage.u, v, column, stage: stage.name, ports: devicePorts };
      nodes.push(node);
      for (const direction of ['in', 'out']) {
        const group = devicePorts.filter(p => p.direction === direction);
        group.forEach((p, index) => { ports[p.id] = { position: point(stage.u + (direction === 'out' ? 1 : -1) * (portrait ? .48 : .98), v + (index - (group.length - 1) / 2) * .085), node: id, column }; });
      }
    });
  });
  const nodesById = Object.fromEntries(nodes.map(n => [n.id, n]));
  const crossExtent = Math.max(1, ...nodes.map(n => Math.abs(n.v))) + 1.5;
  let bypass = 0;
  const wires = rows.map(c => {
    const from = ports[c.from], to = ports[c.to];
    if (!from && !to) return null;
    const offset = (p, amount) => portrait ? [p[0], p[1], p[2] + amount] : [p[0] + amount, p[1], p[2]];
    const start = from?.position || offset(to.position, -.7), end = to?.position || offset(from.position, .7);
    const a = offset(start, .36), b = offset(end, -.36);
    let points = [start, a, b, end];
    if (from && to && to.column !== from.column + 1) {
      const lane = crossExtent + bypass++ * .22;
      const busPoint = p => portrait ? [lane, .12, p[2]] : [p[0], .12, lane];
      points = [start, a, busPoint(a), busPoint(b), b, end];
    }
    if (!from || !to) points = [start, end];
    return { ...c, points, style: roomCableStyle(c), loose: !from || !to, fromNode: from?.node, toNode: to?.node };
  }).filter(Boolean);
  const all = [...nodes.map(n => n.position), ...wires.flatMap(w => w.points)];
  const xs = all.map(p => p[0]), zs = all.map(p => p[2]);
  const minX = Math.min(-1, ...xs) - 1.25, maxX = Math.max(1, ...xs) + 1.25;
  const minZ = Math.min(-1, ...zs) - 1.2, maxZ = Math.max(1, ...zs) + 1.6;
  return { nodes, nodesById, ports, wires, stages, portrait, width: maxX - minX, depth: maxZ - minZ, center: [(minX + maxX) / 2, 0, (minZ + maxZ) / 2] };
}

export function routingTrace(report, source, target = '') {
  const routes = target ? report.routes.filter(r => r.id === target) : report.routes;
  const cables = new Set(routes.filter(r => r.wired).flatMap(r => r.path.map(c => c.id)));
  const devices = new Set([source]);
  routes.filter(r => r.wired).forEach(r => r.path.forEach(c => [c.from, c.to].forEach(p => { if (ROOM_PORT_MAP[p]) devices.add(ROOM_PORT_MAP[p].device); })));
  return { cables, devices };
}
