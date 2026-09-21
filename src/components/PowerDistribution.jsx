import { POWER_STRIP, POWER_OUTLETS } from '../data/powerDistribution';
import { DEVICE_SPECS } from '../data/devicePorts';

export default function PowerDistribution() {
  return <details className="power-distribution">
    <summary><span><strong>{POWER_STRIP.name}</strong><small>Куплен · 8 розеток · кабель 3 м</small></span><span className="power-badge">Питание сетапа</span></summary>
    <div className="power-content">
      <p>Предлагаемое подключение: 6 аппаратов стойки и 2 свободные розетки. Оба REL подключены отдельно у стен.</p>
      <ol className="power-outlets">{POWER_OUTLETS.map((outlet, i) => <li key={i} className={outlet.device ? '' : 'power-spare'}>
        <span className="power-socket" aria-hidden="true">● ●</span><span className="power-number">{i + 1}</span>
        <strong>{outlet.device ? DEVICE_SPECS[outlet.device].name : 'Резерв'}</strong><small>{outlet.cable}</small>
      </li>)}</ol>
      <p className="power-specs">Арт. {POWER_STRIP.article} · 16 А / 3680 Вт суммарно · защита 60 000 А · EMI/RFI · H05VV-F 3G1,5 · корпус 635 × 100 × 65 мм. <a href={POWER_STRIP.source} target="_blank" rel="noreferrer">Паспорт производителя ↗</a></p>
      <p className="power-specs">Толстые кабели разгрузить держателями перед вилками. Для блоков питания оставить место между соседними гнёздами. Это схема подключения; положение распределителя и подвод к его розеткам в 3D ещё не заданы.</p>
    </div>
  </details>;
}
