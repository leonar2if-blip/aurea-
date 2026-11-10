// Instala los widgets nativos de Áurea en el proyecto Android generado por "npx cap add android".
//  - copia el código nativo (android-widgets/java/*.java) y los recursos (android-widgets/res/**)
//  - añade al AndroidManifest los widgets, receptores, actividades y el enlace profundo aurea://open/...
//  - registra el plugin nativo AureaWidgets en MainActivity
// Ejecutar después de patch-android.mjs / patch-android-extras.mjs y antes de "npx cap sync android".
// Es idempotente (se puede repetir) y falla de forma explícita si algo no encaja; no deja un APK a medias.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { ensureRegister } from './android-patch-main.mjs';

const ROOT = process.env.AUREA_ANDROID_DIR || 'android'; // solo se cambia en pruebas
const SRC = 'android-widgets';
const manifestPath = `${ROOT}/app/src/main/AndroidManifest.xml`;
const resDir = `${ROOT}/app/src/main/res`;
if (!existsSync(manifestPath)) throw new Error('Falta android/. Ejecuta antes: npx cap add android');
for (const f of ['java', 'res', 'manifest-application.xml', 'manifest-activity.xml']) {
  if (!existsSync(`${SRC}/${f}`)) throw new Error(`Falta ${SRC}/${f}`);
}

const cap = JSON.parse(readFileSync('capacitor.config.json', 'utf8'));
const appId = cap.appId;
if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(appId || '')) throw new Error('appId inválido en capacitor.config.json');
if (appId !== 'com.leonar2if.aurea') {
  throw new Error(`Los widgets están escritos para el paquete com.leonar2if.aurea y capacitor.config.json usa ${appId}`);
}
const javaDir = `${ROOT}/app/src/main/java/${appId.replace(/\./g, '/')}`;
mkdirSync(javaDir, { recursive: true });

// ---- código nativo ----
let nJava = 0;
for (const f of readdirSync(`${SRC}/java`)) {
  if (!f.endsWith('.java')) continue;
  copyFileSync(`${SRC}/java/${f}`, join(javaDir, f));
  nJava++;
}
if (nJava < 10) throw new Error(`Se esperaban ≥10 archivos .java y hay ${nJava}`);

// ---- MainActivity: solo se añade el registro del plugin (no se reemplaza el archivo) ----
const mainPath = join(javaDir, 'MainActivity.java');
ensureRegister(mainPath, 'AureaWidgetsPlugin');

// ---- recursos ----
let nRes = 0;
const copyTree = (from, to) => {
  for (const f of readdirSync(from)) {
    const a = join(from, f), b = join(to, f);
    if (statSync(a).isDirectory()) copyTree(a, b);
    else { mkdirSync(dirname(b), { recursive: true }); copyFileSync(a, b); nRes++; }
  }
};
copyTree(`${SRC}/res`, resDir);

// ---- manifiesto ----
let m = readFileSync(manifestPath, 'utf8');
const strip = (s, begin, end) => {
  const i = s.indexOf(begin);
  if (i < 0) return s;
  const j = s.indexOf(end, i);
  if (j < 0) throw new Error(`Marcador ${begin} sin cierre en AndroidManifest.xml`);
  const lineStart = s.lastIndexOf('\n', i) + 1;
  const lineEnd = s.indexOf('\n', j + end.length);
  return s.slice(0, lineStart) + s.slice(lineEnd < 0 ? s.length : lineEnd + 1);
};
m = strip(m, '<!-- aurea-widgets:begin -->', '<!-- aurea-widgets:end -->');
m = strip(m, '<!-- aurea-widgets:links:begin -->', '<!-- aurea-widgets:links:end -->');

const appBlock = readFileSync(`${SRC}/manifest-application.xml`, 'utf8');
const linkBlock = readFileSync(`${SRC}/manifest-activity.xml`, 'utf8');
if (!m.includes('</application>')) throw new Error('AndroidManifest sin </application>');
m = m.replace('</application>', () => `${appBlock}    </application>`);

// enlace profundo en MainActivity (el primer <activity> que la declara)
const mi = m.search(/<activity\b[^>]*android:name="[^"]*MainActivity"[^>]*>/);
if (mi < 0) throw new Error('No encontré la <activity> de MainActivity en AndroidManifest.xml');
const open = m.slice(mi).match(/<activity\b[^>]*>/)[0];
if (open.endsWith('/>')) throw new Error('La <activity> de MainActivity no tiene contenido');
const close = m.indexOf('</activity>', mi);
if (close < 0) throw new Error('MainActivity sin </activity>');
m = m.slice(0, close) + linkBlock + '        ' + m.slice(close);
// singleTask: abrir un widget con Áurea ya abierta reutiliza la actividad (llega por appUrlOpen) en vez de crear otra
if (!/android:launchMode="singleTask"/.test(open)) {
  m = m.replace(open, open.replace(/<activity\b/, '<activity android:launchMode="singleTask"'));
}
writeFileSync(manifestPath, m);

// ---- comprobaciones ----
const out = readFileSync(manifestPath, 'utf8');
const count = (s, re) => (s.match(re) || []).length;
if (count(out, /android\.appwidget\.provider/g) !== 12) throw new Error('Se esperaban 12 widgets en el manifiesto');
if (count(out, /aurea-widgets:begin/g) !== 1 || count(out, /aurea-widgets:links:begin/g) !== 1) throw new Error('Bloques duplicados en el manifiesto');
if (!out.includes('android:scheme="aurea"')) throw new Error('Falta el enlace profundo aurea://');
if (!readFileSync(mainPath, 'utf8').includes('registerPlugin(AureaWidgetsPlugin.class);')) throw new Error('MainActivity.java no registra AureaWidgetsPlugin');

console.log(`Widgets listos · ${nJava} clases Java · ${nRes} recursos · 12 widgets (7 principales + 5 opcionales) · enlace aurea://open/...`);
