// Read public Govee storefront data; never execute scripts from the source pages.
// Cached source pages stay outside the repository. Run with Node >= 20.
// Pass --refresh to download a new snapshot; cached imports retain the source date.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const cache = new URL('../../../artifacts/govee/', import.meta.url);
const sourceDates = [];
await mkdir(cache, { recursive: true });

export function storefrontData(html) {
  const marker = 'window.__remixContext = ';
  const start = html.indexOf(marker);
  if (start < 0) throw new Error('Govee storefront format changed');
  const source = html.slice(start + marker.length);
  let quoted = false, escaped = false, depth = 0;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) return JSON.parse(source.slice(0, i + 1)).state.loaderData;
  }
  throw new Error('Incomplete Govee storefront data');
}

async function page(url) {
  const name = `${createHash('sha256').update(url).digest('hex').slice(0, 20)}.html`;
  const path = new URL(name, cache);
  if (!process.argv.includes('--refresh')) {
    try {
      const saved = JSON.parse(await readFile(new URL(`${name}.meta.json`, cache), 'utf8'));
      const html = await readFile(path, 'utf8');
      sourceDates.push(saved.fetchedAt);
      return html;
    } catch { /* No dated cached source. */ }
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  const html = await response.text();
  storefrontData(html); // Reject errors/redirects before caching.
  await writeFile(path, html);
  const fetchedAt = new Date().toISOString().slice(0, 10);
  await writeFile(new URL(`${name}.meta.json`, cache), JSON.stringify({ url, fetchedAt }));
  sourceDates.push(fetchedAt);
  return html;
}

async function region(region) {
  const origin = `https://${region.toLowerCase()}.govee.com`;
  let url = `${origin}/collections/all-products`, pages = 0;
  const products = new Map(), visited = new Set();
  while (url) {
    if (visited.has(url) || pages >= 50) throw new Error(`Pagination did not finish: ${region}`);
    visited.add(url);
    const data = storefrontData(await page(url));
    const collection = Object.values(data).find(value => value?.collection)?.collection;
    if (collection?.handle !== 'all-products') throw new Error(`Wrong collection: ${url}`);
    for (const product of collection.products.nodes) {
      if (product.variantsCount?.count > product.variants.nodes.length) throw new Error(`Incomplete variants: ${product.title}`);
      products.set(product.id, { ...product, region, source: `${origin}/products/${product.handle}` });
    }
    pages++;
    const { hasNextPage, endCursor } = collection.products.pageInfo;
    if (hasNextPage && !endCursor) throw new Error(`Missing cursor: ${region}`);
    url = hasNextPage ? `${origin}/collections/all-products?direction=next&cursor=${encodeURIComponent(endCursor)}` : null;
  }
  console.log(`${region}: ${products.size} products, ${pages} pages, pagination complete`);
  return { region, pages, complete: true, source: `${origin}/collections/all-products`, products: [...products.values()] };
}

const results = await Promise.allSettled(['US', 'EU', 'UK', 'CA'].map(region));
const failures = results.filter(result => result.status === 'rejected');
for (const failure of failures) console.error(failure.reason);
if (failures.length) process.exitCode = 1;
else {
  const regions = results.map(result => result.value);
  await writeFile(new URL('raw-products.json', cache), JSON.stringify(regions));
  console.log(`Saved ${regions.reduce((n, r) => n + r.products.length, 0)} regional listings to ${fileURLToPath(cache)}`);
  await buildCatalog(regions);
}

function category(name) {
  if (/clips?|tape|sensor|sync box|light show box|smart plug/i.test(name) && !/sync box kit/i.test(name)) return 'accessories';
  if (/floor lamp/i.test(name)) return 'floor';
  if (/ceiling|recessed|pendant/i.test(name)) return 'ceiling';
  if (/table lamp|night light/i.test(name) && !/bulb/i.test(name)) return 'table';
  if (/car /i.test(name)) return 'car';
  if (/bulbs?/i.test(name) && !/string/i.test(name)) return 'bulbs';
  if (/outdoor|solar|pathway|flood/i.test(name)) return 'outdoor';
  if (/christmas|icicle|curtain|net light|ball light|cone tree|meteor|sphere|2-in-1 string|holiday/i.test(name)) return 'decorative';
  if (/projector/i.test(name)) return 'projectors';
  if (/tv|backlight|monitor|sync box kit|flow plus|light bars?/i.test(name)) return 'tv';
  if (/strip|neon rope/i.test(name)) return 'strips';
  if (/wall|panel|gaming|glide/i.test(name)) return 'wall';
  throw new Error(`Unclassified lighting product: ${name}`);
}

async function buildCatalog(regions) {
  const all = regions.flatMap(region => region.products);
  const excluded = all.filter(p => /thermo|hygrometer|humidifier|purifier|tower fan|water leak|ice maker/i.test(p.title));
  const lighting = all.filter(p => !excluded.includes(p));
  const families = [];
  const normalize = name => name.toLowerCase().replace(/\[.*?\]|refurbished|govee|smart|led/g, '').replace(/[^a-z0-9]/g, '');
  const baseHandle = handle => handle.replace(/^(special-sale-|refurbished-)/, '');
  // Only explicit identical names, handles or official comparison model codes join series.
  for (const p of lighting) {
    const code = p.compareModelName?.value?.toUpperCase();
    const matches = families.filter(f => f.some(q => baseHandle(q.handle) === baseHandle(p.handle) || normalize(q.title) === normalize(p.title) || (code && q.compareModelName?.value?.toUpperCase() === code)));
    const family = matches.shift() || [];
    if (!families.includes(family)) families.push(family);
    for (const extra of matches) { family.push(...extra); families.splice(families.indexOf(extra), 1); }
    family.push(p);
  }
  const priority = { EU: 0, UK: 1, US: 2, CA: 3 };
  const records = families.map(family => {
    family.sort((a, b) => priority[a.region] - priority[b.region] || Number(/sale|refurbished/i.test(a.title)) - Number(/sale|refurbished/i.test(b.title)));
    const preferred = family[0];
    const id = `govee-${family.map(p => p.handle).sort()[0]}`;
    const variants = family.flatMap(p => p.variants.nodes.map(v => ({
      id: `${p.region}-${v.id.split('/').pop()}`, region: p.region,
      sku: v.sku || null, label: v.title, source: `${p.source}?variant=${v.id.split('/').pop()}`,
    })));
    return {
      id, manufacturer: 'Govee', name: preferred.title.replace(/\[.*?\]|Refurbished\s*/gi, '').trim(),
      category: category(preferred.title),
      modelCodes: [...new Set(family.map(p => p.compareModelName?.value?.toUpperCase()).filter(Boolean))],
      image: preferred.images?.nodes?.[0]?.url || null,
      regions: [...new Set(family.map(p => p.region))],
      sources: family.map(p => ({ region: p.region, url: p.source })), variants,
      specs: [], revision: null, dimensionsMm: null, connectors: null, geometry: null,
      verified: { identity: 'official-catalog', dimensions: false, geometry: false },
    };
  });
  let index = 0, loaded = 0;
  const errors = [];
  // Read one passport per family. Every value remains scoped to the exact source SKU/region.
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (index < records.length) {
      const record = records[index++], source = record.sources[0];
      try {
        const data = storefrontData(await page(source.url));
        const details = Object.values(data).find(value => value?.product);
        const spec = details?.skuSpecDetail;
        if (!details?.product) throw new Error('Product page missing');
        if (spec?.specificationList?.length) {
          record.specs.push({ region: source.region, source: source.url, sku: spec.sku || null,
            values: spec.specificationList.filter(row => row.name && row.value).map(({ name, value }) => ({ name, value })) });
          const models = spec.specificationList.find(row => /^models?$/i.test(row.name))?.value?.match(/\b[HB][0-9][0-9A-Z]{3}\b/g) || [];
          record.modelCodes = [...new Set([...record.modelCodes, ...models])];
        }
        // A description's first Model paragraph is explicit; unrelated model mentions are ignored.
        const declaration = details.product.descriptionHtml?.match(/<(?:p|h\d)[^>]*>\s*(?:<[^>]+>)*\s*Models?\s*:[\s\S]*?<\/(?:p|h\d)>/i)?.[0] || '';
        // Accessory pages can reuse the compatible light's description (e.g. Neon clips).
        if (record.category !== 'accessories') record.modelCodes = [...new Set([...record.modelCodes, ...(declaration.match(/\b[HB][0-9][0-9A-Z]{3}\b/gi) || []).map(v => v.toUpperCase())])];
      } catch (error) { errors.push({ id: record.id, source: source.url, error: error.message }); }
      loaded++;
      if (loaded % 25 === 0) console.log(`Passports: ${loaded}/${records.length}`);
    }
  }));
  records.sort((a, b) => a.name.localeCompare(b.name));
  const catalog = {
    manufacturer: 'Govee', checkedAt: sourceDates.sort()[0],
    scope: 'Все страницы текущих официальных каталогов US, EU, UK и CA. Архив снятых моделей не входит. Региональные версии и комплектации сохранены; устройства GoveeLife без освещения исключены.',
    regions: regions.map(({ region, source, pages, complete, products }) => ({ region, source, pages, complete, listingCount: products.length })),
    counts: { series: records.length, lightingListings: lighting.length, regionalListings: all.length, variants: records.reduce((n, r) => n + r.variants.length, 0), excludedNonLighting: excluded.length, passports: records.filter(r => r.specs.length).length },
    products: records,
  };
  await writeFile(new URL('../src/data/goveeCatalog.json', import.meta.url), JSON.stringify(catalog, null, 2) + '\n');
  await writeFile(new URL('import-report.json', cache), JSON.stringify({ counts: catalog.counts, excluded: excluded.map(p => ({ title: p.title, region: p.region })), passportErrors: errors }, null, 2));
  console.log(JSON.stringify({ ...catalog.counts, passportErrors: errors.length }));
}
