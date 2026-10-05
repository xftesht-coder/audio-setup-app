import { POWER_STRIP, POWER_OUTLETS } from '../data/powerDistribution';
import { DEVICE_SPECS } from '../data/devicePorts';
import { SIDE_POWER_STRIPS } from '../data/listeningRoom';

export default function PowerDistribution() {
  return <details className="power-distribution">
    <summary><span><strong>{POWER_STRIP.name}</strong><small>Куплен · 8 розеток · кабель 3 м</small></span><span className="power-badge">Питание сетапа</span></summary>
    <div className="power-content">
      <p>План стойки — 8 аппаратов, включая оба ЦАПа и оба предусилителя; все 8 розеток зарезервированы. Bifrost 3, Freya 2 и WARMER — планируемые аппараты. Суммарное потребление и габариты адаптеров пока не проверены. Для двух REL и соседних ламп предусмотрены отдельные фильтры у стен.</p>
      <ol className="power-outlets">{POWER_OUTLETS.map((outlet, i) => <li key={i} className={outlet.device ? '' : 'power-spare'}>
        <span className="power-socket" aria-hidden="true">● ●</span><span className="power-number">{i + 1}</span>
        <strong>{outlet.device ? (outlet.name || DEVICE_SPECS[outlet.device]?.name) : 'Резерв'}</strong><small>{outlet.cable}</small>
      </li>)}</ol>
      <p className="power-specs">Арт. {POWER_STRIP.article} · 16 А / 3680 Вт суммарно · защита 60 000 А · EMI/RFI · H05VV-F 3G1,5 · корпус 635 × 100 × 65 мм. <a href={POWER_STRIP.source} target="_blank" rel="noreferrer">Паспорт производителя ↗</a></p>
      <div className="room-power-grid">{SIDE_POWER_STRIPS.map(strip => <article key={strip.id}><h3>{strip.name} · {strip.sockets} розетки</h3><p>{strip.outlets.join(' · ')}</p><small>{strip.note}</small></article>)}</div>
      <p className="power-specs">В сцене комнаты показаны три распределителя и подводы по полу за системой. Радиусы изгиба и длины кабелей — проектные; их нужно сверить с конкретными кабелями. Два боковых фильтра подключаются к стене независимо от центрального.</p>
    </div>
  </details>;
}
