import { useEffect } from 'react';
import { ROOM_DEVICES, ROOM_DEVICE_MAP, ROOM_PORTS, ROOM_PORT_MAP } from '../data/roomEquipment';
import { connectionCheck } from '../data/roomWiring';
import { useRoomWiring } from '../store/roomWiringStore';

const portName=id=>id?`${ROOM_DEVICE_MAP[ROOM_PORT_MAP[id].device].name} · ${ROOM_PORT_MAP[id].label}`:'Свободный конец';
export default function RoomPatchInspector({device,onDevice}) {
  const s=useRoomWiring(),d=ROOM_DEVICE_MAP[device];
  const visible=s.cables.filter(c=>ROOM_PORT_MAP[c.from]?.device===device||ROOM_PORT_MAP[c.to]?.device===device);
  const selected=s.cables.find(c=>c.id===s.selectedCable);
  const cancelSelection=s.cancel;
  useEffect(()=>{const cancel=e=>{if(e.key==='Escape')cancelSelection();};window.addEventListener('keydown',cancel);return()=>window.removeEventListener('keydown',cancel);},[cancelSelection]);
  function save() {
    const data={version:1,createdAt:new Date().toISOString(),scope:'Проект аудиоподключений комнаты; входы выбираются на аппаратах. Распайка REL XLR не проверена.',cables:s.cables.map(c=>({...c,fromLabel:portName(c.from),toLabel:portName(c.to)}))};
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='audio-setup-room-wiring.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <aside className="room-patch" aria-label="Подключения за стойкой">
    <div className="patch-title"><b>За стойкой</b><span>{s.cables.filter(c=>c.from&&c.to).length} соединений</span></div>
    <label>Аппарат<select value={device} onChange={e=>onDevice(e.target.value)}>{ROOM_DEVICES.map(d=><option key={d.id} value={d.id}>{d.name}{d.status?' · план':''}</option>)}</select></label>
    <p className="patch-message" role="status" aria-live="polite">{s.message}</p>
    <div className="patch-ports">{ROOM_PORTS.filter(p=>p.device===device).map(p=>{
      const used=s.cables.filter(c=>c.from===p.id||c.to===p.id).length+(p.reserved?1:0);
      const check=s.selectedPort?connectionCheck(s.selectedPort,p.id,s.cables,s.selectedCable):null;
      return <button key={p.id} title={check?.reason||p.label} className={check?.ok?'is-compatible':''} aria-pressed={s.selectedPort===p.id} onClick={()=>s.pickPort(p.id)}><span>{p.direction==='out'?'↗':'↙'} {p.label}</span><small>{used?`${used} подключено`:'свободен'}</small></button>;
    })}</div>
    {s.selectedPort&&<button className="patch-cancel" onClick={s.cancel}>Отменить выбор · Esc</button>}
    <div className="patch-cables"><b>Кабели аппарата</b>{visible.length===0?<p>Пока не подключён.</p>:visible.map(c=><button key={c.id} aria-pressed={s.selectedCable===c.id} onClick={()=>s.selectCable(c.id)}><span>{portName(c.from)}</span><span>↓ {portName(c.to)}</span></button>)}</div>
    {selected&&<div className="patch-unplug"><b>Выбранный кабель</b><span>{portName(selected.from)} → {portName(selected.to)}</span><div><button disabled={!selected.from} onClick={()=>s.unplug(selected.id,'from')}>Вынуть из выхода</button><button disabled={!selected.to} onClick={()=>s.unplug(selected.id,'to')}>Вынуть из входа</button><button onClick={()=>s.remove(selected.id)}>Убрать кабель</button></div></div>}
    <div className="patch-history"><button disabled={!s.past.length} onClick={s.undo}>↶ Отменить</button><button disabled={!s.future.length} onClick={s.redo}>↷ Повторить</button><button onClick={save}>Скачать схему</button></div>
    <details><summary>Готовые схемы и точность</summary><div className="patch-presets">{[['a90','A90 · исходная'],['bifrost','Freya + Bifrost'],['warmer','Freya + WARMER']].map(([id,name])=><button key={id} onClick={()=>s.preset(id)}>{name}</button>)}</div><p>{d.accuracy}</p>{d.source&&<a href={d.source} target="_blank" rel="noreferrer">Референс аппарата ↗</a>}<p>Стереопара подключается целиком. Проверяем тип сигнала, разъёмы, занятость и петли. Питание WiiM, Skoll и E1 — через штатные БП. Это проект схемы; суммарная нагрузка и распайка REL не подтверждены. Лампы и настенные вводы показаны стационарно.</p></details>
  </aside>;
}
