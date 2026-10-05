// Metres, Blender axes (x right, y rear, z up). Port positions are traced from
// reference photographs, not factory CAD. A stereo pair is one patch operation.
export const ROOM_DEVICES = [
  { id:'freya', name:'Schiit Freya 2', center:[-.14,0,.9702], size:[.4064,.2032,.0508], status:'Планируется', source:'https://www.schiit.com/products/freya_2', accuracy:'Передняя и задняя панели по официальным фото; лампы 2 × 2 справа.' },
  { id:'warmer', name:'FiiO WARMER R2R', center:[.207,0,.9782], size:[.2235,.213,.0588], status:'Кандидат', source:'https://www.fiio.com/WARMERR2R_picture', accuracy:'Две стрелочные шкалы; ручка выбирает вход, выход фиксированный.' },
  { id:'skoll', name:'Schiit Skoll F', center:[-.135,-.094,.7878], size:[.2286,.1524,.034], source:'https://www.schiit.com/products/skoll-f', accuracy:'Панели по официальным фото. Внешний трансформатор 24/6 VAC.' },
  { id:'wiim', name:'WiiM Pro Plus', center:[.135,-.10,.7898], size:[.14,.14,.038], source:'https://wiimhome.com/wiimpro/specs', accuracy:'Габарит производителя; расположение портов по фото, без обмеров.' },
  { id:'bifrost', name:'Schiit Bifrost 3', center:[-.135,-.0888,.5614], size:[.2286,.1524,.0468], status:'Предзаказ / план', source:'https://www.schiit.com/products/bifrost-3', accuracy:'Модульная задняя панель и USB-C по фото Bifrost 3.' },
  { id:'a90', name:'Topping A90', center:[.135,-.09,.559], size:[.222,.16,.04], source:'/photos/a90.jpg', accuracy:'Внешность по сохранённому фото A90 Discrete. Ревизия аппарата владельца ещё не подтверждена.' },
  { id:'rusich', name:'Rusich ALEPH PASS A2', center:[0,-.015,.276], size:[.43,.30,.18], accuracy:'Передняя и задняя панели по чертежу владельца 430 × 180 мм. Глубина 300 мм условная.' },
  { id:'e1', name:'Pro-Ject E1', center:[0,0,1.285], size:[.42,.33,.03], source:'https://www.project-audio.com/en/product/e1/', accuracy:'Размер производителя; координаты кабельного выхода приблизительные.' },
  ...[-1,1].flatMap((s,i)=>[
    {id:`ae${i}`,name:`AE320 · ${i?'R':'L'}`,center:[s*1.1,0,.525],size:[.175,.32,1],accuracy:'Клеммы + / −; высота разъёмов по визуальному приближению.'},
    {id:`rel${i}`,name:`REL Quake · ${i?'R':'L'}`,center:[s*1.6,.08,.1695],size:[.253,.25,.249],accuracy:'XLR HIGH LEVEL по уточнению владельца. Распайка неизвестна; это не линейный XLR.'},
  ]),
  {id:'pdu',name:'Brennenstuhl · 8 розеток',center:[.48,.25,.035],size:[.10,.635,.06],accuracy:'Восемь розеток. Положение вилок и корпусов БП условное; подключение не рассчитывает электрическую нагрузку.'},
  ...[-1,1].map((s,i)=>({id:`side${i}`,name:`Фильтр REL · ${i?'R':'L'}`,center:[s*1.86,.28,.035],size:[.10,.25,.06],accuracy:'Проектный фильтр на 3 розетки: сабвуфер, лампа, резерв. Модель не выбрана.'})),
];
export const ROOM_DEVICE_MAP = Object.fromEntries(ROOM_DEVICES.map(d=>[d.id,d]));
export const FREYA_TUBES = [[.078,-.040],[.144,-.040],[.078,.040],[.144,.040]];
export const GLIVER_CHAIR = { manufacturer:'Gliver', model:'ДеФранс · 1-местный', widthMm:900, depthMm:1080, heightMm:850, seatDepthMm:650, seatHeightMm:[350,400], fabric:'Вертикаль велюр', color:'Молочный', source:'Спецификация и уточнение владельца', geometry:'Форма и складки воссозданы по рисунку; не заводская 3D-модель.' };

const ports=[];
function p(device,key,label,connector,direction,signal,x,z=0,offsets=[[0,0]],extra={}) {
  const d=ROOM_DEVICE_MAP[device];
  ports.push({id:`${device}.${key}`,device,label,connector,direction,signal,position:[d.center[0]+x,d.center[1]+d.size[1]/2+.003,d.center[2]+z],jacks:offsets,capacity:1,...extra});
}
const stereoX=(s=.018)=>[[-s/2,0],[s/2,0]], stereoZ=[[0,.010],[0,-.010]];
// Photo rear left maps to physical right (+x).
p('freya','xlr1','XLR 1 · L/R','XLR','in','line',.153,0,stereoX(.029));
p('freya','xlr2','XLR 2 · L/R','XLR','in','line',.087,0,stereoX(.029));
for(let i=0;i<3;i++)p('freya',`rca${i+3}`,`RCA ${i+3} · L/R`,'RCA','in','line',.036-i*.018,0,stereoZ);
p('freya','xlrOut','XLR OUT · L/R','XLR','out','line',-.061,0,stereoX(.029));
p('freya','rcaOut1','RCA OUT 1 · L/R','RCA','out','line',-.106,0,stereoZ);
p('freya','rcaOut2','RCA OUT 2 · L/R','RCA','out','line',-.125,0,stereoZ);
p('bifrost','xlrOut','XLR OUT · L/R','XLR','out','line',.083,-.001,stereoX(.024));
p('bifrost','rcaOut','RCA OUT · L/R','RCA','out','line',.034,.006,stereoX(.014));
p('bifrost','coax','COAX IN','COAX','in','digital',-.004,-.012);
p('bifrost','opt','OPTICAL IN','OPTICAL','in','digital',-.023,-.012);
p('bifrost','usb','USB-C IN','USB_C','in','usb',-.041,.008);
p('warmer','usb','USB-C IN','USB_C','in','usb',.1,-.022);
p('warmer','opt','OPTICAL IN','OPTICAL','in','digital',.083,-.015);
p('warmer','coax','COAX IN','COAX','in','digital',.064,-.015);
p('warmer','rcaOut','RCA OUT · L/R','RCA','out','line',.027,-.01,stereoX(.017));
p('warmer','xlrOut','XLR OUT · L/R','XLR','out','line',-.035,-.005,stereoX(.041));
p('skoll','xlrIn','XLR IN · L/R','XLR','in','phono',.087,0,stereoX(.025));
p('skoll','rcaIn','RCA IN · L/R','RCA','in','phono',.049,0,stereoX(.015));
p('skoll','xlrOut','XLR OUT · L/R','XLR','out','line',.010,0,stereoX(.025));
p('skoll','rcaOut','RCA OUT · L/R','RCA','out','line',-.031,0,stereoX(.015));
p('skoll','ground','GND','GROUND','in','ground',-.063);
p('wiim','rcaIn','LINE IN · L/R','RCA','in','line',.052,0,stereoX(.012));
p('wiim','rcaOut','LINE OUT · L/R','RCA','out','line',.022,0,stereoX(.012));
p('wiim','optIn','OPTICAL IN','OPTICAL','in','digital',.003);
p('wiim','opt','OPTICAL OUT','OPTICAL','out','digital',-.014);
p('wiim','coax','COAX OUT','COAX','out','digital',-.031);
p('a90','xlrIn','XLR IN · L/R','XLR','in','line',.071,0,stereoX(.025));
p('a90','rcaIn','RCA IN · L/R','RCA','in','line',.029,0,stereoZ);
p('a90','xlrOut','XLR OUT · L/R','XLR','out','line',-.019,0,stereoX(.025));
p('a90','rcaOut','RCA OUT · L/R','RCA','out','line',-.055,0,stereoZ);
// Rusich rear drawing: two RCA pairs, two XLR pairs, binding posts, central IEC.
p('rusich','rca1','RCA 1 · L/R','RCA','in','line',.084,.01,stereoZ);
p('rusich','rca2','RCA 2 · L/R','RCA','in','line',.052,.01,stereoZ);
p('rusich','xlr1','XLR 1 · L/R','XLR','in','line',0,.012,stereoX(.029));
p('rusich','xlr2','XLR 2 · L/R','XLR','in','line',-.066,.012,stereoX(.029));
for(let i=0;i<2;i++) {
  const s=i?1:-1;
  p('rusich',`speaker${i}`,`Выход ${i?'R':'L'} · + / −`,'BINDING','out','speaker',s*.137,.022,stereoX(.040),{capacity:2,channel:i?'R':'L'});
  p(`ae${i}`,'in','Клеммы + / −','BINDING','in','speaker',0,-.395,stereoX(.030),{channel:i?'R':'L'});
  p(`rel${i}`,'hi','XLR HIGH LEVEL','XLR_HIGH','in','speaker',-.04,-.0345,[[0,0]],{channel:i?'R':'L',pinout:null});
  p(`rel${i}`,'low','LOW LEVEL','RCA','in','line',.037,-.0345);
}
p('e1','out','PHONO · L/R','RCA','out','phono',-.04,0,stereoX(.012));
p('e1','ground','GND','GROUND','out','ground',-.063);
for(const [id,x,z,type,desc] of [
  ['rusich',0,-.065,'IEC','230 V · IEC'],['bifrost',-.084,-.003,'IEC','230 V · IEC'],['a90',-.09,0,'IEC','230 V · IEC'],
  ['skoll',-.1,0,'AC24_6','Внешний БП · 24/6 VAC'],['wiim',-.057,0,'USB_POWER','USB-C · БП 5 V'],['e1',.11,0,'E1_POWER','Штатный БП · напряжение уточняется'],
  ['freya',-.175,0,'IEC','230 V · IEC'],['warmer',-.091,.009,'IEC','230 V · IEC'],['rel0',.036,-.0935,'IEC','230 V · IEC'],['rel1',.036,-.0935,'IEC','230 V · IEC'],
])p(id,'power',desc,type,'in','power',x,z);
for(const [id,count,length] of [['pdu',8,.635],['side0',3,.25],['side1',3,.25]]){
  const d=ROOM_DEVICE_MAP[id];
  for(let i=0;i<count;i++)ports.push({id:`${id}.${i+1}`,device:id,label:`Розетка ${i+1} · 230 V`,connector:'SCHUKO',direction:'out',signal:'power',position:[d.center[0],d.center[1]-length/2+.05+i*(length-.14)/(count-1),.070],jacks:[[0,0]],axis:'Z',capacity:1,reserved:id!=='pdu'&&i===1?'Лампа · стационарно':null});
}
export const ROOM_PORTS=ports;
export const ROOM_PORT_MAP=Object.fromEntries(ports.map(port=>[port.id,port]));
export const DEFAULT_ROOM_CABLES=[
  ['vinyl','e1.out','skoll.rcaIn'],['ground','e1.ground','skoll.ground'],
  ['phono','skoll.rcaOut','a90.rcaIn'],['digital','wiim.opt','bifrost.opt'],
  ['dac','bifrost.xlrOut','a90.xlrIn'],['pre','a90.rcaOut','rusich.rca1'],
  ...[0,1].flatMap(i=>[[`speaker${i}`,`rusich.speaker${i}`,`ae${i}.in`],[`sub${i}`,`rusich.speaker${i}`,`rel${i}.hi`]]),
  ...['rusich','bifrost','a90','skoll','wiim','e1'].map((d,i)=>[`power-${d}`,`pdu.${i+1}`,`${d}.power`]),
  ...[0,1].map(i=>[`power-rel${i}`,`side${i}.1`,`rel${i}.power`]),
].map(([id,from,to])=>({id,from,to,fromType:ROOM_PORT_MAP[from].connector,toType:ROOM_PORT_MAP[to].connector}));
