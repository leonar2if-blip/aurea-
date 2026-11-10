/* ===== Áurea · Recordatorios nativos, copias .aurea, Google Drive y copias automáticas =====
   Script independiente: se carga DESPUÉS del script principal de Aurea.html y usa sus funciones globales
   (T, H, E, COL, applyData, snapshot, ask, toast, redraw…). No modifica el esquema de datos ni IndexedDB 'l2life'.
   Plugins nativos (Capacitor) llegan por window.AureaPlugins (aurea-native.js). Sin ellos (navegador) las copias
   funcionan igual con descarga/selección de archivo; los recordatorios nativos y Drive-nativo no. */
(function(){'use strict';
var AF=window.AureaFeatures={version:1,incompat:''};
var P=window.AureaPlugins||{};
var NAT=function(){try{return !!(window.Capacitor&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform())}catch(_){return false}};
/* ---- comprobación de compatibilidad con el Aurea.html actual ---- */
try{void[T,H,E,N,GL,COL,STORES,CORE,recs,applyData,snapshot,ask,sh,shut,toast,redraw,R,mod,PREF,save,fileStore,b64,unb64,jrev,iso,at,occ,dOf,HA,openMod,APP_V,esc,sz,fmtD,importData,persist,prom,setDk,sc,V,ready,ALL,dlBlob,CUR,MC,LASTB,db,sync]}
catch(e){AF.incompat=String(e&&e.message||e);console.error('Áurea features: incompatible',e);return}

var enc=new TextEncoder(),dec=new TextDecoder();
var $q=function(s){return document.querySelector(s)};
function AErr(m,x){var e=new Error(m);e.aurea=1;if(x)Object.assign(e,x);return e}
function toB64(u8){var s='',n=0x8000;for(var i=0;i<u8.length;i+=n)s+=String.fromCharCode.apply(null,u8.subarray(i,i+n));return btoa(s)}
function fromB64(s){var b=atob(s),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u}
function hex(buf){return Array.prototype.map.call(new Uint8Array(buf),function(x){return('0'+x.toString(16)).slice(-2)}).join('')}
async function sha256hex(u8){return hex(await crypto.subtle.digest('SHA-256',u8))}
async function pipe(u8,Ctor,fmt){var s=new Ctor(fmt),w=s.writable.getWriter();w.write(u8);w.close();return new Uint8Array(await new Response(s.readable).arrayBuffer())}
var canZip=function(){return typeof CompressionStream!=='undefined'&&typeof DecompressionStream!=='undefined'};
var pad2=function(n){return String(n).padStart(2,'0')};
var stamp=function(d){d=d||new Date();return d.getFullYear()+pad2(d.getMonth()+1)+pad2(d.getDate())+'-'+pad2(d.getHours())+pad2(d.getMinutes())};

/* ================= almacén propio (IndexedDB 'aurea-bk': claves, tokens, copias en navegador) ================= */
function kv(){return new Promise(function(ok,ko){var r=indexedDB.open('aurea-bk',1);r.onupgradeneeded=function(){var d=r.result;['keys','cloud','copies'].forEach(function(s){if(!d.objectStoreNames.contains(s))d.createObjectStore(s)})};r.onsuccess=function(){ok(r.result)};r.onerror=function(){ko(r.error)}})}
async function kvDo(store,mode,fn){var d=await kv();try{return await new Promise(function(ok,ko){var t=d.transaction(store,mode),s=t.objectStore(store),q=fn(s);t.oncomplete=function(){ok(q&&q.result)};t.onerror=t.onabort=function(){ko(t.error)}})}finally{d.close()}}
var kvGet=function(s,k){return kvDo(s,'readonly',function(o){return o.get(k)})};
var kvPut=function(s,k,v){return kvDo(s,'readwrite',function(o){return o.put(v,k)})};
var kvDel=function(s,k){return kvDo(s,'readwrite',function(o){return o.delete(k)})};
var kvKeys=function(s){return kvDo(s,'readonly',function(o){return o.getAllKeys()})};

/* ================= configuración local (no viaja en las copias) ================= */
var CFG_K='aurea.bk.cfg',ST_K='aurea.bk.st';
var cfgDef={enc:0,keep:7,local:'off',drive:'off',cid:'',sec:'',folder:''};
function lsj(k,d){try{return Object.assign({},d,JSON.parse(localStorage.getItem(k)||'{}'))}catch(_){return Object.assign({},d)}}
function lsw(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(_){return false}}
var cfg=function(){return lsj(CFG_K,cfgDef)},cfgSet=function(p){lsw(CFG_K,Object.assign(cfg(),p))};
var stt=function(){return lsj(ST_K,{local:{},drive:{}})},sttSet=function(t,p){var s=stt();s[t]=Object.assign({},s[t],p);lsw(ST_K,s)};

/* ================= formato .aurea =================
   Archivo JSON (UTF-8): cabecera legible + payload base64.
   payload = [gzip] ( JSON de datos ) [AES-256-GCM, clave PBKDF2-SHA256]; sha256 = hash del payload tal como se guarda.
   La cabecera completa se autentica como "datos adicionales" de AES-GCM: si se toca, el descifrado falla. */
var FMT=1,KDF_ITER=310000;
var aad=function(h){return JSON.stringify([h.format,h.formatVersion,h.appVersion,h.created,h.encrypted,h.comp,h.kdf||null,h.cipher&&h.cipher.iv||null,h.counts,h.attachments])};
async function deriveKey(pass,salt,iter){var km=await crypto.subtle.importKey('raw',enc.encode(String(pass).normalize('NFKC')),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt:salt,iterations:iter,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
/* La clave derivada (no extraíble) se guarda en este teléfono para copias automáticas sin pedir la contraseña. */
async function setPassphrase(pass){if(!pass||pass.length<8)throw AErr('La contraseña debe tener al menos 8 caracteres');
  var salt=crypto.getRandomValues(new Uint8Array(16)),key=await deriveKey(pass,salt,KDF_ITER);
  await kvPut('keys','main',{key:key,salt:toB64(salt),iter:KDF_ITER,at:Date.now()});cfgSet({enc:1})}
var hasKey=async function(){try{return !!(await kvGet('keys','main'))}catch(_){return false}};
async function buildPayload(){await persist();var c=COL(),data={};STORES.forEach(function(k){data[k]=recs(k,c[k])});
  var fl=db?await prom(fileStore('readonly').getAll()):[],files=[];for(var i=0;i<fl.length;i++){var f=fl[i];files.push({id:f.id,name:f.name,type:f.type,size:f.size,b64:await b64(f.blob)})}
  var prefs={cur:CUR,mc:MC,dk:PREF.dk,nt:PREF.nt,waterGoal:PREF.waterGoal};
  return{app:'Áurea',v:APP_V,exported:new Date(),prefs:prefs,data:data,files:files}}
var jrep=function(k,v){var r=this[k];return r instanceof Date?{$d:+r}:v};/* propio: mismo formato {$d:ms} que lee jrev; no depende de que Aurea.html lo exponga */
var contentOf=function(o){return JSON.stringify({d:o.data,p:o.prefs,f:o.files.map(function(f){return[f.id,f.size]})},jrep)};
async function pack(o,opts){opts=opts||{};var useEnc=opts.encrypt==null?!!cfg().enc:!!opts.encrypt;
  var raw=enc.encode(JSON.stringify(o,jrep)),comp='none';if(canZip()){raw=await pipe(raw,CompressionStream,'gzip');comp='gzip'}
  var counts={};STORES.forEach(function(k){counts[k]=(o.data[k]||[]).length});
  var h={format:'aurea-backup',formatVersion:FMT,appVersion:APP_V,created:new Date().toISOString(),encrypted:useEnc,comp:comp,counts:counts,attachments:o.files.length},body=raw;
  if(useEnc){var K=await kvGet('keys','main');if(!K)throw AErr('Falta la contraseña de cifrado. Defínela en Ajustes → Copias de seguridad.');
    var iv=crypto.getRandomValues(new Uint8Array(12));h.kdf={name:'PBKDF2',hash:'SHA-256',iter:K.iter,salt:K.salt};h.cipher={name:'AES-GCM',iv:toB64(iv)};
    body=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:iv,additionalData:enc.encode(aad(h))},K.key,raw))}
  h.sha256=await sha256hex(body);h.payload=toB64(body);return JSON.stringify(h)}
/* inspect: lee la cabecera y comprueba integridad SIN tocar datos */
async function inspect(text){var h;try{h=JSON.parse(text)}catch(_){throw AErr('No es un archivo .aurea válido')}
  if(h&&!h.format&&(h.app==='Áurea'||h.app==='L2 Life')&&h.data)return{legacy:1,h:h};
  if(!h||h.format!=='aurea-backup'||typeof h.payload!=='string')throw AErr('No es un archivo .aurea válido');
  if(!(h.formatVersion>=1))throw AErr('Formato de copia desconocido');
  if(h.formatVersion>FMT)throw AErr('Copia creada con una versión más nueva de Áurea. Actualiza la app para restaurarla.');
  if((h.appVersion|0)>APP_V)throw AErr('Copia creada con una versión más nueva de Áurea. Actualiza la app para restaurarla.');
  var body;try{body=fromB64(h.payload)}catch(_){throw AErr('Copia dañada (contenido ilegible)')}
  if(await sha256hex(body)!==h.sha256)throw AErr('Copia dañada: falla la verificación de integridad (SHA-256)');
  return{h:h,body:body}}
async function openBackup(ins,pass){if(ins.legacy)return ins.h;var h=ins.h,raw=ins.body;
  if(h.encrypted){if(!h.kdf||!h.cipher||!(h.kdf.iter>=100000&&h.kdf.iter<=3000000))throw AErr('Cabecera de cifrado no válida');
    var key=await deriveKey(pass||'',fromB64(h.kdf.salt),h.kdf.iter);
    try{raw=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64(h.cipher.iv),additionalData:enc.encode(aad(h))},key,raw))}catch(_){throw AErr('Contraseña incorrecta, o la copia fue modificada')}}
  if(h.comp==='gzip'){if(!canZip())throw AErr('Este dispositivo no puede descomprimir la copia');raw=await pipe(raw,DecompressionStream,'gzip')}
  var o;try{o=JSON.parse(dec.decode(raw),jrev)}catch(_){throw AErr('Copia dañada (datos ilegibles)')}return validate(o)}
function validate(o){if(!o||!['Áurea','L2 Life'].includes(o.app)||!o.data||CORE.some(function(k){return !Array.isArray(o.data[k])}))throw AErr('La copia no contiene datos de Áurea');
  if((o.v|0)>APP_V)throw AErr('Copia creada con una versión más nueva de Áurea');
  if(o.files&&!Array.isArray(o.files))throw AErr('Adjuntos no válidos');return o}
AF.fmt={pack:pack,inspect:inspect,openBackup:openBackup,buildPayload:buildPayload,setPassphrase:setPassphrase,contentOf:contentOf};
var buildText=async function(opts){var o=await buildPayload();return{text:await pack(o,opts),hash:await sha256hex(enc.encode(contentOf(o))),o:o}};

/* ================= restauración segura ================= */
var pw=null;
function sheetOpen(html,focus){pwCancel();sh.dataset.s='af';sh.innerHTML=html;sh.classList.add('open');sc.classList.add('open');if(focus)setTimeout(function(){var i=$q(focus);i&&i.focus()},350)}
function pwCancel(){if(pw){var f=pw;pw=null;f(null)}}
function askPass(title,msg,okLabel,confirm){return new Promise(function(res){
  sheetOpen('<h3>'+esc(title)+'</h3><p class="sm" style="margin:0 0 8px">'+esc(msg)+'</p><input id="af-pw" type="password" autocomplete="off" enterkeyhint="done" placeholder="Contraseña">'+(confirm?'<input id="af-pw2" type="password" autocomplete="off" enterkeyhint="done" placeholder="Repite la contraseña" style="margin-top:10px">':'')+'<button class="pill" id="af-ok">'+esc(okLabel||'Aceptar')+'</button><button class="pill gh" id="af-no">Cancelar</button>','#af-pw');pw=res})}
sh.addEventListener('click',function(e){if(sh.dataset.s!=='af')return;var id=e.target.id;
  if(id==='af-ok'&&pw){var a=$q('#af-pw'),b=$q('#af-pw2');if(!a||!a.value)return;if(b&&b.value!==a.value){toast('Las contraseñas no coinciden');return}var f=pw;pw=null;shut();f(a.value)}
  else if(id==='af-no'){shut();pwCancel()}});
sh.addEventListener('keydown',function(e){if(sh.dataset.s==='af'&&e.key==='Enter'){var ok=$q('#af-ok');ok&&ok.click()}});
sc.addEventListener('click',function(){if(sh.dataset.s==='af'){pwCancel();if(link)link.cancelled=1}});
var busy=0;
async function restoreText(text,label){if(busy)return;busy=1;
  try{var ins;try{ins=await inspect(text)}catch(e){toast(e.message);return}
    if(ins.legacy){importData(new Blob([text],{type:'application/json'}));return}
    var pass='';if(ins.h.encrypted){pass=await askPass('Copia cifrada','Escribe la contraseña con la que se cifró esta copia.','Descifrar');if(pass==null)return}
    var o;try{o=await openBackup(ins,pass)}catch(e){toast(e.message);return}
    var n=STORES.reduce(function(s,k){return s+(o.data[k]||[]).length},0),m=ALL().reduce(function(s,a){return s+a.length},0),d=new Date(ins.h.created||o.exported);
    ask('Restaurar copia de seguridad',(label?'Archivo «'+label+'» · ':'')+'copia del '+fmtD(d.getTime())+' · '+n+' elementos y '+(o.files||[]).length+' adjuntos. Se reemplazarán los datos actuales ('+m+' elementos). Antes se guarda un punto interno para poder deshacerlo (Ajustes → Datos → «Deshacer la última importación, restauración o borrado»).','Restaurar',async function(){
      try{await snapshot();var fl=(o.files||[]).map(function(f){return{id:f.id,name:f.name,type:f.type,size:f.size,blob:unb64(f.b64,f.type)}});
        await applyData(o.data,fl,o.prefs);var p=o.prefs||{};
        if(p.nt)PREF.nt=p.nt;if(p.waterGoal!=null)PREF.waterGoal=p.waterGoal;if(p.dk!=null&&!!p.dk!==dk)setDk(!!p.dk);save();
        toast('Copia restaurada');AF.nt&&AF.nt.sync(1)}catch(e){toast('No se pudo restaurar: tus datos anteriores siguen disponibles')}})}
  finally{busy=0}}
AF.restoreText=restoreText;

/* ================= almacenamiento de copias locales =================
   Android: carpeta pública Descargas/ÁUREA (plugin nativo AureaBackups): sobrevive a desinstalar la app.
   Las copias antiguas del almacenamiento privado (Data/backups) se siguen listando y se mueven a Descargas.
   Navegador: IndexedDB (aurea-bk/copies), como antes. */
var DIR='backups';
var EXTN=function(){return NAT()&&!!P.backups&&!!P.fs};
/* Las pantallas del sistema que Áurea abre a propósito (permisos, selector de archivos, compartir) pasan la app a segundo plano:
   se avisa al bloqueo para que no lo trate como salida (ventana corta; ver AureaLock.expect en Aurea.html). */
var expectOut=function(ms){try{window.AureaLock&&AureaLock.expect(ms||45000)}catch(_){}};
var tmpName=function(){return'bk-'+Date.now()+'-'+Math.random().toString(36).slice(2,8)+'.tmp'};
var byNameDesc=function(a,b){return b.name<a.name?-1:b.name>a.name?1:0};
async function extPerm(interactive){var st=await P.backups.status();if(!st.needsPermission||st.granted)return;
  if(!interactive)throw AErr('Falta el permiso de almacenamiento (Android 9 o anterior). Se pide al crear una copia manual.',{noperm:1});
  expectOut(60000);var r=await P.backups.ensurePermission();
  if(!r.granted)throw AErr('Sin el permiso de almacenamiento no se puede guardar en Descargas/ÁUREA',{noperm:1})}
async function extSave(name,text,interactive){await extPerm(interactive);var t=tmpName();
  await P.fs.writeFile({path:t,data:text,directory:P.Dir.Cache,encoding:P.Enc.UTF8});
  try{return await P.backups.saveFromCache({name:name,cacheName:t})}
  catch(e){try{await P.fs.deleteFile({path:t,directory:P.Dir.Cache})}catch(_){}throw AErr(String(e&&e.message||'No se pudo guardar en Descargas/ÁUREA'))}}
async function cacheText(r){var t;try{t=(await P.fs.readFile({path:r.cacheName,directory:P.Dir.Cache,encoding:P.Enc.UTF8})).data}
  finally{try{await P.fs.deleteFile({path:r.cacheName,directory:P.Dir.Cache})}catch(_){}}return t}
var Store={
 async list(){
  if(EXTN()){var out=[];
   try{var r=await P.backups.list();(r.files||[]).forEach(function(f){out.push({name:f.name,size:f.size,mtime:f.mtime||0,src:'ext',uri:f.uri})})}catch(_){}
   try{var r2=await P.fs.readdir({path:DIR,directory:P.Dir.Data});r2.files.forEach(function(f){if(/\.aurea$/.test(f.name)&&!out.some(function(o){return o.name===f.name}))out.push({name:f.name,size:f.size,mtime:f.mtime||0,src:'int'})})}catch(_){}
   return out.sort(byNameDesc)}
  var ks=await kvKeys('copies');return Promise.all(ks.map(async function(k){var t=await kvGet('copies',k);return{name:k,size:t.length,mtime:0,src:'idb'}})).then(function(a){return a.sort(byNameDesc)})},
 async save(name,text,interactive){if(EXTN())return extSave(name,text,!!interactive);await kvPut('copies',name,text)},
 async read(f){if(typeof f==='string')f={name:f,src:EXTN()?'int':'idb'};
  if(f.src==='ext'){return cacheText(await P.backups.readToCache({uri:f.uri}))}
  if(f.src==='int'){var r=await P.fs.readFile({path:DIR+'/'+f.name,directory:P.Dir.Data,encoding:P.Enc.UTF8});return r.data}
  return kvGet('copies',f.name)},
 async del(f){if(typeof f==='string')f={name:f,src:EXTN()?'int':'idb'};
  if(f.src==='ext'){await P.backups.remove({uri:f.uri});return}
  if(f.src==='int'){await P.fs.deleteFile({path:DIR+'/'+f.name,directory:P.Dir.Data});return}
  await kvDel('copies',f.name)}};
/* Mueve las copias del almacenamiento privado (antiguas) a Descargas/ÁUREA, una sola vez y sin pedir permisos nuevos. */
async function migrateLegacy(){if(!EXTN()||cfg().mig)return;
  try{var st=await P.backups.status();if(st.needsPermission&&!st.granted)return;
    var r;try{r=await P.fs.readdir({path:DIR,directory:P.Dir.Data})}catch(_){cfgSet({mig:1});return}
    var moved=0,fail=0;
    for(var i=0;i<r.files.length;i++){var f=r.files[i];if(!/\.aurea$/.test(f.name))continue;
      try{var d=await P.fs.readFile({path:DIR+'/'+f.name,directory:P.Dir.Data,encoding:P.Enc.UTF8});await extSave(f.name,d.data,false);await P.fs.deleteFile({path:DIR+'/'+f.name,directory:P.Dir.Data});moved++}catch(_){fail++}}
    if(!fail)cfgSet({mig:1});if(moved)toast(moved+(moved===1?' copia antigua movida':' copias antiguas movidas')+' a Descargas/ÁUREA')}
  catch(_){}}
AF.store=Store;
/* Rotación: solo se borran copias AUTOMÁTICAS antiguas, nunca las manuales, y solo por encima del límite configurado. */
async function rotateLocal(keep){var l=(await Store.list()).filter(function(f){return /^Aurea-auto-/.test(f.name)});for(var i=keep;i<l.length;i++){try{await Store.del(l[i])}catch(_){}}}

/* ================= exportar / importar a mano ================= */
async function shareOrDownload(name,text){
  if(NAT()&&P.fs&&P.share){expectOut(60000);await P.fs.writeFile({path:name,data:text,directory:P.Dir.Cache,encoding:P.Enc.UTF8});var u=await P.fs.getUri({path:name,directory:P.Dir.Cache});
    await P.share.share({title:'Copia de Áurea',text:'Copia de seguridad de Áurea',files:[u.uri],dialogTitle:'Guardar copia de Áurea'});
    try{await P.fs.deleteFile({path:name,directory:P.Dir.Cache})}catch(_){}return}
  dlBlob(new Blob([text],{type:'application/octet-stream'}),name)}
async function manualBackup(share){if(busy)return;busy=1;try{var b=await buildText(),name='Aurea-copia-'+stamp()+'.aurea';
  if(EXTN()&&!share){var rs=await Store.save(name,b.text,true);toast((cfg().enc?'Copia cifrada guardada en ':'Copia (sin cifrar) guardada en ')+((rs&&rs.path)||'Descargas/ÁUREA'),null,4500)}
  else{await shareOrDownload(name,b.text);toast(cfg().enc?'Copia cifrada creada':'Copia creada (sin cifrar)')}
  LASTB=Date.now();save();cache.local=null;redraw();uiRefresh()}
  catch(e){if(e&&/cancel/i.test(String(e.message||e)))return;toast(e.aurea?e.message:'No se pudo crear la copia')}finally{busy=0}}
function pickFile(){expectOut(60000);var i=document.createElement('input');i.type='file';i.accept='.aurea,.json,application/json,application/octet-stream,*/*';i.style.display='none';
  i.onchange=async function(){var f=i.files&&i.files[0];i.remove();if(!f)return;if(f.size>300*1048576){toast('Archivo demasiado grande');return}restoreText(await f.text(),f.name)};document.body.appendChild(i);i.click()}

/* Restaurar un archivo de copia externo (Descargas/ÁUREA, Drive descargado, otra carpeta…). En Android abre el selector del sistema
   directamente en Descargas/ÁUREA y funciona también tras desinstalar y reinstalar Áurea. Distinto de «Deshacer última importación» (punto interno). */
async function pickExternal(){
  if(!EXTN()){pickFile();return}
  expectOut(60000);var r;try{r=await P.backups.pickBackup()}catch(e){toast('No se pudo abrir el selector de archivos');return}
  if(!r||r.cancelled)return;var text;
  try{text=await cacheText(r)}catch(_){toast('No se pudo leer el archivo');return}
  restoreText(text,r.name)}

/* ================= Google Drive (OAuth "dispositivos con entrada limitada": sin redirecciones ni SDK) ================= */
var G=Object.assign({dev:'https://oauth2.googleapis.com/device/code',tok:'https://oauth2.googleapis.com/token',api:'https://www.googleapis.com/drive/v3',up:'https://www.googleapis.com/upload/drive/v3/files',
  info:'https://www.googleapis.com/oauth2/v3/userinfo',revoke:'https://oauth2.googleapis.com/revoke',scope:'https://www.googleapis.com/auth/drive.file email',verify:'https://www.google.com/device'},window.AUREA_G||{});
var lowerH=function(h){var o={};if(h&&h.forEach)h.forEach(function(v,k){o[String(k).toLowerCase()]=v});else for(var k in (h||{}))o[k.toLowerCase()]=h[k];return o};
async function http(o){var h=Object.assign({},o.headers||{}),data;
  if(o.form){h['Content-Type']='application/x-www-form-urlencoded';data=o.form}else if(o.json){h['Content-Type']='application/json; charset=UTF-8';data=o.json}else data=o.body;
  if(NAT()&&P.http){var r=await P.http.request({url:o.url,method:o.method||'GET',headers:h,data:data,responseType:o.text?'text':'json',connectTimeout:30000,readTimeout:180000}),d=r.data;
    if(!o.text&&typeof d==='string'){try{d=JSON.parse(d)}catch(_){}}return{status:r.status,data:d,headers:lowerH(r.headers)}}
  var body=o.form?new URLSearchParams(o.form).toString():(o.json?JSON.stringify(o.json):o.body),res=await fetch(o.url,{method:o.method||'GET',headers:h,body:body}),t=await res.text(),dd=t;
  if(!o.text){try{dd=JSON.parse(t)}catch(_){}}return{status:res.status,data:dd,headers:lowerH(res.headers)}}
var offline=function(){return typeof navigator!=='undefined'&&navigator.onLine===false};
/* Inicio de sesión nativo (Android): token de acceso de la cuenta de Google del teléfono, sin ID de cliente ni secreto. Se renueva en silencio. */
var NATG=function(){return NAT()&&!!P.gauth};
async function gNative(t,force){if(!force&&t.access&&t.exp>Date.now()+120000)return t.access;
  var r;try{r=await P.gauth.authorize({interactive:false})}catch(e){if(e&&e.code==='NEEDS_SIGN_IN'){await kvDel('cloud','tok');throw AErr('Google pide iniciar sesión de nuevo.',{relink:1})}throw AErr('No se pudo renovar el acceso a Google: '+String(e&&e.message||e).slice(0,80))}
  t.access=r.accessToken;t.exp=Date.now()+50*6e4;if(r.email)t.email=r.email;await kvPut('cloud','tok',t);return t.access}
async function gToken(force){var t=await kvGet('cloud','tok');if(t&&t.native&&NATG())return gNative(t,force);
  if(!t||!t.refresh)throw AErr('Cuenta de Google no vinculada',{relink:1});
  if(!force&&t.access&&t.exp>Date.now()+60000)return t.access;var c=cfg();
  var r=await http({method:'POST',url:G.tok,form:{client_id:c.cid,client_secret:c.sec,refresh_token:t.refresh,grant_type:'refresh_token'}});
  if(r.status!==200){if(r.data&&r.data.error==='invalid_grant'){await kvDel('cloud','tok');throw AErr('Google ya no autoriza esta cuenta (caducó o se revocó). Vincúlala de nuevo.',{relink:1})}throw AErr('No se pudo renovar el acceso a Google (HTTP '+r.status+')')}
  t.access=r.data.access_token;t.exp=Date.now()+(r.data.expires_in||3600)*1000;await kvPut('cloud','tok',t);return t.access}
async function gApi(o,retry){var tok=await gToken(!!retry),r=await http(Object.assign({},o,{headers:Object.assign({},o.headers,{Authorization:'Bearer '+tok})}));
  if(r.status===401&&!retry)return gApi(o,1);
  if(r.status>=400){var m=r.data&&r.data.error&&(r.data.error.message||r.data.error)||('HTTP '+r.status);throw AErr('Drive: '+m,{http:r.status})}return r}
var driveName='Áurea copias';
async function ensureFolder(){var c=cfg();if(c.folder){try{var r=await gApi({url:G.api+'/files/'+c.folder+'?fields=id,trashed'});if(r.data&&!r.data.trashed)return c.folder}catch(e){if(e.http!==404)throw e}}
  var q="name='"+driveName+"' and mimeType='application/vnd.google-apps.folder' and trashed=false",l=await gApi({url:G.api+'/files?fields=files(id)&q='+encodeURIComponent(q)}),id;
  if(l.data.files&&l.data.files.length)id=l.data.files[0].id;else id=(await gApi({method:'POST',url:G.api+'/files?fields=id',json:{name:driveName,mimeType:'application/vnd.google-apps.folder'}})).data.id;
  cfgSet({folder:id});return id}
var Drive={
 linked:async function(){try{var t=await kvGet('cloud','tok');return !!(t&&(t.refresh||(t.native&&NATG())))}catch(_){return false}},
 account:async function(){var t=await kvGet('cloud','tok');return t&&t.email||''},
 async list(){var f=await ensureFolder(),r=await gApi({url:G.api+'/files?pageSize=100&orderBy=createdTime%20desc&fields=files(id,name,size,createdTime)&q='+encodeURIComponent("'"+f+"' in parents and trashed=false")});
   return(r.data.files||[]).filter(function(x){return /\.aurea$/.test(x.name)})},
 async upload(name,text){var f=await ensureFolder(),init=await gApi({method:'POST',url:G.up+'?uploadType=resumable&fields=id,name,size',json:{name:name,parents:[f],mimeType:'application/octet-stream'},headers:{'X-Upload-Content-Type':'application/octet-stream'}}),loc=init.headers.location;
   if(!loc)throw AErr('Drive no devolvió la sesión de subida');var r=await gApi({method:'PUT',url:loc,body:text,text:1,headers:{'Content-Type':'application/octet-stream'}});return r.data},
 async download(id){return(await gApi({url:G.api+'/files/'+id+'?alt=media',text:1})).data},
 async del(id){await gApi({method:'DELETE',url:G.api+'/files/'+id,text:1})},
 async unlink(){var t=await kvGet('cloud','tok');if(t&&t.refresh&&!t.native){try{await http({method:'POST',url:G.revoke,form:{token:t.refresh}})}catch(_){}}await kvDel('cloud','tok');cfgSet({folder:''})}};
AF.drive=Drive;
/* «Iniciar sesión con Google»: un toque, como en WhatsApp. Tras elegir la cuenta se activa la copia diaria y se sube la primera copia. */
async function signInGoogle(){if(!NATG()){toast('El inicio de sesión con Google solo existe en la app de Android');return}
  if(offline()){toast('Sin conexión: no se puede iniciar sesión ahora');return}
  expectOut(60000);var r;
  try{r=await P.gauth.authorize({interactive:true})}catch(e){toast('Google: '+String(e&&e.message||'no se pudo iniciar sesión').slice(0,90));return}
  if(!r||r.cancelled||!r.accessToken){toast('Inicio de sesión cancelado');return}
  await kvPut('cloud','tok',{native:1,access:r.accessToken,exp:Date.now()+50*6e4,email:r.email||''});
  cfgSet({drive:'daily',folder:''});toast('Sesión iniciada · subiendo la primera copia…',null,3000);uiRefresh();
  try{await backupTo('drive',null,false);sttSet('drive',{last:Date.now(),err:'',errAt:0});cache.drive=null;toast('Copia subida a tu Google Drive',null,3500)}
  catch(e){sttSet('drive',{err:String(e&&e.message||e),errAt:Date.now()});toast('Sesión iniciada, pero la subida falló: '+String(e&&e.aurea?e.message:'error'),null,5000)}
  uiRefresh()}
var link=null;
async function linkAccount(){var c=cfg();if(!c.cid||!c.sec){toast('Primero escribe el ID de cliente y el secreto de Google');return}
  if(offline()){toast('Sin conexión: no se puede vincular ahora');return}
  var r;try{r=await http({method:'POST',url:G.dev,form:{client_id:c.cid,scope:G.scope}})}catch(e){toast('No se pudo contactar con Google');return}
  if(r.status!==200||!r.data.device_code){toast('Google rechazó el ID de cliente'+(r.data&&r.data.error?' ('+r.data.error+')':''));return}
  var d=r.data,url=d.verification_url||G.verify,tok={cancelled:0};link=tok;
  sheetOpen('<h3>Vincular Google Drive</h3><p class="sm" style="margin:0 0 6px">1. Abre <b>'+esc(url.replace(/^https?:\/\//,''))+'</b> en cualquier navegador.<br>2. Escribe este código y acepta:</p><div class="kv" style="justify-content:center"><b style="font-size:30px;letter-spacing:.12em">'+esc(d.user_code)+'</b></div><p class="sm" id="af-lst" style="margin:6px 0 0">Esperando autorización…</p><button class="pill" id="af-open">Abrir página de Google</button><button class="pill gh" id="af-cancel">Cancelar</button>');
  var onc=function(e){if(sh.dataset.s!=='af')return;if(e.target.id==='af-open'){expectOut(60000);try{window.open(url,'_blank')}catch(_){}}else if(e.target.id==='af-cancel'){tok.cancelled=1;shut()}};sh.addEventListener('click',onc);
  var iv=(d.interval||5)*1000,end=Date.now()+(d.expires_in||900)*1000,done=0;
  try{while(!tok.cancelled&&Date.now()<end){await new Promise(function(ok){setTimeout(ok,iv)});if(tok.cancelled)break;
      var p;try{p=await http({method:'POST',url:G.tok,form:{client_id:c.cid,client_secret:c.sec,device_code:d.device_code,grant_type:'urn:ietf:params:oauth:grant-type:device_code'}})}catch(_){continue}
      if(p.status===200&&p.data.refresh_token){var email='';try{var u=await http({url:G.info,headers:{Authorization:'Bearer '+p.data.access_token}});email=u.data&&u.data.email||''}catch(_){}
        await kvPut('cloud','tok',{refresh:p.data.refresh_token,access:p.data.access_token,exp:Date.now()+(p.data.expires_in||3600)*1000,email:email});done=1;break}
      var er=p.data&&p.data.error;if(er==='slow_down')iv+=5000;else if(er==='access_denied'){toast('Autorización denegada');break}else if(er&&er!=='authorization_pending'){toast('Google: '+er);break}}
    if(!done&&!tok.cancelled&&Date.now()>=end)toast('El código caducó. Inténtalo de nuevo.')}
  finally{sh.removeEventListener('click',onc);link=null;if(sh.dataset.s==='af'&&!tok.cancelled)shut()}
  if(done){toast('Google Drive vinculado');uiRefresh()}}

/* ================= copias (manual a Drive / locales) y automatización ================= */
var running=0;
async function backupTo(target,pre,auto){var b=pre||await buildText(),name=(auto?'Aurea-auto-':'Aurea-copia-')+stamp()+'.aurea';
  if(target==='local'){await Store.save(name,b.text,!auto);if(auto)await rotateLocal(Math.max(1,cfg().keep|0))}else{await Drive.upload(name,b.text);if(auto)await rotateDrive(Math.max(1,cfg().keep|0))}
  return name}
async function rotateDrive(keep){var l=(await Drive.list()).filter(function(f){return /^Aurea-auto-/.test(f.name)});for(var i=keep;i<l.length;i++){try{await Drive.del(l[i].id)}catch(_){}}}
var IV={daily:20*36e5,weekly:6.5*864e5,monthly:29*864e5},RETRY=30*6e4;
function due(target,now){var c=cfg(),f=c[target];if(!IV[f])return false;var s=stt()[target]||{};if(s.errAt&&now-s.errAt<RETRY)return false;return now-(s.last||0)>=IV[f]}
AF.due=due;
async function autoRun(force){if(running||!ready||!db)return;if(!ALL().some(function(a){return a.length}))return;var now=Date.now(),need=[];
  ['local','drive'].forEach(function(t){if(force===t||due(t,now))need.push(t)});if(!need.length)return;running=1;
  try{var b=null;
    for(var i=0;i<need.length;i++){var t=need[i];
      try{if(t==='drive'){if(offline()){sttSet('drive',{pending:1,err:'Sin conexión: se reintentará al volver la red'});continue}if(!(await Drive.linked())){sttSet('drive',{err:'Cuenta de Google no vinculada',errAt:now});continue}}
        b=b||await buildText();var s=stt()[t]||{};
        if(force!==t&&s.hash&&s.hash===b.hash){sttSet(t,{last:Date.now(),err:'',errAt:0,pending:0});continue}   /* sin cambios desde la última copia */
        var name=await backupTo(t,b,true);sttSet(t,{last:Date.now(),hash:b.hash,name:name,err:'',errAt:0,pending:0})}
      catch(e){sttSet(t,{err:String(e&&e.message||e),errAt:Date.now()});if(e&&e.noperm)continue;toast('Copia '+(t==='drive'?'en Drive':'local')+' fallida: '+String(e&&e.aurea?e.message:'error')+' (se reintentará)',null,5000)}}}
  finally{running=0;uiRefresh()}}
AF.autoRun=autoRun;
addEventListener('online',function(){autoRun()});
document.addEventListener('visibilitychange',function(){if(!document.hidden)autoRun()});

/* ================= recordatorios nativos (LocalNotifications) ================= */
var NT={H:30,MAX:150,ROFF:[0,0,10,60,1440],HOFF:[0,0,10,60]},SOUNDS={sistema:'Sonido del sistema',suave:'Campana suave',alarma:'Alarma',ninguno:'Solo vibración / silencio'};
var ntp=function(){return Object.assign({sound:'sistema',vib:1,snooze:10,on:1},PREF.nt||{})};
var fnv=function(s){var h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0}return(h&0x7fffffff)||1};
var chanId=function(p){return 'aurea_'+p.sound+(p.vib?'_v':'_n')};
function compute(now){now=now||Date.now();var out=[],base=new Date(now);base.setHours(0,0,0,0);
  var day=function(n){var d=new Date(base);d.setDate(d.getDate()+n);return d};
  for(var n=0;n<=NT.H;n++){var d=day(n);
    E.forEach(function(e){if(!e.rem||!(e.t||'').trim()||!occ(e,d))return;var st=at(d,e.all||!e.time?'09:00':e.time),tr=st-NT.ROFF[e.rem]*6e4;
      if(tr>now)out.push({key:'e'+e.id+'|'+iso(d),k:'e',id:e.id,at:tr,title:e.t,body:'Evento'+(e.all?' · todo el día':e.time?' · '+e.time:'')+(e.loc?' · '+e.loc:'')})});
    T.forEach(function(t){var pd=t.plan||t.due;if(t.done||!t.rem||!pd||!(t.t||'').trim())return;var same=iso(pd)===iso(d);if(!same)return;
      var st=at(d,t.time||'09:00'),tr=st-NT.ROFF[t.rem]*6e4;if(tr>now)out.push({key:'t'+t.id+'|'+iso(d),k:'t',id:t.id,at:tr,title:t.t,body:'Tarea'+(t.time?' · '+t.time:'')})});
    HA().forEach(function(h){if(!h.rem||!h.tm||!(h.n||'').trim())return;if(n===0&&h.d[34]==1)return;var wd=d.getDay();if(h.fq==1&&(wd===0||wd===6))return;
      var tr=at(d,h.tm)-NT.HOFF[h.rem]*6e4;if(tr>now)out.push({key:'h'+h.id+'|'+iso(d),k:'h',id:h.id,at:tr,title:h.n,body:'Hábito · '+h.tm})});
    if(typeof RT!=='undefined'&&typeof rPlan==='function')RT.forEach(function(r){if(!r.on||!(r.rem||r.au)||!r.tm||!(r.n||'').trim()||!r.st.length||!rSched(r,d))return;
      var ru=n===0?rRunOf(r):null;
      if(r.au){var tra=at(d,r.tm);if(tra>now&&!ru)out.push({key:'a'+r.id+'|'+iso(d),k:'r',id:r.id,at:tra,title:'Áurea · inicio de rutina',body:rKey(r,'INICIO'),auto:1})}
      if(!r.rem||(ru&&ru.s!==0))return;
      (r.sn?rPlan(r):[{j:0,off:0}]).forEach(function(p){var tr=at(d,r.tm)+p.off*6e4,s=r.st[p.j];if(tr>now&&s)out.push({key:'r'+r.id+'|'+iso(d)+'|'+p.j,k:'r',id:r.id,at:tr,title:r.n,body:'Paso '+(p.j+1)+' de '+r.st.length+': '+s.n+(p.j===0?' · '+r.tm:'')})})})}
  out.sort(function(a,b){return a.at-b.at});return out.slice(0,NT.MAX)}
var ntState={perm:'',exact:'',err:'',count:0,last:0},lastSig='',syncing=0;
async function ntChannels(){var L=P.ln;if(!L)return;var snd={sistema:null,suave:'aurea_suave',alarma:'aurea_alarma',ninguno:null};
  for(var s in SOUNDS)for(var v=0;v<2;v++){var o={id:'aurea_'+s+(v?'_v':'_n'),name:'Recordatorios · '+SOUNDS[s]+(v?' + vibración':''),description:'Avisos de Áurea',importance:s==='ninguno'?3:5,visibility:1,vibration:!!v,lights:true};
    if(snd[s])o.sound=snd[s]+'.wav';try{await L.createChannel(o)}catch(_){}}
  try{await L.createChannel({id:'aurea_auto',name:'Automatizaciones (Samsung y otras apps)',description:'Notificaciones silenciosas con palabra clave para que otras apps las lean',importance:2,visibility:1,vibration:false,lights:false})}catch(_){}}
async function ntActions(){var L=P.ln;if(!L)return;var m=ntp().snooze,sn={id:'snooze',title:'Posponer '+m+' min'};
  await L.registerActionTypes({types:[{id:'AUREA_E',actions:[sn]},{id:'AUREA_T',actions:[sn,{id:'done',title:'Hecha'}]},{id:'AUREA_H',actions:[sn,{id:'done',title:'Hecho hoy'}]},{id:'AUREA_R',actions:[sn,{id:'start',title:'Empezar'}]}]})}
async function ntStatus(){if(!NAT()||!P.ln)return ntState;try{var p=await P.ln.checkPermissions();ntState.perm=p.display}catch(_){}
  try{var x=await P.ln.checkExactNotificationSetting();ntState.exact=x.exact_alarm}catch(_){ntState.exact='n/d'}return ntState}
async function ntSync(force){if(!NAT()||!P.ln||!ready||syncing)return;var p=ntp();syncing=1;
  try{await ntStatus();if(ntState.perm!=='granted'&&p.on)maybeAskNt();if(ntState.perm!=='granted'||!p.on){if(ntState.perm==='granted'&&!p.on){var pe=await P.ln.getPending();if(pe.notifications.length)await P.ln.cancel({notifications:pe.notifications.map(function(n){return{id:n.id}})})}return}
    var list=compute(),ids=new Set(),items=list.map(function(o){var id=fnv(o.key);while(ids.has(id))id++;ids.add(id);return{id:id,o:o}}),sig=chanId(p)+'|'+p.snooze+'|'+items.map(function(x){return x.id+'@'+x.o.at+x.o.title+x.o.body}).join(';');
    var pend=(await P.ln.getPending()).notifications;
    if(!force&&sig===lastSig&&pend.length>=items.length)return;
    if(pend.length)await P.ln.cancel({notifications:pend.filter(function(n){return !n.extra||!n.extra.snz}).map(function(n){return{id:n.id}})});
    await ntChannels();await ntActions();
    if(items.length)await P.ln.schedule({notifications:items.map(function(x){return{id:x.id,title:x.o.title,body:x.o.body,channelId:x.o.auto?'aurea_auto':chanId(p),smallIcon:'ic_stat_aurea',iconColor:'#237a74',actionTypeId:'AUREA_'+x.o.k.toUpperCase(),group:x.o.auto?'aurea_auto':'aurea',schedule:{at:new Date(x.o.at),allowWhileIdle:true},extra:{k:x.o.k,id:x.o.id,key:x.o.key}}})});
    lastSig=sig;ntState.count=items.length;ntState.last=Date.now();ntState.err=''}
  catch(e){ntState.err=String(e&&e.message||e)}finally{syncing=0}}
/* El permiso de avisos NO se pide al iniciar: solo cuando ya hay algo que avisar (evento/tarea/hábito con aviso), una única vez y con explicación.
   Si se rechaza, no se vuelve a insistir: queda el botón en Ajustes → Permisos. */
var askingNt=0;
function maybeAskNt(){if(askingNt||cfg().ntAsked||document.hidden||!/prompt/.test(ntState.perm))return;
  try{if(window.AureaLock&&AureaLock.isLocked())return;if(!compute().length)return}catch(_){return}
  askingNt=1;cfgSet({ntAsked:Date.now()});
  ask('¿Permitir avisos?','Tienes eventos, tareas o hábitos con aviso. Para recordártelos con Áurea cerrada, Android necesita tu permiso de notificaciones.','Permitir',function(){askingNt=0;ntAsk()});
  setTimeout(function(){askingNt=0},60000)}
async function ntAsk(){if(!NAT()||!P.ln){toast('Los avisos del teléfono solo existen en la app de Android');return}
  try{expectOut(60000);var r=await P.ln.requestPermissions();ntState.perm=r.display;if(r.display!=='granted')toast('Permiso de notificaciones denegado: actívalo en los ajustes de Android');}catch(e){toast('No se pudo pedir el permiso')}
  await ntSync(1);uiRefresh()}
async function ntExact(){try{expectOut(60000);await P.ln.changeExactNotificationSetting()}catch(_){toast('No se pudo abrir el ajuste de alarmas exactas')}}
async function ntTest(){if(!NAT()||!P.ln){toast('Solo disponible en la app de Android');return}if(ntState.perm!=='granted'){await ntAsk();if(ntState.perm!=='granted')return}
  var p=ntp();await ntChannels();await ntActions();await P.ln.schedule({notifications:[{id:fnv('test'+Date.now()),title:'Aviso de prueba',body:'Así sonará y vibrará un recordatorio de Áurea',channelId:chanId(p),smallIcon:'ic_stat_aurea',iconColor:'#237a74',actionTypeId:'AUREA_E',schedule:{at:new Date(Date.now()+5000),allowWhileIdle:true},extra:{k:'x',id:0,key:'test',snz:1}}]});toast('Aviso de prueba en 5 segundos: cierra la app para comprobarlo')}
function openItem(k,id){if(k==='r'){if(window.AureaRoutines&&!AureaRoutines.start(id))toast('Esa rutina ya no existe');return}var L={t:[T,'tasks','td'],h:[H,'habits','hd'],e:[E,'cal','ed']}[k];if(!L)return;var i=L[0].findIndex(function(x){return x.id==id});if(i<0){toast('Ese elemento ya no existe');return}
  openMod(L[1]);V={k:L[1],sub:L[2],i:i};redraw();mod.scrollTop=0}
var soft=function(){if(mod.classList.contains('open'))redraw();else sync()};
async function ntAction(ev){var n=ev.notification||{},x=n.extra||{},a=ev.actionId;
  for(var w=0;w<100&&!ready;w++)await new Promise(function(r){setTimeout(r,100)});
  if(a==='snooze'){var m=ntp().snooze;await P.ln.schedule({notifications:[{id:fnv('snz'+Date.now()+n.id),title:n.title,body:n.body,channelId:chanId(ntp()),smallIcon:'ic_stat_aurea',iconColor:'#237a74',actionTypeId:n.actionTypeId,schedule:{at:new Date(Date.now()+m*6e4),allowWhileIdle:true},extra:Object.assign({},x,{snz:1})}]});toast('Pospuesto '+m+' min');return}
  if(a==='done'){if(x.k==='t'){var t=T.find(function(y){return y.id==x.id});if(t&&typeof doneT==='function'){if(doneT(t,1)){toast('Tarea completada');save();soft()}}}
    else if(x.k==='h'){var h=H.find(function(y){return y.id==x.id});if(h){h.d[34]=1;save();soft();toast('Hábito marcado')}}return}
  if(a==='start'&&x.k==='r'){openItem('r',x.id);return}
  if(x.k&&x.k!=='x')openItem(x.k,x.id)}
AF.nt={fnv:fnv,compute:compute,sync:ntSync,state:ntState,prefs:ntp,chanId:chanId,action:ntAction,ask:ntAsk,test:ntTest,exact:ntExact,status:ntStatus};
async function ntInit(){if(!NAT()||!P.ln)return;try{P.ln.addListener('localNotificationActionPerformed',ntAction)}catch(_){}
  for(var w=0;w<200&&!ready;w++)await new Promise(function(r){setTimeout(r,100)});await ntSync();uiRefresh()}
/* re-sincroniza tras cambios (mismos eventos con los que Áurea guarda), con pausa para no repetir trabajo */
var ntT=0;['click','input','change','keyup','pointerup','touchend'].forEach(function(ev){addEventListener(ev,function(){if(!NAT()||!P.ln)return;clearTimeout(ntT);ntT=setTimeout(function(){ntSync()},2500)},true)});
document.addEventListener('visibilitychange',function(){if(!document.hidden)ntSync()});

/* ================= interfaz en Ajustes ================= */
var cache={local:null,drive:null,driveErr:'',acct:'',linked:0,hasKey:0,loading:0};
function uiRefresh(){try{if(V&&V.k==='set'&&!V.sub){loadLists().then(function(){redraw()})}}catch(_){}}
async function loadLists(){cache.hasKey=await hasKey();cache.linked=await Drive.linked();cache.acct=cache.linked?await Drive.account():'';try{cache.local=await Store.list()}catch(_){cache.local=[]}
  cache.stor=null;if(EXTN()){try{cache.stor=await P.backups.status()}catch(_){}}
  if(NAT())await ntStatus()}
var ago2=function(t){return t?fmtD(t):'nunca'};
var opt=function(v,l,c){return'<option value="'+v+'"'+(v==c?' selected':'')+'>'+l+'</option>'};
var FRQ=[['off','Desactivada'],['daily','Cada día'],['weekly','Cada semana'],['monthly','Cada mes']];
function secNt(){var p=ntp(),nat=NAT()&&!!P.ln;
  var h='<div class="fl">Recordatorios del teléfono</div>';
  if(!nat)h+='<p class="sm" style="margin:0">Los avisos con la app cerrada solo funcionan en la app de Android.</p>';
  else{h+='<p class="sm" style="margin:0 0 10px">Notificaciones del sistema para eventos, tareas y hábitos con aviso, aunque Áurea esté cerrada. Se reprograman tras reiniciar el teléfono y cada vez que abres Áurea (cubren los próximos '+NT.H+' días).</p>'
    +'<div class="kv" style="align-items:center"><span>Permiso de notificaciones</span><b style="font:600 13px Manrope,system-ui">'+(ntState.perm==='granted'?'Concedido':ntState.perm==='denied'?'Denegado':'Sin conceder')+'</b></div>'
    +(ntState.perm!=='granted'?'<button class="pill" data-af="nt-ask" style="margin-top:12px">Permitir notificaciones</button>':'')
    +(ntState.exact==='denied'?'<p class="sm" style="margin:10px 0 6px">Android no permite alarmas exactas: los avisos pueden retrasarse varios minutos.</p><button class="pill gh" data-af="nt-exact">Permitir alarmas exactas</button>':'')
    +'<div class="kv" style="align-items:center"><span>Avisos activados</span><button type="button" class="sw" role="switch" aria-checked="'+(p.on?'true':'false')+'" data-af="nt-on" aria-label="Avisos activados"></button></div>'
    +'<div class="fl">Sonido</div><select data-afc="nt-sound">'+Object.keys(SOUNDS).map(function(k){return opt(k,SOUNDS[k],p.sound)}).join('')+'</select>'
    +'<div class="kv" style="align-items:center"><span>Vibración</span><button type="button" class="sw" role="switch" aria-checked="'+(p.vib?'true':'false')+'" data-af="nt-vib" aria-label="Vibración"></button></div>'
    +'<div class="fl">Posponer</div><select data-afc="nt-snooze">'+[5,10,15,30,60].map(function(m){return opt(m,m+' min',p.snooze)}).join('')+'</select>'
    +'<p class="sm" style="margin:8px 0 0">Los botones «Posponer» y «Hecha» del aviso abren Áurea un instante para aplicarse.</p>'
    +'<div class="l2b" style="margin-top:12px"><button class="pill gh" data-af="nt-test">Enviar aviso de prueba</button></div>'
    +(ntState.err?'<p class="sm" style="margin:8px 0 0;color:#d0645b">'+esc(ntState.err)+'</p>':ntState.last?'<p class="sm" style="margin:8px 0 0">'+ntState.count+' avisos programados · '+fmtD(ntState.last)+'</p>':'')}
  return h}
function secBk(){var c=cfg(),s=stt(),h='';
  h+='<div class="fl">Copias de seguridad</div><p class="sm" style="margin:0 0 12px">Archivo .aurea con todos tus datos, adjuntos y preferencias. Última copia manual: '+(LASTB?fmtD(LASTB):'nunca')+'.</p>'
    +'<div class="l2b"><button class="pill" data-af="bk-make">Crear copia</button>'+(EXTN()?'<button class="pill gh" data-af="bk-share">Compartir copia</button>':'')+'</div>'
    +(EXTN()?'<p class="sm" style="margin:8px 0 0">«Crear copia» guarda el archivo en <b>Descargas/ÁUREA</b>, fuera de la app: no se borra al desinstalarla.</p>':'')
    +'<div class="fl">Restaurar desde un archivo de copia</div><p class="sm" style="margin:0 0 10px">Elige un archivo .aurea (de Descargas/ÁUREA, de Drive o de otra carpeta). Sirve también tras reinstalar Áurea. No es lo mismo que «Deshacer la última importación» (Datos): eso vuelve a un punto interno, no abre archivos.</p><div class="l2b"><button class="pill gh" data-af="bk-pick">Elegir archivo de copia…</button></div>'
    +'<div class="kv" style="align-items:center;margin-top:8px"><div class="g"><div>Cifrar copias</div><div class="sm">'+(c.enc&&cache.hasKey?'Activo (AES-256, contraseña definida)':'Sin cifrar: cualquiera con el archivo puede leerlo')+'</div></div><button type="button" class="sw" role="switch" aria-checked="'+(c.enc&&cache.hasKey?'true':'false')+'" data-af="bk-enc" aria-label="Cifrar copias"></button></div>'
    +(cache.hasKey?'<button class="lk" data-af="bk-pass" style="padding:6px 0;display:block;text-align:left">Cambiar contraseña</button>':'')
    +'<p class="sm" style="margin:6px 0 0">Si olvidas la contraseña no se puede recuperar ninguna copia cifrada.</p>'
    +'<div class="fl">Copias automáticas en el teléfono</div><select data-afc="bk-local">'+FRQ.map(function(f){return opt(f[0],f[1],c.local)}).join('')+'</select>'
    +'<p class="sm" style="margin:8px 0 0">Última: '+ago2((s.local||{}).last)+(s.local&&s.local.err?' · <span style="color:#d0645b">'+esc(s.local.err)+'</span>':'')+'. Se hacen al abrir Áurea o volver a ella, si toca. Se guardan en Descargas/ÁUREA'+(EXTN()?'':' (en Android; aquí, dentro del navegador)')+'.</p>'
    +'<div class="fl">Copias conservadas</div><select data-afc="bk-keep">'+[3,7,14,30].map(function(n){return opt(n,'Últimas '+n+' automáticas',c.keep)}).join('')+'</select><p class="sm" style="margin:6px 0 0">Solo se borran copias automáticas antiguas; las manuales nunca.</p>'
    +((cache.local||[]).length?'<div class="fl">'+(EXTN()?'Copias de esta instalación en Descargas/ÁUREA':'En este navegador')+'</div>'+cache.local.slice(0,10).map(function(f,i){return'<div class="kv" style="align-items:center"><div class="g"><div class="sm" style="word-break:break-all">'+esc(f.name)+'</div>'+(f.src==='int'?'<div class="sm">Almacenamiento privado (se moverá a Descargas)</div>':'')+'</div><button class="pill gh sm2" data-af="bk-rl" data-i="'+i+'">Restaurar</button></div>'}).join(''):'');
  h+='<div class="fl">Google Drive</div>'
    +(cache.linked?'<p class="sm" style="margin:0 0 10px">Vinculado'+(cache.acct?' como <b>'+esc(cache.acct)+'</b>':'')+'. Solo ve la carpeta «'+driveName+'» creada por Áurea.</p><div class="l2b"><button class="pill" data-af="dr-up">Subir copia ahora</button><button class="pill gh" data-af="dr-list">Mis copias en Drive</button></div><button class="lk" data-af="dr-unlink" style="padding:10px 0;display:block;text-align:left">Desvincular cuenta</button>'
     :NATG()?'<p class="sm" style="margin:0 0 10px">Inicia sesión con tu cuenta de Google y Áurea sube tus copias a una carpeta propia en tu Drive (solo ve lo que ella crea). Se activa la copia diaria automática.</p><button class="pill" data-af="dr-gsign">Iniciar sesión con Google</button>'
     :'<p class="sm" style="margin:0 0 8px">Para vincular tu cuenta necesitas un ID de cliente de Google («TV y dispositivos de entrada limitada»). Guía: README-ANDROID.md.</p><input class="si" id="af-cid" placeholder="ID de cliente" value="'+esc(c.cid)+'" autocomplete="off" autocapitalize="off" spellcheck="false"><input class="si" id="af-sec" placeholder="Secreto de cliente" value="'+esc(c.sec)+'" autocomplete="off" autocapitalize="off" spellcheck="false" style="margin-top:8px"><button class="pill" data-af="dr-link" style="margin-top:12px">Vincular cuenta de Google</button>')
    +(cache.driveErr?'<p class="sm" style="margin:8px 0 0;color:#d0645b">'+esc(cache.driveErr)+'</p>':'')
    +(cache.drive?'<div class="fl">En Drive</div>'+(cache.drive.length?cache.drive.slice(0,15).map(function(f,i){return'<div class="kv" style="align-items:center"><div class="g"><div class="sm" style="word-break:break-all">'+esc(f.name)+'</div><div class="sm">'+sz(+f.size||0)+'</div></div><button class="pill gh sm2" data-af="dr-rs" data-i="'+i+'">Restaurar</button></div>'}).join(''):'<p class="sm">No hay copias en Drive.</p>'):'')
    +(cache.linked?'<div class="fl">Copias automáticas en Drive</div><select data-afc="bk-drive">'+FRQ.map(function(f){return opt(f[0],f[1],c.drive)}).join('')+'</select><p class="sm" style="margin:8px 0 0">Última: '+ago2((s.drive||{}).last)+((s.drive||{}).err?' · <span style="color:#d0645b">'+esc(s.drive.err)+'</span>':'')+'. Necesita conexión; si falla se reintenta a los 30 min o al volver la red.</p>':'');
  return h}
function permRow(name,why,state,btn,act){return'<div class="kv" style="align-items:center;gap:12px"><div class="g"><div>'+name+'</div><div class="sm">'+why+'</div></div>'+(btn?'<button class="pill gh sm2" data-af="'+act+'">'+btn+'</button>':'<b style="font:600 13px Manrope,system-ui;white-space:nowrap">'+state+'</b>')+'</div>'}
/* Permisos: ninguno se pide al iniciar. Cada uno se pide en el momento en que hace falta; aquí se ve el estado y se puede pedir a mano. */
function secPerm(){if(!NAT())return'';var n=ntState,h='<div class="fl">Permisos</div><p class="sm" style="margin:0 0 8px">Áurea pide cada permiso solo cuando lo necesita, nunca todos al abrirla.</p>';
  h+=permRow('Notificaciones','Avisos de eventos, tareas y hábitos con Áurea cerrada.',n.perm==='granted'?'Concedido':n.perm==='denied'?'Denegado (ajustes de Android)':'',n.perm==='granted'||n.perm==='denied'||!n.perm?'':'Permitir','pm-nt');
  if(n.perm==='granted'&&n.exact==='denied')h+=permRow('Alarmas exactas','Para que los avisos lleguen a la hora exacta.','','Permitir','pm-ex');
  var st=cache.stor;
  if(st)h+=permRow('Almacenamiento',st.needsPermission?'Solo en Android 9 o anterior, para guardar copias en Descargas/ÁUREA.':'No hace falta en Android 10+: las copias se guardan en Descargas/ÁUREA sin permiso.',st.needsPermission?(st.granted?'Concedido':''):'No necesario',st.needsPermission&&!st.granted?'Permitir':'','pm-st');
  h+=permRow('Huella / PIN','Lo gestiona Android al desbloquear; Áurea no guarda tu PIN.','Sin permiso',0);
  return h}
function lazy(){if(!cache.loading&&cache.local===null){cache.loading=1;loadLists().then(function(){cache.loading=0;redraw()}).catch(function(){cache.loading=0;cache.local=[]})}}
/* Aurea.html dibuja Ajustes y llama a estas dos funciones en su sitio */
AF.ui={nt:secNt,bk:function(){lazy();return secBk()+secPerm()}};
async function guard(fn,okMsg){try{await fn();if(okMsg)toast(okMsg)}catch(e){toast(e&&e.aurea?e.message:'Algo falló: '+String(e&&e.message||e).slice(0,80));if(e&&e.relink){cache.linked=0}}uiRefresh()}
mod.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-af]');if(!b||V.k!=='set')return;var a=b.dataset.af,p=ntp();
  if(a==='bk-make')manualBackup();
  else if(a==='bk-share')manualBackup(1);
  else if(a==='bk-pick')pickExternal();
  else if(a==='pm-nt')ntAsk();
  else if(a==='pm-ex')ntExact();
  else if(a==='pm-st')guard(async function(){await extPerm(true)});
  else if(a==='bk-enc'){var c=cfg();if(c.enc&&cache.hasKey){ask('Dejar de cifrar','Las próximas copias se guardarán SIN cifrar. Las copias anteriores siguen cifradas.','Dejar de cifrar',function(){cfgSet({enc:0});redraw()})}else guard(async function(){var pw1=await askPass('Contraseña de cifrado','Mínimo 8 caracteres. No se puede recuperar si la olvidas.','Activar',1);if(pw1==null)return;await setPassphrase(pw1);cache.hasKey=true},'Cifrado activado')}
  else if(a==='bk-pass')guard(async function(){var pw1=await askPass('Nueva contraseña','Las copias antiguas seguirán necesitando la contraseña anterior.','Cambiar',1);if(pw1==null)return;await setPassphrase(pw1)},'Contraseña cambiada')
  else if(a==='bk-rl'){var f=cache.local[+b.dataset.i];if(f)guard(async function(){await restoreText(await Store.read(f),f.name)})}
  else if(a==='dr-gsign')guard(signInGoogle);
  else if(a==='dr-link'){var ci=$q('#af-cid'),se=$q('#af-sec');if(ci)cfgSet({cid:ci.value.trim(),sec:se.value.trim()});linkAccount()}
  else if(a==='dr-up')guard(async function(){if(offline())throw AErr('Sin conexión');var n=await backupTo('drive',null,false);sttSet('drive',{last:Date.now(),err:'',errAt:0});cache.drive=null},'Copia subida a Drive')
  else if(a==='dr-list')guard(async function(){cache.driveErr='';try{cache.drive=await Drive.list()}catch(er){cache.driveErr=er.message;throw er}})
  else if(a==='dr-rs'){var d=(cache.drive||[])[+b.dataset.i];if(d)guard(async function(){var t=await Drive.download(d.id);await restoreText(typeof t==='string'?t:JSON.stringify(t),d.name)})}
  else if(a==='dr-unlink')ask('Desvincular Google','Se revoca el acceso de Áurea. Las copias ya subidas permanecen en tu Drive.','Desvincular',function(){guard(async function(){await Drive.unlink();cache.drive=null;cache.linked=0;cfgSet({drive:'off'})},'Cuenta desvinculada')});
  else if(a==='nt-ask')ntAsk();
  else if(a==='nt-exact')ntExact();
  else if(a==='nt-test')ntTest();
  else if(a==='nt-on'){PREF.nt=Object.assign({},p,{on:p.on?0:1});save();ntSync(1).then(function(){redraw()});redraw()}
  else if(a==='nt-vib'){PREF.nt=Object.assign({},p,{vib:p.vib?0:1});save();ntSync(1);redraw()}});
mod.addEventListener('change',function(e){var t=e.target,k=t.dataset&&t.dataset.afc;if(!k)return;var p=ntp();
  if(k==='nt-sound'){PREF.nt=Object.assign({},p,{sound:t.value});save();ntSync(1)}
  else if(k==='nt-snooze'){PREF.nt=Object.assign({},p,{snooze:+t.value});save();ntSync(1)}
  else if(k==='bk-local'||k==='bk-drive'){var o={};o[k.slice(3)]=t.value;cfgSet(o);if(t.value!=='off')autoRun()}
  else if(k==='bk-keep'){cfgSet({keep:+t.value})}
  redraw()});
mod.addEventListener('input',function(e){var i=e.target.id;if(i==='af-cid'||i==='af-sec')cfgSet(i==='af-cid'?{cid:e.target.value.trim()}:{sec:e.target.value.trim()})});

/* ================= arranque ================= */
(async function(){for(var w=0;w<300&&!ready;w++)await new Promise(function(r){setTimeout(r,100)});if(!ready)return;
  try{await loadLists()}catch(_){}migrateLegacy().then(function(){cache.local=null});ntInit();autoRun();setInterval(function(){autoRun()},10*6e4)})();
})();
