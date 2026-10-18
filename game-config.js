/* MALI — public Firebase-driven game configuration.
 * Administration remains on localhost via the private Admin SDK key.
 * This script reads public settings only; the browser never receives admin credentials.
 */
(function () {
  'use strict';
  const KEY = 'mali-last-valid-game-config-v1';
  const defaults = {
    schema_version:1, revision:0,
    colors:{
      items:[
        {id:'crvena',name:'Crvena',hue:0,spread:8,saturation_min:.78,saturation_max:.95,lightness_min:.45,lightness_max:.58,weight:1,enabled:true},
        {id:'plava',name:'Plava',hue:222,spread:12,saturation_min:.78,saturation_max:.95,lightness_min:.45,lightness_max:.58,weight:1,enabled:true},
        {id:'zelena',name:'Zelena',hue:127,spread:12,saturation_min:.78,saturation_max:.95,lightness_min:.45,lightness_max:.58,weight:1,enabled:true},
        {id:'zuta',name:'Žuta',hue:60,spread:6,saturation_min:.78,saturation_max:.95,lightness_min:.52,lightness_max:.61,weight:1,enabled:true}
      ],
      allow_dont_know:true,allow_unlisted_feedback:true
    },
    maze:{size:8,blocked_percent:13,ball_count:1,vision_radius:2,ball_order:'sequential'}
  };
  let config=defaults, source='zadano', lastRequest=0, inflight=null;
  function isNum(n,a,b){return typeof n==='number'&&Number.isFinite(n)&&n>=a&&n<=b;}
  function valid(raw){
    if(!raw||typeof raw!=='object'||raw.schema_version!==1||!raw.colors||!raw.maze)return null;
    const items=raw.colors.items,maze=raw.maze;
    if(!Array.isArray(items)||items.length<1||items.length>24)return null;
    const colors=[],ids=new Set(),labels=new Set();
    for(const c of items){
      if(!c||typeof c.id!=='string'||!(/^[a-z][a-z0-9_-]{1,29}$/).test(c.id)||
        typeof c.name!=='string'||c.name.trim().length<2||c.name.trim().length>40||
        ids.has(c.id)||labels.has(c.name.trim().toLocaleLowerCase('hr'))||
        !Number.isInteger(c.hue)||!isNum(c.hue,0,359)||
        !Number.isInteger(c.spread)||!isNum(c.spread,0,45)||
        !isNum(c.saturation_min,0,1)||!isNum(c.saturation_max,0,1)||
        !isNum(c.lightness_min,0,1)||!isNum(c.lightness_max,0,1)||
        c.saturation_min>c.saturation_max||c.lightness_min>c.lightness_max||
        !Number.isInteger(c.weight)||!isNum(c.weight,1,100)||typeof c.enabled!=='boolean')return null;
      ids.add(c.id);labels.add(c.name.trim().toLocaleLowerCase('hr'));
      colors.push({...c,name:c.name.trim()});
    }
    if(!colors.some(c=>c.enabled))return null;
    if(![8,12,16].includes(maze.size)||!Number.isInteger(maze.blocked_percent)||
       !isNum(maze.blocked_percent,5,30)||![1,2,3].includes(maze.ball_count)||
       !Number.isInteger(maze.vision_radius)||!isNum(maze.vision_radius,1,5)||
       maze.ball_order!=='sequential')return null;
    return {
      schema_version:1,revision:Number.isInteger(raw.revision)?raw.revision:0,
      colors:{items:colors,allow_dont_know:raw.colors.allow_dont_know!==false,
        allow_unlisted_feedback:raw.colors.allow_unlisted_feedback!==false},
      maze:{size:maze.size,blocked_percent:maze.blocked_percent,ball_count:maze.ball_count,
        vision_radius:maze.vision_radius,ball_order:'sequential'}
    };
  }
  try{
    const cached=valid(JSON.parse(localStorage.getItem(KEY)||'null'));
    if(cached){config=cached;source='spremljeno';}
  }catch(_){}
  function refresh(force){
    if(inflight)return inflight;
    const now=Date.now();
    if(!force&&now-lastRequest<20000)return Promise.resolve(config);
    lastRequest=now;
    const endpoint=window.MALI_FIREBASE_CONFIG&&window.MALI_FIREBASE_CONFIG.databaseURL;
    if(!endpoint)return Promise.resolve(config);
    const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),6500);
    inflight=fetch(endpoint.replace(/\/$/,'')+'/gameConfig/public.json',{
      cache:'no-store',signal:controller.signal
    }).then(response=>{
      if(!response.ok)throw Error('Config read denied or offline');
      return response.json();
    }).then(remote=>{
      const next=valid(remote);
      if(!next)throw Error('Invalid remote config');
      config=next;source='Firebase';
      try{localStorage.setItem(KEY,JSON.stringify(next));}catch(_){}
      return config;
    }).catch(err=>{
      console.info('Mali: koristim prethodnu konfiguraciju; nema novog čitanja Firebasea.',err.message);
      return config;
    }).finally(()=>{clearTimeout(timeout);inflight=null;});
    return inflight;
  }
  function current(){return config;}
  function activeColors(){return config.colors.items.filter(x=>x.enabled);}
  function randomRgb(){
    const choices=activeColors(),total=choices.reduce((a,c)=>a+c.weight,0);
    let roll=Math.random()*total,c=choices[choices.length-1];
    for(const item of choices){roll-=item.weight;if(roll<0){c=item;break;}}
    const hue=(c.hue+(Math.random()*2-1)*c.spread+360)%360;
    const sat=c.saturation_min+Math.random()*(c.saturation_max-c.saturation_min);
    const light=c.lightness_min+Math.random()*(c.lightness_max-c.lightness_min);
    const a=sat*Math.min(light,1-light);
    function channel(n){
      const k=(n+hue/30)%12;
      return Math.round(255*(light-a*Math.max(-1,Math.min(k-3,9-k,1))));
    }
    return [channel(0),channel(8),channel(4)];
  }
  window.MaliConfig={
    get:current,activeColors:activeColors,randomRgb:randomRgb,
    source:()=>source,revision:()=>config.revision,refresh:refresh
  };
  refresh(true);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(false);});
  window.addEventListener('focus',()=>refresh(false));
}());
