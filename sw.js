/* Network first, so a new version shows up the next time the app opens online; the cache is only for offline use. */
const C='daylog-v1';
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(['./','manifest.webmanifest','icon-192.png','icon-512.png'])).catch(()=>{}));});
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
/* A reminder nudge from the server carries no text. Everything shown is worked out here, from the plan the app saved on this phone. */
const DATA='daylog-data';
async function readJ(n){try{const c=await caches.open(DATA),r=await c.match(n);return r?await r.json():null;}catch(e){return null;}}
async function writeJ(n,o){try{const c=await caches.open(DATA);await c.put(n,new Response(JSON.stringify(o),{headers:{'Content-Type':'application/json'}}));}catch(e){}}
const pad=n=>String(n).padStart(2,'0');
const mm=t=>{const p=t.split(':');return +p[0]*60+ +p[1];};
const fmt=t=>{const p=t.split(':'),h=+p[0];return ((h+11)%12+1)+':'+p[1]+(h<12?' AM':' PM');};
const dur=m=>m>=60?Math.floor(m/60)+'h '+pad(m%60)+'m':m+'m';
const hit=(nm,m)=>nm>=m-1&&nm<=m+4;
const nowParts=()=>{const n=new Date();return {k:n.getFullYear()+'-'+pad(n.getMonth()+1)+'-'+pad(n.getDate()),nm:n.getHours()*60+n.getMinutes()};};
const RING=[];for(let i=0;i<16;i++)RING.push(900,400); /* about 20 seconds of long buzzes, like an incoming call */
const SHORT=[300,150,300];
const BASE={icon:'icon-192.png',badge:'icon-192.png',renotify:true,silent:false};
const ACTS=[{action:'done',title:'Done'},{action:'snooze',title:'Snooze 10 min'}];
self.addEventListener('push',e=>e.waitUntil((async()=>{
  const d=await readJ('reminders.json'),p=nowParts(),k=p.k,nm=p.nm,all=(d&&d.days&&d.days[k])||[],out=[];
  const sh=(await readJ('shown.json'))||{},tags=sh.k===k&&Array.isArray(sh.tags)?sh.tags:[]; /* what has already been shown today */
  const open=all.filter(t=>!t.st&&t.from&&t.to).sort((a,b)=>a.from<b.from?-1:1);
  const cur=open.find(t=>mm(t.from)<=nm&&nm<mm(t.to)),nx=open.find(t=>mm(t.from)>nm);
  const ctx=[cur?'Now: '+cur.text+' · '+dur(mm(cur.to)-nm)+' left':'',nx?'Next: '+nx.text+' at '+fmt(nx.from)+' · in '+dur(mm(nx.from)-nm):''].filter(Boolean).join(String.fromCharCode(10));
  const start=t=>({body:ctx||fmt(t.from)+(t.to?' to '+fmt(t.to):''),tag:'daylog-'+k+'-'+t.id,vibrate:RING,requireInteraction:true,actions:ACTS,data:{k:k,id:t.id}});
  ((d&&d.snooze)||[]).forEach(z=>{if(z.k!==k||!hit(nm,mm(z.at)))return;const t=all.find(x=>x.id===z.id);if(t&&!t.st){out.push(['Snoozed: '+t.text,start(t),true]);z.fired=true;}});
  all.forEach(t=>{if(!t.st&&t.from&&hit(nm,mm(t.from)-(t.lead||0)))out.push([mm(t.from)>nm?t.text+' starts at '+fmt(t.from):t.text+(t.to?' until '+fmt(t.to):''),start(t)]);});
  if(d&&d.over)all.forEach(t=>{if(!t.st&&t.to&&nm>=mm(t.to)&&nm<=mm(t.to)+4)out.push([t.text+' should be finished',{body:'It was planned to end at '+fmt(t.to)+'. Mark it done, or snooze.',tag:'daylog-over-'+k+'-'+t.id,vibrate:SHORT,actions:ACTS,data:{k:k,id:t.id}}]);});
  ((d&&d.habits)||[]).forEach(hb=>{
    const cnt=(d.hdone&&d.hdone[k]&&d.hdone[k][hb.id])||0;
    if(hb.at&&cnt<hb.goal&&hit(nm,mm(hb.at)))out.push([hb.name,{body:hb.goal>1?cnt+' of '+hb.goal+' so far today':'Habit reminder',tag:'daylog-h-'+k+'-'+hb.id,vibrate:RING,requireInteraction:true,actions:[{action:'done',title:hb.goal>1?'Add one':'Done'}],data:{k:k,id:hb.id,h:true}}]);
  });
  if(d&&d.wrap&&all.length&&hit(nm,mm(d.wrap))){
    const cnt=all.filter(t=>t.st!=='s'),dn=cnt.filter(t=>t.st==='d').length,left=all.filter(t=>!t.st);
    out.push(['Today: '+dn+' of '+cnt.length+' done'+(cnt.length?' ('+Math.round(dn/cnt.length*100)+'%)':''),{body:left.length?'Not marked: '+left.slice(0,6).map(t=>t.text).join(', ')+(left.length>6?' and '+(left.length-6)+' more':''):'Everything is marked. Nice work.',tag:'daylog-wrap-'+k,vibrate:SHORT}]);
  }
  const seen={},list=out.filter(x=>(x[2]||tags.indexOf(x[1].tag)<0)&&(seen[x[1].tag]?false:(seen[x[1].tag]=true)));
  if(list.length)await writeJ('shown.json',{k:k,tags:tags.concat(list.map(x=>x[1].tag)).filter((x,i,a)=>a.indexOf(x)===i)});
  if(d&&d.snooze&&d.snooze.some(z=>z.fired)){d.snooze=d.snooze.filter(z=>!z.fired);await writeJ('reminders.json',d);}
  if(!list.length)return self.registration.showNotification('Daylog',Object.assign({body:'Time to check your schedule.',tag:'daylog-generic',vibrate:SHORT},BASE));
  await Promise.all(list.map(x=>self.registration.showNotification(x[0],Object.assign(x[1],BASE))));
})()));
self.addEventListener('notificationclick',e=>{
  const a=e.action,dt=e.notification.data;e.notification.close();
  if(a==='done'&&dt&&dt.h)return e.waitUntil((async()=>{
    const d=await readJ('reminders.json');
    if(d){d.hdone=d.hdone||{};d.hdone[dt.k]=d.hdone[dt.k]||{};d.hdone[dt.k][dt.id]=(d.hdone[dt.k][dt.id]||0)+1;await writeJ('reminders.json',d);}
    const q=(await readJ('actions.json'))||[];q.push({type:'habit',k:dt.k,id:dt.id,at:Date.now()});await writeJ('actions.json',q);
  })());
  if(a==='done'&&dt)return e.waitUntil((async()=>{
    const d=await readJ('reminders.json');
    if(d&&d.days&&d.days[dt.k]){const t=d.days[dt.k].find(x=>x.id===dt.id);if(t)t.st='d';await writeJ('reminders.json',d);}
    const q=(await readJ('actions.json'))||[];q.push({type:'done',k:dt.k,id:dt.id,at:Date.now()});await writeJ('actions.json',q);
  })());
  if(a==='snooze'&&dt)return e.waitUntil((async()=>{
    const d=await readJ('reminders.json');if(!d)return;
    const n=new Date(Date.now()+10*60000),p=nowParts();if(n.getDate()!==new Date().getDate())return;
    const at=pad(n.getHours())+':'+pad(n.getMinutes());
    d.snooze=(d.snooze||[]).filter(z=>!(z.k===p.k&&z.id===dt.id)).concat({k:p.k,id:dt.id,at:at});
    if(d.server&&d.server.url&&d.server.body){
      const body=d.server.body;body.dates=body.dates||{};body.dates[p.k]=(body.dates[p.k]||[]).concat(at);
      try{await fetch(d.server.url+'/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});}catch(x){}
    }
    await writeJ('reminders.json',d);
  })());
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{for(const c of cs)if('focus' in c)return c.focus();return self.clients.openWindow('./');}));
});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(fetch(e.request).then(r=>{if(r&&(r.ok||r.type==='opaque')){const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp)).catch(()=>{});}return r;})
    .catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||(e.request.mode==='navigate'?caches.match('./'):Response.error()))));
});
