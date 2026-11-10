// Prepara www/: copia Aurea.html como www/index.html y empaqueta el puente nativo.
import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

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

// Plugins nativos (recordatorios, archivos, compartir, red) + funciones de recordatorios/copias/Drive
await build({
  entryPoints: ['aurea-native.js'],
  bundle: true,
  format: 'iife',
  target: ['chrome90'],
  minify: true,
  outfile: 'www/aurea-native.js',
  logLevel: 'info',
});
copyFileSync('aurea-features.js', 'www/aurea-features.js');
copyFileSync('aurea-widgets.js', 'www/aurea-widgets.js');
copyFileSync('aurea-automation.js', 'www/aurea-automation.js');
{
  // Se cargan al final del <body>, después del script principal de Aurea.html (que no se modifica)
  let h = readFileSync('www/index.html', 'utf8');
  if (!h.includes('src="aurea-features.js"')) {
    const i = h.lastIndexOf('</body>');
    if (i < 0) throw new Error('Aurea.html no tiene </body>');
    h = h.slice(0, i) + '<script src="aurea-native.js"></script>\n<script src="aurea-features.js"></script>\n<script src="aurea-widgets.js"></script>\n<script src="aurea-automation.js"></script>\n' + h.slice(i);
    writeFileSync('www/index.html', h);
  }
}

const html = readFileSync('www/index.html', 'utf8');
const js = readFileSync('www/aurea-biometric.js', 'utf8');
if (!html.includes('src="aurea-biometric.js"')) throw new Error('Aurea.html no carga aurea-biometric.js');
if (!html.includes('id="lock"')) throw new Error('Aurea.html no contiene la pantalla de bloqueo');
if (!js.includes('AureaNative')) throw new Error('El puente no expone AureaNative');
if (!html.includes('src="aurea-automation.js"')) throw new Error('No se inyectó aurea-automation.js');
if (!html.includes('src="aurea-native.js"') || !html.includes('src="aurea-features.js"') || !html.includes('src="aurea-widgets.js"')) throw new Error('No se inyectaron aurea-native.js / aurea-features.js / aurea-widgets.js');
if (!readFileSync('www/aurea-native.js', 'utf8').includes('AureaPlugins')) throw new Error('El puente nativo no expone AureaPlugins');
console.log('www/ listo: index.html + aurea-biometric.js + aurea-native.js + aurea-features.js');
