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
  widgets: registerPlugin('AureaWidgets'), // plugin nativo propio: widgets de pantalla de inicio (solo Android)
};
