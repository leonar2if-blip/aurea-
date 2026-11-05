package com.leonar2if.aurea;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.json.JSONObject;

import java.util.HashMap;
import java.util.Map;

/**
 * Acciones de los widgets (completar tarea, registrar hábito, agua, temporizador).
 * Cada acción se encola (WStore) y el widget cambia al instante; la app la aplica a IndexedDB cuando se abre o está activa.
 * Antirrebote: pulsaciones repetidas no duplican nada.
 */
public class WActionReceiver extends BroadcastReceiver {
    static final String ACTION = "com.leonar2if.aurea.widget.ACTION";
    private static final Map<String, Long> LAST = new HashMap<>();

    private static synchronized boolean tooSoon(String key, long ms) {
        long now = System.currentTimeMillis();
        Long t = LAST.get(key);
        if (t != null && now - t < ms) return true;
        LAST.put(key, now);
        return false;
    }

    @Override
    public void onReceive(Context c, Intent i) {
        try {
            if (i == null || !ACTION.equals(i.getAction())) return;
            String k = i.getStringExtra("k");
            long id2 = i.getLongExtra("id2", 0);
            int ml = i.getIntExtra("ml", 0);
            if (k == null) return;
            JSONObject op = new JSONObject();
            boolean added;
            switch (k) {
                case "tc":
                case "hl":
                    if (tooSoon(k + id2, 800)) return;
                    op.put("k", k).put("id2", id2);
                    added = WStore.addOp(c, op, true); // si ya hay una igual pendiente, no se repite
                    break;
                case "w":
                    if (tooSoon("w" + i.getIntExtra("wid", 0), 600) || ml <= 0 || ml > 2000) return;
                    op.put("k", "w").put("ml", ml);
                    added = WStore.addOp(c, op, false);
                    break;
                case "f": {
                    if (tooSoon("f", 900)) return;
                    JSONObject v = WStore.view(c);
                    JSONObject f = v == null ? null : v.optJSONObject("focus");
                    if (f == null) return; // sin datos de Áurea no hay temporizador que controlar
                    boolean running = "run".equals(f.optString("mode"));
                    op.put("k", running ? "fp" : "fs");
                    added = WStore.addOp(c, op, false);
                    break;
                }
                default:
                    return;
            }
            if (added) {
                WUpdater.updateAll(c);
                AureaWidgetsPlugin.ping();
            }
        } catch (Throwable ignored) { /* una acción fallida no debe tumbar el proceso */ }
    }
}
