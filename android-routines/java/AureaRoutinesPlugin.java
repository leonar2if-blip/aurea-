package com.leonar2if.aurea;

import android.app.AlarmManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Puente nativo de Rutinas: estado de avisos/batería, ajustes del sistema y atajos del icono.
 * No controla Modos y rutinas de Samsung (Samsung no publica API para eso): solo detecta si la app de Samsung
 * está instalada y, si lo está, la abre para que el usuario configure su rutina a mano.
 */
@CapacitorPlugin(name = "AureaRoutines")
public class AureaRoutinesPlugin extends Plugin {
    private static final String SAMSUNG_ROUTINES = "com.samsung.android.app.routines";

    private Context ctx() { return getContext(); }

    private Intent samsungIntent() {
        try { return ctx().getPackageManager().getLaunchIntentForPackage(SAMSUNG_ROUTINES); }
        catch (Exception e) { return null; }
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        try {
            r.put("notif", NotificationManagerCompat.from(ctx()).areNotificationsEnabled());
            if (Build.VERSION.SDK_INT >= 31) {
                AlarmManager am = (AlarmManager) ctx().getSystemService(Context.ALARM_SERVICE);
                r.put("exact", am != null && am.canScheduleExactAlarms());
            } else r.put("exact", JSObject.NULL);
            PowerManager pm = (PowerManager) ctx().getSystemService(Context.POWER_SERVICE);
            r.put("battery", pm != null && pm.isIgnoringBatteryOptimizations(ctx().getPackageName()));
            r.put("maker", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER.toLowerCase());
            r.put("samsung", samsungIntent() != null);
            r.put("sdk", Build.VERSION.SDK_INT);
        } catch (Exception e) {
            call.reject("No se pudo leer el estado: " + e.getMessage());
            return;
        }
        call.resolve(r);
    }

    private void launch(PluginCall call, Intent i) {
        try {
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("No se pudo abrir el ajuste: " + e.getMessage());
        }
    }

    private Intent appDetails() {
        return new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + ctx().getPackageName()));
    }

    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
        if (i.resolveActivity(ctx().getPackageManager()) == null) i = appDetails();
        launch(call, i);
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) { launch(call, appDetails()); }

    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 31) {
            launch(call, new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + ctx().getPackageName())));
        } else call.resolve();
    }

    @PluginMethod
    public void openSamsungRoutines(PluginCall call) {
        Intent i = samsungIntent();
        if (i == null) { call.reject("Modos y rutinas de Samsung no está instalado en este dispositivo"); return; }
        launch(call, i);
    }

    /** items: [{id,label,url}] → atajos dinámicos del icono (estándar de Android; abren aurea://open/routines/ID/start). */
    @PluginMethod
    public void setShortcuts(PluginCall call) {
        try {
            JSArray arr = call.getArray("items");
            int max = Math.max(1, ShortcutManagerCompat.getMaxShortcutCountPerActivity(ctx()));
            List<ShortcutInfoCompat> list = new ArrayList<>();
            if (arr != null) {
                for (int n = 0; n < arr.length() && list.size() < max; n++) {
                    JSONObject o = arr.getJSONObject(n);
                    String id = o.optString("id", ""), label = o.optString("label", ""), url = o.optString("url", "");
                    if (id.isEmpty() || label.isEmpty() || !url.startsWith("aurea://")) continue;
                    Intent in = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    in.setPackage(ctx().getPackageName());
                    list.add(new ShortcutInfoCompat.Builder(ctx(), id)
                        .setShortLabel(label.length() > 10 ? label.substring(0, 10) : label)
                        .setLongLabel(label)
                        .setIntent(in)
                        .build());
                }
            }
            ShortcutManagerCompat.setDynamicShortcuts(ctx(), list);
            JSObject r = new JSObject();
            r.put("count", list.size());
            call.resolve(r);
        } catch (Exception e) {
            call.reject("No se pudieron crear los atajos: " + e.getMessage());
        }
    }
}
