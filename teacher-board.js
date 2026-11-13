/* MALI teachers v1: optional anonymous profiles and evidence-backed lesson credits.
   Public records: nickname + minimal credit receipts. Raw lessons remain private.
   Teacher XP is separate from Tamagotchi room XP. */
(function(){
  'use strict';
  const NICK_KEY='mali-teacher-nickname-v1';
  const QUEUE_KEY='mali-teacher-pending-credits-v1';
  const SKIP_KEY='mali-teacher-skip-until-v1';
  const POINTS={color:5,route:10,help:30};
  let nickname='',uid='',db=null,database=null,ready=false,flushing=false,open=false;
  let pending=[],period='week',profiles={},credits={},error='';
  try{nickname=localStorage.getItem(NICK_KEY)||'';}catch(_){}
  try{
    const prev=JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]');
    if(Array.isArray(prev))pending=prev.filter(v=>v&&POINTS[v.kind]&&typeof v.id==='string').slice(-300);
  }catch(_){}
  function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function saveQueue(){try{localStorage.setItem(QUEUE_KEY,JSON.stringify(pending));}catch(_){}}
  function validNick(v){return /^[A-Za-z0-9_čćđšžČĆĐŠŽ-]{3,20}$/.test(v);}
  const button=document.createElement('button');
  button.id='ml-teachers-button';button.type='button';button.textContent='🏆 Teachers';
  button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','ml-teachers-dialog');
  const cover=document.createElement('div');
  cover.id='ml-teachers-cover';cover.hidden=true;
  cover.innerHTML='<section id="ml-teachers-dialog" class="ml-teachers-card" role="dialog" aria-modal="true" aria-label="Mali’s Teachers">'+
    '<div class="ml-teachers-head"><strong>🏆 Mali’s Teachers</strong><button type="button" data-t-action="close" aria-label="Close">✕</button></div>'+
    '<div id="ml-teachers-content"></div></section>';
  document.body.appendChild(button);document.body.appendChild(cover);
  button.addEventListener('click',()=>show());
  cover.addEventListener('click',e=>{if(e.target===cover)hide();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&open)hide();});
  function hide(){open=false;cover.hidden=true;button.focus();}
  function show(mode){open=true;cover.hidden=false;render(mode||(!nickname?'profile':'board'));const f=cover.querySelector('input');if(f)f.focus();}
  function localMessage(){return error||(!ready?'Connecting to Firebase; your nickname can be saved locally.':'');}
  function render(mode){
    const dst=document.getElementById('ml-teachers-content');
    if(!dst)return;
    if(mode==='profile'||!nickname){
      dst.innerHTML='<p>🐶 Hi! What should I call you? Your nickname will appear on the leaderboard.</p>'+
        '<form id="ml-teachers-form"><label for="ml-teachers-nick">Nickname (3–20 characters)</label>'+
        '<input id="ml-teachers-nick" name="nickname" maxlength="20" autocomplete="nickname" value="'+esc(nickname)+'" required>'+
        '<p class="ml-t-note">Letters, numbers, _ and -. No email or real name. Nicknames do not have to be unique.</p>'+ 
        '<p class="ml-t-note">For private administration we estimate your country from your internet connection. We do not save your full IP address in Mali. Only the site owner can read country statistics.</p>'+
        '<button type="submit" class="ml-t-primary">Save nickname</button> '+
        '<button type="button" data-t-action="skip">Not now</button></form>'+
        '<p class="ml-t-note" role="status">'+esc(localMessage())+'</p>';
      return;
    }
    const rows=makeRows(period);
    const yours=rows.findIndex(r=>r.uid===uid);
    dst.innerHTML='<p class="ml-t-note">Hello, <b>'+esc(nickname)+'</b>! Points are awarded for lessons successfully uploaded to Firebase.</p>'+
      '<div class="ml-t-tabs"><button type="button" data-t-period="week" aria-pressed="'+(period==='week')+'">Week</button>'+
      '<button type="button" data-t-period="month" aria-pressed="'+(period==='month')+'">Month</button>'+
      '<button type="button" data-t-period="all" aria-pressed="'+(period==='all')+'">All time</button></div>'+
      (rows.length?'<ol class="ml-t-ranking">'+rows.slice(0,50).map((r,i)=>
          '<li><span class="ml-t-rank">'+(i+1)+'.</span><span>'+esc(r.nick)+(r.uid===uid?' (you)':'')+'</span><strong>'+r.xp+' XP</strong></li>').join('')+'</ol>'
        :'<p>No verified lessons for this period yet.</p>')+
      '<p class="ml-t-note">'+(yours>=0?'Your rank: '+(yours+1)+'. · '+rows[yours].xp+' XP':'You have no points this period yet.')+'</p>'+
      '<p class="ml-t-note">Maze +10 · Help +30 · Color +5. Only nicknames and points are public.</p><p class="ml-t-note">Country is estimated from your connection and saved privately for the site owner, without storing your full IP in Mali.</p>'+
      (pending.length?'<p class="ml-t-note">'+pending.length+' lessons awaiting point confirmation.</p>':'')+
      '<p class="ml-t-note" role="status">'+esc(localMessage())+'</p>'+
      '<button type="button" data-t-action="refresh">Refresh</button> <button type="button" data-t-action="edit">Edit nickname</button>';
  }
  function makeRows(which){
    const now=new Date(),year=now.getFullYear(),month=now.getMonth();
    const startMonth=new Date(year,month,1).getTime();
    const dow=(now.getDay()+6)%7;
    const week=new Date(year,month,now.getDate()-dow).getTime();
    const cutoff=which==='week'?week:which==='month'?startMonth:0;
    return Object.keys(profiles).map(id=>{
      const all=credits[id]||{};
      const events=Object.values(all).filter(v=>v&&typeof v.points==='number'&&typeof v.created_at==='number'&&v.created_at>=cutoff);
      return {uid:id,nick:String(profiles[id]?.nickname||'Teacher').slice(0,20),xp:events.reduce((n,v)=>n+v.points,0)};
    }).filter(r=>r.xp>0).sort((a,b)=>b.xp-a.xp||a.nick.localeCompare(b.nick,'hr'));
  }
  async function loadBoard(){
    if(!ready)return;
    try{
      const [p,c]=await Promise.all([
        db.get(db.ref(database,'teacherProfiles/v1')),
        db.get(db.ref(database,'teacherCredits/v1'))
      ]);
      profiles=p.val()||{};credits=c.val()||{};
      if(!pending.length)error='';
    }catch(e){error='The leaderboard is not available yet. Check Firebase rules.';}
    if(open)render('board');
  }
  async function recoverUploadedCredits(){
    if(!ready)return;
    // Only existing *server-side* lessons may earn credits; this also restores
    // previously uploaded lessons from before the leaderboard existed.
    const paths=[
      ['color','colorLessons/v1/'+uid],
      ['route','navigationLessons/v1/'+uid],
      ['help','navigationCorrections/v1/'+uid]
    ];
    try{
      const [receipts,...sources]=await Promise.all([
        db.get(db.ref(database,'teacherCredits/v1/'+uid)),
        ...paths.map(p=>db.get(db.ref(database,p[1])))
      ]);
      const awarded=receipts.val()||{};
      const valid=new Map();
      sources.forEach((snapshot,i)=>{
        const kind=paths[i][0],all=snapshot.val()||{};
        Object.keys(all).slice(-250).forEach(id=>{
          if(typeof id==='string'&&id.length<=75&&POINTS[kind])
            valid.set(kind+'|'+id,{kind,id});
        });
      });
      pending=pending.filter(v=>valid.has(v.kind+'|'+v.id)&&!awarded[v.id]);
      const queued=new Set(pending.map(v=>v.kind+'|'+v.id));
      for(const [key,item] of valid){
        if(!awarded[item.id]&&!queued.has(key)){pending.push(item);queued.add(key);}
      }
      pending=pending.slice(-300);
      saveQueue();
    }catch(e){
      error='Unable to check older lessons. Check Firebase permissions and connection.';
    }
  }
  async function saveProfile(){
    if(!ready||!nickname)return;
    try{
      await db.set(db.ref(database,'teacherProfiles/v1/'+uid),{
        nickname,updated_at:db.serverTimestamp()
      });
      error='';profiles[uid]={nickname};
      await flush();await loadBoard();
    }catch(e){error='Nickname saved on this device only. Publish Firebase rules to enable the shared leaderboard.';}
    if(open)render('board');
  }
  function credit(kind,id){
    if(!POINTS[kind]||typeof id!=='string'||id.length>75)return;
    if(!pending.some(v=>v.id===id))pending.push({kind,id});
    pending=pending.slice(-300);saveQueue();void flush();
  }
  async function flush(){
    if(!ready||!nickname||flushing||!pending.length)return;
    flushing=true;
    try{
      // Keep credits one-to-one with already uploaded Firebase lessons.
      for(let i=0;i<Math.min(20,pending.length);){
        const item=pending[i];
        try{
          const path='teacherCredits/v1/'+uid+'/'+item.id;
          // Retry-safe: if an earlier write succeeded but acknowledgement was lost,
          // the receipt already exists; never award it twice.
          const existing=await db.get(db.ref(database,path));
          if(!existing.exists()){
            await db.set(db.ref(database,path),{
              kind:item.kind,points:POINTS[item.kind],created_at:db.serverTimestamp()
            });
          }
          pending.splice(i,1);saveQueue();
        }catch(e){error='Points are waiting for Firebase rules or a connection.';break;}
      }
    }finally{
      flushing=false;
      if(!pending.length&&ready){
        error='';
        void loadBoard();
      }else if(open)render('board');
    }
  }
  cover.addEventListener('click',e=>{
    const action=e.target.closest('[data-t-action]')?.getAttribute('data-t-action');
    const next=e.target.closest('[data-t-period]')?.getAttribute('data-t-period');
    if(next){period=next;render('board');return;}
    if(action==='close'){hide();return;}
    if(action==='skip'){
      try{localStorage.setItem(SKIP_KEY,String(Date.now()+7*86400000));}catch(_){}
      hide();return;
    }
    if(action==='edit'){render('profile');return;}
    if(action==='refresh'){void (async()=>{await recoverUploadedCredits();await flush();await loadBoard();})();return;}
  });
  cover.addEventListener('submit',e=>{
    if(e.target.id!=='ml-teachers-form')return;
    e.preventDefault();
    const n=document.getElementById('ml-teachers-nick')?.value.trim()||'';
    if(!validNick(n)){alert('Nickname must have 3–20 characters: letters, numbers, _ or -.');return;}
    nickname=n;
    window.dispatchEvent(new Event('mali:nickname-changed'));
    try{localStorage.setItem(NICK_KEY,n);}catch(_){}
    render('board');void saveProfile();
  });
  window.MaliTeachers={credit,open:()=>show(),refresh:loadBoard,nickname:()=>nickname};
  if(!nickname){
    let until=0;try{until=Number(localStorage.getItem(SKIP_KEY)||0);}catch(_){}
    if(Date.now()>until)show('profile');
  }
  (async()=>{
    try{
      const connection=await window.MaliCloud?.whenReady?.();
      if(!connection)throw Error('MaliCloud identity unavailable');
      uid=connection.userId;db=connection.sdk;database=connection.database;ready=true;
      try{
        const current=await db.get(db.ref(database,'teacherProfiles/v1/'+uid));
        if(current.exists()&&validNick(current.val()?.nickname)){
          nickname=current.val().nickname;
          window.dispatchEvent(new Event('mali:nickname-changed'));
          try{localStorage.setItem(NICK_KEY,nickname);}catch(_){}
        }else if(nickname){await saveProfile();}
      }catch(_){
        // Existing rules may deny the read before the teacher rollout.
        // Retry profile creation next time this version loads.
        if(nickname)await saveProfile();
      }
      await recoverUploadedCredits();
      await flush();await loadBoard();
      if(open)render(!nickname?'profile':'board');
    }catch(e){
      error='Firebase is currently unavailable. Your nickname stays on this device.';
      if(open)render(!nickname?'profile':'board');
    }
  })();
})();
