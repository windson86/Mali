/* MALI navigation v1 model: trained locally on human demonstrations, published through Control Center.
   The predictor never reads the hidden maze walls or a pathfinder. */
(function(){
'use strict';
const expected=['relative_goal_x','relative_goal_y','position_x','position_y','goal_x','goal_y',
  'blocked_up','blocked_down','blocked_left','blocked_right',
  'prior_visits_up','prior_visits_down','prior_visits_left','prior_visits_right',
  'previous_delta_x','previous_delta_y','map_size','goal_index'];
const dirs=[['up',0,-1],['down',0,1],['left',-1,0],['right',1,0]];
let model=null,lastFetch=0,inflight=null;
function valid(o){
  if(!o||o.trained!==true||o.schema_version!==1||o.architecture!=='mali-nav-mlp-v1'||
    !Array.isArray(o.features)||o.features.join('|')!==expected.join('|')||
    !Array.isArray(o.classes)||o.classes.join('|')!=='up|down|left|right')return false;
  const m=o.model;if(!m||!Array.isArray(m.w1)||m.w1.length!==18||
    !Array.isArray(m.b1)||m.b1.length!==24||!Array.isArray(m.w2)||m.w2.length!==24||
    !Array.isArray(m.b2)||m.b2.length!==4)return false;
  const v=x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=100;
  return m.b1.every(v)&&m.b2.every(v)&&m.w1.every(r=>Array.isArray(r)&&r.length===24&&r.every(v))&&
    m.w2.every(r=>Array.isArray(r)&&r.length===4&&r.every(v));
}
async function load(force){
  if(inflight)return inflight;
  if(model&&!force&&Date.now()-lastFetch<60000)return model;
  const cfg=window.MALI_FIREBASE_CONFIG;
  if(!cfg||!cfg.databaseURL)return null;
  inflight=fetch(cfg.databaseURL.replace(/\/$/,'')+'/brain/navigation/active.json',
     {cache:'no-store'}).then(r=>{if(!r.ok)throw Error('model read denied');return r.json();}).then(payload=>{
    if(!valid(payload))throw Error('navigation model missing or incompatible');
    model=payload;lastFetch=Date.now();return model;
  }).catch(err=>{console.info('Mali navigation: nema objavljenog modela.',err.message);return model;})
    .finally(()=>{inflight=null;});
  return inflight;
}
function features(env){
  const n=env.size,[x,y]=env.dog,[gx,gy]=env.goal,den=n-1;
  const known=env.known,visits=env.visits,blocks=[],prior=[];
  for(const [,dx,dy] of dirs){
    const xx=x+dx,yy=y+dy,k=xx+','+yy;
    blocks.push(xx<0||yy<0||xx>=n||yy>=n||known.has(k)?1:-1);
    prior.push(Math.min(3,visits.get(k)||0)/3);
  }
  const last=dirs.find(d=>d[0]===env.previous);
  return [(gx-x)/den,(gy-y)/den,x/den*2-1,y/den*2-1,gx/den*2-1,gy/den*2-1,
    ...blocks,...prior,last?last[1]:0,last?last[2]:0,(n-8)/8,env.target_index/2];
}
function predict(env){
  if(!valid(model))throw Error('Nema valjanog navigacijskog modela');
  const x=features(env),m=model.model;
  const h=m.b1.map((b,j)=>Math.tanh(b+x.reduce((s,v,i)=>s+v*m.w1[i][j],0)));
  const scores=m.b2.map((b,k)=>b+h.reduce((s,v,j)=>s+v*m.w2[j][k],0));
  const peak=Math.max(...scores),exp=scores.map(v=>Math.exp(v-peak));
  const sum=exp.reduce((a,b)=>a+b,0);
  return exp.map(v=>v/sum);
}
window.MaliNavBrain={load,predict,features,ready:()=>valid(model),version:()=>model&&model.version||'neobjavljen'};
})();