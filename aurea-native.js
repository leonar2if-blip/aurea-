// Puente de plugins nativos para aurea-features.js. Se empaqueta con esbuild en www/aurea-native.js
// y expone window.AureaPlugins. (El bloqueo biométrico sigue en aurea-biometric.js, sin cambios.)
import { CapacitorHttp, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

window.AureaPlugins = {
  ln: LocalNotifications,
  fs: Filesystem,
  Dir: Directory,
  Enc: Encoding,
  share: Share,
  http: CapacitorHttp,
  app: App, // enlaces profundos (aurea://open/...) de los widgets
  gauth: registerPlugin('AureaGoogleAuth'), // inicio de sesión nativo con Google para copias en Drive (solo Android)
  backups: registerPlugin('AureaBackups'), // plugin nativo propio: copias en Descargas/ÁUREA y selector de archivos (solo Android)
  routines: registerPlugin('AureaRoutines'), // plugin nativo propio: estado de avisos/batería, ajustes y atajos de rutinas (solo Android)
  widgets: registerPlugin('AureaWidgets'), // plugin nativo propio: widgets de pantalla de inicio (solo Android)
};
