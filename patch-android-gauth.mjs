// Instala el inicio de sesión nativo con Google (para copias en Drive): plugin Java + dependencia play-services-auth + registro en MainActivity.
// Ejecutar después de "npx cap add android" y antes de "npx cap sync android". Idempotente y con fallo explícito.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureRegister } from './android-patch-main.mjs';

const ROOT = process.env.AUREA_ANDROID_DIR || 'android'; // solo se cambia en pruebas
const gradlePath = `${ROOT}/app/build.gradle`;
if (!existsSync(gradlePath)) throw new Error('Falta android/app/build.gradle. Ejecuta antes: npx cap add android');
const cap = JSON.parse(readFileSync('capacitor.config.json', 'utf8'));
if (cap.appId !== 'com.leonar2if.aurea') throw new Error(`El plugin está escrito para com.leonar2if.aurea y capacitor.config.json usa ${cap.appId}`);

const javaDir = `${ROOT}/app/src/main/java/com/leonar2if/aurea`;
mkdirSync(javaDir, { recursive: true });
let n = 0;
for (const f of readdirSync('android-gauth/java')) if (f.endsWith('.java')) { copyFileSync(`android-gauth/java/${f}`, join(javaDir, f)); n++; }
if (n < 1) throw new Error('No hay clases Java en android-gauth/java');
ensureRegister(join(javaDir, 'MainActivity.java'), 'AureaGoogleAuthPlugin');

let g = readFileSync(gradlePath, 'utf8');
const dep = "implementation 'com.google.android.gms:play-services-auth:21.2.0'";
if (!g.includes('play-services-auth')) {
  const m = g.match(/\n(\s*)dependencies\s*\{/g);
  if (!m) throw new Error('No encontré el bloque dependencies en app/build.gradle');
  // el bloque de dependencias de la app es el último "dependencies {" del archivo (los anteriores son de buildscript)
  const idx = g.lastIndexOf('dependencies {');
  g = g.slice(0, idx) + `dependencies {\n    ${dep}` + g.slice(idx + 'dependencies {'.length);
  writeFileSync(gradlePath, g);
}
if (!readFileSync(gradlePath, 'utf8').includes(dep)) throw new Error('No se añadió la dependencia de Google');
if (!readFileSync(join(javaDir, 'MainActivity.java'), 'utf8').includes('registerPlugin(AureaGoogleAuthPlugin.class);')) throw new Error('MainActivity no registra AureaGoogleAuthPlugin');
console.log('Inicio de sesión con Google listo · plugin AureaGoogleAuth · play-services-auth 21.2.0');
