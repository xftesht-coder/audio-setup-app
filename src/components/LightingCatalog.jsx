import { useMemo, useState } from 'react';
import catalog from '../data/goveeCatalog.json';
import { useLightingStore } from '../stores/useLightingStore';

const CATEGORIES = {
  floor: 'Торшеры', table: 'Настольные', wall: 'Панели и настенные', strips: 'Ленты и неон',
  tv: 'ТВ и мониторы', ceiling: 'Потолочные', bulbs: 'Лампочки', projectors: 'Проекторы',
  decorative: 'Декоративные', outdoor: 'Уличные', car: 'Автомобильные', accessories: 'Аксессуары',
};
const ORDER = Object.keys(CATEGORIES);
const PRODUCTS = [...catalog.products].sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category) || a.name.localeCompare(b.name));
const SEARCH = new Map(PRODUCTS.map(p => [p.id, [p.name, ...p.modelCodes, ...p.variants.map(v => v.sku)].join(' ').toLowerCase()]));
const counts = Object.fromEntries(ORDER.map(key => [key, PRODUCTS.filter(p => p.category === key).length]));

function ProductCard({ product, planned, onAdd }) {
  const [imageFailed, setImageFailed] = useState(false);
  return <article className="lighting-card">
    <div className="lighting-image">
      {product.image && !imageFailed ? <img src={`${product.image}&width=420`} alt={product.name} loading="lazy" decoding="async" onError={() => setImageFailed(true)} /> : <span>GOVEE<br />{CATEGORIES[product.category]}</span>}
      <span className="lighting-type">{CATEGORIES[product.category]}</span>
    </div>
    <div className="lighting-card-body">
      <p className="lighting-code">{product.modelCodes.join(' / ') || 'Код модели — в комплектациях'}</p>
      <h2>{product.name.replace(/^Govee\s+/, '')}</h2>
      <p className="lighting-meta">{product.regions.join(' · ')} · {product.variants.length} комплектаций</p>
      <details className="lighting-passport">
        <summary>Паспорт и артикулы</summary>
        {product.specs.map(spec => <div key={`${spec.region}-${spec.sku}`}>
          <p className="lighting-spec-scope">Характеристики {spec.sku || 'версии на странице'} · {spec.region}. Другие комплектации могут отличаться.</p>
          <dl>{spec.values.map((row, i) => <div key={`${row.name}-${i}`}><dt>{row.name}</dt><dd>{row.value}</dd></div>)}</dl>
          <a href={spec.source} target="_blank" rel="noreferrer">Источник характеристик ↗</a>
        </div>)}
        {!product.specs.length && <p>Паспортные характеристики пока не внесены. Название и комплектации — из официального каталога.</p>}
        <p className="lighting-unknown">Точная 3D-геометрия, ревизия, положение разъёмов и данные для прокладки кабеля пока не проверены. Напряжение в таблице может относиться к выходу адаптера.</p>
        <h3>Региональные комплектации</h3>
        <ul>{product.variants.map(variant => <li key={variant.id}><a href={variant.source} target="_blank" rel="noreferrer"><b>{variant.sku || 'SKU не указан'}</b><span>{variant.region} · {variant.label}</span></a></li>)}</ul>
      </details>
      <div className="lighting-card-actions">
        <button onClick={() => onAdd(product)} disabled={planned}>{planned ? 'В плане ✓' : 'В план освещения'}</button>
        <a href={product.sources[0].url} target="_blank" rel="noreferrer" aria-label={`Официальная страница ${product.name}`}>Govee ↗</a>
      </div>
    </div>
  </article>;
}

export default function LightingCatalog() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [region, setRegion] = useState('all');
  const [visible, setVisible] = useState(24);
  const planned = useLightingStore(state => state.planned);
  const add = useLightingStore(state => state.add);
  const remove = useLightingStore(state => state.remove);
  const setQuantity = useLightingStore(state => state.setQuantity);
  const selected = useMemo(() => new Set(planned.map(p => p.id)), [planned]);
  const filtered = useMemo(() => PRODUCTS.filter(p =>
    (category === 'all' || p.category === category) &&
    (region === 'all' || p.regions.includes(region)) &&
    query.trim().toLowerCase().split(/\s+/).every(word => SEARCH.get(p.id).includes(word))), [query, category, region]);
  const update = (setter, value) => { setter(value); setVisible(24); };
  return <section className="lighting-catalog" aria-label="Каталог освещения Govee">
    <header className="lighting-heading">
      <div><p className="share-eyebrow">AUDIO SETUP · LIGHTING LIBRARY</p><h1>Свет для музыки.</h1><p>Вся линейка Govee — от торшеров у сабвуферов до света во всём доме.</p></div>
      <div className="lighting-stats"><b>{catalog.counts.series}</b><span>серий и аксессуаров</span><small>{catalog.counts.variants} региональных комплектаций · {catalog.regions.length} рынка</small></div>
    </header>
    <aside className="lighting-plan">
      <div><p className="share-eyebrow">НАША СИСТЕМА · ПЛАН ОСВЕЩЕНИЯ</p><h2>Govee рядом с двумя REL Quake</h2><p>С каждой стороны предусмотрена розетка для лампы. Выбираем конкретные модели; светильники в рендере пока условные.</p></div>
      {planned.length > 0 && <ul>{planned.map(item => <li key={item.id}>
        <b>{item.name}</b>
        <label>Количество<input aria-label={`Количество ${item.name}`} type="number" min="1" max="20" value={item.quantity} onChange={e => setQuantity(item.id, e.target.value)} /></label>
        <button onClick={() => remove(item.id)} aria-label={`Убрать ${item.name}`}>Убрать</button>
      </li>)}</ul>}
      <small>Выбор сохраняется в этом браузере. Это список кандидатов; он пока не меняет 3D-сцену, схему питания и публичную ссылку.</small>
    </aside>
    <div className="lighting-filters">
      <label className="lighting-search">Найти модель<input type="search" placeholder="Floor Lamp 3, H6022, Neon…" value={query} onChange={e => update(setQuery, e.target.value)} /></label>
      <label>Регион каталога<select value={region} onChange={e => update(setRegion, e.target.value)}><option value="all">Все регионы</option>{catalog.regions.map(r => <option key={r.region}>{r.region}</option>)}</select></label>
    </div>
    <div className="lighting-categories" role="group" aria-label="Категории освещения">
      <button aria-pressed={category === 'all'} onClick={() => update(setCategory, 'all')}>Все · {PRODUCTS.length}</button>
      {ORDER.map(key => <button key={key} aria-pressed={category === key} onClick={() => update(setCategory, key)}>{CATEGORIES[key]} · {counts[key]}</button>)}
    </div>
    <p className="lighting-results" role="status">Найдено: {filtered.length} · Сверено {catalog.checkedAt.split('-').reverse().join('.')}</p>
    {filtered.length ? <div className="lighting-grid">{filtered.slice(0, visible).map(product => <ProductCard key={product.id} product={product} planned={selected.has(product.id)} onAdd={add} />)}</div> : <div className="lighting-empty"><h2>Такой модели в выборке нет</h2><p>Попробуй название на английском или код Hxxxx.</p><button onClick={() => { setQuery(''); setCategory('all'); setRegion('all'); }}>Сбросить фильтры</button></div>}
    {visible < filtered.length && <button className="lighting-more" onClick={() => setVisible(n => n + 24)}>Показать ещё · осталось {filtered.length - visible}</button>}
    <footer className="lighting-provenance"><p>{catalog.scope}</p><p>Паспортные таблицы доступны для {catalog.counts.passports} серий. Пустые поля не заменены догадками. Наличие, цены, тип вилки и совместимость с электросетью уточняются для выбранного артикула.</p><div>{catalog.regions.map(r => <a key={r.region} href={r.source} target="_blank" rel="noreferrer">Официальный каталог {r.region} ↗</a>)}</div></footer>
  </section>;
}
