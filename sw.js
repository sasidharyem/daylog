/* Network first, so a new version shows up the next time the app opens online; the cache is only for offline use. */
const C='daylog-v1';
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(['./','manifest.webmanifest','icon-192.png','icon-512.png'])).catch(()=>{}));});
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
/* A reminder nudge carries no text. Look up what starts now in the plan the app saved on this phone. */
self.addEventListener('push',e=>e.waitUntil((async()=>{
  let d=null;try{const c=await caches.open('daylog-data'),r=await c.match('reminders.json');if(r)d=await r.json();}catch(x){}
  const now=new Date(),pad=n=>String(n).padStart(2,'0'),k=now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate()),nm=now.getHours()*60+now.getMinutes();
  const lead=(d&&d.lead)||0,list=((d&&d.days&&d.days[k])||[]).filter(t=>{if(t.closed)return false;const p=t.from.split(':'),m=+p[0]*60+ +p[1]-lead;return nm>=m-1&&nm<=m+4;});
  const fmt=t=>{const p=t.split(':'),h=+p[0];return ((h+11)%12+1)+':'+p[1]+(h<12?' AM':' PM');};
  const RING=[];for(let i=0;i<16;i++)RING.push(900,400); /* about 20 seconds of long buzzes, like an incoming call */
  const opt={icon:'icon-192.png',badge:'icon-192.png',vibrate:RING,renotify:true,silent:false,requireInteraction:true};
  if(!list.length)return self.registration.showNotification('Daylog',Object.assign({body:'Time to check your schedule.',tag:'daylog-generic'},opt));
  /* Same "Now" and "Next" lines as the banner at the top of the task list. */
  const mm=t=>{const p=t.split(':');return +p[0]*60+ +p[1];},dur=m=>m>=60?Math.floor(m/60)+'h '+pad(m%60)+'m':m+'m';
  const open=((d.days[k])||[]).filter(t=>!t.closed&&t.to).sort((a,b)=>a.from<b.from?-1:1);
  const cur=open.find(t=>mm(t.from)<=nm&&nm<mm(t.to)),nx=open.find(t=>mm(t.from)>nm);
  const body=[cur?'Now: '+cur.text+' · '+dur(mm(cur.to)-nm)+' left':'',nx?'Next: '+nx.text+' at '+fmt(nx.from)+' · in '+dur(mm(nx.from)-nm):''].filter(Boolean).join(String.fromCharCode(10));
  await Promise.all(list.map(t=>self.registration.showNotification(mm(t.from)>nm?t.text+' starts at '+fmt(t.from):t.text+(t.to?' until '+fmt(t.to):''),Object.assign({body:body||fmt(t.from)+(t.to?' to '+fmt(t.to):''),tag:'daylog-'+k+'-'+t.id},opt))));
})()));
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{for(const c of cs)if('focus' in c)return c.focus();return self.clients.openWindow('./');}));});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(fetch(e.request).then(r=>{if(r&&(r.ok||r.type==='opaque')){const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp)).catch(()=>{});}return r;})
    .catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||(e.request.mode==='navigate'?caches.match('./'):Response.error()))));
});
