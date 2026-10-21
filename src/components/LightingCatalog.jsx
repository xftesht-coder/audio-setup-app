import { useMemo, useState } from 'react';
import WorkspaceHeader from './WorkspaceHeader';
import catalog from '../data/goveeCatalog.json';
import { useLightingStore } from '../stores/useLightingStore';
import { downloadJson } from '../data/roomBackup';

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
  const [mobilePanel, setMobilePanel] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [region, setRegion] = useState('all');
  const [visible, setVisible] = useState(24);
  const planned = useLightingStore(state => state.planned);
  const storageError = useLightingStore(state => state.storageError);
  const add = useLightingStore(state => state.add);
  const remove = useLightingStore(state => state.remove);
  const setQuantity = useLightingStore(state => state.setQuantity);
  const selected = useMemo(() => new Set(planned.map(p => p.id)), [planned]);
  const filtered = useMemo(() => PRODUCTS.filter(p =>
    (category === 'all' || p.category === category) &&
    (region === 'all' || p.regions.includes(region)) &&
    query.trim().toLowerCase().split(/\s+/).every(word => SEARCH.get(p.id).includes(word))), [query, category, region]);
  const update = (setter, value) => { setter(value); setVisible(24); };
  return <section className="lighting-catalog studio-page lighting-studio" aria-label="Каталог освещения Govee" data-mobile-panel={mobilePanel}>
    <WorkspaceHeader title="Освещение" symbol="☼" subtitle={'Govee · ' + catalog.counts.series + ' серий · ' + catalog.counts.variants + ' комплектаций'}><a href="#room">Комната ↗</a><a href="#system">Аудиокаталог ↗</a></WorkspaceHeader>
    <div className="catalog-toolbar"><span className="workspace-toolbar-label">Каталог Govee</span><span className="workspace-toolbar-note">{catalog.regions.length} региональных каталога</span><button className="catalog-inspector-jump" aria-pressed={mobilePanel} onClick={()=>setMobilePanel(!mobilePanel)}>{mobilePanel ? 'К каталогу' : 'План · ' + planned.length}</button></div>
    <div className="catalog-workspace"><div className="catalog-main" tabIndex={0} aria-label="Модели освещения">
    <div className="lighting-filters">
      <label className="lighting-search">Найти модель<input type="search" placeholder="Floor Lamp 3, H6022, Neon…" value={query} onChange={e => update(setQuery, e.target.value)} /></label>
      <label>Категория освещения<select value={category} onChange={e=>update(setCategory,e.target.value)}><option value="all">Все · {PRODUCTS.length}</option>{ORDER.map(key=><option key={key} value={key}>{CATEGORIES[key]} · {counts[key]}</option>)}</select></label>
      <label>Регион каталога<select value={region} onChange={e => update(setRegion, e.target.value)}><option value="all">Все регионы</option>{catalog.regions.map(r => <option key={r.region}>{r.region}</option>)}</select></label>
    </div>
    <p className="lighting-results" role="status">Найдено: {filtered.length} · Сверено {catalog.checkedAt.split('-').reverse().join('.')}</p>
    {filtered.length ? <div className="lighting-grid">{filtered.slice(0, visible).map(product => <ProductCard key={product.id} product={product} planned={selected.has(product.id)} onAdd={add} />)}</div> : <div className="lighting-empty"><h2>Такой модели в выборке нет</h2><p>Попробуй название на английском или код Hxxxx.</p><button onClick={() => { setQuery(''); setCategory('all'); setRegion('all'); }}>Сбросить фильтры</button></div>}
    {visible < filtered.length && <button className="lighting-more" onClick={() => setVisible(n => n + 24)}>Показать ещё · осталось {filtered.length - visible}</button>}
    <footer className="lighting-provenance"><p>{catalog.scope}</p><p>Паспортные таблицы доступны для {catalog.counts.passports} серий. Пустые поля не заменены догадками. Наличие, цены, тип вилки и совместимость с электросетью уточняются для выбранного артикула.</p><div>{catalog.regions.map(r => <a key={r.region} href={r.source} target="_blank" rel="noreferrer">Официальный каталог {r.region} ↗</a>)}</div></footer>
    </div>    <aside className="lighting-plan catalog-inspector" aria-label="План освещения">
      <div className="lighting-plan-heading"><h2>План освещения</h2><span role="status">Моделей: {planned.length}</span></div><p>По лампе рядом с каждым REL. В рендере пока показаны только места установки.</p>{!planned.length && <div className="lighting-plan-empty"><span aria-hidden="true">☼</span><b>Выбери свет для комнаты</b><p>Добавь модель из каталога. Здесь можно задать количество.</p></div>}
      {planned.length > 0 && <ul>{planned.map(item => <li key={item.id}>
        <b>{item.name}</b>
        <label>Количество<input aria-label={`Количество ${item.name}`} type="number" min="1" max="20" value={item.quantity} onChange={e => setQuantity(item.id, e.target.value)} /></label>
        <button onClick={() => remove(item.id)} aria-label={`Убрать ${item.name}`}>Убрать</button>
      </li>)}</ul>}
      {storageError && <p role="alert">{storageError}</p>}
      {planned.length > 0 && <button onClick={() => downloadJson('audio-setup-lighting.json', { state: { planned }, version: 0 })}>Скачать план освещения</button>}
      <small>Выбор сохраняется в этом браузере. Это список кандидатов; он пока не меняет 3D-сцену, схему питания и публичную ссылку.</small>
    </aside>
    </div>
  </section>;
}
