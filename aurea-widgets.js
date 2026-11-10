/* ===== Áurea · Widgets de Android: puente JS <-> nativo =====
   Script independiente (como aurea-features.js): se carga DESPUÉS del script principal y usa sus globales
   (T, H, E, N, PJ, GL, MV, SL, F, W, PREF, mkT, mkN, doneT, save, redraw, openMod, V…). No cambia el esquema de datos.

   Arquitectura (la fuente de verdad sigue siendo IndexedDB):
   1) INSTANTÁNEA (app -> widgets): JSON compacto y de solo lectura que se publica en SharedPreferences nativas
      (plugin AureaWidgets.commit). Es una caché derivada: si se pierde, se regenera al abrir Áurea.
   2) OPERACIONES (widgets -> app): cada acción hecha en un widget (hecha, hábito, agua, temporizador, captura) se encola
      en SharedPreferences con un id único. Aquí se aplican a los datos reales, se guardan en IndexedDB y solo entonces
      se confirman (commit). El id aplicado se guarda en PREF.wOps (mismo guardado que los datos) para no repetir
      una operación si la app se cierra entre guardar y confirmar.
   Sin Capacitor (navegador) no hace nada. */
(function(){'use strict';
var AW=window.AureaWidgetsJS={version:1,incompat:'',stats:{pushes:0,applied:0}};
var P=window.AureaPlugins||{};
var NAT=function(){try{return !!(window.Capacitor&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform())}catch(_){return false}};
try{void[T,H,E,N,PJ,GL,MV,BD,SG,SL,F,W,PREF,mkT,mkN,doneT,save,persist,redraw,openMod,V,dOf,D0,iso,HA,diff,urg,gProg,pProg,fLog,fUpd,resumeFocusTimer,restoreFocusSnapshot,focusSnapshot,wl,sync,toast,occ,CATS,CUR,disp,DI,ready,uid]}
catch(e){AW.incompat=String(e&&e.message||e);console.error('Áurea widgets: incompatible',e);return}

var APPLIED_MAX=200,OPS_MAX=500;
var dayKey=function(d){return iso(d)};
var ms=function(d){return d instanceof Date?+d:(d?+new Date(d):0)};

/* ---------- 1) instantánea ---------- */
function eventsAhead(days){
  var out=[];
  for(var n=0;n<days;n++){var d=dOf(n),k=dayKey(d);
    E.forEach(function(e){if(occ(e,d))out.push({id:e.id,t:e.t,day:k,time:e.all?'':(e.time||''),end:e.all?'':(e.end||''),all:e.all?1:0,loc:e.loc||'',rem:e.rem?1:0})})}
  out.sort(function(a,b){return a.day<b.day?-1:a.day>b.day?1:(a.time||'99')<(b.time||'99')?-1:1});
  return out.slice(0,40)}
function taskRow(t){return{id:t.id,t:t.t,due:t.due?dayKey(t.due):'',plan:t.plan?dayKey(t.plan):'',time:t.time||'',u:urg(t)|0,c:t.cat|0,pj:t.proj||0,dep:(typeof bl==='function'&&bl(t))?1:0}}
function focusSnap(){
  var t=F.task?T.find(function(x){return x.id==F.task}):null;
  return{mode:F.mode,kind:F.kind,phase:F.phase,left:F.left|0,total:F.total|0,up:F.up|0,end:F.end||0,start:F.start||0,task:t?t.id:0,taskT:t?t.t:'',cd:F.cd|0}}
function buildSnapshot(){
  var today=dayKey(D0),now=Date.now(),d0=+D0;
  var pend=T.filter(function(t){return !t.done&&t.t&&t.t.trim()});
  var dueToday=pend.filter(function(t){return(t.plan?diff(t.plan)<=0:t.due&&diff(t.due)<=0)||(!t.plan&&t.due&&diff(t.due)<=0)});
  var doneToday=T.filter(function(t){return t.done&&t.doneAt>=d0}).length;
  var tasks=pend.slice().sort(function(a,b){return urg(b)-urg(a)||(a.plan?+a.plan:a.due?+a.due:9e15)-(b.plan?+b.plan:b.due?+b.due:9e15)}).slice(0,25).map(taskRow);
  var habits=HA().filter(function(h){return !h.water}).slice(0,25).map(function(h){return{id:h.id,n:h.n,done:h.d[34]==1?1:0,tm:h.tm||'',s:strk(h)|0}});
  var goal=Math.max(500,Math.min(8000,Number(PREF.waterGoal)||2500));
  var activeP=PJ.filter(function(p){return p.n&&p.n.trim()&&p.st<3});
  var projects=activeP.slice().sort(function(a,b){return(a.due?+a.due:9e15)-(b.due?+b.due:9e15)}).slice(0,12).map(function(p){var g=pProg(p);return{id:p.id,n:p.n,p:Math.round(g.p*100),due:p.due?dayKey(p.due):'',late:g.lt.length,st:p.st|0}});
  var goals=GL.filter(function(g){return g.n&&g.n.trim()&&!g.done}).slice(0,12).map(function(g){return{id:g.id,n:g.n,p:Math.round(gProg(g).p*100),date:g.date?dayKey(g.date):''}});
  var mo=D0.getMonth(),yr=D0.getFullYear(),mi=0,mg=0;
  var MVv=MV.filter(function(m){return m.a>0});
  MVv.forEach(function(m){var d=m.d instanceof Date?m.d:new Date(m.d);if(d.getMonth()==mo&&d.getFullYear()==yr){if(m.t=='i')mi+=m.a;else mg+=m.a}});
  var fm=function(n){try{return new Intl.NumberFormat('es-ES',{style:'currency',currency:CUR,maximumFractionDigits:0}).format(n)}catch(_){return Math.round(n)+' '+CUR}};
  var DIv=DI.filter(function(e){return e.parts&&e.parts.length}),diaryDays={};DIv.forEach(function(e){if(e.d)diaryDays[dayKey(e.d instanceof Date?e.d:new Date(e.d))]=1});
  var dStreak=0;for(var k=0;k<400;k++){if(diaryDays[dayKey(dOf(-k))])dStreak++;else if(k>0)break;else continue}
  var wkS=+wkStart(D0),doneWeek=T.filter(function(t){return t.done&&t.doneAt>=wkS}).length;
  var focusToday=SL.filter(function(s){return s.start>=d0}).reduce(function(a,s){return a+(s.min|0)},0);
  var act=HA().filter(function(h){return !h.water});
  return{v:1,at:now,day:today,dk:PREF.dk==null?-1:(PREF.dk?1:0),
    td:{p:dueToday.length,d:doneToday},tasks:tasks,habits:habits,
    water:{ml:W|0,goal:goal,day:today},events:eventsAhead(14),focus:focusSnap(),
    projects:projects,goals:goals,
    money:MVv.length?{disp:fm(disp()),inc:fm(mi),exp:fm(mg),n:MVv.length}:null,
    diary:DIv.length?{n:DIv.length,streak:dStreak,today:diaryDays[today]?1:0}:null,
    stats:{weekDone:doneWeek,focusMin:focusToday,habitPct:act.length?Math.round(act.reduce(function(s,h){return s+cons(h)},0)/act.length):0,hasData:(T.length+H.length+SL.length)>0},
    mods:{projects:activeP.length,goals:goals.length,money:MVv.length,diary:DIv.length,stats:(T.length+H.length+SL.length)>0?1:0}}}
AW.snapshot=buildSnapshot;

/* ---------- 2) operaciones ---------- */
function applied(){PREF.wOps=Array.isArray(PREF.wOps)?PREF.wOps:[];return PREF.wOps}
function remember(id){var a=applied();a.push(id);if(a.length>APPLIED_MAX)a.splice(0,a.length-APPLIED_MAX)}
function applyOp(op){
  var k=op.k,res=0;
  if(k==='tc'){var t=T.find(function(x){return x.id==op.id2});if(t&&!t.done){res=doneT(t,1)?1:0}}
  else if(k==='hl'){var h=H.find(function(x){return x.id==op.id2});if(h&&h.d[34]!=1){h.d[34]=1;res=1}}
  else if(k==='w'){var ml=Math.max(0,Math.min(2000,op.ml|0));if(ml){W=(W|0)+ml;wl();res=1}}
  else if(k==='fp'){if(F.mode==='run'){var at=Math.min(op.at||Date.now(),Date.now());
      if(F.kind==2){F.up=Math.max(0,Math.round((at-F.start)/1000))}else{F.left=Math.max(0,Math.round((F.end-at)/1000))}
      F.mode='pause';clearInterval(F.iv);F.iv=0;F.end=0;fUpd();res=1}}
  else if(k==='fs'){if(F.mode!=='run'){var a2=op.at||Date.now();
      if(F.kind==2){F.start=a2-(F.up||0)*1000;F.end=0}else{F.end=a2+F.left*1000;F.start=a2-(F.up||0)*1000}
      F.mode='run';restoreFocusSnapshot(focusSnapshot());resumeFocusTimer();res=1}}
  else if(k==='cq'){var tx=String(op.text||'').trim().slice(0,500);if(tx){
      if(op.type==='task')T.unshift(mkT(tx));else if(op.type==='idea')N.unshift(mkN(tx,'',{tags:['idea']}));else N.unshift(mkN(tx,''));res=1}}
  return res}
var busy=0,again=0;
async function drain(){
  if(!NAT()||!P.widgets||!ready)return;
  if(busy){again=1;return}busy=1;
  try{
    var r=await P.widgets.drainOps(),ops=(r&&r.ops)||[],ids=[],n=0;
    ops.sort(function(a,b){return(a.at||0)-(b.at||0)});
    var seen=applied();
    ops.forEach(function(op){ids.push(op.id);if(!op.id||seen.indexOf(op.id)>=0)return;
      try{if(applyOp(op))n++}catch(e){console.error('widget op',op,e)}remember(op.id)});
    if(ops.length)await persist();
    AW.stats.applied+=n;
    await commit(ids);
    if(n){try{if(mod.classList.contains('open'))redraw();else sync()}catch(_){}
      if(typeof toast==='function')toast(n==1?'Acción de un widget aplicada':n+' acciones de widgets aplicadas')}
  }catch(e){console.error('Áurea widgets: drain',e)}
  busy=0;if(again){again=0;drain()}}
AW.drain=drain;

/* ---------- publicación ---------- */
var lastStr='',pushT=0;
async function commit(ids){
  if(!NAT()||!P.widgets)return;
  var s=JSON.stringify(buildSnapshot());
  var same=s===lastStr&&!(ids&&ids.length);
  if(same)return;
  lastStr=s;AW.stats.pushes++;
  try{await P.widgets.commit({json:s,ids:ids||[]})}catch(e){lastStr='';console.error('Áurea widgets: commit',e)}}
function push(now){if(!NAT()||!P.widgets||!ready)return;clearTimeout(pushT);
  if(now){commit([]);return}
  pushT=setTimeout(function(){commit([])},900)}
AW.push=push;

/* ---------- deep links: aurea://open/<modulo>[/<id>] ---------- */
function route(url){
  try{var m=String(url||'').match(/^aurea:\/\/open\/([a-z]+)(?:\/(\d+))?(?:\/(start))?/);if(!m)return false;var mod_=m[1],id=m[2]?+m[2]:0;
    if(mod_==='routines'&&window.AureaRoutines){if(!id){openMod('routines');return true}if(!(m[3]?AureaRoutines.start(id):AureaRoutines.open(id))){openMod('routines');toast('Esa rutina ya no existe')}return true}
    var L={tasks:[T,'tasks','td'],habits:[H,'habits','hd'],cal:[E,'cal','ed'],projects:[PJ,'projects','pd'],goals:[GL,'stats','gl']}[mod_];
    if(L&&id){var i=L[0].findIndex(function(x){return x.id==id});
      if(i<0){openMod(L[1]);toast('Ese elemento ya no existe');return true}
      openMod(L[1]);V={k:L[1],sub:L[2],i:i};redraw();mod.scrollTop=0;return true}
    var KEYS={tasks:'tasks',habits:'habits',cal:'cal',notes:'notes',diary:'diary',money:'money',projects:'projects',focus:'focus',stats:'stats',goals:'stats'};
    if(KEYS[mod_]){openMod(KEYS[mod_]);return true}
  }catch(e){console.error('Áurea widgets: ruta',e)}
  return false}
AW.route=route;
async function whenReady(f){for(var w=0;w<300&&!ready;w++)await new Promise(function(r){setTimeout(r,100)});if(ready)f()}

/* ---------- arranque ---------- */
if(NAT()&&P.widgets){
  /* publicar tras cada guardado real (persist) sin tocar el script principal */
  var _persist=window.persist;
  if(typeof _persist==='function')window.persist=async function(){var r=await _persist.apply(this,arguments);push();return r};
  document.addEventListener('visibilitychange',function(){if(document.hidden)push(true);else drain().then(function(){push()})});
  addEventListener('pagehide',function(){push(true)});
  ['click','input','change','keyup','pointerup','touchend'].forEach(function(ev){addEventListener(ev,function(){push()},true)});
  setInterval(function(){if(!document.hidden)push()},30000);
  try{P.widgets.addListener('ops',function(){drain()})}catch(_){}
  try{if(P.app){P.app.addListener('appUrlOpen',function(e){whenReady(function(){route(e&&e.url)})});
      P.app.getLaunchUrl().then(function(r){if(r&&r.url)whenReady(function(){route(r.url)})}).catch(function(){})}}catch(_){}
  whenReady(function(){drain().then(function(){push(true)})});
}
})();
