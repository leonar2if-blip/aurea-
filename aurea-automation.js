/* ===== Áurea · Automatizaciones y Samsung (puente JS <-> nativo) =====
   Expone window.AureaAuto para la guía de Rutinas. No simula nada: cada acción llama a un ajuste o API real de Android.
   - Samsung "Modos y rutinas" no tiene API pública: aquí solo se detecta si la app está instalada y se abre para configurarla a mano.
   - Atajos del icono: estándar de Android (ShortcutManager) que abren aurea://open/routines/ID/start. */
(function(){'use strict';
var NAT=function(){try{return !!(window.Capacitor&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform())}catch(_){return false}};
var P=window.AureaPlugins||{},AF=window.AureaFeatures||{},A=window.AureaAuto={native:NAT()&&!!P.routines};
if(!A.native)return;
A.status=async function(){var s=await P.routines.status(),n={};
  try{if(AF.nt){n=await AF.nt.status();if(n.perm)s.notif=s.notif&&n.perm==='granted'}}catch(_){}return s};
A.shortcuts=async function(){var L=typeof RT!=='undefined'?RT.filter(function(r){return r.on&&r.st.length}):[];
  var items=L.map(function(r){return{id:'r'+r.id,label:r.n||'Rutina',url:'aurea://open/routines/'+r.id+'/start'}});
  var r=await P.routines.setShortcuts({items:items});return r.count};
/* Notificación silenciosa con palabra clave (canal aurea_auto) para que Modos y rutinas de Samsung u otra app la lea */
A.emit=async function(kind,r){var L=P.ln,N=AF.nt;if(!L||!N)return;try{var st=await N.status();if(st.perm!=='granted')return;
  await L.createChannel({id:'aurea_auto',name:'Automatizaciones (Samsung y otras apps)',description:'Notificaciones silenciosas con palabra clave para que otras apps las lean',importance:2,visibility:1,vibration:false,lights:false}).catch(function(){});
  await L.schedule({notifications:[{id:N.fnv('auto'+kind+r.id+Date.now()),title:'Áurea · '+(kind==='FIN'?'rutina completada':'inicio de rutina'),body:'AUREA_'+kind+' '+(r.n||'').trim(),channelId:'aurea_auto',smallIcon:'ic_stat_aurea',iconColor:'#237a74',group:'aurea_auto',schedule:{at:new Date(Date.now()+1500),allowWhileIdle:true},extra:{k:'r',id:r.id,key:'auto-'+kind,snz:1}}]})}catch(_){}};
A.act=async function(a){
  if(a==='autotest'){var r=(typeof RT!=='undefined'?RT:[]).find(function(x){return x.au})||(typeof RT!=='undefined'?RT:[])[0]||{id:0,n:'Prueba'};var st=await AF.nt.status();if(st.perm!=='granted'){await AF.nt.ask();st=await AF.nt.status();if(st.perm!=='granted')return 'Permite las notificaciones primero'}
    await A.emit('INICIO',r);return 'Notificación enviada: «AUREA_INICIO '+(r.n||'').trim()+'»'}
  if(a==='perm'){await AF.nt.ask();return ''}
  if(a==='exact'){await P.routines.openExactAlarmSettings();return ''}
  if(a==='battery'){await P.routines.openBatterySettings();return ''}
  if(a==='test'){await AF.nt.test();return ''}
  if(a==='samsung'){try{await P.routines.openSamsungRoutines()}catch(e){return String(e&&e.message||'No disponible')}return ''}
  if(a==='shortcuts'){var n=await A.shortcuts();return n?n+(n==1?' atajo actualizado':' atajos actualizados'):'No hay rutinas con pasos para crear atajos'}
  return ''};
/* Mantiene los atajos al día cuando cambian las rutinas (mismo ritmo que los avisos) */
var sig='',t=0;
function tick(){try{if(typeof RT==='undefined'||typeof ready==='undefined'||!ready)return;var s=JSON.stringify(RT.filter(function(r){return r.on&&r.st.length}).map(function(r){return[r.id,r.n]}));
  if(s===sig)return;sig=s;A.shortcuts().catch(function(){})}catch(_){}}
['click','change','keyup'].forEach(function(ev){addEventListener(ev,function(){clearTimeout(t);t=setTimeout(tick,2500)},true)});
document.addEventListener('visibilitychange',function(){if(!document.hidden)setTimeout(tick,1500)});
setTimeout(tick,4000);
})();
