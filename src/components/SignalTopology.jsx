const LABELS = { BINDING_POST: 'Акустический кабель · + / −', XLR_HIGH_LEVEL: 'Клеммы усилителя → HIGH LEVEL → XLR на REL', OPTICAL: 'Оптика · S/PDIF', COAXIAL: 'Коаксиал · S/PDIF', RCA: 'RCA', XLR: 'XLR' };
const STATUS = { ok: 'Проверено', unknown: 'Нужны данные', warning: 'Проверить', error: 'Несовместимо' };
function Node({ model, quantity = 1 }) {
  return <div className="signal-node"><b>{model.name}{quantity > 1 ? ` × ${quantity}` : ''}</b>{model.availability === 'preorder' && <small>Планируем · предзаказ</small>}{model.source && <a href={model.source} target="_blank" rel="noreferrer" aria-label={`Источник: ${model.name}`}>Паспорт ↗</a>}</div>;
}
function Path({ links, quantity }) {
  return <ol className="signal-path">{links.map((link, index) => <li key={`${link.from.id}-${link.to.id}`}>
    {index === 0 && <Node model={link.from} />}
    <div className={`signal-wire ${link.status}`}><span>{LABELS[link.connector] || link.connector}{link.signal === 'phono' ? ' · PHONO' : ''}</span><span aria-hidden="true">↓</span><small>{link.provenance === 'owner-reported' ? 'По владельцу · распайка неизвестна' : STATUS[link.status]}</small></div>
    <Node model={link.to} quantity={link.to.roles?.includes('powerAmp') ? quantity : 1} />
  </li>)}</ol>;
}
export default function SignalTopology({ result }) {
  const main = result.links.filter(link => link.branch === 'speakers'), headphones = result.links.filter(link => link.branch === 'headphones');
  const subs = result.links.filter(link => link.branch === 'subwoofers');
  const headphoneSource = result.selected.headphoneAmp || (result.selected.preamp.hasHeadphoneOutput ? result.selected.preamp : null);
  return <div className="signal-topology" aria-label="Схема прохождения сигнала">
    <section className="signal-main"><h3>Акустика</h3><Path links={main} quantity={result.plan.powerAmpQuantity} /></section>
    <div className="signal-side"><section><h3>Наушники · отдельная ветка</h3>{headphones.length > 0 ? <Path links={headphones} quantity={1} /> : headphoneSource ? <Node model={headphoneSource} /> : <p className="signal-pending">Усилитель наушников не выбран.</p>}
      <div className="signal-pending"><b>Sennheiser HD 650</b><small>{headphoneSource ? 'Кабель и выходной разъём нужно подтвердить' : 'Требуется выход на наушники'}</small></div>
    </section><section className="signal-subwoofers"><h3>Сабвуферы · параллельная ветка</h3><p>{subs.every(link => link.provenance === 'owner-reported') ? 'От тех же акустических выходов, что и AE320. XLR на сабах передаёт HIGH LEVEL; это отдельные кабели.' : 'Проект high-level веток. При смене усилителя подключение REL нужно согласовать заново.'}</p>{subs.map(link => <Path key={link.to.id} links={[link]} quantity={result.plan.powerAmpQuantity} />)}</section></div>
  </div>;
}
