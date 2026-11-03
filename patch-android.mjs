// Ajusta el proyecto Android generado por "npx cap add android":
//  - versionName (de package.json) y versionCode (VERSION_CODE o número de ejecución de CI)
//  - firma debug FIJA (para que las actualizaciones se instalen encima sin perder datos)
//  - permisos de biometría
// Si algún patrón no se encuentra, falla de forma explícita (no deja un APK a medias).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const versionName = pkg.version;
const versionCode = parseInt(process.env.VERSION_CODE || process.env.GITHUB_RUN_NUMBER || '1', 10);
if (!Number.isInteger(versionCode) || versionCode < 1) throw new Error('versionCode inválido');

const gradlePath = 'android/app/build.gradle';
const manifestPath = 'android/app/src/main/AndroidManifest.xml';
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
writeFileSync(manifestPath, m);
console.log(`Android listo · versionName ${versionName} · versionCode ${versionCode}`);
