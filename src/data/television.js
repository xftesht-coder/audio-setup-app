export const TV_REFERENCES = [
  { name: 'Pinterest · низкая открытая ТВ-стойка', url: 'https://www.pinterest.com/pin/368310075790897525/' },
  { name: 'Pinterest · широкая деревянная консоль', url: 'https://es.pinterest.com/pin/647673990146852736/' },
];
export const TV_NOTE = 'Экран рассчитан по диагонали 16:9. Рамка 12 мм, корпус 45 мм и ножки — проектные допущения. Модель, масса и разъёмы ТВ неизвестны; крепление от опрокидывания и подключение ещё не выбраны. До изготовления сверить основание и нагрузку.';

// The screen follows a nominal diagonal; bezel and depth are explicit layout
// allowances, never manufacturer dimensions or a verified mounting envelope.
export function televisionEnvelope(tv) {
  const diagonal = tv.diagonal * 25.4;
  const screenWidth = diagonal * 16 / Math.hypot(16, 9);
  const screenHeight = diagonal * 9 / Math.hypot(16, 9);
  return { screenWidth, screenHeight, width: screenWidth + 24, height: screenHeight + 24, depth: 45 };
}

export function televisionBox(p) {
  if (!p.television) return null;
  const tv = p.television, d = televisionEnvelope(tv);
  const shelf = televisionBase(p), bottom = shelf.y + shelf.thickness + tv.standHeight;
  return { id: 'layout_tv', name: 'ТВ · условный габарит', center: [tv.x, bottom + d.height / 2, tv.z], size: [d.width, d.height, d.depth] };
}

export const televisionBase = p => p.shelves.reduce((top, s) => s.y + s.thickness > top.y + top.thickness ? s : top);
export function televisionObstacles(p) {
  if (!p.television) return [];
  const tv = p.television, s = televisionBase(p), y = s.y + s.thickness;
  return [televisionBox(p), ...[-1, 1].flatMap((side, i) => [
    { id: 'layout_tv_foot' + i, name: 'Ножка ТВ ' + (i + 1), center: [tv.x + side * tv.footSpan / 2, y + 6, tv.z], size: [44, 12, tv.footDepth] },
    { id: 'layout_tv_leg' + i, name: 'Стойка ножки ТВ ' + (i + 1), center: [tv.x + side * tv.footSpan / 2, y + tv.standHeight / 2, tv.z], size: [30, tv.standHeight, 30] },
  ])];
}
