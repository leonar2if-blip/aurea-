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

## Recordatorios del teléfono, copias .aurea y Google Drive (versión 1.1.0)
Archivos nuevos que hay que subir a la raíz del repositorio (junto a los de antes):
`aurea-features.js`, `aurea-native.js`, `aurea-android-assets.json`, `patch-android-extras.mjs`.
Cambian `package.json` (3 plugins oficiales de Capacitor), `capacitor.config.json`, `build-www.mjs` y el workflow.
`Aurea.html` dibuja la pantalla de Ajustes y llama a `AureaFeatures.ui` (en `aurea-features.js`) para las secciones de recordatorios, copias y Drive; `build-www.mjs` carga `aurea-features.js` al final de la página. Los dos archivos deben ir siempre juntos.

**Recordatorios**: Ajustes → Recordatorios del teléfono. Pulsa «Permitir notificaciones» (y «alarmas exactas» si Android lo pide).
Se programan los avisos de eventos, tareas y hábitos (campo «aviso») de los próximos 30 días; se refrescan al abrir/editar Áurea
y Android los recupera tras reiniciar. Si pasas más de 30 días sin abrir Áurea, los avisos se agotan hasta que la abras.
Los botones «Posponer» y «Hecha» del aviso abren Áurea un instante para aplicarse.

**Copias .aurea**: Ajustes → Copias de seguridad. «Crear copia» abre el menú de compartir de Android (guárdala en Archivos, Drive, etc.).
Con «Cifrar copias» se usa AES-256-GCM; la contraseña no se guarda ni se puede recuperar. «Restaurar desde archivo» verifica la
integridad, pide confirmación y guarda un punto de restauración antes de reemplazar nada.
Copias automáticas (diaria/semanal/mensual): se ejecutan al abrir Áurea o volver a ella, no con la app cerrada.

**Google Drive** (configuración única, ~10 min, en https://console.cloud.google.com):
1. Crea un proyecto → «APIs y servicios» → Biblioteca → activa **Google Drive API**.
2. «Pantalla de consentimiento de OAuth» → tipo **Externo** → añade el ámbito `.../auth/drive.file` y tu correo como usuario de prueba.
   Después pulsa **«Publicar aplicación»** (estado «En producción»): en modo «Pruebas» Google caduca la vinculación cada 7 días.
3. «Credenciales» → Crear credenciales → ID de cliente de OAuth → tipo **«TV y dispositivos de entrada limitada»**.
4. Copia el **ID de cliente** y el **Secreto** en Áurea (Ajustes → Google Drive) y pulsa «Vincular cuenta de Google».
   Te mostrará un código: ábrelo en google.com/device, escribe el código y acepta.
Áurea solo ve la carpeta «Áurea copias» que ella misma crea (ámbito `drive.file`).

## Widgets de pantalla de inicio (versión 1.2.0)
Archivos nuevos en el repo: `aurea-widgets.js`, `patch-android-widgets.mjs` y la carpeta `android-widgets/` (código Java y recursos). Cambian `aurea-native.js`, `build-www.mjs`, `package.json` y el workflow (que ejecuta `patch-android-widgets.mjs`).

**Widgets**: Mi día, Tareas, Hábitos, Agenda, Enfoque, Agua y Captura rápida. Opcionales (aparecen en el selector solo cuando su módulo tiene datos): Proyectos, Objetivos, Dinero, Diario y Estadísticas. No existen aún widgets de Rutinas, Estado personal ni Relaciones porque esos módulos no existen en Áurea.
Al añadir un widget se abre su ajuste nativo: tema (automático/claro/oscuro), ocultar información sensible y, en Tareas/Hábitos, qué mostrar. Se reconfigura manteniendo pulsado el widget (Android 9+).

**Cómo se sincroniza** (IndexedDB sigue siendo la única fuente de verdad):
- La app publica una instantánea de solo lectura en SharedPreferences nativas cada vez que guarda y al pasar a segundo plano.
- Las acciones de los widgets (completar tarea, registrar hábito, agua, iniciar/pausar enfoque, captura rápida) se encolan y el widget cambia al instante. Áurea las aplica a sus datos al abrirse (o si está abierta, de inmediato) y las confirma. Con Áurea cerrada, los cambios aparecen en la app la próxima vez que la abras.
- Enlaces profundos `aurea://open/<modulo>[/<id>]` abren la sección o elemento.
- Android no garantiza actualizaciones instantáneas: además de cada acción se redibuja al cambiar de día, al reiniciar y cada ~30 min como respaldo.
