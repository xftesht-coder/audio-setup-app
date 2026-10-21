import { ROOM_DEVICE_MAP } from '../data/roomEquipment';
import { useRoomWiring } from '../store/roomWiringStore';
import '../roomReplacement.css';

export default function RoomComponentSummary() {
  const components = useRoomWiring(s => s.components);
  return <p className="room-current-components">Выбраны для тракта: <b>{ROOM_DEVICE_MAP[components.dac]?.name || 'ЦАП не определён'}</b> → <b>{ROOM_DEVICE_MAP[components.preamp]?.name || 'Предусилитель не определён'}</b>. <a href="#patch">Заменить аппарат ↗</a></p>;
}
