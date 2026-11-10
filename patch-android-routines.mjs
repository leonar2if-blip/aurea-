// Instala el plugin nativo de Rutinas (estado de avisos/batería, ajustes del sistema, atajos del icono).
//  - copia android-routines/java/*.java y lo registra en MainActivity
//  - declara <queries> para poder detectar la app de Modos y rutinas de Samsung (Android 11+)
// Ejecutar después de patch-android.mjs y antes de "npx cap sync android". Idempotente.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureRegister } from './android-patch-main.mjs';

const ROOT = process.env.AUREA_ANDROID_DIR || 'android';
const manifestPath = `${ROOT}/app/src/main/AndroidManifest.xml`;
if (!existsSync(manifestPath)) throw new Error('Falta android/. Ejecuta antes: npx cap add android');
if (!existsSync('android-routines/java')) throw new Error('Falta android-routines/java');
const javaDir = `${ROOT}/app/src/main/java/com/leonar2if/aurea`;
mkdirSync(javaDir, { recursive: true });
let n = 0;
for (const f of readdirSync('android-routines/java')) if (f.endsWith('.java')) { copyFileSync(`android-routines/java/${f}`, join(javaDir, f)); n++; }
if (n < 1) throw new Error('No hay clases Java en android-routines/java');
ensureRegister(join(javaDir, 'MainActivity.java'), 'AureaRoutinesPlugin');

let m = readFileSync(manifestPath, 'utf8');
const pkg = '<package android:name="com.samsung.android.app.routines" />';
if (!m.includes(pkg)) {
  if (/<queries>/.test(m)) m = m.replace(/<queries>/, () => `<queries>\n        ${pkg}`);
  else {
    if (!/<application/.test(m)) throw new Error('AndroidManifest sin <application>');
    m = m.replace(/<application/, () => `<queries>\n        ${pkg}\n    </queries>\n    <application`);
  }
  writeFileSync(manifestPath, m);
}
if (!readFileSync(manifestPath, 'utf8').includes('com.samsung.android.app.routines')) throw new Error('No se declaró <queries>');
const main = readFileSync(join(javaDir, 'MainActivity.java'), 'utf8');
if (!main.includes('registerPlugin(AureaRoutinesPlugin.class);')) throw new Error('MainActivity no registra AureaRoutinesPlugin');
console.log(`Rutinas nativas listas · ${n} clase(s) Java · atajos del icono · detección de Modos y rutinas de Samsung`);
