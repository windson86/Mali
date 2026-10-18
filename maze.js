/* MALI — 8x8 spatial lessons, learned moves come only from users. */
(function () {
  'use strict';
  let N=8, START=[0,7], GOAL=[7,0]; const KEY='mali-navigation-lessons-v1';
  const DIR={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
  let world=null, ctx=null, saved=[];
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
    N=cfg.size;START=[0,N-1];GOAL=[N-1,0];
    const options=[];
    for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(pos(x,y)!==pos(...START)&&pos(x,y)!==pos(...GOAL))options.push([x,y]);
    for(let t=0;t<500;t++){
      const bag=options.slice();
      for(let i=bag.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}
      const goals=[GOAL.slice()];
      for(const p of bag){
        if(goals.length===cfg.ball_count)break;
        if(goals.every(g=>Math.abs(g[0]-p[0])+Math.abs(g[1]-p[1])>=3)&&Math.abs(p[0]-START[0])+Math.abs(p[1]-START[1])>=3)goals.push(p);
      }
      if(goals.length!==cfg.ball_count)continue;
      const reserved=new Set([pos(...START),...goals.map(g=>pos(...g))]);
      const walls=new Set(bag.filter(p=>!reserved.has(pos(...p))).slice(0,Math.round(N*N*cfg.blocked_percent/100)).map(p=>pos(...p)));
      let previous=START.slice(),optimal=0,ok=true;
      for(const target of goals){const steps=shortestFrom(walls,previous,target);if(steps===null){ok=false;break;}optimal+=steps;previous=target;}
      if(ok)return {walls,optimal,goals,cfg};
    }
    const goals=[GOAL.slice(),...[[N-1,N-1],[Math.floor(N/2),Math.floor(N/2)]].slice(0,cfg.ball_count-1)];
    let prev=START.slice(),optimal=0;
    for(const p of goals){optimal+=Math.abs(p[0]-prev[0])+Math.abs(p[1]-prev[1]);prev=p;}
    return {walls:new Set(),optimal,goals,cfg};
  }
  function reveal(){
    for(const wall of world.walls){
      const [x,y]=wall.split(',').map(Number);
      if(Math.abs(x-world.dog[0])+Math.abs(y-world.dog[1])<=world.cfg.vision_radius)world.known.add(wall);
    }
  }
  function newMaze(){
    const map=createWorld();
    world={walls:map.walls,optimal:map.optimal,goals:map.goals,cfg:map.cfg,known:new Set(),dog:START.slice(),ballRgbs:map.goals.map(()=>window.MaliConfig.randomRgb()),targetIndex:0,moves:0,hits:0,steps:[],done:false};
    reveal();draw();void window.MaliConfig.refresh(false);
  }
  function cells(){
    let out='';
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){
      const k=pos(x,y),dog=world.dog[0]===x&&world.dog[1]===y,
        i=world.goals.findIndex(g=>g[0]===x&&g[1]===y),rock=world.known.has(k);
      const kind=dog?'dog':i>=0?(i===world.targetIndex?'goal':'future'):rock?'rock':'empty';
      const what=dog?'🐶':i>=0?'<span class="ml-ball" style="--ml-ball-color:rgb('+
        world.ballRgbs[i].join(',')+')"><span class="ml-ball-num">'+(i+1)+'</span></span>':rock?'🪨':'';
      out+='<div class="ml-cell ml-'+kind+'" role="gridcell" aria-label="'+
        (dog?'Mali':i>=0?'Loptica '+(i+1):rock?'Prepreka':'Nepoznato polje')+'">'+what+'</div>';
    }
    return out;
  }
  function controlsHtml(){
    return '<div class="ml-controls">'+
      '<span></span><button class="action" type="button" data-ml-dir="up" aria-label="Gore">↑</button><span></span>'+
      '<button class="action" type="button" data-ml-dir="left" aria-label="Lijevo">←</button>'+
      '<button class="action" type="button" data-ml-dir="down" aria-label="Dolje">↓</button>'+
      '<button class="action" type="button" data-ml-dir="right" aria-label="Desno">→</button></div>';
  }
  function resultHtml(){
    return '<div class="ml-result">🎉 Sve loptice skupljene! Tvoj put: '+world.moves+' koraka. Najkraći mogući: '+world.optimal+
      '. '+(world.storageError?'Spremanje nije uspjelo.':'<b>Ruta spremljena na uređaju.</b>')+'</div>';
  }
  function draw(message){
    if(!ctx)return;
    ctx.open('maze','Malijev labirint 🐶',
      '<p class="ml-help">Skupljaj loptice redom <b>1 → '+world.goals.length+'</b>. Prepreke vidi do <b>'+world.cfg.vision_radius+' polja</b>.</p>'+
      '<div id="ml-board" class="ml-board" role="grid" style="--ml-size:'+N+';--ml-font:'+(N===16?11:N===12?15:23)+'px" aria-label="Labirint '+N+' puta '+N+'">'+cells()+'</div>'+
      '<div id="ml-stats" class="ml-stats">Koraci: <b>'+world.moves+'</b> · Otkriveno: <b>'+world.known.size+'/'+world.walls.size+'</b> · Udarci: <b>'+world.hits+'</b></div>'+
      '<div id="ml-message" class="ml-message" role="status">'+(message||'Loptica je gore desno. Vodi me strelicama!')+'</div>'+
      '<div id="ml-controlslot">'+(world.done?resultHtml():controlsHtml())+'</div>'+
      '<div class="ml-actions"><button class="action" type="button" data-ml-action="new">↻ Novi labirint</button>'+
      '<button id="ml-export" class="action" type="button" data-ml-action="export">⬇ Izvezi rute ('+saved.length+')</button></div>'+
      '<p class="muted ml-footnote">Konfiguracija rev. '+window.MaliConfig.revision()+' ('+window.MaliConfig.source()+') · '+N+'×'+N+'. Mali još ne hoda sam.</p>'+
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
  function move(direction){
    if(!world||world.done||!DIR[direction])return;
    const [dx,dy]=DIR[direction],from=world.dog.slice(),x=from[0]+dx,y=from[1]+dy;
    const blocked=x<0||y<0||x>=N||y>=N||world.walls.has(pos(x,y));
    world.steps.push({from,action:direction,to:blocked?from.slice():[x,y],blocked,known_walls:Array.from(world.known).sort(),target_index:world.targetIndex,target:world.goals[world.targetIndex].slice()});
    if(blocked)world.hits++; else{world.dog=[x,y];world.moves++;reveal();}
    let msg=blocked?'Ovdje ne mogu proći!':'Idemo dalje!';
    const target=world.goals[world.targetIndex];
    if(!blocked&&x===target[0]&&y===target[1]){
      world.targetIndex++;
      if(world.targetIndex===world.goals.length){solved();msg='Sve loptice skupljene!';}
      else msg='Bravo! Sada loptica broj '+(world.targetIndex+1)+'.';
    }
    update(world.done&&world.storageError?'Ruta se nije spremila.':msg);
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
      if(d)move(d);else if(a==='new')newMaze();else if(a==='export')exportAll();
    }
  };
  document.addEventListener('keydown',function(e){
    const d={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'}[e.key];
    if(d&&el('ml-board')&&!el('overlay').hidden){e.preventDefault();move(d);}
  });
}());
