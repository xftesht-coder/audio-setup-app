import { useMemo, useState } from 'react';
import { portLabel } from '../data/roomIntelligence';
import { connectionCheck } from '../data/roomWiring';
import { roomRackLayout, RACK_CARD_WIDTH, roomCableStyle } from '../data/roomRackLayout';
import { useRoomWiring } from '../store/roomWiringStore';
import '../roomRackView.css';

const activate = action => event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action(); } };
export default function RoomRackView({ rows, kind, device, onDevice, onCable }) {
  const s = useRoomWiring();
  const [showIdle, setShowIdle] = useState(false), [zoom, setZoom] = useState('fit');
  const layout = useMemo(() => roomRackLayout(rows, { kind, showIdle }), [rows, kind, showIdle]);
  const selected = s.cables.find(c => c.id === s.selectedCable);
  const used = new Map();
  s.cables.forEach(c => [c.from, c.to].filter(Boolean).forEach(id => used.set(id, (used.get(id) || 0) + 1)));
  const legend = [...new Map(layout.wires.map(w => [w.style.name, w.style])).values()];
  return <section className="room-rack" aria-label="Графическая схема подключений">
    <header><div><h2>Роутинг · вид разъёмов</h2><p>Выбери кабель или соедини выход со входом. Цвет обозначает тип соединения.</p></div><div className="rack-view-controls"><label><input type="checkbox" checked={showIdle} onChange={e => setShowIdle(e.target.checked)} /> Неподключённые аппараты</label><label>Масштаб<select value={zoom} onChange={e => setZoom(e.target.value)}><option value="fit">Вся схема</option><option value="100">100%</option><option value="125">125%</option></select></label></div></header>
    <div className="rack-feedback" role="status">{s.message}{s.selectedPort && <button onClick={s.cancel}>Отмена · Esc</button>}</div>
    {selected && <div className="rack-cable-actions"><span>{portLabel(selected.from)} → {portLabel(selected.to)}</span><button disabled={!selected.from} onClick={() => s.unplug(selected.id, 'from')}>Отсоединить выход</button><button disabled={!selected.to} onClick={() => s.unplug(selected.id, 'to')}>Отсоединить вход</button><button onClick={s.cancel}>Снять выделение</button></div>}
    <div className="rack-scroll" tabIndex={0} aria-label="Схема разъёмов; прокрутка по горизонтали">
      <svg className="room-rack-svg" width={zoom === 'fit' ? '100%' : layout.width * Number(zoom) / 100} viewBox={`0 0 ${layout.width} ${layout.height}`} style={{ minWidth: zoom === 'fit' ? Math.min(layout.width, 1050) : undefined }} aria-label="Аппараты и кабели общей схемы">
        {layout.cards.map(card => <g key={card.id} className={`rack-device ${device === card.id ? 'focused' : ''}`}>
          <rect x={card.x} y={card.y} width={RACK_CARD_WIDTH} height={card.height} rx="5" className="rack-device-body" />
          <g role="button" tabIndex={0} aria-label={`Аппарат на схеме: ${card.name}`} onClick={() => onDevice(card.id)} onKeyDown={activate(() => onDevice(card.id))} className="rack-device-heading">
            <rect x={card.x} y={card.y} width={RACK_CARD_WIDTH} height="34" rx="4" fill={['pdu', 'side0', 'side1'].includes(card.id) ? '#eee0ca' : '#dce8e2'} />
            <text x={card.x + 10} y={card.y + 21} fontSize="11" fontWeight="700">{card.name}</text>
          </g>
          {card.ports.map(p => {
            const point = layout.ports[p.id], count = (used.get(p.id) || 0) + (p.reserved ? 1 : 0);
            const check = s.selectedPort && s.selectedPort !== p.id ? connectionCheck(s.selectedPort, p.id, s.cables, selected && (!selected.from || !selected.to) ? selected.id : null) : null;
            const color = roomCableStyle({ from: p.id, to: p.id }).color;
            const pick = () => { onDevice(card.id); s.pickPort(p.id); };
            return <g key={p.id} className="rack-port" role="button" tabIndex={0} aria-label={`Разъём: ${card.name} · ${p.label}`} aria-pressed={s.selectedPort === p.id} onClick={pick} onKeyDown={activate(pick)}>
              <title>{p.reserved || check?.reason || `${p.direction === 'out' ? 'Выход' : 'Вход'} · ${count}/${p.capacity} занято`}</title>
              <rect x={card.x + 2} y={point.y - 11} width={RACK_CARD_WIDTH - 4} height="23" rx="2" fill={s.selectedPort === p.id ? '#ffe7ae' : check?.ok ? '#d9edce' : count ? '#eff5f1' : '#fff'} />
              <text x={card.x + 12} y={point.y + 3} fontSize="9.5">{p.direction === 'out' ? '↗ ' : '↙ '}{p.label}</text>
              <text x={card.x + RACK_CARD_WIDTH - 8} y={point.y + 3} textAnchor="end" fontSize="8" fill="#718377">{p.reserved ? 'лампа' : count ? `${count}/${p.capacity}` : '○'}</text>
              <circle cx={point.x} cy={point.y} r={s.selectedPort === p.id || check?.ok ? 6 : 4.5} fill={count ? color : '#fff'} stroke={check?.ok ? '#3d853e' : color} strokeWidth="2" />
            </g>;
          })}
        </g>)}
        {layout.wires.map(w => <g key={w.id} className={`rack-wire ${s.selectedCable === w.id ? 'selected' : ''}`} role="button" tabIndex={0} aria-label={`Кабель на схеме: ${portLabel(w.from)} → ${portLabel(w.to)}`} aria-pressed={s.selectedCable === w.id} onClick={() => onCable(w)} onKeyDown={activate(() => onCable(w))}>
          <title>{portLabel(w.from)} → {portLabel(w.to)}{w.loose ? ' · свободный конец' : ''}</title>
          <path d={w.d} fill="none" stroke="transparent" strokeWidth="14" className="wire-hit" />
          <path d={w.d} fill="none" stroke={s.selectedCable === w.id ? '#b77918' : w.style.color} strokeWidth={w.style.width + (s.selectedCable === w.id ? 1.5 : 0)} strokeDasharray={w.loose ? '5 4' : w.style.dash} strokeLinejoin="round" strokeLinecap="round" className="wire-visible" />
          {w.loose && <circle cx={!w.from ? w.start.x : w.end.x} cy={!w.from ? w.start.y : w.end.y} r="5" fill="#fff3d2" stroke={w.style.color} strokeWidth="2" />}
        </g>)}
      </svg>
      {!layout.cards.length && <p className="rack-empty">Нет кабелей по выбранному фильтру. Включи неподключённые аппараты, чтобы собрать соединение.</p>}
    </div>
    <footer>{legend.map(style => <span key={style.name}><i style={{ borderColor: style.color, borderTopStyle: style.dash ? 'dashed' : 'solid' }} />{style.name}</span>)}<small>Стереопара — одна линия. Геометрия схемы не задаёт длину кабеля.</small></footer>
  </section>;
}
