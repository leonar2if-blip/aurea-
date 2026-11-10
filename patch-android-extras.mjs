// Complementa patch-android.mjs para recordatorios nativos y copias:
//  - permisos Android: notificaciones, alarmas exactas, arranque del teléfono, vibración, red
//  - sonidos de aviso (res/raw) e icono de la barra de estado (drawable-*), desde aurea-android-assets.json
// Ejecutar después de "npx cap add android" y antes de "npx cap sync android". Es idempotente y falla de forma explícita.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = process.env.AUREA_ANDROID_DIR || 'android'; // solo se cambia en pruebas
const manifestPath = `${ROOT}/app/src/main/AndroidManifest.xml`;
const resDir = `${ROOT}/app/src/main/res`;
if (!existsSync(manifestPath)) throw new Error('Falta android/. Ejecuta antes: npx cap add android');
if (!existsSync('aurea-android-assets.json')) throw new Error('Falta aurea-android-assets.json en la raíz del repositorio');

let m = readFileSync(manifestPath, 'utf8');
if (!/<application/.test(m)) throw new Error('AndroidManifest sin <application>');
for (const p of ['INTERNET', 'POST_NOTIFICATIONS', 'SCHEDULE_EXACT_ALARM', 'RECEIVE_BOOT_COMPLETED', 'VIBRATE']) {
  if (!m.includes(`android.permission.${p}"`)) {
    m = m.replace(/<application/, `<uses-permission android:name="android.permission.${p}" />\n    <application`);
  }
}
writeFileSync(manifestPath, m);

const assets = JSON.parse(readFileSync('aurea-android-assets.json', 'utf8'));
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const need = ['raw/aurea_suave.wav', 'raw/aurea_alarma.wav',
  ...['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'].map((d) => `drawable-${d}/ic_stat_aurea.png`)];
for (const key of need) {
  if (!assets[key]) throw new Error(`aurea-android-assets.json no incluye ${key}`);
  const buf = Buffer.from(assets[key], 'base64');
  const ok = key.endsWith('.wav') ? buf.subarray(0, 4).toString() === 'RIFF' : buf.subarray(0, 4).equals(PNG);
  if (!ok || buf.length < 100) throw new Error(`${key} no es un archivo válido`);
  const out = join(resDir, key);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buf);
}
console.log('Android extras listo · permisos de avisos, sonidos e icono de notificación instalados');
