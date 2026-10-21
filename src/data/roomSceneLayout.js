import { ROOM_DEVICES, ROOM_PORTS } from './roomEquipment.js';
import { equipmentBoxes, postCenters } from './workshop.js';
import { televisionObstacles } from './television.js';
import { nearestWalkPosition } from './roomNavigation.js';

export const ROOM_DIMENSIONS = { width: 6, depth: 3.3, height: 2.8, minZ: -1.09, maxZ: 2.21, source: 'Размеры владельца · 20.10.2026', heightSource: 'Высота 2,8 м — проектное допущение' };
export const BACKABRO_SOFA = {
  manufacturer: 'IKEA', model: 'BACKABRO', widthMm: 2100, depthMm: 1080, heightMm: 880,
  center: [0, .444, 1.62], color: 'Светлый бежевый',
  source: 'Ширина, глубина и цвет — по данным владельца; высота и мягкая форма предварительные.',
  reference: 'https://www.ikea.com/be/nl/assembly_instructions/backabro-hoes-zits-slaapbank__AA-918943-4_pub.pdf',
  note: 'Архив IKEA для BACKABRO 2-местного указывает 168 × 88 см. Здесь сохранён габарит владельца 210 × 108 см; точное исполнение не подтверждено.',
};
export const ROOM_EQUIPMENT_IDS = { freya: 'freya2', warmer: 'warmer_r2r', skoll: 'phono', wiim: 'streamer_wiim', bifrost: 'dac_fiio', a90: 'a90', rusich: 'rusich_a2', e1: 'turntable' };
const DETAIL_MODELS = { freya: 'schiit-freya_2', warmer: 'fiio-warmer-r2r', skoll: 'schiit-skoll-f', bifrost: 'schiit-bifrost-3', a90: 'owner-a90', rusich: 'owner-rusich' };
const SOURCE_SHELF_TOP = { freya: .9408, warmer: .9408, skoll: .7668, wiim: .7668, bifrost: .534, a90: .534, rusich: .172, e1: 1.2508 };

// The detailed Blender parts retain their original geometry. Only translation
// changes; the same translation is applied to their photo-traced rear ports.
export function roomSceneLayout(project) {
  const speakerX = Math.max(1.1, project.width / 2000 + .35);
  const shifts = {}, devices = {};
  for (const d of ROOM_DEVICES) {
    let center = [...d.center];
    const e = project.equipment.find(e => e.id === ROOM_EQUIPMENT_IDS[d.id]);
    if (e) {
      const shelf = project.shelves.find(s => s.id === e.shelfId);
      center = [(shelf.x + e.x) / 1000, -(shelf.z + e.z) / 1000, (shelf.y + shelf.thickness) / 1000 + d.center[2] - SOURCE_SHELF_TOP[d.id]];
    } else if (/^(ae|rel|side)[01]$/.test(d.id)) {
      center[0] = (d.id.endsWith('0') ? -1 : 1) * (speakerX + (d.id.startsWith('rel') ? .45 : d.id.startsWith('side') ? .76 : 0));
    } else if (d.id === 'pdu') center = [project.width / 2000 + .15, .35, .035];
    shifts[d.id] = center.map((n, i) => n - d.center[i]);
    devices[d.id] = { ...d, center, present: !ROOM_EQUIPMENT_IDS[d.id] || !!e && (!e.modelId || e.modelId === DETAIL_MODELS[d.id]) };
  }
  const ports = ROOM_PORTS.map(p => ({ ...p, position: p.position.map((n, i) => n + shifts[p.device][i]) }));
  const rear = Math.max(...project.shelves.map(s => (s.depth / 2 - s.z) / 1000), ...ports.filter(p => p.axis !== 'Z').map(p => p.position[1])) + .13;
  const postTop = Math.max(...project.shelves.map(s => s.y + s.thickness)) / 1000 + .023;
  const posts = postCenters(project).map(([x,z]) => ({ x:x/1000, y:-z/1000, radius:project.postDiameter/2000, top:postTop }));
  return { project, devices, shifts, ports, portMap: Object.fromEntries(ports.map(p => [p.id, p])), rear, speakerX, equipment: equipmentBoxes(project), posts };
}

export function sceneWalkRoom(layout) {
  const rect = (name, x, z, w, d) => ({ name, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  const room = {
    minX: -3, maxX: 3, minZ: ROOM_DIMENSIONS.minZ, maxZ: ROOM_DIMENSIONS.maxZ,
    radius: .18, eyeHeight: 1.63, speed: 1.1, start: { x: 0, z: .72 }, behind: { x: 0, z: -.84 },
    obstacles: [
      ...layout.project.shelves.map(s => rect('Стойка', s.x / 1000, s.z / 1000, s.width / 1000, s.depth / 1000)),
      ...layout.equipment.map(e => rect('Аппарат', e.center[0]/1000, e.center[2]/1000, e.w/1000, e.d/1000)),
      ...televisionObstacles(layout.project).map(e => rect(e.name, e.center[0]/1000, e.center[2]/1000, e.size[0]/1000, e.size[2]/1000)),
      ...Object.values(layout.devices).filter(d => /^(ae|rel|side|pdu)/.test(d.id)).map(d => rect(d.name, d.center[0], -d.center[1], d.size[0] + .04, d.size[1] + .04)),
      ...[-1, 1].map(s => rect('Торшер', s * (layout.speakerX + .76), .05, .32, .32)),
      rect('IKEA BACKABRO', 0, 1.62, 2.1, 1.08), rect('Gliver ДеФранс', 2.15, 1.45, .9, 1.08),
    ],
  };
  room.start = nearestWalkPosition(room.start, room);
  room.behind = nearestWalkPosition(room.behind, room);
  return room;
}
