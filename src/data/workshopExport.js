import { ENGINEERING_SOURCES, manufacturingBOM, shelfHoles, sortedShelves, validateConstruction } from './workshop.js';
import { routeAllCables } from './cableRouting.js';

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n = value => +Number(value).toFixed(3);
export const REVIEW_NOTES = [
  'Статус: проект для согласования. Геометрия и сверловка параметрические; выпуск в производство ещё не согласован.',
  'Проверить нагрузку, прогиб, устойчивость, смятие дерева под шайбами, влажностные деформации, сорт древесины и допуски. Расчёта прочности здесь нет.',
  'Подтвердить разъёмы и их координаты на реальных аппаратах. Модели техники и разъёмов схематичны. Питание кастомных аппаратов и БП проигрывателя требует сверки.',
  'Уточнить модель Supra LoRad, кабель и вилки Furutech, массу, паспортный радиус изгиба. Запас длины показан в спецификации, его укладка пока не моделируется.',
  'Согласовать заднюю сервисную раму, держатели и лоток блоков питания: сейчас показаны точки опоры и габарит. Нет чертежа изготовления рамы и крепления её к стойке.',
  'Трассы проверяются по габаритам полок, аппаратов и стоек. Совместная электромагнитная совместимость и нагрузочная способность держателей не рассчитаны.',
];

export function panelSVG(p, s) {
  const w = s.width, d = s.depth;
  const holes = shelfHoles(p, s);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-70 -70 ${w + 140} ${d + 150}" role="img" aria-label="${escape(s.name)}: сверловка" style="max-width:100%;background:white">
    <g fill="none" stroke="#34483d" stroke-width="1.2"><rect x="0" y="0" width="${w}" height="${d}"/>${holes.map(h => `<circle cx="${n(w / 2 + h.x)}" cy="${n(d / 2 + h.z)}" r="${h.diameter / 2}"/><path stroke-width=".5" d="M${n(w / 2 + h.x - 14)},${n(d / 2 + h.z)}h28 M${n(w / 2 + h.x)},${n(d / 2 + h.z - 14)}v28"/>`).join('')}
    <path d="M0,${d + 15}v25 M${w},${d + 15}v25 M0,${d + 28}H${w} M-30,0H-15 M-30,${d}H-15 M-24,0V${d}"/></g>
    <g font-family="Arial,sans-serif" fill="#273b30" font-size="12"><text x="0" y="-35">${escape(s.name)} · ${w} × ${d} × ${s.thickness} мм · вид сверху</text><text x="${w / 2}" y="${d + 48}" text-anchor="middle">${w} мм · ПЕРЕДНЯЯ КРОМКА</text><text x="-38" y="${d / 2}" transform="rotate(-90 -38 ${d / 2})" text-anchor="middle">${d} мм</text>${holes.map((h, i) => `<text x="${n(w / 2 + h.x + 13)}" y="${n(d / 2 + h.z - 13)}">${i + 1}: Ø${h.diameter}</text>`).join('')}</g></svg>`;
}

export function projectDXF(p) {
  let d = '0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n';
  let offset = 0;
  const line = (x1, y1, x2, y2) => `0\nLINE\n8\nOUTLINE\n10\n${n(x1)}\n20\n${n(y1)}\n30\n0\n11\n${n(x2)}\n21\n${n(y2)}\n31\n0\n`;
  sortedShelves(p).forEach((s, index) => {
    d += line(offset, 0, offset + s.width, 0) + line(offset + s.width, 0, offset + s.width, s.depth) + line(offset + s.width, s.depth, offset, s.depth) + line(offset, s.depth, offset, 0);
    shelfHoles(p, s).forEach(h => { d += `0\nCIRCLE\n8\nDRILL_THROUGH\n10\n${n(offset + s.width / 2 + h.x)}\n20\n${n(s.depth / 2 - h.z)}\n30\n0\n40\n${n(h.diameter / 2)}\n`; });
    d += `0\nTEXT\n8\nLABELS\n10\n${offset}\n20\n-30\n30\n0\n40\n10\n1\nSHELF ${index + 1} T=${s.thickness} MM - REVIEW\n`;
    offset += s.width + 100;
  });
  return d + '0\nENDSEC\n0\nEOF\n';
}
function csv(rows) { return '\uFEFF' + rows.map(row => row.map(v => `"${String(v ?? '').replaceAll('"', '""')}"`).join(';')).join('\r\n'); }
export function bomCSV(p) { return csv([['Деталь', 'Количество', 'Описание', 'Длина мм', 'Ширина мм', 'Толщина мм'], ...manufacturingBOM(p, routeAllCables(p)).map(r => [r.part, r.quantity, r.description, r.length, r.width, r.thickness])]); }
export function drillingCSV(p) { return csv([['Полка', 'Отверстие', 'X от левого края мм', 'Y от переднего края мм', 'Диаметр мм', 'Глубина мм'], ...sortedShelves(p).flatMap(s => shelfHoles(p, s).map(h => [s.name, h.id, n(s.width / 2 + h.x), n(s.depth / 2 - h.z), h.diameter, s.thickness]))]); }
export function reviewHTML(p) {
  const routes = routeAllCables(p), bom = manufacturingBOM(p, routes);
  const issues = [...validateConstruction(p).map(x => x.message), ...routes.flatMap(r => r.issues.map(x => `${r.cable.name}: ${x}`))];
  return `<!doctype html><html lang="ru"><meta charset="utf-8"><title>${escape(p.name)} — проект стойки</title><style>body{font:14px/1.6 Arial;color:#24362c;max-width:1000px;margin:40px auto;padding:24px}h1{font-size:30px}table{width:100%;border-collapse:collapse;font-size:12px}td,th{padding:8px;border:1px solid #ccd5cf;text-align:left}section{break-inside:avoid;margin:32px 0}svg{max-height:480px}li{margin:8px 0}.status{background:#fff2cf;padding:16px}@media print{body{margin:0;padding:0}section{page-break-inside:avoid}a{color:inherit}}</style><h1>${escape(p.name)}</h1><p>Редакция ${new Date().toISOString()} · все размеры в мм · DXF 1:1</p><p class="status">ДЛЯ СОГЛАСОВАНИЯ — НЕ ВЫПУСК В ПРОИЗВОДСТВО</p><ol>${REVIEW_NOTES.map(s => `<li>${escape(s)}</li>`).join('')}</ol><h2>Проверка геометрии</h2>${issues.length ? `<ul>${issues.map(s => `<li>${escape(s)}</li>`).join('')}</ul>` : '<p>Пересечений с габаритами мебели и техники, нехватки длины и нарушений заданных радиусов не найдено.</p>'}<h2>Спецификация</h2><table><tr><th>Деталь</th><th>Кол-во</th><th>Описание</th><th>Длина, мм</th></tr>${bom.map(r => `<tr><td>${escape(r.part)}</td><td>${r.quantity}</td><td>${escape(r.description)}</td><td>${r.length ?? ''}</td></tr>`).join('')}</table>${sortedShelves(p).map(s => `<section><h2>${escape(s.name)}</h2>${panelSVG(p, s)}<p>Высота нижней плоскости ${s.y}; смещение X=${s.x}, Z=${s.z}. Координаты сверловки: X от левого края, Y от передней кромки. Сквозные отверстия, без фасок и цековок.</p><table><tr><th>№</th><th>ID</th><th>X</th><th>Y</th><th>Ø</th><th>Глубина</th></tr>${shelfHoles(p, s).map((h, i) => `<tr><td>${i + 1}</td><td>${escape(h.id)}</td><td>${n(s.width / 2 + h.x)}</td><td>${n(s.depth / 2 - h.z)}</td><td>${h.diameter}</td><td>${s.thickness} насквозь</td></tr>`).join('')}</table></section>`).join('')}<section><h2>Кабели и опоры</h2>${routes.map(r => `<h3>${escape(r.cable.name)}</h3><p>Ø${r.cable.diameter}; R≥${r.cable.bendRadius}; трасса ${Math.ceil(r.length)} + запас ${r.cable.reserve} мм; кабель ${r.cable.available} мм; масса ${(r.mass / 1000).toFixed(3)} кг; ${r.supports.length} держателей, шаг ≤${r.cable.supportSpan} мм, вес пролёта ${r.spanLoad.toFixed(2)} Н.</p><p>${escape(r.cable.note)}</p>`).join('')}</section><h2>Источники исходных данных</h2><ul>${ENGINEERING_SOURCES.map(s => `<li><a href="${escape(s.url)}">${escape(s.name)}</a></li>`).join('')}</ul></html>`;
}

export function downloadText(name, content, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
