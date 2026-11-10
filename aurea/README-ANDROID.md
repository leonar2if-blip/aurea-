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

## Seguridad, copias externas y permisos (versión 1.3.0)
Archivos nuevos en el repo: `patch-android-backup.mjs`, `android-patch-main.mjs` y `android-backup/java/AureaBackupsPlugin.java`. Cambian `Aurea.html` (solo el bloqueo y dos textos de Ajustes), `aurea-features.js`, `aurea-native.js`, `patch-android-widgets.mjs`, `package.json` y el workflow.

**Bloqueo**: con el bloqueo activado, Áurea se bloquea al instante al pasar a segundo plano o cambiar de aplicación y pide huella o el PIN/patrón del teléfono (BiometricPrompt de Android; Áurea no guarda ningún PIN). Excepción deliberada de máx. 60 s cuando Áurea abre una pantalla del sistema (permisos, selector de archivos, compartir, navegador para vincular Drive): al volver no pide autenticación; si sales a otra app durante esa ventana, queda bloqueada igualmente al cabo de ese tiempo.

**Copias locales**: «Crear copia» y las automáticas se guardan en `Descargas/ÁUREA/` (Android 10+: MediaStore, sin permiso; Android 7–9: permiso de almacenamiento, que se pide al crear la primera copia manual). Sobreviven a desinstalar. Las copias antiguas del almacenamiento privado se mueven solas a esa carpeta. Tras desinstalar y reinstalar, Android no deja a la app nueva *listar* los archivos de la anterior: usa **Elegir archivo de copia…** (selector del sistema, abre en `Descargas/ÁUREA`).
**Restaurar**: «Elegir archivo de copia…» / «Restaurar» abren un archivo `.aurea` (pide contraseña si está cifrado) y antes guardan un punto interno. «Deshacer la última importación, restauración o borrado» (Datos) es otra función: vuelve a ese punto interno y no abre archivos.

**Permisos**: nada se pide al iniciar. Notificaciones: una sola pregunta explicada cuando ya hay algo con aviso (o desde Ajustes → Permisos). Alarmas exactas: solo desde Ajustes. Almacenamiento: solo Android ≤ 9 y al guardar la primera copia manual.

**Google Drive**: sigue usando el flujo OAuth «dispositivos de entrada limitada» (API REST real, ámbito `drive.file`, carpeta «Áurea copias»); requiere el ID de cliente y el secreto de tu proyecto de Google Cloud (ver arriba). Guardar, listar y restaurar funcionan sin SDK de Google.

## Iniciar sesión con Google para las copias en Drive (sin ID ni secreto en la app)
En Android, Ajustes → Copias de seguridad → Google Drive → **Iniciar sesión con Google**: eliges tu cuenta, se activa la copia diaria y se sube la primera copia. Áurea solo ve los archivos que ella crea (ámbito `drive.file`). El usuario no escribe nada.
Configuración única del desarrollador (Google Cloud, no hace falta secreto):
1. Activa **Google Drive API** en tu proyecto y configura la pantalla de consentimiento (publícala para que no caduque).
2. Credenciales → ID de cliente de OAuth → tipo **Android**: paquete `com.leonar2if.aurea` y huella SHA-1 de la firma de `aurea-debug.keystore`:
   `AB:E5:38:26:3E:61:94:A8:82:23:2A:29:37:07:F5:7B:A7:B3:F4:73`
   (Si más adelante firmas con otra clave, añade también su SHA-1.)
Sin ese cliente Android, Google rechaza el inicio de sesión («Google: …» en un aviso). El flujo con ID de cliente + secreto queda solo para la versión web.

## Fase 2 · Rutinas, avisos y Samsung (v1.4.0)

- **Rutinas** (módulo «Rutinas y modos»): pasos ordenados, días/hora, vínculos a tareas, hábitos y eventos existentes (sin duplicarlos), ejecución diaria, historial con copia de los pasos, racha y cumplimiento. Nuevos almacenes `routines` y `routruns` (IndexedDB v4, `APP_V=6`); entran solos en copias locales y Drive.
- **Avisos Android**: `aurea-features.js` programa el inicio de cada rutina (y opcionalmente cada paso) con acción «Empezar».
- **Enlaces**: `aurea://open/routines/<id>` (editor) y `aurea://open/routines/<id>/start` (empezar). Atajos dinámicos del icono para las rutinas activas.
- **Plugin nativo** `AureaRoutines` (`android-routines/java`, instalado con `patch-android-routines.mjs`): estado de avisos/alarmas exactas/batería, ajustes del sistema y atajos. `aurea-automation.js` lo expone a la guía.
- **Samsung Modos y rutinas**: no existe API pública para crearlos, leerlos ni activarlos desde otra app. La conexión es por notificación: con «Notificación para Samsung» activado, Áurea publica una notificación silenciosa (canal `aurea_auto`) con la palabra clave `AUREA_INICIO <rutina>` a la hora de inicio y `AUREA_FIN <rutina>` al completarla; una rutina de Samsung con la condición «Notificación recibida» (app Áurea + palabra clave) la lee y hace lo que el usuario configure. La guía en pantalla explica los pasos y permite enviar una notificación de prueba. Los enlaces/atajos sirven para apps como Tasker o MacroDroid.
- **Batería**: en Samsung hay que añadir Áurea a «Apps sin suspender» para que los avisos lleguen puntuales.
- No verificado en dispositivo real ni compilado aquí (sin SDK de Android): el código Java sólo se comprobó sintácticamente.
