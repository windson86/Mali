/* MALI — 8x8 spatial lessons, learned moves come only from users. */
(function () {
  'use strict';
  const N=8, START=[0,7], GOAL=[7,0], KEY='mali-navigation-lessons-v1';
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
  function createWorld() {
    const candidates=[];
    for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(pos(x,y)!==pos(...START)&&pos(x,y)!==pos(...GOAL))candidates.push(pos(x,y));
    for(let tries=0;tries<300;tries++){
      const shuffled=candidates.slice();
      for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
      const walls=new Set(shuffled.slice(0,Math.random()<0.5?8:9)), optimal=shortest(walls);
      if(optimal!==null)return {walls,optimal};
    }
    const walls=new Set(['1,1','2,1','3,1','4,1','1,4','2,4','3,4','4,4']);
    return {walls,optimal:shortest(walls)};
  }
  function reveal(){
    for(const wall of world.walls){
      const [x,y]=wall.split(',').map(Number);
      if(Math.abs(x-world.dog[0])+Math.abs(y-world.dog[1])<=2)world.known.add(wall);
    }
  }
  function newMaze(){
    const map=createWorld();
    world={walls:map.walls,optimal:map.optimal,known:new Set(),dog:START.slice(),ballRgb:window.MaliColors.randomRgb(),moves:0,hits:0,steps:[],done:false};
    reveal();draw();
  }
  function cells(){
    let out='';
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){
      const k=pos(x,y), dog=world.dog[0]===x&&world.dog[1]===y,
        goal=GOAL[0]===x&&GOAL[1]===y,rock=world.known.has(k);
      const kind=dog?'dog':goal?'goal':rock?'rock':'empty';
      const what=dog?'🐶':goal?'<span class="ml-ball" style="--ml-ball-color:rgb('+world.ballRgb.join(',')+')"></span>':rock?'🪨':'';
      const label=dog?'Mali':goal?'Loptica':rock?'Otkrivena prepreka':'Nepoznato polje';
      out+='<div class="ml-cell ml-'+kind+'" role="gridcell" aria-label="'+label+'">'+what+'</div>';
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
    return '<div class="ml-result">🎉 Bravo! Tvoj put: '+world.moves+' koraka. Najkraći mogući: '+world.optimal+
      '. '+(world.storageError?'Spremanje nije uspjelo.':'<b>Ruta spremljena na uređaju.</b>')+'</div>';
  }
  function draw(message){
    if(!ctx)return;
    ctx.open('maze','Malijev labirint 🐶',
      '<p class="ml-help">Dovedi Malog do loptice. Prepreke vidi do <b>2 polja</b> oko sebe, čak i iza drugih prepreka, i pamti otkrivene.</p>'+
      '<div id="ml-board" class="ml-board" role="grid" aria-label="Labirint 8 puta 8">'+cells()+'</div>'+
      '<div id="ml-stats" class="ml-stats">Koraci: <b>'+world.moves+'</b> · Otkriveno: <b>'+world.known.size+'/'+world.walls.size+'</b> · Udarci: <b>'+world.hits+'</b></div>'+
      '<div id="ml-message" class="ml-message" role="status">'+(message||'Loptica je gore desno. Vodi me strelicama!')+'</div>'+
      '<div id="ml-controlslot">'+(world.done?resultHtml():controlsHtml())+'</div>'+
      '<div class="ml-actions"><button class="action" type="button" data-ml-action="new">↻ Novi labirint</button>'+
      '<button id="ml-export" class="action" type="button" data-ml-action="export">⬇ Izvezi rute ('+saved.length+')</button></div>'+
      '<p class="muted ml-footnote">Mali još ne zna sam pronaći put. Ljudske demonstracije ostaju na uređaju i ne šalju se u Firebase.</p>');
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
  }
  function solved(){
    world.done=true;
    const entry={
      id:'maze-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10),
      created_at:new Date().toISOString(),size:N,start:START.slice(),goal:GOAL.slice(),ball_rgb:world.ballRgb.slice(),
      walls:Array.from(world.walls).sort(),known_walls:Array.from(world.known).sort(),
      optimal_steps:world.optimal,moves:world.moves,hits:world.hits,
      actions:world.steps.slice()
    };
    const previous=saved.slice();saved.push(entry);if(saved.length>200)saved.shift();
    try{localStorage.setItem(KEY,JSON.stringify(saved));}
    catch(_){saved=previous;world.storageError=true;return;}
    ctx.s.xp=(ctx.s.xp||0)+8;
    ctx.s.joy=Math.min(100,(ctx.s.joy||0)+6);
    ctx.s.energy=Math.max(0,(ctx.s.energy||0)-5);
    ctx.persist();ctx.render();ctx.speak('Bravo! 🐾','+8 XP. Tvoja ruta je zabilježena.');
  }
  function move(direction){
    if(!world||world.done||!DIR[direction])return;
    const [dx,dy]=DIR[direction],from=world.dog.slice(),x=from[0]+dx,y=from[1]+dy;
    const blocked=x<0||y<0||x>=N||y>=N||world.walls.has(pos(x,y));
    world.steps.push({from,action:direction,to:blocked?from.slice():[x,y],blocked,known_walls:Array.from(world.known).sort()});
    if(blocked)world.hits++; else{world.dog=[x,y];world.moves++;reveal();}
    if(x===GOAL[0]&&y===GOAL[1]&&!blocked)solved();
    update(world.done?(world.storageError?'Nije uspjelo spremanje rute.':'Pronašao sam lopticu!'):blocked?'Ovdje ne mogu proći!':'Idemo dalje!');
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
