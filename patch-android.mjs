// Ajusta el proyecto Android generado por "npx cap add android":
//  - versionName (de package.json) y versionCode (VERSION_CODE o número de ejecución de CI)
//  - firma debug FIJA (para que las actualizaciones se instalen encima sin perder datos)
//  - permisos de biometría
//  - icono de Áurea (mipmap de todas las densidades + icono adaptativo) en lugar del icono genérico de Capacitor
// Si algún patrón no se encuentra, falla de forma explícita (no deja un APK a medias).
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = process.env.AUREA_ANDROID_DIR || 'android'; // solo se cambia en pruebas
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const versionName = pkg.version;
const versionCode = parseInt(process.env.VERSION_CODE || process.env.GITHUB_RUN_NUMBER || '1', 10);
if (!Number.isInteger(versionCode) || versionCode < 1) throw new Error('versionCode inválido');

const gradlePath = `${ROOT}/app/build.gradle`;
const manifestPath = `${ROOT}/app/src/main/AndroidManifest.xml`;
const resDir = `${ROOT}/app/src/main/res`;
if (!existsSync(gradlePath) || !existsSync(manifestPath)) throw new Error('Falta android/. Ejecuta antes: npx cap add android');

let g = readFileSync(gradlePath, 'utf8');
const need = (re, what) => { if (!re.test(g)) throw new Error(`No encontré ${what} en ${gradlePath}`); };

need(/versionCode\s*=?\s*\d+/, 'versionCode');
g = g.replace(/(versionCode\s*=?\s*)\d+/, `$1${versionCode}`);
need(/versionName\s*=?\s*"[^"]*"/, 'versionName');
g = g.replace(/(versionName\s*=?\s*)"[^"]*"/, `$1"${versionName}"`);

if (!g.includes('aurea-debug.keystore')) {
  need(/\n(\s*)buildTypes\s*\{/, 'buildTypes');
  g = g.replace(/\n(\s*)buildTypes\s*\{/, (m, ind) =>
    `\n${ind}signingConfigs {\n${ind}    debug {\n` +
    `${ind}        storeFile = rootProject.file('../aurea-debug.keystore')\n` +
    `${ind}        storePassword = 'android'\n${ind}        keyAlias = 'androiddebugkey'\n${ind}        keyPassword = 'android'\n` +
    `${ind}    }\n${ind}}\n${ind}buildTypes {`);
}
writeFileSync(gradlePath, g);

let m = readFileSync(manifestPath, 'utf8');
for (const p of ['USE_BIOMETRIC', 'USE_FINGERPRINT']) {
  if (!m.includes(`android.permission.${p}`)) {
    if (!/<application/.test(m)) throw new Error('AndroidManifest sin <application>');
    m = m.replace(/<application/, `<uses-permission android:name="android.permission.${p}" />\n    <application`);
  }
}

// ---- Icono de Áurea ----
// aurea-icons.json: { "mipmap-xxxhdpi/ic_launcher.png": "<base64>", ... } generado desde el logo original.
if (!existsSync('aurea-icons.json')) throw new Error('Falta aurea-icons.json (iconos de Áurea) en la raíz del repositorio');
const icons = JSON.parse(readFileSync('aurea-icons.json', 'utf8'));
const DENS = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
const NAMES = ['ic_launcher', 'ic_launcher_round', 'ic_launcher_foreground', 'ic_launcher_background'];
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
for (const d of DENS) for (const n of NAMES) {
  const key = `mipmap-${d}/${n}.png`;
  if (!icons[key]) throw new Error(`aurea-icons.json no incluye ${key}`);
  const buf = Buffer.from(icons[key], 'base64');
  if (buf.length < 100 || !buf.subarray(0, 8).equals(PNG)) throw new Error(`${key} no es un PNG válido`);
  const out = join(resDir, key);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buf);
}
// Quita restos del icono genérico que chocarían con los nuestros (mismo nombre, otro formato) o que ya no se usan.
for (const dir of readdirSync(resDir)) {
  if (!dir.startsWith('mipmap-')) continue;
  for (const f of readdirSync(join(resDir, dir))) {
    if (/^ic_launcher.*\.(webp|jpg|jpeg)$/.test(f)) rmSync(join(resDir, dir, f));
  }
}
for (const old of ['drawable/ic_launcher_background.xml', 'drawable-v24/ic_launcher_foreground.xml']) {
  if (existsSync(join(resDir, old))) rmSync(join(resDir, old));
}
// Icono adaptativo (Android 8+): capa de fondo + capa del logo, tanto normal como redondo.
const adaptive =
  '<?xml version="1.0" encoding="utf-8"?>\n' +
  '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n' +
  '    <background android:drawable="@mipmap/ic_launcher_background"/>\n' +
  '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n' +
  '</adaptive-icon>\n';
mkdirSync(join(resDir, 'mipmap-anydpi-v26'), { recursive: true });
writeFileSync(join(resDir, 'mipmap-anydpi-v26/ic_launcher.xml'), adaptive);
writeFileSync(join(resDir, 'mipmap-anydpi-v26/ic_launcher_round.xml'), adaptive);

// AndroidManifest: <application android:icon="@mipmap/ic_launcher" android:roundIcon="@mipmap/ic_launcher_round" ...>
const appTag = m.match(/<application\b[^>]*>/);
if (!appTag) throw new Error('AndroidManifest sin <application>');
let tag = appTag[0];
for (const [attr, val] of [['android:icon', '@mipmap/ic_launcher'], ['android:roundIcon', '@mipmap/ic_launcher_round']]) {
  const re = new RegExp(`${attr}="[^"]*"`);
  tag = re.test(tag) ? tag.replace(re, `${attr}="${val}"`) : tag.replace(/<application\b/, `<application ${attr}="${val}"`);
}
m = m.replace(appTag[0], tag);
writeFileSync(manifestPath, m);

console.log(`Android listo · versionName ${versionName} · versionCode ${versionCode} · icono de Áurea instalado`);
