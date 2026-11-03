// Prepara www/: copia Aurea.html como www/index.html y empaqueta el puente nativo.
import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';

mkdirSync('www', { recursive: true });
copyFileSync('Aurea.html', 'www/index.html');

await build({
  entryPoints: ['aurea-biometric.js'],
  bundle: true,
  format: 'iife',
  target: ['chrome90'],
  minify: true,
  outfile: 'www/aurea-biometric.js',
  logLevel: 'info',
});

const html = readFileSync('www/index.html', 'utf8');
const js = readFileSync('www/aurea-biometric.js', 'utf8');
if (!html.includes('src="aurea-biometric.js"')) throw new Error('Aurea.html no carga aurea-biometric.js');
if (!html.includes('id="lock"')) throw new Error('Aurea.html no contiene la pantalla de bloqueo');
if (!js.includes('AureaNative')) throw new Error('El puente no expone AureaNative');
console.log('www/ listo: index.html + aurea-biometric.js');
