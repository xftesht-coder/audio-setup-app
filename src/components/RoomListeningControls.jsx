import { ROOM_DEVICE_MAP } from '../data/roomEquipment';
import { INPUT_DEVICES, INPUT_OPTIONS, LISTENING_SOURCES } from '../data/roomListening';
import { useRoomWiring } from '../store/roomWiringStore';
import { FREYA_MODES } from '../data/roomPassports';
import '../roomListening.css';

function InputSelect({ device }) {
  const input = useRoomWiring(s => s.listening.inputs[device]);
  const cables = useRoomWiring(s => s.cables);
  const setListening = useRoomWiring(s => s.setListening);
  return <label>{ROOM_DEVICE_MAP[device].name}<select aria-label={`Рабочий вход: ${ROOM_DEVICE_MAP[device].name}`} value={input || ''} onChange={e => setListening({ inputs: { [device]: e.target.value || null } })}>
    <option value="">Не указан</option>
    {INPUT_OPTIONS[device].map(p => <option key={p.id} value={p.id}>{p.label}{cables.some(c => c.to === p.id && c.from) ? ' · кабель' : ' · без кабеля'}</option>)}
  </select></label>;
}

export default function RoomListeningControls({ device }) {
  const listening = useRoomWiring(s => s.listening);
  const setListening = useRoomWiring(s => s.setListening);
  const storageError = useRoomWiring(s => s.storageError);
  return <div className={`listening-controls ${device ? 'listening-compact' : ''}`}>
    <div className="listening-selectors">
      <label>Слушаем<select value={listening.source} onChange={e => setListening({ source: e.target.value })}>{LISTENING_SOURCES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>Проверка<select value={listening.mode} onChange={e => setListening({ mode: e.target.value })}><option value="possible">По кабелям</option><option value="selected">С выбранными входами</option></select></label>
    </div>
    {device ? INPUT_DEVICES.includes(device) && <InputSelect device={device} /> : <details open={listening.mode === 'selected'}><summary>Рабочие входы аппаратов</summary><div className="listening-inputs">{INPUT_DEVICES.map(id => <InputSelect key={id} device={id} />)}</div></details>}
    {(!device || device === 'freya') && <label>Режим Freya 2 в проекте<select value={listening.freyaMode || ''} onChange={e => setListening({ freyaMode: e.target.value || null })}><option value="">Не указан</option>{Object.entries(FREYA_MODES).map(([id, m]) => <option key={id} value={id}>{m.label}</option>)}</select></label>}
    <p className="listening-note">{listening.mode === 'possible' ? 'Проверяем возможные пути по кабелям. Выбранные входы пока не учитываются.' : 'Входы учитываются в проверке. Неуказанные считаются неизвестными.'} Это настройки проекта; переключатели, питание и громкость реальных аппаратов меняются вручную.</p>
    {storageError && <p className="listening-error" role="alert">{storageError}</p>}
  </div>;
}
