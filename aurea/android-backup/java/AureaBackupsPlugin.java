package com.leonar2if.aurea;

import android.Manifest;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.provider.MediaStore;
import android.provider.OpenableColumns;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Copias de seguridad en una carpeta pública que sobrevive a la desinstalación: Descargas/ÁUREA/.
 *  - Android 10+ (API 29+): MediaStore.Downloads. No necesita ningún permiso para crear archivos propios.
 *  - Android 7-9 (API 24-28): archivo normal en Download/ÁUREA con WRITE_EXTERNAL_STORAGE (se pide solo al guardar la primera copia).
 * Los datos pasan por un archivo temporal de la caché de la app (no por el puente JS) para no mover copias grandes como texto.
 * Tras reinstalar Áurea, Android ya no deja "listar" los archivos de la instalación anterior: para eso está pickBackup() (selector del sistema).
 */
@CapacitorPlugin(
        name = "AureaBackups",
        permissions = {@Permission(strings = {Manifest.permission.WRITE_EXTERNAL_STORAGE}, alias = "storage")}
)
public class AureaBackupsPlugin extends Plugin {
    static final String FOLDER = "ÁUREA";
    private static final String REL = Environment.DIRECTORY_DOWNLOADS + "/" + FOLDER + "/";

    private boolean legacy() { return Build.VERSION.SDK_INT < 29; }

    private boolean needsStoragePermission() {
        return legacy() && getPermissionState("storage") != PermissionState.GRANTED;
    }

    private static String safeName(String n) {
        if (n == null) return null;
        n = n.replace("\\", "/");
        n = n.substring(n.lastIndexOf('/') + 1).trim();
        if (n.length() == 0 || n.startsWith(".") || n.length() > 120) return null;
        return n;
    }

    private File cacheFile(String name) {
        return new File(getContext().getCacheDir(), name);
    }

    private static void copy(InputStream in, OutputStream out) throws Exception {
        byte[] buf = new byte[64 * 1024];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        out.flush();
    }

    /* ---------------- estado y permiso ---------------- */

    @PluginMethod
    public void status(PluginCall call) {
        JSObject o = new JSObject();
        o.put("sdk", Build.VERSION.SDK_INT);
        o.put("needsPermission", legacy());
        o.put("granted", !needsStoragePermission());
        o.put("folder", "Descargas/" + FOLDER);
        call.resolve(o);
    }

    @PluginMethod
    public void ensurePermission(PluginCall call) {
        if (!needsStoragePermission()) {
            JSObject o = new JSObject();
            o.put("granted", true);
            call.resolve(o);
            return;
        }
        requestPermissionForAlias("storage", call, "permissionResult");
    }

    @PermissionCallback
    private void permissionResult(PluginCall call) {
        JSObject o = new JSObject();
        o.put("granted", !needsStoragePermission());
        call.resolve(o);
    }

    /* ---------------- guardar ---------------- */

    /** Copia un archivo de la caché de la app (cacheName) a Descargas/ÁUREA/<name>. */
    @PluginMethod
    public void saveFromCache(PluginCall call) {
        if (needsStoragePermission()) {
            call.reject("Falta el permiso de almacenamiento", "PERMISSION");
            return;
        }
        String name = safeName(call.getString("name")), cn = safeName(call.getString("cacheName"));
        if (name == null || cn == null) { call.reject("Nombre no válido"); return; }
        File src = cacheFile(cn);
        if (!src.isFile()) { call.reject("No se encontró el archivo temporal"); return; }
        try {
            JSObject o = new JSObject();
            if (!legacy()) {
                ContentResolver cr = getContext().getContentResolver();
                deleteByName(cr, name); // si ya existía una con el mismo nombre, se reemplaza en vez de crear "nombre (1)"
                ContentValues v = new ContentValues();
                v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                v.put(MediaStore.MediaColumns.MIME_TYPE, "application/octet-stream");
                v.put(MediaStore.MediaColumns.RELATIVE_PATH, REL);
                v.put(MediaStore.MediaColumns.IS_PENDING, 1);
                Uri uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (uri == null) throw new Exception("MediaStore no creó el archivo");
                try (InputStream in = new FileInputStream(src); OutputStream out = cr.openOutputStream(uri, "w")) {
                    if (out == null) throw new Exception("No se pudo abrir el destino");
                    copy(in, out);
                } catch (Exception e) {
                    cr.delete(uri, null, null);
                    throw e;
                }
                ContentValues done = new ContentValues();
                done.put(MediaStore.MediaColumns.IS_PENDING, 0);
                cr.update(uri, done, null, null);
                o.put("uri", uri.toString());
            } else {
                File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), FOLDER);
                if (!dir.isDirectory() && !dir.mkdirs()) throw new Exception("No se pudo crear Descargas/" + FOLDER);
                File dst = new File(dir, name);
                try (InputStream in = new FileInputStream(src); OutputStream out = new FileOutputStream(dst)) { copy(in, out); }
                o.put("uri", Uri.fromFile(dst).toString());
            }
            o.put("name", name);
            o.put("path", "Descargas/" + FOLDER + "/" + name);
            call.resolve(o);
        } catch (Exception e) {
            call.reject("No se pudo guardar en Descargas/" + FOLDER + ": " + e.getMessage());
        } finally {
            //noinspection ResultOfMethodCallIgnored
            src.delete();
        }
    }

    private void deleteByName(ContentResolver cr, String name) {
        try {
            cr.delete(MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                    MediaStore.MediaColumns.DISPLAY_NAME + "=? AND " + MediaStore.MediaColumns.RELATIVE_PATH + "=?",
                    new String[]{name, REL});
        } catch (Exception ignored) { /* si no es nuestro, no se toca */ }
    }

    /* ---------------- listar / leer / borrar (solo los creados por esta instalación) ---------------- */

    @PluginMethod
    public void list(PluginCall call) {
        JSArray arr = new JSArray();
        try {
            if (!legacy()) {
                ContentResolver cr = getContext().getContentResolver();
                String[] proj = {MediaStore.MediaColumns._ID, MediaStore.MediaColumns.DISPLAY_NAME, MediaStore.MediaColumns.SIZE, MediaStore.MediaColumns.DATE_MODIFIED};
                try (Cursor c = cr.query(MediaStore.Downloads.EXTERNAL_CONTENT_URI, proj,
                        MediaStore.MediaColumns.RELATIVE_PATH + "=? AND " + MediaStore.MediaColumns.DISPLAY_NAME + " LIKE ?",
                        new String[]{REL, "%.aurea"}, MediaStore.MediaColumns.DATE_MODIFIED + " DESC")) {
                    while (c != null && c.moveToNext()) {
                        JSObject f = new JSObject();
                        f.put("uri", ContentUris.withAppendedId(MediaStore.Downloads.EXTERNAL_CONTENT_URI, c.getLong(0)).toString());
                        f.put("name", c.getString(1));
                        f.put("size", c.getLong(2));
                        f.put("mtime", c.getLong(3) * 1000L);
                        arr.put(f);
                    }
                }
            } else if (!needsStoragePermission()) {
                File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), FOLDER);
                File[] fs = dir.listFiles((d, n) -> n.endsWith(".aurea"));
                if (fs != null) for (File x : fs) {
                    JSObject f = new JSObject();
                    f.put("uri", Uri.fromFile(x).toString());
                    f.put("name", x.getName());
                    f.put("size", x.length());
                    f.put("mtime", x.lastModified());
                    arr.put(f);
                }
            }
        } catch (Exception e) {
            call.reject("No se pudo leer Descargas/" + FOLDER);
            return;
        }
        JSObject o = new JSObject();
        o.put("files", arr);
        call.resolve(o);
    }

    /** Copia el archivo (uri) a la caché de la app y devuelve su nombre en caché para leerlo con Filesystem. */
    @PluginMethod
    public void readToCache(PluginCall call) {
        String uri = call.getString("uri");
        if (uri == null) { call.reject("Falta el archivo"); return; }
        try {
            JSObject o = copyUriToCache(Uri.parse(uri));
            call.resolve(o);
        } catch (Exception e) {
            call.reject("No se pudo leer el archivo: " + e.getMessage());
        }
    }

    private JSObject copyUriToCache(Uri u) throws Exception {
        ContentResolver cr = getContext().getContentResolver();
        String display = null;
        long size = -1;
        if ("file".equals(u.getScheme())) {
            File f = new File(u.getPath());
            display = f.getName();
            size = f.length();
        } else {
            try (Cursor c = cr.query(u, new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE}, null, null, null)) {
                if (c != null && c.moveToFirst()) { display = c.getString(0); size = c.getLong(1); }
            } catch (Exception ignored) { }
        }
        if (size > 300L * 1048576L) throw new Exception("Archivo demasiado grande");
        String cn = "restore-" + System.currentTimeMillis() + ".tmp";
        File dst = cacheFile(cn);
        try (InputStream in = "file".equals(u.getScheme()) ? new FileInputStream(new File(u.getPath())) : cr.openInputStream(u);
             OutputStream out = new FileOutputStream(dst)) {
            if (in == null) throw new Exception("No se pudo abrir el archivo");
            copy(in, out);
        }
        JSObject o = new JSObject();
        o.put("cacheName", cn);
        o.put("name", display == null ? "copia.aurea" : display);
        o.put("size", dst.length());
        return o;
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String uri = call.getString("uri");
        if (uri == null) { call.reject("Falta el archivo"); return; }
        try {
            Uri u = Uri.parse(uri);
            if ("file".equals(u.getScheme())) {
                if (needsStoragePermission()) { call.reject("Falta el permiso de almacenamiento", "PERMISSION"); return; }
                File f = new File(u.getPath());
                if (!f.getParentFile().getName().equals(FOLDER) || !f.delete()) throw new Exception("no se pudo borrar");
            } else if (getContext().getContentResolver().delete(u, null, null) < 1) {
                throw new Exception("Android no permite borrarlo desde Áurea");
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("No se pudo borrar: " + e.getMessage());
        }
    }

    /* ---------------- elegir una copia con el selector del sistema (sirve tras reinstalar) ---------------- */

    @PluginMethod
    public void pickBackup(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("*/*");
        if (Build.VERSION.SDK_INT >= 26) {
            try {
                // abre el selector directamente en Descargas/ÁUREA (si existe)
                Uri init = DocumentsContract.buildDocumentUri("com.android.externalstorage.documents", "primary:Download/" + FOLDER);
                i.putExtra(DocumentsContract.EXTRA_INITIAL_URI, init);
            } catch (Exception ignored) { }
        }
        startActivityForResult(call, i, "pickResult");
    }

    @ActivityCallback
    private void pickResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            JSObject o = new JSObject();
            o.put("cancelled", true);
            call.resolve(o);
            return;
        }
        try {
            JSObject o = copyUriToCache(result.getData().getData());
            o.put("cancelled", false);
            call.resolve(o);
        } catch (Exception e) {
            call.reject("No se pudo leer el archivo: " + e.getMessage());
        }
    }
}
