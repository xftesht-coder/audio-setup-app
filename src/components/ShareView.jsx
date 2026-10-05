import ListeningRoom from './ListeningRoom';
import SystemSummary from './SystemSummary';
import { EQUIPMENT_PHYSICAL } from '../data/cabinetSpecs';
import { DEVICE_SPECS } from '../data/devicePorts';
import { AUDIO_MODELS, DEFAULT_SYSTEM_PLAN } from '../data/audioModels';
import { systemPlanFromSearch } from '../data/systemMatching';
import { POWER_STRIP } from '../data/powerDistribution';

const RACK_DEVICES = ['turntable', 'phono', 'streamer_wiim', 'dac_fiio', 'a90', 'rusich_a2'];
export default function ShareView() {
  const params = new URLSearchParams(window.location.search);
  const sharedPlan = systemPlanFromSearch(window.location.search);
  const invalid = params.has('system') && !sharedPlan;
  const plan = sharedPlan || DEFAULT_SYSTEM_PLAN;
  const name = params.get('name')?.trim().slice(0, 64);
  return <main className="share-page">
    <header className="share-heading"><p className="cabinet-eyebrow">AUDIO SETUP · LISTENING & PLANNING</p><h1>{name || 'Моя аудиосистема'}</h1><p>Место для музыки · AE320 в чёрном лаке · два серых REL Quake.</p></header>
    <div className="share-grid"><section className="share-visual" aria-label="Визуализация комнаты"><ListeningRoom compact /></section>
      <aside className="share-details">{invalid ? <section className="share-card" role="alert"><h2>Не удалось открыть этот вариант</h2><p>В ссылке повреждены данные или есть неизвестный аппарат. Попроси отправить её заново. Ниже — только общий проект комнаты.</p></section> : <SystemSummary plan={plan} />}
        <section className="share-card share-gear"><p className="share-eyebrow">ВОСЕМЬ АППАРАТОВ · ПРОЕКТ СТОЙКИ</p><ul>{RACK_DEVICES.map(id => <li key={id}><b>{DEVICE_SPECS[id].name}{id === 'dac_fiio' ? ' · предзаказ' : ''}</b><span>{id === 'rusich_a2' ? '430 × 180 мм · глубина и масса уточняются' : `${EQUIPMENT_PHYSICAL[id].dims.w} × ${EQUIPMENT_PHYSICAL[id].dims.h} × ${EQUIPMENT_PHYSICAL[id].dims.d} мм`}</span></li>)}
          {['schiit-freya_2', 'fiio-warmer-r2r'].map(id => { const model = AUDIO_MODELS[id]; return <li key={id}><b>{model.name} · {id.includes('freya') ? 'планируем' : 'кандидат'}</b><span>≈ {model.envelope.w} × {model.envelope.h} × {model.envelope.d} мм</span></li>; })}</ul>
          <p className="share-note">Freya 2 сменит A90 в роли предусилителя. Bifrost 3 и WARMER остаются на полках для выбора ЦАПа; планируемые аппараты ещё не считаются купленными.</p></section>
        <section className="share-power"><span aria-hidden="true">⏚</span><div><b>{POWER_STRIP.name}</b><small>8 розеток · кабель 3 м · все места зарезервированы</small></div></section>
        <p className="share-note">Выбранный тракт передаётся в ссылке. Комната показывает базовый проект из восьми аппаратов; другие кандидаты из каталога в этот рендер не добавляются автоматически.</p>
      </aside></div>
  </main>;
}
