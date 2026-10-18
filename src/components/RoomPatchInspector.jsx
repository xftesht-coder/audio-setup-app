import { useEffect, useMemo, useRef, useState } from 'react';
import { ROOM_DEVICES, ROOM_DEVICE_MAP, ROOM_PORTS, ROOM_PORT_MAP } from '../data/roomEquipment';
import { connectionCheck } from '../data/roomWiring';
import { useRoomWiring } from '../store/roomWiringStore';
import { downloadJson, MAX_ROOM_BACKUP_BYTES, roomSnapshot } from '../data/roomBackup';
import { auditRoom } from '../data/roomIntelligence';
import RoomListeningControls from './RoomListeningControls';
import RoomSystemEditor from './RoomSystemEditor';

const portName=id=>id?`${ROOM_DEVICE_MAP[ROOM_PORT_MAP[id].device].name} · ${ROOM_PORT_MAP[id].label}`:'Свободный конец';
export default function RoomPatchInspector({device,onDevice,compact=false,section="device",onSection}) {
  const upload=useRef(null),[importError,setImportError]=useState(''),[importing,setImporting]=useState(false);
  const s=useRoomWiring(),d=ROOM_DEVICE_MAP[device];
  const report=useMemo(()=>auditRoom(s.cables,s.listening.source,s.listening),[s.cables,s.listening]);
  const visible=s.cables.filter(c=>ROOM_PORT_MAP[c.from]?.device===device||ROOM_PORT_MAP[c.to]?.device===device);
  const selected=s.cables.find(c=>c.id===s.selectedCable);
  const cancelSelection=s.cancel;
  useEffect(()=>{const cancel=e=>{if(e.key==='Escape')cancelSelection();};window.addEventListener('keydown',cancel);return()=>window.removeEventListener('keydown',cancel);},[cancelSelection]);
  function save() {
    const data={...roomSnapshot(s),createdAt:new Date().toISOString(),scope:'Проект аудиоподключений комнаты; входы и режим Freya указаны пользователем. Распайка REL XLR не проверена.',cables:s.cables.map(c=>({...c,fromLabel:portName(c.from),toLabel:portName(c.to)}))};
    downloadJson('audio-setup-room-wiring.json',data);
  }
  async function restore(event) {
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    setImportError('');setImporting(true);
    try {if(file.size>MAX_ROOM_BACKUP_BYTES)throw new Error('Файл слишком большой. Максимум 128 КБ.');s.importFile(await file.text());}
    catch(error){setImportError(error.message+' Схема не изменена.');}
    finally{setImporting(false);}
  }
  const unplug = selected && <div className="patch-unplug"><b>Выбранный кабель</b><span>{portName(selected.from)} → {portName(selected.to)}</span><div><button disabled={!selected.from} onClick={()=>s.unplug(selected.id,'from')}>Вынуть из выхода</button><button disabled={!selected.to} onClick={()=>s.unplug(selected.id,'to')}>Вынуть из входа</button><button onClick={()=>s.remove(selected.id)}>Убрать кабель</button><button onClick={s.cancel}>Снять выделение</button></div></div>;
  const cables = <div className="patch-cables">{!compact&&<b>Кабели аппарата</b>}{visible.length===0?<p>Пока не подключён.</p>:visible.map(c=><button key={c.id} aria-pressed={s.selectedCable===c.id} onClick={()=>s.selectCable(c.id)}><span>{portName(c.from)}</span><span>↓ {portName(c.to)}</span></button>)}</div>;
  return <aside className={'room-patch'+(compact?' patch-compact':'')} aria-label="Подключения за стойкой">
    {compact?<div className="inspector-tabs" role="group" aria-label="Раздел инспектора">{[['device','Аппарат'],['listening','Слушаем'],['project','Проект']].map(([id,label])=><button key={id} aria-pressed={section===id} onClick={()=>onSection(id)}>{label}</button>)}</div>:<div className="patch-title"><b>За стойкой</b><span>{s.cables.filter(c=>c.from&&c.to).length} соединений</span></div>}
    {(!compact||section==='device')&&<>
      <label>Аппарат<select value={device} onChange={e=>onDevice(e.target.value)}>{ROOM_DEVICES.map(d=><option key={d.id} value={d.id}>{d.name}{d.status?' · план':''}</option>)}</select></label>
      <details className="inspector-replacement" open={Boolean(s.replacement)}><summary>Заменить ЦАП / предусилитель</summary><RoomSystemEditor compact /></details>
      {compact&&unplug}
      {!compact&&<RoomListeningControls device={device} />}
      {!compact&&<p className="patch-listening-status" role="status">{report.connected} / 4 путей {s.listening.mode==='selected'?'с выбранными входами':'по кабелям'} · <a href="#intelligence">Подробнее ↗</a></p>}
      {!compact&&<p className="patch-message" role="status" aria-live="polite">{s.message}</p>}
      {compact&&<div className="inspector-ports-heading"><b>Разъёмы</b><span>выход → вход</span></div>}
      <div className="patch-ports">{ROOM_PORTS.filter(p=>p.device===device).map(p=>{
        const used=s.cables.filter(c=>c.from===p.id||c.to===p.id).length+(p.reserved?1:0);
        const check=s.selectedPort?connectionCheck(s.selectedPort,p.id,s.cables,s.selectedCable):null;
        return <button key={p.id} title={check?.reason||p.label} className={check?.ok?'is-compatible':''} aria-pressed={s.selectedPort===p.id} onClick={()=>s.pickPort(p.id)}><span>{p.direction==='out'?'↗':'↙'} {p.label}</span><small>{used?used+' подключено':'свободен'}</small></button>;
      })}</div>
      {s.selectedPort&&<button className="patch-cancel" onClick={s.cancel}>Отменить выбор · Esc</button>}
      {compact?<details className="inspector-cables"><summary>Кабели аппарата · {visible.length}</summary>{cables}</details>:cables}
      {!compact&&unplug}
      {compact&&<p className="inspector-hint">Выбери выход, затем вход. Совместимые разъёмы подсветятся.</p>}
    </>}
    {compact&&section==='listening'&&<><h2 className="inspector-section-title">Источник и входы</h2><RoomListeningControls /><p className="patch-listening-status">{report.connected} / 4 путей · <a href="#intelligence">Подробнее ↗</a></p></>}
    {(!compact||section==='project')&&<>
      {compact&&<h2 className="inspector-section-title">Проект подключений</h2>}
      <div className="patch-history"><button disabled={!s.past.length} onClick={s.undo}>↶ Отменить</button><button disabled={!s.future.length} onClick={s.redo}>↷ Повторить</button><button onClick={save}>Скачать схему</button></div>
      <div className="patch-history"><button disabled={importing} onClick={()=>upload.current?.click()}>{importing?'Читаем файл…':'Загрузить схему'}</button><a href="#intelligence">Проверить систему ↗</a></div>
      <input ref={upload} type="file" accept=".json,application/json" hidden onChange={restore} aria-label="Резервная копия комнаты" />
      <p className="patch-import-help">Загрузка заменяет состав, провода, источник, входы и режим Freya. Можно отменить. В копиях v1 входы не указаны — проверяем только кабели.</p>
      {importError&&<p role="alert" className="patch-import-error">{importError}</p>}
      <details><summary>Готовые схемы и точность</summary><div className="patch-presets">{[['a90','A90 · исходная'],['bifrost','Freya + Bifrost'],['warmer','Freya + WARMER']].map(([id,name])=><button key={id} onClick={()=>s.preset(id)}>{name}</button>)}</div><p>{d.accuracy}</p>{d.source&&<a href={d.source} target="_blank" rel="noreferrer">Референс аппарата ↗</a>}<p>Стереопара подключается целиком. Проверяем тип сигнала, разъёмы, занятость и петли. Питание WiiM, Skoll и E1 — через штатные БП. Это проект схемы; суммарная нагрузка и распайка REL не подтверждены. Лампы и настенные вводы показаны стационарно.</p></details>
    </>}
  </aside>;
}
