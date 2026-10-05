// Public manufacturer catalog. Run: node scripts/import-schiit.mjs [--refresh]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const cache = new URL('../../../artifacts/schiit/', import.meta.url);
await mkdir(cache, { recursive: true });
const dates = [];
function text(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&(?:nbsp|ensp|emsp);/g, ' ').replace(/&amp;/g, '&')
    .replace(/&(?:rdquo|ldquo|quot);/g, '"').replace(/&(?:rsquo|lsquo|apos);/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&deg;/g, '°').replace(/&times;/g, '×').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/\s+/g, ' ').trim();
}
async function page(url) {
  const slug = new URL(url).pathname.split('/').pop() || 'products';
  const file = new URL(`${slug}.html`, cache), meta = new URL(`${slug}.meta.json`, cache);
  if (!process.argv.includes('--refresh')) try {
    const saved = JSON.parse(await readFile(meta, 'utf8'));
    const html = await readFile(file, 'utf8'); dates.push(saved.fetchedAt); return html;
  } catch { /* Not cached. */ }
  const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  const html = await response.text(), fetchedAt = new Date().toISOString().slice(0, 10);
  await writeFile(file, html); await writeFile(meta, JSON.stringify({ url, fetchedAt })); dates.push(fetchedAt); return html;
}
const html = await page('https://www.schiit.com/products');
const start = html.indexOf("<div class='mobile-product-list'>");
if (start < 0) throw new Error('Catalog navigation changed');
const end = html.indexOf('</li>', start);
const menu = html.slice(start, end), products = new Map();
let category = '';
for (const token of menu.matchAll(/<div class='cat-name'>([^<]+)<\/div>|<a href='(https:\/\/www\.schiit\.com\/products\/[^']+)'>([\s\S]*?)<\/a>/g)) {
  if (token[1]) category = text(token[1]);
  else if (!products.has(token[2])) products.set(token[2], {
    id: `schiit-${new URL(token[2]).pathname.split('/').pop()}`, manufacturer: 'Schiit',
    name: text(token[3].replace(/<span[\s\S]*?<\/span>/g, '')), category, source: token[2],
    availability: category === 'Pre-Order' ? 'preorder' : 'catalog',
    image: null, facts: [], dimensionsMm: null, revision: null, geometry: null,
  });
}
if (products.size < 40) throw new Error('Incomplete Schiit navigation');
const records = [...products.values()]; let index = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (index < records.length) {
    const p = records[index++], h = await page(p.source);
    p.image = h.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)/i)?.[1]
      || h.match(/<img[^>]*src=["']([^"']*\/public\/upload\/images\/[^"']+)["']/i)?.[1] || null;
    if (p.image) p.image = new URL(p.image, p.source).href;
    const specs = h.match(/<div\s+tab=['"]2['"][^>]*>([\s\S]*?)(?=<div\s+tab=['"]3['"]|$)/i)?.[1] || '';
    const lines = specs.replace(/<br\s*\/?\s*>|<\/(?:div|p|li|h\d)>/gi, '\n').split('\n').map(text).filter(Boolean);
    let section = '';
    for (const line of lines) {
      const pair = line.match(/^([^:]{2,80}):\s*(.+)$/);
      if (pair) {
        if (['Noise', 'Distortion', 'Heat', 'Input capability'].includes(pair[1]) || (pair[1] === 'Size' && !/\d.*[x×].*\d/.test(pair[2]))) continue;
        if (/^(Input Impedance|Inputs|Outputs|Power Consumption|Power Supply|Size|Weight|Remote|Tubes|Volume Control|Headphone stage)$/i.test(pair[1])) section = '';
        if (!['Noise', 'Distortion', 'Heat'].includes(pair[1]) || /\d/.test(pair[2])) p.facts.push({ name: pair[1], value: pair[2], ...(section ? { section } : {}) });
      } else if (/^(?:Passive|Solid State|All Tube|Low Gain|High Gain|Gain|Headphone|Preamp|Balanced|Single.ended)/i.test(line) && line.length < 60) section = line;
    }
    console.log(`${p.category}: ${p.name} (${p.facts.length} facts)`);
  }
}));
await writeFile(new URL('../src/data/schiitCatalog.js', import.meta.url), 'export default ' + JSON.stringify({
  manufacturer: 'Schiit', checkedAt: dates.sort()[0], source: 'https://www.schiit.com/products',
  scope: 'Текущий официальный каталог Schiit: аппараты, аксессуары, апгрейды и сувениры. Архив снятых моделей и отдельные экземпляры B-stock не входят.',
  products: records,
}, null, 2) + '\n');
console.log(`Saved ${records.length} catalog entries`);
