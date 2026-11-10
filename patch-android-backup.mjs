// Instala en el proyecto Android el plugin nativo de copias externas (Descargas/ÁUREA) y su permiso.
//  - copia android-backup/java/*.java
//  - declara WRITE_EXTERNAL_STORAGE solo hasta Android 9 (API 28); en Android 10+ no hace falta ningún permiso
//  - registra el plugin en MainActivity
// Ejecutar después de patch-android.mjs y antes de "npx cap sync android". Idempotente y con fallo explícito.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureRegister } from './android-patch-main.mjs';

const ROOT = process.env.AUREA_ANDROID_DIR || 'android'; // solo se cambia en pruebas
const manifestPath = `${ROOT}/app/src/main/AndroidManifest.xml`;
if (!existsSync(manifestPath)) throw new Error('Falta android/. Ejecuta antes: npx cap add android');
if (!existsSync('android-backup/java')) throw new Error('Falta android-backup/java');
const cap = JSON.parse(readFileSync('capacitor.config.json', 'utf8'));
if (cap.appId !== 'com.leonar2if.aurea') throw new Error(`El plugin está escrito para com.leonar2if.aurea y capacitor.config.json usa ${cap.appId}`);

const javaDir = `${ROOT}/app/src/main/java/com/leonar2if/aurea`;
mkdirSync(javaDir, { recursive: true });
let n = 0;
for (const f of readdirSync('android-backup/java')) {
  if (f.endsWith('.java')) { copyFileSync(`android-backup/java/${f}`, join(javaDir, f)); n++; }
}
if (n < 1) throw new Error('No hay clases Java en android-backup/java');
ensureRegister(join(javaDir, 'MainActivity.java'), 'AureaBackupsPlugin');

let m = readFileSync(manifestPath, 'utf8');
const perm = '<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />';
if (!/android\.permission\.WRITE_EXTERNAL_STORAGE/.test(m)) {
  if (!/<application/.test(m)) throw new Error('AndroidManifest sin <application>');
  m = m.replace(/<application/, () => `${perm}\n    <application`);
} else if (!/WRITE_EXTERNAL_STORAGE"[^>]*maxSdkVersion="28"/.test(m)) {
  throw new Error('El manifiesto ya declara WRITE_EXTERNAL_STORAGE sin maxSdkVersion="28": revísalo a mano (no se debe pedir en Android 10+).');
}
writeFileSync(manifestPath, m);

const main = readFileSync(join(javaDir, 'MainActivity.java'), 'utf8');
if (!main.includes('registerPlugin(AureaBackupsPlugin.class);')) throw new Error('MainActivity no registra AureaBackupsPlugin');
console.log(`Copias externas listas · ${n} clase(s) Java · Descargas/ÁUREA · permiso de almacenamiento solo hasta Android 9`);
