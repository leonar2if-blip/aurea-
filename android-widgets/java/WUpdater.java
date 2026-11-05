package com.leonar2if.aurea;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.util.Calendar;

/** Redibuja widgets. Se llama tras cada acción, al publicar datos la app, al cambiar de día y tras reiniciar. Sin procesos en segundo plano. */
final class WUpdater {
    static final String REFRESH = "com.leonar2if.aurea.widget.REFRESH";

    private WUpdater() {}

    static void update(Context c, AppWidgetManager m, int id, String kind) {
        RemoteViews rv;
        try {
            rv = WRender.build(c, kind, id, WStore.view(c), WStore.cfg(c, id), m.getAppWidgetOptions(id));
        } catch (Throwable t) {
            rv = WRender.error(c);
        }
        try {
            m.updateAppWidget(id, rv);
        } catch (Throwable ignored) { /* el launcher puede haber retirado el widget */ }
    }

    static void updateAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        for (int i = 0; i < WProviders.KINDS.length; i++) {
            int[] ids = m.getAppWidgetIds(new ComponentName(c, WProviders.CLASSES[i]));
            for (int id : ids) update(c, m, id, WProviders.KINDS[i]);
        }
        scheduleNext(c);
    }

    /** Habilita los widgets complementarios cuyo módulo ya tiene datos. Nunca los deshabilita solos (no quita uno ya colocado). */
    static void syncOptional(Context c) {
        JSONObject s = WStore.snapshotRaw(c);
        if (s == null) return;
        JSONObject mods = s.optJSONObject("mods");
        if (mods == null) return;
        PackageManager pm = c.getPackageManager();
        for (String k : WProviders.OPTIONAL) {
            if (mods.optInt(k) <= 0) continue;
            ComponentName cn = new ComponentName(c, WProviders.classOf(k));
            if (pm.getComponentEnabledSetting(cn) != PackageManager.COMPONENT_ENABLED_STATE_ENABLED) {
                pm.setComponentEnabledSetting(cn, PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
            }
        }
    }

    /** Una sola alarma inexacta: la medianoche (cambio de día) o el fin del temporizador, lo que ocurra antes. */
    static void scheduleNext(Context c) {
        try {
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            Calendar cal = Calendar.getInstance();
            cal.add(Calendar.DAY_OF_YEAR, 1);
            cal.set(Calendar.HOUR_OF_DAY, 0);
            cal.set(Calendar.MINUTE, 0);
            cal.set(Calendar.SECOND, 30);
            long at = cal.getTimeInMillis();
            JSONObject v = WStore.view(c);
            JSONObject f = v == null ? null : v.optJSONObject("focus");
            if (f != null && "run".equals(f.optString("mode")) && f.optInt("kind") != 2) {
                long end = f.optLong("end") + 1500;
                if (end > System.currentTimeMillis() && end < at) at = end;
            }
            Intent i = new Intent(c, WSystemReceiver.class).setAction(REFRESH);
            PendingIntent pi = PendingIntent.getBroadcast(c, 7001, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            if (Build.VERSION.SDK_INT >= 23) am.setAndAllowWhileIdle(AlarmManager.RTC, at, pi);
            else am.set(AlarmManager.RTC, at, pi);
        } catch (Throwable ignored) { /* sin alarma: quedan las actualizaciones periódicas */ }
    }
}
