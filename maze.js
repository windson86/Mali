/* MALI — 8x8 spatial lessons, learned moves come only from users. */
(function () {
  'use strict';
  let N=8, START=[0,7], GOAL=[7,0]; const KEY='mali-navigation-lessons-v1';
  const DIR={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
  let world=null, ctx=null, saved=[], autoTimer=null;
  const SWIPE_MIN_PX=10;
  const KEY_TO_DIR={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',
    w:'up',s:'down',a:'left',d:'right'};
  let held=null,holdTimer=null,swipeStart=null,pointerButton=null;
  // A swipe is always one grid step. Diagonals take their dominant axis.
  function swipeDirection(dx,dy){
    if(Math.hypot(dx,dy)<SWIPE_MIN_PX)return null;
    if(Math.abs(dx)>=Math.abs(dy))return dx<0?'left':'right';
    return dy<0?'up':'down';
  }
  function stopHold(){
    if(holdTimer!==null){clearInterval(holdTimer);holdTimer=null;}
    held=null;
  }
  function startHold(direction,source){
    stopHold();
    if(!world||world.done||world.autoRunning||world.autoRequested||
       !el('ml-board')||el('overlay').hidden)return;
    held=source;
    // The first step is immediate; stop repeated motion at unknown walls.
    if(!move(direction,false)){stopHold();return;}
    holdTimer=setInterval(()=>{
      if(!held||!el('ml-board')||el('overlay').hidden||!move(direction,false))stopHold();
    },280);
  }
  function stopAuto(){
    if(autoTimer!==null){clearInterval(autoTimer);autoTimer=null;}
    if(world)world.autoRunning=false;
  }
  function controlsState(){
    if(!world||!el('ml-controlslot'))return;
    el('ml-controlslot').innerHTML=world.done?resultHtml():controlsHtml();
  }
  function detectCycle(states,repeats){
    // 'states' contains the initial position and one result for each AI decision.
    // A cycle is accepted only after the same ordered states recur 'repeats' times.
    for(let len=2;len<=Math.min(24,Math.floor((states.length-1)/repeats));len++){
      const last=states.slice(-len*repeats);
      let recurring=true;
      for(let i=len;i<last.length;i++)if(last[i]!==last[i%len]){recurring=false;break;}
      if(recurring)return last.slice(0,len).map(k=>k.split('|')[1]);
    }
    return null;
  }
  function incidentNow(cycle){
    stopHold();
    stopAuto();
    const repeats=world.cfg.loop_repeats||4;
    const incident={
      id:'loop-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10),
      kind:'loop',created_at:new Date().toISOString(),size:N,dog:world.dog.slice(),
      goals:world.goals.map(g=>g.slice()),walls:Array.from(world.walls).sort(),
      known_walls:Array.from(world.known).sort(),target_index:world.targetIndex,
      cycle:cycle,cycle_length:cycle.length,repetitions:repeats,
      model_version:window.MaliNavBrain.version(),config_revision:window.MaliConfig.revision(),
      steps:world.autoSteps
    };
    world.helpIncident=incident;world.helpPending=true;world.helpActive=false;
    world.helpActions=[];world.helpStart=world.dog.slice();world.helpTarget=world.goals[world.targetIndex].slice();
    world.helpTargetIndex=world.targetIndex;
    if(window.MaliCloud&&window.MaliCloud.enqueueIncident)
      window.MaliCloud.enqueueIncident(incident);
    controlsState();
    update('🐶 Mislim da se vrtim u krug ('+repeats+' puta). Možeš mi pokazati put?');
  }
  function tickAuto(){
    if(!world||!world.autoRunning||world.done||el('overlay').hidden){stopAuto();return;}
    if(world.autoSteps>=Math.min(6*N*N,650)){
      stopAuto();controlsState();update('Mali je dosegnuo granicu poteza. Zaustavljen je bez lažne pobjede.');
      return;
    }
    const brain=window.MaliNavBrain;
    let probs;
    try{
      probs=brain.predict({size:N,dog:world.dog,goal:world.goals[world.targetIndex],
        known:world.known,visits:world.visits,previous:world.previous,
        target_index:world.targetIndex});
    }catch(e){stopAuto();controlsState();update('Model nije spreman za hodanje.');return;}
    const directions=['up','down','left','right'];
    // Soft penalty: a previously visited square is less attractive, never forbidden.
    // Mali still chooses from the neural network's probabilities and known open paths.
    const score=i=>{
      const [dx,dy]=DIR[directions[i]],key=pos(world.dog[0]+dx,world.dog[1]+dy);
      const count=world.visits.get(key)||0;
      return Math.log(Math.max(1e-6,probs[i]))-0.65*Math.min(5,count);
    };
    const ranked=[0,1,2,3].sort((a,b)=>score(b)-score(a));
    const chosen=ranked.find(i=>{
      const [dx,dy]=DIR[directions[i]],xx=world.dog[0]+dx,yy=world.dog[1]+dy;
      return xx>=0&&yy>=0&&xx<N&&yy<N&&!world.known.has(pos(xx,yy));
    });
    if(chosen===undefined){
      stopAuto();controlsState();update('Mali ne vidi slobodan smjer. Zaustavljen je.');
      return;
    }
    const beforeGoal=world.targetIndex;
    move(directions[chosen],true);
    world.autoSteps++;
    if(world.done){stopAuto();controlsState();update('🎉 Mali je sam pronašao sve loptice!');return;}
    if(world.targetIndex!==beforeGoal){
      world.autoStates=[world.targetIndex+'|'+pos(...world.dog)];
    }else{
      world.autoStates.push(world.targetIndex+'|'+pos(...world.dog));
      if(world.autoStates.length>180)world.autoStates.shift();
      const cycle=detectCycle(world.autoStates,world.cfg.loop_repeats||4);
      if(cycle)incidentNow(cycle);
    }
  }
  async function tryAutonomy(){
    stopHold();
    if(!world||world.done||world.helpPending||world.helpActive)return;
    if(world.autoInterrupted){update('Ovaj samostalni pokušaj je prekinut. Za novi pokušaj otvori novi labirint.');return;}
    if(world.autoRunning||world.autoRequested)return;
    const snapshot=world;
    world.autoRequested=true;
    controlsState();
    update('Učitavam istrenirani navigacijski mozak...');
    const brain=window.MaliNavBrain;
    if(!brain||!await brain.load()){
      if(world===snapshot){
        world.autoRequested=false;
        controlsState();
        update('Nema objavljenog modela. U lokalnom Control Centeru odaberi brain/navigation-active.json i klikni Objavi mozak.');
      }
      return;
    }
    if(world!==snapshot||world.done||world.autoInterrupted||!world.autoRequested)return;
    world.autoRequested=false;
    world.usedAuto=true;world.autoRunning=true;world.autoSteps=0;
    world.autoStates=[world.targetIndex+'|'+pos(...world.dog)];
    // Visits are tracked throughout the maze, including earlier manual moves.
    world.previous=null;
    controlsState();
    update('🧠 Mali sam odlučuje kamo će ići. Model: '+brain.version());
    autoTimer=setInterval(tickAuto,450);
  }
  function beginHelp(){
    if(!world||!world.helpPending)return;
    world.helpPending=false;world.helpActive=true;
    controlsState();update('Vodi Malog potezima prsta ili strelicama prema loptici. Tvoji potezi postaju nova lekcija.');
  }
  function recordCorrection(){
    if(!world.helpActive||!world.helpActions.length||!world.helpIncident)return;
    const item={
      id:world.helpIncident.id,incident_id:world.helpIncident.id,created_at:new Date().toISOString(),
      size:N,start:world.helpStart.slice(),target:world.helpTarget.slice(),
      target_index:world.helpTargetIndex,
      actions:world.helpActions.slice(),resolved:true
    };
    if(window.MaliCloud&&window.MaliCloud.enqueueCorrection)window.MaliCloud.enqueueCorrection(item);
    world.helpActive=false;world.helpIncident=null;world.helpActions=[];
  }
  const el=id=>document.getElementById(id), pos=(x,y)=>x+','+y;
  try {const data=JSON.parse(localStorage.getItem(KEY)||'[]');saved=Array.isArray(data)?data.slice(-200):[];}catch(_){}
  function shortest(walls) {
    const queue=[[START[0],START[1],0]], seen=new Set([pos(...START)]);
    for(let i=0;i<queue.length;i++){
      const [x,y,d]=queue[i]; if(x===GOAL[0]&&y===GOAL[1])return d;
      for(const [dx,dy] of Object.values(DIR)){
        const xx=x+dx,yy=y+dy,k=pos(xx,yy);
        if(xx>=0&&yy>=0&&xx<N&&yy<N&&!walls.has(k)&&!seen.has(k)){seen.add(k);queue.push([xx,yy,d+1]);}
      }
    }
    return null;
  }
  function shortestFrom(walls,from,to){
    const q=[[...from,0]],seen=new Set([pos(...from)]);
    for(let i=0;i<q.length;i++){
      const [x,y,d]=q[i];if(x===to[0]&&y===to[1])return d;
      for(const [dx,dy] of Object.values(DIR)){
        const xx=x+dx,yy=y+dy,k=pos(xx,yy);
        if(xx>=0&&yy>=0&&xx<N&&yy<N&&!seen.has(k)&&!walls.has(k)){
          seen.add(k);q.push([xx,yy,d+1]);
        }
      }
    }return null;
  }
  function createWorld(){
    const cfg=window.MaliConfig.get().maze;
    N=cfg.size;START=[0,N-1];
    // Every ball, including number 1, now gets a fresh random location.
    // Keep Mali's starting square fixed so we change only one training variable.
    const options=[];
    for(let y=0;y<N;y++)for(let x=0;x<N;x++)
      if(pos(x,y)!==pos(...START))options.push([x,y]);
    let fallbackGoals=null;
    for(let t=0;t<500;t++){
      const bag=options.slice();
      for(let i=bag.length-1;i>0;i--){
        const j=Math.floor(Math.random()*(i+1));
        [bag[i],bag[j]]=[bag[j],bag[i]];
      }
      const goals=[];
      for(const p of bag){
        if(Math.abs(p[0]-START[0])+Math.abs(p[1]-START[1])<3)continue;
        if(goals.every(g=>Math.abs(g[0]-p[0])+Math.abs(g[1]-p[1])>=3))
          goals.push(p);
        if(goals.length===cfg.ball_count)break;
      }
      if(goals.length!==cfg.ball_count)continue;
      fallbackGoals=goals.map(p=>p.slice());
      const reserved=new Set([pos(...START),...goals.map(g=>pos(...g))]);
      const walls=new Set(bag.filter(p=>!reserved.has(pos(...p)))
        .slice(0,Math.round(N*N*cfg.blocked_percent/100)).map(p=>pos(...p)));
      let previous=START.slice(),optimal=0,ok=true;
      for(const target of goals){
        const steps=shortestFrom(walls,previous,target);
        if(steps===null){ok=false;break;}
        optimal+=steps;previous=target;
      }
      if(ok){
        GOAL=goals[0].slice(); // Legacy route export records the actual first goal.
        return {walls,optimal,goals,cfg};
      }
    }
    // If obstacle placement repeatedly blocks paths, keep random goals but
    // remove walls. Never silently revert to a fixed corner goal.
    if(!fallbackGoals)throw Error('Nije moguće rasporediti loptice.');
    GOAL=fallbackGoals[0].slice();
    let previous=START.slice(),optimal=0;
    for(const p of fallbackGoals){
      optimal+=Math.abs(p[0]-previous[0])+Math.abs(p[1]-previous[1]);
      previous=p;
    }
    return {walls:new Set(),optimal,goals:fallbackGoals,cfg};
  }
  function reveal(){
    for(const wall of world.walls){
      const [x,y]=wall.split(',').map(Number);
      if(Math.abs(x-world.dog[0])+Math.abs(y-world.dog[1])<=world.cfg.vision_radius)world.known.add(wall);
    }
  }
  function newMaze(){
    stopHold();swipeStart=null;
    stopAuto();
    const map=createWorld();
    world={walls:map.walls,optimal:map.optimal,goals:map.goals,cfg:map.cfg,known:new Set(),dog:START.slice(),ballRgbs:map.goals.map(()=>window.MaliConfig.randomRgb()),targetIndex:0,moves:0,hits:0,steps:[],done:false,usedAuto:false,autoRunning:false,autoRequested:false,autoInterrupted:false,helpPending:false,helpActive:false,autoSteps:0,visits:new Map([[pos(...START),1]]),previous:null};
    reveal();draw();void window.MaliConfig.refresh(false);
  }
  function cells(){
    let out='';
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){
      const k=pos(x,y),visits=world.visits.get(k)||0,dog=world.dog[0]===x&&world.dog[1]===y,
        i=world.goals.findIndex(g=>g[0]===x&&g[1]===y),rock=world.known.has(k);
      // Previously collected balls must disappear visually. The model already
      // receives world.goals[world.targetIndex], so drawing an old ball was misleading.
      const pendingBall=i>=world.targetIndex;
      const kind=dog?'dog':pendingBall?(i===world.targetIndex?'goal':'future'):rock?'rock':'empty';
      const what=dog?'🐶':pendingBall?'<span class="ml-ball" style="--ml-ball-color:rgb('+
        world.ballRgbs[i].join(',')+')"><span class="ml-ball-num">'+(i+1)+'</span></span>':rock?'🪨':'';
      const pawLevel=visits<=2?1:visits<=5?2:visits<=10?3:4;
      const paw=visits>0&&!dog&&!rock&&!pendingBall
        ?'<span class="ml-paw ml-paw-'+pawLevel+'" aria-hidden="true">🐾</span>':'';
      out+='<div class="ml-cell ml-'+kind+'" role="gridcell" aria-label="'+
        (dog?'Mali':pendingBall?'Loptica '+(i+1):rock?'Prepreka':'Prazno polje')+
        (!dog&&!rock&&visits?'; posjećeno '+visits+' puta':'')+'">'+what+paw+'</div>';
    }
    return out;
  }
  function arrowControlsHtml(){
    return '<div class="ml-controls">'+
      '<span></span><button class="action" type="button" data-ml-dir="up" aria-label="Gore">↑</button><span></span>'+
      '<button class="action" type="button" data-ml-dir="left" aria-label="Lijevo">←</button>'+
      '<button class="action" type="button" data-ml-dir="down" aria-label="Dolje">↓</button>'+
      '<button class="action" type="button" data-ml-dir="right" aria-label="Desno">→</button></div>';
  }
  function controlsHtml(){
    // Keep this entire help region the same size when the first arrow starts
    // a correction. Previously the banner and action disappeared and moved the
    // arrow pad under the user's finger.
    if(world.helpPending||world.helpActive)return '<div class="ml-result ml-help-banner" style="min-height:3.5em;display:flex;align-items:center;justify-content:center;text-align:center">🐶 Zapetljao sam se. Trebam tvoju pomoć! Vodi me prstom ili strelicama do loptice.</div>'+
      arrowControlsHtml()+
      '<div class="ml-actions ml-help-actions" style="min-height:41px"><button class="action" type="button" data-ml-action="help"'+
      (world.helpActive?' disabled aria-disabled="true"':'')+'>'+
      (world.helpActive?'🐾 Pomažeš mi':'🐾 Pomozi mi')+'</button></div>';
    if(world.autoRequested||world.autoRunning)return '<div class="ml-result">🧠 Mali traži sam. Strelice su zaključane dok ne zatraži pomoć; Zaustavi prekida bez XP-a.</div>';
    return arrowControlsHtml();
  }
  function resultHtml(){
    return '<div class="ml-result">🎉 Sve loptice skupljene! Tvoj put: '+world.moves+' koraka. Najkraći mogući: '+world.optimal+
      '. '+(world.usedAuto?(world.autoInterrupted
        ?'<b>Prekinuti samostalni pokušaj: bez XP-a i lekcije.</b>'
        :'<b>Samostalni pokušaj (nije ljudska ruta).</b>')
        :world.storageError?'Spremanje nije uspjelo.':'<b>Ruta spremljena na uređaju.</b>')+'</div>';
  }
  function draw(message){
    if(!ctx)return;
    ctx.open('maze','Malijev labirint 🐶',
      '<p class="ml-help">Skupljaj loptice redom <b>1 → '+world.goals.length+'</b>. Prepreke vidi do <b>'+world.cfg.vision_radius+' polja</b>. Na mobitelu povuci prst za jedan korak.</p>'+
      '<div id="ml-board" class="ml-board" role="grid" style="--ml-size:'+N+';--ml-font:'+(N===16?11:N===12?15:23)+'px" aria-label="Labirint '+N+' puta '+N+'">'+cells()+'</div>'+
      '<div id="ml-stats" class="ml-stats">Koraci: <b>'+world.moves+'</b> · Otkriveno: <b>'+world.known.size+'/'+world.walls.size+'</b> · Udarci: <b>'+world.hits+'</b></div>'+
      '<div id="ml-message" class="ml-message" style="min-height:4.5em;line-height:1.5" role="status">'+(message||'Pronađi lopticu broj 1. Vodi me strelicama ili prstom!')+'</div>'+
      '<div id="ml-controlslot">'+(world.done?resultHtml():controlsHtml())+'</div>'+
      '<div class="ml-actions"><button class="action" type="button" data-ml-action="new">↻ Novi labirint</button>'+
      '<button id="ml-auto" class="action" type="button" data-ml-action="auto">🧠 Probaj sam</button>'+
      '<button id="ml-stop" class="action" type="button" data-ml-action="stop">⏹ Zaustavi</button>'+
      '<button id="ml-export" class="action" type="button" data-ml-action="export">⬇ Izvezi rute ('+saved.length+')</button></div>'+
      '<p class="muted ml-footnote">Konfiguracija rev. '+window.MaliConfig.revision()+' ('+window.MaliConfig.source()+') · '+N+'×'+N+'. Samostalni pokušaji koriste objavljeni navigacijski model.</p>'+
      '<p id="ml-cloud-status" class="muted ml-footnote">'+
        (window.MaliCloud && window.MaliCloud.navigationMessage
          ? window.MaliCloud.navigationMessage()
          : 'Rute su spremljene lokalno.')+'</p>');
  }
  function update(message){
    // Never re-open the modal on each move. This also preserves focus and grid dimensions.
    const board=el('ml-board');if(!board)return;
    board.innerHTML=cells();
    el('ml-stats').innerHTML='Koraci: <b>'+world.moves+'</b> · Otkriveno: <b>'+world.known.size+'/'+world.walls.size+'</b> · Udarci: <b>'+world.hits+'</b>';
    el('ml-message').textContent=message;
    if(world.done){
      el('ml-controlslot').innerHTML=resultHtml();
      el('ml-export').textContent='⬇ Izvezi rute ('+saved.length+')';
    }
    if(el('ml-cloud-status') && window.MaliCloud && window.MaliCloud.navigationMessage)
      el('ml-cloud-status').textContent=window.MaliCloud.navigationMessage();
  }
  function solved(){
    world.done=true;
    if(world.usedAuto){
      // A forced stop permanently disqualifies this maze from XP, even if finished manually.
      if(!world.autoInterrupted)ctx.s.xp=(ctx.s.xp||0)+8;
      ctx.s.joy=Math.min(100,(ctx.s.joy||0)+6);
      ctx.s.energy=Math.max(0,(ctx.s.energy||0)-5);
      ctx.persist();ctx.render();
      ctx.speak('Bravo! 🐾',world.autoInterrupted
        ?'Pokušaj je prekinut: nema XP-a ni spremljene lekcije.'
        :'Mali je stigao do cilja.');
      return;
    }
    const entry={
      id:'maze-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10),
      created_at:new Date().toISOString(),size:N,start:START.slice(),goal:GOAL.slice(),goals:world.goals.map(g=>g.slice()),ball_rgbs:world.ballRgbs.map(c=>c.slice()),config_revision:window.MaliConfig.revision(),
      walls:Array.from(world.walls).sort(),known_walls:Array.from(world.known).sort(),
      optimal_steps:world.optimal,moves:world.moves,hits:world.hits,
      actions:world.steps.slice()
    };
    const previous=saved.slice();saved.push(entry);if(saved.length>200)saved.shift();
    try{localStorage.setItem(KEY,JSON.stringify(saved));}
    catch(_){saved=previous;world.storageError=true;return;}
    // Keep local copy forever. Queue the same successful demonstration for the shared brain.
    if(window.MaliCloud && window.MaliCloud.enqueueNavigationMany)
      window.MaliCloud.enqueueNavigationMany([entry]);
    ctx.s.xp=(ctx.s.xp||0)+8;
    ctx.s.joy=Math.min(100,(ctx.s.joy||0)+6);
    ctx.s.energy=Math.max(0,(ctx.s.energy||0)-5);
    ctx.persist();ctx.render();ctx.speak('Bravo! 🐾','+8 XP. Tvoja ruta je zabilježena.');
  }
  function move(direction,byAuto){
    if(!world||world.done||!DIR[direction])return false;
    if((world.autoRunning||world.autoRequested)&&!byAuto)return false;
    // A manual arrow press is also an explicit takeover when Mali asks for help.
    if(world.helpPending&&!byAuto)beginHelp();
    if(world.helpPending)return false;
    if(byAuto)world.usedAuto=true;
    const [dx,dy]=DIR[direction],from=world.dog.slice(),x=from[0]+dx,y=from[1]+dy;
    const blocked=x<0||y<0||x>=N||y>=N||world.walls.has(pos(x,y));
    const decision={from,action:direction,to:blocked?from.slice():[x,y],blocked,
      known_walls:Array.from(world.known).sort(),target_index:world.targetIndex,
      target:world.goals[world.targetIndex].slice()};
    world.steps.push(decision);
    if(world.helpActive&&!byAuto&&!blocked)
      world.helpActions.push({from:from.slice(),to:[x,y],action:direction,blocked:false,
        known_walls:decision.known_walls.slice()});
    if(blocked)world.hits++; else{
      world.dog=[x,y];world.moves++;reveal();
      world.visits.set(pos(x,y),(world.visits.get(pos(x,y))||0)+1);
      if(byAuto)world.previous=direction;
    }
    let msg=blocked?'Ovdje ne mogu proći!':'Idemo dalje!';
    const target=world.goals[world.targetIndex];
    if(!blocked&&x===target[0]&&y===target[1]){
      world.targetIndex++;
      if(world.helpActive)recordCorrection();
      if(world.targetIndex===world.goals.length){solved();msg='Sve loptice skupljene!';}
      else msg='Bravo! Sada loptica broj '+(world.targetIndex+1)+'.';
    }
    update(world.done&&world.storageError?'Ruta se nije spremila.':msg);
    return !blocked;
  }
  function exportAll(){
    if(!saved.length){el('ml-message').textContent='Najprije završi barem jedan labirint.';return;}
    const data={format:KEY,exported_at:new Date().toISOString(),lessons:saved};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='mali-labirint-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  window.MaliMaze={
    open:function(context){ctx=context;newMaze();},
    handleClick:function(event){
      const btn=event.target.closest('[data-ml-dir],[data-ml-action]');if(!btn)return;
      const d=btn.getAttribute('data-ml-dir'),a=btn.getAttribute('data-ml-action');
      if(d){
        // Pointerdown already performed this move; suppress its synthetic click.
        if(pointerButton===btn){pointerButton=null;return;}
        move(d,false);
      }else if(a==='new')newMaze();
      else if(a==='export')exportAll();else if(a==='auto')void tryAutonomy();
      else if(a==='stop'){
        stopHold();swipeStart=null;
        const interrupted=world&&(world.autoRunning||world.autoRequested||world.helpPending||world.helpActive);
        if(interrupted){
          world.usedAuto=true;
          world.autoInterrupted=true;world.autoRequested=false;
          world.helpPending=false;world.helpActive=false;
          world.helpIncident=null;world.helpActions=[];
        }
        stopAuto();controlsState();
        update(interrupted
          ?'Samostalni pokušaj je prekinut. Možeš nastaviti ručno, ali bez XP-a i nove lekcije.'
          :'Zaustavljeno. Možeš nastaviti ručno ili otvoriti novi labirint.');
      }
      else if(a==='help')beginHelp();
    }
  };
  function isTyping(target){
    return !!(target&&target.closest&&target.closest('input,textarea,select,[contenteditable="true"]'));
  }
  document.addEventListener('keydown',function(e){
    const key=e.key.length===1?e.key.toLowerCase():e.key;
    const direction=KEY_TO_DIR[key];
    if(!direction||!el('ml-board')||el('overlay').hidden||
       e.altKey||e.ctrlKey||e.metaKey||isTyping(e.target))return;
    e.preventDefault();
    // Ignore OS auto-repeat: we use a predictable, slower walking interval.
    if(e.repeat)return;
    startHold(direction,{type:'key',code:e.code});
  });
  document.addEventListener('keyup',function(e){
    if(held&&held.type==='key'&&e.code===held.code)stopHold();
  });
  document.addEventListener('pointerdown',function(e){
    if(!el('ml-board')||el('overlay').hidden||!e.isPrimary)return;
    const button=e.target.closest&&e.target.closest('[data-ml-dir]');
    if(button&&e.button===0){
      pointerButton=button;
      startHold(button.getAttribute('data-ml-dir'),{type:'pointer',id:e.pointerId});
      return;
    }
    const board=e.target.closest&&e.target.closest('#ml-board');
    if(!board||(e.pointerType!=='touch'&&e.pointerType!=='pen'))return;
    stopHold();
    swipeStart={id:e.pointerId,x:e.clientX,y:e.clientY};
    try{board.setPointerCapture(e.pointerId);}catch(_){}
  });
  document.addEventListener('pointerup',function(e){
    if(held&&held.type==='pointer'&&held.id===e.pointerId)stopHold();
    if(!swipeStart||swipeStart.id!==e.pointerId)return;
    const swipe=swipeStart;swipeStart=null;
    const direction=swipeDirection(e.clientX-swipe.x,e.clientY-swipe.y);
    if(direction)move(direction,false);
  });
  document.addEventListener('pointercancel',function(e){
    if(held&&held.type==='pointer'&&held.id===e.pointerId)stopHold();
    if(swipeStart&&swipeStart.id===e.pointerId)swipeStart=null;
  });
  window.addEventListener('blur',function(){stopHold();swipeStart=null;});
}());
