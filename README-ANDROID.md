# Áurea 1.0.0 · Android

## Compilar el APK (desde el móvil, solo con el navegador)
1. En GitHub crea un repositorio **privado** (la firma debug va dentro del repo).
2. "Add file → Upload files" y sube **estos 9 archivos juntos** (selección múltiple):
   `Aurea.html`, `package.json`, `capacitor.config.json`, `aurea-biometric.js`,
   `build-www.mjs`, `patch-android.mjs`, `aurea-icons.json`, `aurea-debug.keystore`, `.gitignore`
3. "Add file → Create new file", nombre `.github/workflows/build-apk.yml`
   (al escribir las `/` crea las carpetas) y pega el contenido del archivo del ZIP.
4. Pestaña **Actions → Compilar APK de Áurea (debug) → Run workflow**.
5. Al terminar (~5–10 min), dentro de la ejecución, descarga el artefacto **Aurea-debug-apk** (ZIP con el .apk) e instálalo.

El workflow copia `Aurea.html` como `www/index.html` y genera el proyecto Android en cada ejecución.
`aurea-icons.json` contiene el logo de Áurea ya recortado para todas las densidades de Android (mipmap + icono adaptativo);
`patch-android.mjs` lo instala y configura `android:icon` / `android:roundIcon` en el AndroidManifest.

## Bloqueo de la aplicación
Ajustes → Seguridad y privacidad → Bloqueo de la aplicación. Con el bloqueo activado, Áurea pide la verificación del teléfono
al abrirse y **cada vez** que sales de ella (segundo plano) y vuelves. Navegar dentro de Áurea no la pide.
Abrir el selector de archivos (importar copia, adjuntar a una nota) cuenta como salir de Áurea.

## Actualizar Áurea sin perder datos
1. Sustituye `Aurea.html` en el repo (mismo nombre) → commit.
2. (Opcional) sube `"version"` en `package.json` (p. ej. 1.0.1): es el nombre visible de la versión.
3. Se compila solo. Instala el nuevo APK **encima** del anterior. **No desinstales antes.**

Qué mantiene los datos: mismo Package ID (`com.leonar2if.aurea`), misma firma (`aurea-debug.keystore`),
mismo origen web (`https://localhost`) y `versionCode` creciente (= nº de ejecución del workflow).
No cambies ni borres `aurea-debug.keystore`; si lo hicieras, Android rechazará la actualización.

## Tus datos actuales (navegador → app)
La app Android tiene su propio almacenamiento: no ve lo que hay en el navegador.
En la versión web: Ajustes → Exportar copia. En la app: Ajustes → Importar copia.
