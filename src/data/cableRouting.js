import { equipmentBoxes, obstacles } from './workshop.js';
import { getPortLocalAnchor } from './portGeometry.js';

const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const mul = (a, k) => a.map(v => v * k);
const norm = a => Math.hypot(...a);
const unit = a => mul(a, 1 / norm(a));
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const distance = (a, b) => norm(sub(a, b));
const mix = (a, b, t) => add(a, mul(sub(b, a), t));

// Circular fillets preserve a specified centreline bend radius. No spline can
// silently overshoot a keep-out or conceal a bend tighter than the profile.
export function roundedRoute(vertices, radius) {
  const vs = vertices.filter((v, i) => !i || distance(v, vertices[i - 1]) > 0.01);
  const corners = vs.map((v, i) => {
    if (!i || i === vs.length - 1) return null;
    const incoming = unit(sub(v, vs[i - 1]));
    const outgoing = unit(sub(vs[i + 1], v));
    const angle = Math.acos(Math.max(-1, Math.min(1, dot(incoming, outgoing))));
    if (angle < 0.0001) return null;
    return { incoming, outgoing, angle, trim: radius * Math.tan(angle / 2) };
  });
  let feasible = true;
  for (let i = 0; i < vs.length - 1; i++) if ((corners[i]?.trim || 0) + (corners[i + 1]?.trim || 0) > distance(vs[i], vs[i + 1]) - 0.01) feasible = false;
  const points = [vs[0]];
  const line = end => {
    const start = points.at(-1), n = Math.max(1, Math.ceil(distance(start, end) / 4));
    for (let i = 1; i <= n; i++) points.push(mix(start, end, i / n));
  };
  if (!feasible) {
    vs.slice(1).forEach(line);
    return { points, feasible, radius: 0 };
  }
  corners.forEach((c, i) => {
    if (!c) return;
    const start = sub(vs[i], mul(c.incoming, c.trim));
    const end = add(vs[i], mul(c.outgoing, c.trim));
    const normal = unit(sub(c.outgoing, mul(c.incoming, dot(c.incoming, c.outgoing))));
    const center = add(start, mul(normal, radius));
    const u = unit(sub(start, center));
    line(start);
    const n = Math.max(8, Math.ceil(radius * c.angle / 4));
    for (let j = 1; j <= n; j++) {
      const angle = c.angle * j / n;
      points.push(add(center, add(mul(u, radius * Math.cos(angle)), mul(c.incoming, radius * Math.sin(angle)))));
    }
    points[points.length - 1] = end;
  });
  line(vs.at(-1));
  return { points, feasible, radius };
}

export function pathLength(points) { return points.slice(1).reduce((s, p, i) => s + distance(p, points[i]), 0); }
function supportPoints(points, maxSpan) {
  const length = pathLength(points), count = Math.max(2, Math.ceil(length / maxSpan));
  const targets = Array.from({ length: count + 1 }, (_, i) => i * length / count);
  let run = 0, idx = 0;
  const supports = [];
  for (let i = 1; i < points.length; i++) {
    const len = distance(points[i - 1], points[i]);
    while (idx < targets.length && targets[idx] <= run + len + 0.001) {
      supports.push(mix(points[i - 1], points[i], len ? (targets[idx] - run) / len : 0)); idx++;
    }
    run += len;
  }
  return supports;
}

export function routeCable(p, c) {
  const boxes = equipmentBoxes(p);
  const from = boxes.find(e => e.id === c.from), to = boxes.find(e => e.id === c.to);
  const anchor = (e, port, offset) => add(e.center, add(port ? getPortLocalAnchor(e.id, port).map(v => v * 1000) : [e.w * 0.24, e.h * 0.2, -e.d / 2 - 2], offset));
  const a = anchor(from, c.fromPort, c.fromOffset);
  const rear = Math.min(...p.shelves.map(s => s.z - s.depth / 2));
  const back = Math.min(rear, a[2], to ? to.center[2] - to.d / 2 : rear) - p.rearGap - c.depthOffset - (c.category === 'signal' ? 0 : p.powerGap + 120);
  const serviceIndex = p.cables.filter(c => c.to === 'service').findIndex(a => a.id === c.id);
  const b = to ? anchor(to, c.toPort, c.toOffset) : add([p.width / 2 + 90 + (serviceIndex % 2) * 42, 26, back + c.bendRadius + c.connectorLength + c.straight + 5], c.toOffset);
  const tipA = add(a, [0, 0, -c.connectorLength]);
  const tipB = add(b, [0, 0, -c.connectorLength]);
  const start = add(tipA, [0, 0, -c.straight]);
  const end = add(tipB, [0, 0, -c.straight]);
  const vertices = c.waypoints.length ? [start, ...c.waypoints, end] : c.to === 'service'
    ? [start, [start[0], start[1], back], [end[0], start[1], back], [end[0], end[1], back], end]
    : [start, [start[0], start[1], back], [end[0], end[1], back], end];
  const rounded = roundedRoute(vertices, c.bendRadius);
  // Include the straight strain-relief portions in the same checks and length.
  const segment = (x, y) => { const n = Math.max(1, Math.ceil(distance(x, y) / 4)); return Array.from({ length: n + 1 }, (_, i) => mix(x, y, i / n)); };
  const points = [...segment(tipA, start), ...rounded.points.slice(1), ...segment(end, tipB).slice(1)];
  const length = pathLength(points) + 2 * c.connectorLength;
  const issues = [];
  if (c.waypoints.length && (Math.hypot(c.waypoints[0][0] - start[0], c.waypoints[0][1] - start[1]) > 0.01 || c.waypoints[0][2] >= start[2] || Math.hypot(c.waypoints.at(-1)[0] - end[0], c.waypoints.at(-1)[1] - end[1]) > 0.01 || c.waypoints.at(-1)[2] >= end[2])) issues.push('Крайние точки должны продолжать ось разъёма назад: совпадающие X/Y, меньшее Z. Иначе на прямом участке возникает излом.');
  if (!rounded.feasible) issues.push('Нет места для заданного радиуса: увеличьте вылет трассы или расстояние между точками.');
  if (length + c.reserve > c.available) issues.push(`Кабель короток на ${Math.ceil(length + c.reserve - c.available)} мм с учётом запаса.`);
  if (c.bendRadius < c.diameter * 2) issues.push('Радиус меньше двух диаметров; проверьте паспорт.');
  const hit = new Set();
  for (const o of obstacles(p)) {
    const contains = (point, radius) => point.every((v, i) => Math.abs(v - o.center[i]) < o.size[i] / 2 + radius + 0.5);
    if (points.some(pt => contains(pt, c.diameter / 2))) hit.add(o.name);
    // Connector shells are checked too, except for their own mating chassis.
    if (o.id !== c.from && segment(a, tipA).some(pt => contains(pt, c.connectorDiameter / 2))) hit.add(o.name);
    if (o.id !== c.to && segment(b, tipB).some(pt => contains(pt, c.connectorDiameter / 2))) hit.add(o.name);
  }
  if (hit.size) issues.push(`Пересечение: ${[...hit].join(', ')}. Измените позицию аппарата, разъёма или трассу.`);
  if (points.some(pt => pt[1] < c.diameter / 2)) issues.push('Трасса пересекает пол.');
  const supports = supportPoints(points, c.supportSpan);
  return { cable: c, points, vertices, connectors: [[a, tipA], [b, tipB]], length, mass: (length - 2 * c.connectorLength) / 1000 * c.massPerM + 2 * c.connectorMass, supports,
    spanLoad: c.massPerM / 1000 * Math.min(c.supportSpan, length) / 1000 * 9.81, issues, radius: rounded.radius };
}
export function routeAllCables(p) { return p.cables.map(c => routeCable(p, c)); }
