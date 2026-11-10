// Puente entre Áurea (HTML plano) y el plugin nativo de huella/credenciales.
// Se empaqueta con esbuild en www/aurea-biometric.js y expone window.AureaNative.
// Áurea NO guarda ni lee ningún PIN: la verificación la hace Android (BiometricPrompt).
import { App } from '@capacitor/app';
import { AndroidBiometryStrength, BiometricAuth } from '@aparajita/capacitor-biometric-auth';

window.AureaNative = {
  version: 1,
  // Estado del teléfono: { isAvailable, deviceIsSecure, ... }
  check: () => BiometricAuth.checkBiometry(),
  // Resuelve si el usuario se autentica; rechaza con { code, message } si cancela o falla.
  // weak = acepta huella y también reconocimiento facial si el teléfono lo permite a las apps.
  authenticate: (options) =>
    BiometricAuth.authenticate({
      androidBiometryStrength: AndroidBiometryStrength.weak,
      ...options,
    }),
  // Avisa cuando la app pasa a segundo plano (false) o vuelve (true).
  onState: (cb) => App.addListener('appStateChange', (s) => cb(!!s.isActive)),
};
