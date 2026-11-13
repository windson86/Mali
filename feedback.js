/* Send a short, anonymous issue report to Firebase. It is never shown publicly.
   Maximum 3 submissions per UTC day in the normal game. No email, IP or GPS.
   Client-side limits cannot prevent determined abuse; server rules cap record size. */
(function(){
  'use strict';
  const launcher=document.createElement('button');
  launcher.id='ml-feedback-open';
  launcher.type='button';
  launcher.textContent='🐞 Report a problem';
  launcher.setAttribute('aria-haspopup','dialog');
  const cover=document.createElement('div');
  cover.id='ml-feedback-cover';
  cover.hidden=true;
  cover.innerHTML='<section class="ml-feedback-panel" role="dialog" aria-modal="true" aria-labelledby="ml-feedback-title">'+
    '<div class="ml-feedback-heading"><h2 id="ml-feedback-title">🐞 Help improve Mali</h2><button type="button" id="ml-feedback-close" aria-label="Close">✕</button></div>'+
    '<form id="ml-feedback-form">'+
    '<label for="ml-feedback-type">What would you like to report?</label>'+
    '<select id="ml-feedback-type" required><option value="bug">Something is broken</option><option value="suggestion">I have an idea</option><option value="other">Other feedback</option></select>'+
    '<label for="ml-feedback-area">Where did it happen?</label>'+
    '<select id="ml-feedback-area" required><option value="room">Mali’s room</option><option value="colors">Learning colors</option><option value="maze">Maze</option><option value="other">Other</option></select>'+
    '<label for="ml-feedback-text">Tell us what happened</label>'+
    '<textarea id="ml-feedback-text" minlength="10" maxlength="500" rows="5" placeholder="What did you try? What happened instead?" required></textarea>'+
    '<p class="ml-feedback-note">Do not include your name, email, phone number or other private details. Only the owner can read your message. Up to 3 reports per day; no reply is sent automatically.</p>'+
    '<button class="ml-feedback-submit" id="ml-feedback-submit" type="submit">Send report</button></form>'+
    '<p id="ml-feedback-status" aria-live="polite" role="status"></p></section>';
  document.body.append(launcher,cover);
  const form=cover.querySelector('#ml-feedback-form');
  const status=cover.querySelector('#ml-feedback-status');
  const submit=cover.querySelector('#ml-feedback-submit');
  let previousFocus=null;
  function close(){
    cover.hidden=true;
    launcher.focus();
  }
  launcher.addEventListener('click',()=>{
    previousFocus=document.activeElement;
    form.hidden=false;form.reset();status.textContent='';
    cover.hidden=false;cover.querySelector('#ml-feedback-type').focus();
  });
  cover.querySelector('#ml-feedback-close').addEventListener('click',close);
  cover.addEventListener('click',e=>{if(e.target===cover)close();});
  cover.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();close();}
    // Keep keyboard focus inside the active dialog.
    if(e.key==='Tab'){
      const focusable=[...cover.querySelectorAll('button:not([disabled]),select:not([disabled]),textarea:not([disabled])')].filter(n=>!n.closest('[hidden]'));
      if(!focusable.length)return;
      const first=focusable[0],last=focusable[focusable.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  });
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    if(submit.disabled)return;
    const message=cover.querySelector('#ml-feedback-text').value.trim();
    if(message.length<10||message.length>500){status.textContent='Please write between 10 and 500 characters.';return;}
    submit.disabled=true;status.textContent='Sending…';
    try{
      const identity=await window.MaliCloud?.whenReady?.();
      if(!identity?.sdk||!identity?.database||!identity?.userId)throw Error('not-connected');
      const sdk=identity.sdk;
      const day=new Date().toISOString().slice(0,10);
      const rawNick=String(window.MaliTeachers?.nickname?.()||'Teacher').trim();
      const nickname=/^[A-Za-z0-9_čćđšžČĆĐŠŽ-]{3,20}$/.test(rawNick)?rawNick:'Teacher';
      const device=window.matchMedia?.('(pointer:coarse)')?.matches?'mobile':'desktop';
      const report={
        category:cover.querySelector('#ml-feedback-type').value,
        area:cover.querySelector('#ml-feedback-area').value,
        message,nickname,device,status:'new',created_at:sdk.serverTimestamp()
      };
      let sent=false;
      // Security rules permit create-only records and users cannot read reports.
      for(let slot=1;slot<=3;slot++){
        try{
          await sdk.set(sdk.ref(identity.database,'userReports/v1/'+identity.userId+'/'+day+'-'+slot),report);
          sent=true;break;
        }catch(_){}
      }
      if(!sent)throw Error('unavailable-or-limit');
      form.hidden=true;
      status.textContent='✅ Thank you! Your report was sent to the Mali team.';
    }catch(error){
      status.textContent=error.message==='not-connected'?'Could not connect to Mali. Try again when online.':
        'Could not send. You may have sent 3 reports today, or reporting is temporarily unavailable.';
    }finally{submit.disabled=false;}
  });
}());
