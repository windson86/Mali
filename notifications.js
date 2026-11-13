/* Low-energy browser notification. No auto-prompts; user's explicit opt-in is required.
   This is a local Web Notifications implementation. A server push service is needed to
   notify reliably when all browser processes have been closed. */
(function(){
  'use strict';
  const KEY='mali-energy-warning-shown-v1';
  let shown=false;
  try{shown=localStorage.getItem(KEY)==='1';}catch(_){}
  const supported='Notification' in window;
  let workerPromise=null;
  function worker(){
    if(!('serviceWorker' in navigator))return Promise.resolve(null);
    if(!workerPromise)workerPromise=navigator.serviceWorker.register('./mali-sw.js').then(()=>navigator.serviceWorker.ready).catch(()=>null);
    return workerPromise;
  }
  async function show(){
    const title='MALI';
    const options={body:'Hey Teacher, please put me to sleep!',tag:'mali-low-energy',
      icon:'./mali-icon.svg',badge:'./mali-icon.svg',renotify:false};
    const registration=await worker();
    if(registration && registration.showNotification){
      await registration.showNotification(title,options);
    }else new Notification(title,options);
  }
  async function check(state){
    if(!state||!supported)return;
    if(state.energy>=30 && state.sleep && shown){
      shown=false;try{localStorage.removeItem(KEY);}catch(_){}
    }
    if(state.energy>10||state.sleep||shown||Notification.permission!=='granted')return;
    try{
      await show();shown=true;try{localStorage.setItem(KEY,'1');}catch(_){}
    }catch(e){console.warn('Mali notification unavailable:',e);}
  }
  async function enable(state){
    if(!supported)return;
    const permission=await Notification.requestPermission();
    const button=document.getElementById('notifications');
    if(button)button.textContent=permission==='granted'?'Alerts enabled':'Enable alerts';
    if(permission==='granted'){await worker();await check(state);}
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const btn=document.getElementById('notifications');
    if(btn&&supported&&Notification.permission==='granted')btn.textContent='Alerts enabled';
  });
  window.MaliAlerts={check,enable};
})();