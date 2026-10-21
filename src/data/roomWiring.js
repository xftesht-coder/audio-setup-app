import { DEFAULT_ROOM_CABLES, ROOM_PORT_MAP } from './roomEquipment.js';

export function connectionCheck(firstId,secondId,cables=[],ignoreId=null) {
  const a=ROOM_PORT_MAP[firstId],b=ROOM_PORT_MAP[secondId];
  if(!a||!b)return {ok:false,reason:'Выбери два разъёма.'};
  if(a.direction===b.direction)return {ok:false,reason:'Нужны выход и вход.'};
  const [from,to]=a.direction==='out'?[a,b]:[b,a];
  const existing=cables.find(c=>c.id===ignoreId);
  if(existing&&(!existing.from||!existing.to)&&((existing.fromType&&existing.fromType!==from.connector)||(existing.toType&&existing.toType!==to.connector)))return {ok:false,reason:'У свободного конца другой штекер. Для этого соединения нужен другой кабель.'};
  if(from.reserved||to.reserved)return {ok:false,reason:'Розетка занята стационарной лампой.'};
  if(from.device===to.device)return {ok:false,reason:'Нельзя замкнуть аппарат на себя.'};
  if(from.signal!==to.signal)return {ok:false,reason:'Разный уровень сигнала: линейный, phono и акустический не взаимозаменяемы.'};
  if(['line','phono'].includes(from.signal)&&from.jacks.length!==to.jacks.length)return {ok:false,reason:'Стереопару нельзя вставить в один моно-вход. Нужна отдельная схема подключения.'};
  const ownerHigh=from.connector==='BINDING'&&to.connector==='XLR_HIGH';
  const power=from.connector==='SCHUKO'&&to.signal==='power';
  if(from.connector!==to.connector&&!ownerHigh&&!power)return {ok:false,reason:'Разъёмы не совпадают. Переходник автоматически не предполагается.'};
  if(from.channel&&to.channel&&from.channel!==to.channel)return {ok:false,reason:'Каналы L / R должны совпадать.'};
  const others=cables.filter(c=>c.id!==ignoreId);
  if([from,to].some(p=>others.filter(c=>c.from===p.id||c.to===p.id).length>=p.capacity))return {ok:false,reason:'Разъём занят. Сначала отсоедини существующий кабель.'};
  const seen=new Set();
  function reaches(device) {
    if(device===from.device)return true;
    if(seen.has(device))return false;seen.add(device);
    return others.filter(c=>c.from&&c.to&&ROOM_PORT_MAP[c.from]?.device===device).some(c=>reaches(ROOM_PORT_MAP[c.to].device));
  }
  if(reaches(to.device))return {ok:false,reason:'Соединение создаёт замкнутую петлю сигнала.'};
  return {ok:true,from:from.id,to:to.id,note:ownerHigh?'REL: схема владельца HIGH LEVEL. Распайка XLR не проверена.':power&&to.connector!=='IEC'?`Питание через штатный адаптер: ${to.label}. Корпус БП показан условно.`:''};
}

export function restoreRoomCables(value) {
  if(!Array.isArray(value)||value.length>100)return structuredClone(DEFAULT_ROOM_CABLES);
  const result=[];const ids=new Set();
  for(const c of value) {
    if(!c||typeof c.id!=='string'||ids.has(c.id))continue;
    const from=ROOM_PORT_MAP[c.from],to=ROOM_PORT_MAP[c.to];
    if(c.from&& !from || c.to&& !to || !from&&!to)continue;
    if(from&&from.direction!=='out'||to&&to.direction!=='in')continue;
    if(from&&to&&!connectionCheck(c.from,c.to,result).ok)continue;
    if(!from||!to) {
      const p=from||to;if(result.filter(k=>k.from===p.id||k.to===p.id).length>=p.capacity)continue;
    }
    ids.add(c.id);result.push({id:c.id,from:c.from||null,to:c.to||null,fromType:from?.connector||c.fromType,toType:to?.connector||c.toType,loose:c.loose&&c.loose.length===3&&c.loose.every(Number.isFinite)?c.loose:undefined});
  }
  return result;
}

// C1 shape-preserving interpolation: avoids Catmull-Rom floor/shelf overshoot.
export function sampleDrape(knots,step=.009) {
  const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
  const p=knots.filter((v,i)=>!i||dist(v,knots[i-1])>1e-6);
  const h=p.slice(1).map((v,i)=>dist(v,p[i]));
  const slopes=h.map((v,i)=>p[i].map((n,a)=>(p[i+1][a]-n)/v));
  const tangents=p.map((_,i)=>i===0?slopes[0]:i===p.length-1?slopes.at(-1):[0,1,2].map(a=>{
    const l=slopes[i-1][a],r=slopes[i][a],w1=2*h[i]+h[i-1],w2=h[i]+2*h[i-1];
    return l*r<=0?0:(w1+w2)/(w1/l+w2/r);
  }));
  return [p[0],...h.flatMap((v,i)=>Array.from({length:Math.max(6,Math.ceil(v/step))},(_,j)=>{
    const t=(j+1)/Math.max(6,Math.ceil(v/step));
    return [0,1,2].map(a=>(2*t**3-3*t*t+1)*p[i][a]+(t**3-2*t*t+t)*v*tangents[i][a]+(-2*t**3+3*t*t)*p[i+1][a]+(t**3-t*t)*v*tangents[i+1][a]);
  }))];
}
export const toWeb=([x,y,z])=>[x,z,-y];
export function cablePaths(cable, layout) {
  if (layout) return placedCablePaths(cable, layout);
  const a=ROOM_PORT_MAP[cable.from],b=ROOM_PORT_MAP[cable.to],anchor=a||b;
  if(!anchor)return [];
  const speaker=anchor.signal==='speaker',power=anchor.signal==='power';
  const radius=power?(b&&b.connector!=='IEC'?.0025:.0045):speaker?.004:anchor.connector==='GROUND'?.0012:anchor.connector==='OPTICAL'?.002:.003;
  const high=(b?.connector||cable.toType)==='XLR_HIGH';
  const count=high?1:a&&b?Math.max(a.jacks.length,b.jacks.length):anchor.jacks.length;
  const paths=Array.from({length:count},(_,i)=>{
    const jack=(p)=>{const off=p.jacks[Math.min(i,p.jacks.length-1)];return [p.position[0]+off[0],p.position[1],p.position[2]+off[1]+(p.axis==='Z'?.045:0)];};
    const start=a?(high?[a.position[0],.31,a.position[2]]:jack(a)):cable.loose||[anchor.position[0]-.06,.43,Math.max(.02,anchor.position[2]-.18)];
    const end=b?jack(b):cable.loose||[anchor.position[0]+.06,.47,Math.max(.02,anchor.position[2]-.18)];
    let knots;
    if(power&&a&&b) {
      if(a.device==='pdu'){
        // Preserve the individually dressed arcs of the earlier Blender study.
        // Thin PSU leads follow the rear post; heavier IEC leads land in broad,
        // unequal floor returns instead of a repeated fan of parallel curves.
        const floor=.004+radius+.002;
        const drops={
          rusich:[[-.12,.46,.17],[-.10,.61,.063],[.08,.68,floor],[.37,.70,floor],[.72,.52,floor],[.74,.15,.019],[.62,-.065,.105]],
          bifrost:[[-.23,.42,.47],[-.18,.53,.29],[-.09,.59,.064],[.24,.61,floor],[.57,.55,floor],[.69,.37,.025],[.63,.085,.13]],
          a90:[[.05,.37,.45],[.18,.43,.24],[.38,.52,.058],[.54,.59,floor],[.72,.49,floor],[.76,.30,.052],[.65,.14,.176]],
          skoll:[[-.25,.42,.65],[-.24,.57,.38],[-.14,.72,.07],[.09,.77,floor],[.36,.73,floor],[.68,.62,.013],[.82,.41,.047],[.69,.22,.183]],
          wiim:[[.277,.31,.738],[.308,.322,.61],[.30,.338,.51],[.328,.345,.32],[.385,.44,.067],[.53,.53,floor],[.66,.43,.033],[.61,.29,.16]],
          e1:[[.24,.30,1.245],[.316,.326,1.17],[.324,.337,.985],[.303,.340,.815],[.324,.350,.63],[.326,.361,.38],[.36,.40,.083],[.46,.48,floor],[.60,.51,.028],[.64,.415,.118]],
        };
        const drop=drops[b.device]||[[end[0],.40,end[2]-.12],[end[0]+.08,.53,.35],[.30,.62,.04],[.62,.58,floor],[.79,.46,.06],[.68,.40,.15]];
        knots=[end,[end[0],end[1]+.05,end[2]],[end[0],.265,end[2]],...drop,[.515,start[1],start[2]+.058],[start[0],start[1],start[2]+.047],start].reverse();
      }else{
        const sign=start[0]<0?-1:1;
        knots=[start,[start[0],start[1],.17],[start[0]+sign*.16,.38,.065],[start[0]+sign*.17,.51,.013],[end[0],.5,.013],[end[0],.32,end[2]],[end[0],end[1]+.04,end[2]],end];
      }
    } else if(speaker&&a&&b) {
      const s=b.position[0]<0?-1:1,hi=b.connector==='XLR_HIGH',dy=i*.012;
      const lane=hi?.80:.61;
      knots=[start,[start[0],.29,start[2]],[start[0]+s*.045,.43,start[2]-.04],
        [s*.36,lane-.04+dy,.065],[s*.52,lane+dy,.014+radius],[s*.67,lane+.04+dy,hi?.030:.049],
        [s*.90,lane+.045+dy,.019],[s*1.07,lane-.01+dy,hi?.028:.052],
        [s*(hi?1.48:1.3),hi?.72+dy:.49+dy,.016+radius],
        [end[0]+s*.05,.35,end[2]-.035],[end[0],end[1]+.065,end[2]],end];
    } else {
      const lane=.41+i*.023,low=Math.max(.035,Math.min(start[2],end[2])-.13-i*.017);
      knots=[start,[start[0],Math.max(.08,start[1]+.05),start[2]],[start[0],.265,start[2]],
        [start[0]-.025,lane,Math.max(low+.025,start[2]-.075)],[(start[0]+end[0])/2,lane+.035,low],
        [end[0]+.020,lane+.012,Math.max(low+.02,end[2]-.075)],[end[0],.27,end[2]],
        [end[0],Math.max(.08,end[1]+.045),end[2]],end];
      if(!a)knots=knots.slice(0,1).concat(knots.slice(3));
      if(!b)knots=knots.slice(0,-3).concat([end]);
    }
    return {points:sampleDrape(knots),radius,color:i?'#292b2a':'#181b1c',start,end,startAxis:a?.axis||(cable.fromType==='SCHUKO'?'Z':'Y'),endAxis:b?.axis||'Y',adapter:power&&b&&b.connector!=='IEC',startPlug:!high,endPlug:true};
  });
  if(high&&a)for(const [i,[dx,dz]] of a.jacks.entries()){
    const start=[a.position[0]+dx,a.position[1],a.position[2]+dz],end=paths[0].start;
    paths.push({points:sampleDrape([start,[start[0],start[1]+.065,start[2]],end]),radius:.0018,color:i?'#222827':'#7c2820',start,end,startAxis:'Y',endAxis:'Y',startPlug:true,endPlug:false});
  }
  return paths;
}

// Physical layout only. Logical port IDs and the saved audio patch never change.
function placedCablePaths(cable, layout) {
  const a=layout.portMap[cable.from], b=layout.portMap[cable.to], anchor=a||b;
  if(!anchor || [a,b].some(p=>p&&!layout.devices[p.device].present))return [];
  const power=anchor.signal==='power', speaker=anchor.signal==='speaker', high=(b?.connector||cable.toType)==='XLR_HIGH';
  const radius=power?(b&&b.connector!=='IEC'?.0025:.0055):speaker?.004:anchor.signal==='ground'?.0012:anchor.connector==='OPTICAL'?.002:.003;
  const count=high?1:a&&b?Math.max(a.jacks.length,b.jacks.length):anchor.jacks.length;
  const salt=[...cable.id].reduce((n,c)=>n+c.charCodeAt(0),0)%7;
  const rear=layout.rear + (power?.19:speaker?.10:.025) + salt*.008;
  const paths=Array.from({length:count},(_,i)=>{
    const jack=p=>{const off=p.jacks[Math.min(i,p.jacks.length-1)];return [p.position[0]+off[0],p.position[1],p.position[2]+off[1]+(p.axis==='Z'?.045:0)];};
    const loose=[anchor.position[0]+.07,rear,Math.max(.045,anchor.position[2]-.16)];
    const start=a?(high?[a.position[0],a.position[1]+.10,a.position[2]]:jack(a)):loose;
    const end=b?jack(b):loose;
    // Clear the shelf edge before allowing the jacket to sag. Long horizontal
    // beams look weightless; the bend below is outside the furniture envelope.
    const edge=p=>[p[0],Math.max(p[1]+.06,layout.rear-.075),p[2]];
    const escape=p=>[p[0]+.012*(i?1:-1),rear+i*.016,Math.max(.045,p[2]-.055)];
    const egress=p=>{
      const points=[p];
      const blockers=(layout.posts||[]).filter(post=>p[2]<post.top+radius&&post.y>p[1]&&post.y<edge(p)[1]&&Math.abs(post.x-p[0])<post.radius+radius+.012).sort((a,b)=>a.y-b.y);
      for(const post of blockers) {
        const clearance=post.radius+radius+.018,side=p[0]<post.x?-1:1, bx=post.x+side*clearance;
        points.push([p[0],Math.max(p[1],post.y-clearance-.025),p[2]],[bx,post.y-clearance-.005,p[2]],[bx,post.y+clearance+.015,p[2]],[p[0],post.y+clearance+.045,p[2]]);
      }
      return [...points,edge(p),escape(p)];
    };
    let knots, supports=[];
    if(speaker&&a&&b) {
      const lane=rear+i*.018, s=end[0]<0?-1:1;
      const low=.013+radius;
      const x1=start[0]+s*.14, x2=end[0]-s*.12, span=x2-x1;
      supports=[.30,.72].map(t=>[x1+span*t,lane,.039]);
      knots=[...egress(start),[x1,lane,.10],
        [x1,lane,low],supports[0],[x1+span*.52,lane+.015,low],supports[1],[x2,lane,low],
        ...egress(end).reverse()];
    } else if(power&&a&&b) {
      const lane=rear+i*.014, floor=.009+radius;
      knots=[start,[start[0],start[1],start[2]+.07],[start[0]+.065,lane,.15],
        [start[0]+.09,lane,floor],[(start[0]+end[0])/2,lane+.025,floor],
        [end[0]+.06,lane,floor],[end[0],lane,Math.max(.11,end[2]-.13)],...egress(end).reverse()];
    } else {
      const low=Math.max(.035,Math.min(start[2],end[2])-.10-i*.016);
      knots=[...egress(start),
        [start[0]-.025,rear+.04,Math.max(low,start[2]-.08)],
        [(start[0]+end[0])/2,rear+.07,low],
        [end[0]+.025,rear+.04,Math.max(low,end[2]-.08)],...egress(end).reverse()];
    }
    return {points:sampleDrape(knots),radius,color:i?'#30302b':'#161b1c',start,end,startAxis:a?.axis||'Y',endAxis:b?.axis||'Y',adapter:power&&b&&b.connector!=='IEC',startPlug:!high,endPlug:true,supports};
  });
  if(high&&a)for(const [i,[dx,dz]] of a.jacks.entries()){
    const start=[a.position[0]+dx,a.position[1],a.position[2]+dz],end=paths[0].start;
    paths.push({points:sampleDrape([start,[start[0],start[1]+.055,start[2]],end]),radius:.0018,color:i?'#222827':'#7c2820',start,end,startAxis:'Y',endAxis:'Y',startPlug:true,endPlug:false,supports:[]});
  }
  return paths;
}

export function roomPreset(name) {
  const cables=structuredClone(DEFAULT_ROOM_CABLES);
  if(name==='a90')return cables;
  return [...cables.map(c=>c.id==='phono'?{...c,to:'freya.rca3'}:c.id==='dac'?{...c,from:name==='warmer'?'warmer.xlrOut':'bifrost.xlrOut',to:'freya.xlr1'}:c.id==='pre'?{...c,from:'freya.rcaOut1'}:c.id==='digital'?{...c,to:name==='warmer'?'warmer.opt':'bifrost.opt'}:c),{id:'power-freya',from:'pdu.7',to:'freya.power'},...(name==='warmer'?[{id:'power-warmer',from:'pdu.8',to:'warmer.power'}]:[])].map(c=>({...c,fromType:ROOM_PORT_MAP[c.from].connector,toType:ROOM_PORT_MAP[c.to].connector}));
}
