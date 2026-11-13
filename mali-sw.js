/* Mali's service worker: notification display and click only, no stale content caching. */
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const all=await clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of all){
      if(client.url.includes(self.registration.scope)){
        await client.focus();
        return;
      }
    }
    await clients.openWindow('./');
  })());
});
self.addEventListener('push',event=>{
  // Future server-push backend can send a payload here.
  let payload={title:'MALI',body:'Hey Teacher, please put me to sleep!'};
  try{if(event.data)payload={...payload,...event.data.json()};}catch(_){}
  event.waitUntil(self.registration.showNotification(payload.title,{
    body:payload.body,tag:'mali-low-energy',icon:'./mali-icon.svg'
  }));
});