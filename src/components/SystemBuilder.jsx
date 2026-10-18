import { useEffect, useMemo, useRef, useState } from 'react';
import { AUDIO_MODELS, AUDIO_ROLES, SCHIIT_CATALOG, productEnvelope } from '../data/audioModels';
import { IMPEDANCE_REFERENCE, systemShareUrl } from '../data/systemMatching';
import { equipmentName, plannedRack } from '../data/equipmentProfiles';
import { useSystemPlanStore } from '../stores/useSystemPlanStore';
import { useWorkshopStore } from '../stores/useWorkshopStore';
import SystemSummary from './SystemSummary';
import SystemVariants from './SystemVariants';
import WorkspaceHeader from './WorkspaceHeader';
import RoomSystemEditor from './RoomSystemEditor';
import { useRoomWiring } from '../store/roomWiringStore';
import { roomInstance } from '../data/roomComponents';

const CATEGORIES = { 'Pre-Order': 'Предзаказ', Fun: 'Специальные устройства', Modular: 'Модульные усилители', 'Speaker Amps': 'Усилители мощности', 'Headphone Amps': 'Усилители наушников', DACs: 'ЦАПы', Preamps: 'Предусилители', Gaming: 'Игровые', Phono: 'Фонокорректоры', EQ: 'Эквалайзеры', Accessories: 'Аксессуары', Upgrades: 'Апгрейды', Schwag: 'Сувениры', Packages: 'Комплекты' };
const categories = [...new Set(SCHIIT_CATALOG.products.map(p => p.category))];
const roleModels = Object.fromEntries(Object.keys(AUDIO_ROLES).map(role => [role, Object.values(AUDIO_MODELS).filter(m => m.roles.includes(role))]));
function SelectField({ label, value, onChange, options }) {
  return <label>{label}<select value={value} onChange={event => onChange(event.target.value)}>{options.map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label>;
}
function CatalogCard({ product, onSelect, active }) {
  const [failed, setFailed] = useState(false);
  const model = AUDIO_MODELS[product.id], envelope = productEnvelope(product);
  return <article className="schiit-card">
    <div className="schiit-image">{product.image && !failed ? <img src={product.image} alt={product.name} loading="lazy" onError={() => setFailed(true)} /> : <span>SCHIIT<br />{product.name}</span>}{product.availability === 'preorder' && <span className="system-status warning">Предзаказ</span>}</div>
    <div className="schiit-card-body"><small>{CATEGORIES[product.category] || product.category}</small><h3>{product.name}</h3>
      <p>{envelope ? `${envelope.w} × ${envelope.h} × ${envelope.d} мм · Ш × В × Г${envelope.approximateHeight ? ' · приблизительно' : ''}` : 'Полный габарит не внесён'}</p>
      <details><summary>Паспорт и источник</summary><dl>{product.facts.map((fact, i) => <div key={i}><dt>{fact.section ? `${fact.section} · ` : ''}{fact.name}</dt><dd>{fact.value}</dd></div>)}</dl>{!product.facts.length && <p>Характеристики не опубликованы в паспортной вкладке. Название и категория — из каталога производителя.</p>}<p>Точная геометрия, координаты разъёмов и ревизия требуют отдельной проверки. Названия секций сохранены из паспорта; параметры разных режимов нельзя смешивать.</p></details>
      {model?.note && <p className="schiit-model-note">{model.note}</p>}
      {active && <p className="system-status ok">Выбран в комнате</p>}
      <div className="schiit-card-actions">{model?.roles.map(role => <button key={role} onClick={() => onSelect(role, product.id)}>{roomInstance(role, product.id) ? 'Примерить в комнате' : `В черновик: ${AUDIO_ROLES[role].toLowerCase()}`}</button>)}<a href={product.source} target="_blank" rel="noreferrer">Schiit ↗</a></div>
    </div>
  </article>;
}

export default function SystemBuilder() {
  const { plan, update, storageError, undo, redo, past, future } = useSystemPlanStore();
  const room = useRoomWiring();
  const [view, setView] = useState('catalog');
  const [mobilePanel, setMobilePanel] = useState(false);
  const showRoom = () => { setMobilePanel(true); document.getElementById('room-system-editor')?.closest('.catalog-inspector')?.scrollTo({ top: 0 }); };
  const catalogMain = useRef(null);
  useEffect(() => { catalogMain.current?.scrollTo({ top: 0 }); }, [view]);
  const project = useWorkshopStore(s => s.project), commit = useWorkshopStore(s => s.commit);
  const [query, setQuery] = useState(''), [category, setCategory] = useState('all'), [visible, setVisible] = useState(18), [message, setMessage] = useState('');
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 6000);
    return () => clearTimeout(timer);
  }, [message]);
  const filtered = useMemo(() => SCHIIT_CATALOG.products.filter(p => (category === 'all' || category === p.category) && p.name.toLowerCase().includes(query.trim().toLowerCase())), [category, query]);
  const shareUrl = systemShareUrl(plan, window.location.origin);
  const set = (key, value) => update({ [key]: value });
  const chooseDraft = (role, id) => { set(role, id); setMessage('Каталожный черновик обновлён. Для замены в комнате используй блок «Тракт в комнате».'); };
  const choose = (role, id) => {
    const instance = roomInstance(role, id);
    if (instance) { room.previewReplacement({ [role]: instance }); showRoom(); }
    else { chooseDraft(role, id); setView('draft'); }
  };
  const applyRack = () => {
    try {
      const next = plannedRack(project, plan);
      if (!commit(next)) throw new Error(useWorkshopStore.getState().editError);
      setMessage(`На стойке ${next.equipment.length} аппаратов. Сохранены оба ЦАПа, Freya и A90. Проверь зазоры в мастерской; перенос можно отменить там.`);
    } catch (error) { setMessage(error.message); }
  };
  return <section className="system-builder studio-page catalog-studio" aria-label="Конфигуратор аудиосистемы" data-mobile-panel={mobilePanel}>
    <WorkspaceHeader title="Система и каталог" symbol="▤" subtitle={'Schiit · позиций: ' + SCHIIT_CATALOG.products.length + ' · данные производителя'}><a href="#room">Комната ↗</a><a href="#patch">Роутинг ↗</a></WorkspaceHeader>
    <div className="catalog-toolbar">
      <div className="workspace-segments" role="group" aria-label="Вид каталога"><button aria-pressed={view==='catalog'} onClick={()=>{setView('catalog');setMobilePanel(false);}}>Каталог Schiit <span>{SCHIIT_CATALOG.products.length}</span></button><button aria-pressed={view==='draft'} onClick={()=>{setView('draft');setMobilePanel(false);}}>Варианты и сравнение</button></div>
      <span className="workspace-toolbar-note">Каталог ↔ комната</span>
      <button className="catalog-inspector-jump" aria-pressed={mobilePanel} onClick={()=>setMobilePanel(!mobilePanel)}>{mobilePanel ? 'К каталогу' : 'Тракт комнаты'}</button>
    </div>
    <div className="catalog-workspace"><div className="catalog-main" ref={catalogMain} tabIndex={0} aria-label="Модели и варианты системы">
    <div className="system-draft" hidden={view!=='draft'}><h2>Каталожные варианты</h2><p>Черновики для сравнения хранятся отдельно от комнаты. ЦАП и предусилитель можно перенести через предпросмотр в блоке «Тракт в комнате».</p>
    <SystemVariants />
    <section className="system-controls" aria-label="Выбор компонентов черновика"><div className="system-section-title"><h2>Каталожный черновик</h2><div className="plan-history"><button disabled={!past.length} onClick={() => { undo(); setMessage('Изменение черновика отменено.'); }}>↶ Отменить</button><button disabled={!future.length} onClick={() => { redo(); setMessage('Изменение черновика повторено.'); }}>↷ Повторить</button></div></div><div className="system-select-grid">
      {Object.entries(AUDIO_ROLES).map(([role, label]) => <SelectField key={role} label={label} value={plan[role] || ''} onChange={value => chooseDraft(role, value || null)} options={[...(['eq', 'headphoneAmp'].includes(role) ? [['', 'Не используется']] : []), ...roleModels[role].map(m => [m.id, m.name + (m.availability === 'preorder' ? ' · предзаказ' : '')])]} />)}
    </div><h3>Подключение</h3><div className="system-select-grid">
      <SelectField label="Источник" value={plan.sourceMode} onChange={v => set('sourceMode', v)} options={ [['digital', 'WiiM → внешний ЦАП'], ['vinyl', 'Винил → фонокорректор'], ['wiimAnalog', 'WiiM → аналоговый выход RCA']] } />
      {plan.sourceMode === 'digital' && <><SelectField label="WiiM → ЦАП" value={plan.transport} onChange={v => set('transport', v)} options={ [['OPTICAL', 'Оптика · TOSLINK'], ['COAXIAL', 'Коаксиал · S/PDIF']] } /><SelectField label="ЦАП → предусилитель" value={plan.lineConnector} onChange={v => set('lineConnector', v)} options={ [['XLR', 'XLR'], ['RCA', 'RCA']] } /></>}
      {plan.sourceMode === 'vinyl' && <SelectField label="Фонокорректор → предусилитель" value={plan.phonoConnector} onChange={v => set('phonoConnector', v)} options={ [['RCA', 'RCA'], ['XLR', 'XLR']] } />}
      <SelectField label="Предусилитель → усилитель мощности" value={plan.ampConnector} onChange={v => set('ampConnector', v)} options={ [['RCA', 'RCA'], ['XLR', 'XLR']] } />
      <SelectField label="Режим предусилителя" value={plan.preampMode} onChange={v => set('preampMode', v)} options={ [['active', 'Активный'], ['passive', 'Пассивный, если поддерживается']] } />
      <SelectField label="Усилителей мощности" value={plan.powerAmpQuantity} onChange={v => set('powerAmpQuantity', Number(v))} options={ [[1, 'Один аппарат'], [2, 'Два аппарата для стерео']] } />
    </div></section>
    <SystemSummary plan={plan} detailed />
    <button className="system-primary" disabled={!roomInstance('dac', plan.dac) || !roomInstance('preamp', plan.preamp)} onClick={() => { room.previewReplacement({ dac: roomInstance('dac', plan.dac), preamp: roomInstance('preamp', plan.preamp) }); showRoom(); }}>Примерить ЦАП и предусилитель из черновика</button><p>Переносятся только эти два аппарата. Типы кабелей и остальные подключения берутся из комнаты.</p>
    <section className="system-inventory"><div className="system-section-title"><div><p className="share-eyebrow">ФИЗИЧЕСКОЕ РАЗМЕЩЕНИЕ</p><h2>Остаются на полках</h2></div><a href="/#cabinet">Открыть стойку ↗</a></div><ul>{project.equipment.map(item => <li key={item.id}>{equipmentName(item)}</li>)}</ul><p>Смена тракта сохраняет остальные аппараты. Кнопка добавит недостающие кандидаты на отдельные полки. Для моделей без полного габарита перенос будет остановлен; новые кабели требуют координат разъёмов.</p><button className="system-primary" onClick={applyRack}>Разместить выбранные аппараты</button></section>
    <section className="system-sharing"><h2>Показать другу черновик</h2><p>Ссылка содержит каталожный план. Проводка комнаты переносится отдельной резервной копией через кнопку «Скачать схему комнаты» в боковой панели.</p><div><a className="system-primary" href={shareUrl} target="_blank" rel="noreferrer">Открыть просмотр ↗</a><button onClick={async () => { try { await navigator.clipboard.writeText(shareUrl); setMessage('Ссылка на черновик скопирована.'); } catch { setMessage('Скопируйте ссылку из поля ниже.'); } }}>Копировать ссылку</button></div><input aria-label="Ссылка на выбранную систему" readOnly value={shareUrl} onFocus={e => e.target.select()} /></section>
    </div>
    {(message || storageError) && <div className="system-feedback" role="status"><p>{storageError || message}</p>{!storageError && <button aria-label="Закрыть уведомление" onClick={() => setMessage('')}>×</button>}</div>}
    <section id="schiit-catalog" className="schiit-library" aria-label="Каталог Schiit" hidden={view!=='catalog'}>
      <div className="lighting-filters"><label className="lighting-search">Найти Schiit<input type="search" placeholder="Freya, Bifrost, Yggdrasil…" value={query} onChange={e => { setQuery(e.target.value); setVisible(18); }} /></label><SelectField label="Категория Schiit" value={category} onChange={v => { setCategory(v); setVisible(18); }} options={ [['all', 'Все категории'], ...categories.map(c => [c, CATEGORIES[c] || c])] } /></div>
      <p role="status" className="lighting-results">Найдено: {filtered.length} <span>Сверено {SCHIIT_CATALOG.checkedAt.split('-').reverse().join('.')}</span></p><div className="schiit-grid">{filtered.slice(0, visible).map(p => <CatalogCard key={p.id} product={p} onSelect={choose} active={['dac','preamp'].some(role => roomInstance(role, p.id) && roomInstance(role, p.id) === room.components[role])} />)}</div>{!filtered.length && <p>Совпадений нет. Попробуй другое название или категорию.</p>}{visible < filtered.length && <button className="lighting-more" onClick={() => setVisible(n => n + 18)}>Показать ещё</button>}
      <footer className="lighting-provenance"><p>{SCHIIT_CATALOG.scope}</p><p>Каталог сохраняет паспортные факты производителя. Для согласования отдельно проверены основные ЦАПы, предусилители, фонокорректоры и усилители мощности; неизвестные параметры не считаются совпадением.</p><div><a href={SCHIIT_CATALOG.source} target="_blank" rel="noreferrer">Официальный каталог Schiit ↗</a><a href="https://fiio.com/WARMERR2R_parameters" target="_blank" rel="noreferrer">Паспорт FiiO WARMER R2R ↗</a><a href={IMPEDANCE_REFERENCE} target="_blank" rel="noreferrer">Rane: согласование сопротивлений ↗</a></div></footer>
    </section>
    </div><aside className="catalog-inspector" aria-label="Тракт комнаты"><RoomSystemEditor sidebar /></aside></div>
  </section>;
}
