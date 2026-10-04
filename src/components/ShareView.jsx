import ListeningRoom from './ListeningRoom';
import { EQUIPMENT_PHYSICAL } from '../data/cabinetSpecs';
import { DEVICE_SPECS } from '../data/devicePorts';
import { POWER_STRIP } from '../data/powerDistribution';

const RACK_DEVICES = ['turntable', 'phono', 'streamer_wiim', 'dac_fiio', 'a90', 'rusich_a2'];

export default function ShareView() {
  return <main className="share-page">
    <header className="share-heading">
      <p className="cabinet-eyebrow">AUDIO SETUP · SYSTEM VIEW</p>
      <h1>Моя аудиосистема</h1>
      <p>Место для музыки · AE320 в чёрном лаке · два REL Quake.</p>
    </header>
    <div className="share-grid">
      <section className="share-visual" aria-label="Визуализация комнаты">
        <ListeningRoom compact />
      </section>
      <aside className="share-details">
        <section className="share-card">
          <p className="share-eyebrow">СИГНАЛ · ВИНИЛ</p>
          <p className="share-flow">Pro-Ject E1 <span>→</span> Schiit Skoll F <span>→</span> Topping A90 <span>→</span> Rusich ALEPH PASS A2 <span>→</span> Acoustic Energy AE320</p>
        </section>
        <section className="share-card">
          <p className="share-eyebrow">СИГНАЛ · СТРИМИНГ</p>
          <p className="share-flow">WiiM Pro Plus <span>→</span> Optical <i>или</i> Coaxial <span>→</span> Bifrost 3 <span>→</span> XLR <span>→</span> Topping A90 <span>→</span> RCA 1 <span>→</span> Rusich <span>→</span> AE320</p>
        </section>
        <section className="share-card share-gear">
          <p className="share-eyebrow">КОМПОНЕНТЫ НА СТОЙКЕ</p>
          <ul>{RACK_DEVICES.map(id => {
            const equipment = EQUIPMENT_PHYSICAL[id];
            const dimensions = id === 'rusich_a2'
              ? '430 × 180 мм · глубина и масса уточняются'
              : `${equipment.dims.w} × ${equipment.dims.h} × ${equipment.dims.d} мм`;
            return <li key={id}><b>{DEVICE_SPECS[id].name}</b><span>{dimensions}</span></li>;
          })}</ul>
        </section>
        <section className="share-power">
          <span aria-hidden="true">⏚</span>
          <div><b>{POWER_STRIP.name}</b><small>8 розеток · кабель 3 м</small></div>
        </section>
        <p className="share-note">Глубина и масса Rusich пока не указаны в чертеже; модель показывает его с временным габаритом по глубине.</p>
      </aside>
    </div>
  </main>;
}
