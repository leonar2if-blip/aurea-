package com.leonar2if.aurea;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * Almacenamiento nativo de los widgets. NO es una base de datos paralela:
 *  - "snap": instantánea de SOLO LECTURA que publica la app (derivada de IndexedDB, que sigue siendo la fuente de verdad).
 *  - "ops":  cola de acciones hechas en los widgets, pendientes de aplicarse en la app (que las guarda en IndexedDB y las confirma).
 *  - "cfg_<id>": ajustes de cada widget (tema, privacidad...).
 * Lo que se dibuja es instantánea + operaciones pendientes (vista optimista), así el widget responde al instante aunque Áurea esté cerrada.
 */
final class WStore {
    static final String PREFS = "aurea_widgets";
    private static final Object LOCK = new Object();
    private static final int OPS_MAX = 500;

    private WStore() {}

    static SharedPreferences sp(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static String today() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    /* ------------------------------ instantánea ------------------------------ */

    static JSONObject snapshotRaw(Context c) {
        String s = sp(c).getString("snap", null);
        if (s == null) return null;
        try {
            return new JSONObject(s);
        } catch (Exception e) {
            return null;
        }
    }

    static JSONArray ops(Context c) {
        synchronized (LOCK) {
            try {
                return new JSONArray(sp(c).getString("ops", "[]"));
            } catch (Exception e) {
                return new JSONArray();
            }
        }
    }

    /** Guarda la instantánea nueva y retira de la cola las operaciones ya aplicadas por la app. */
    static void commit(Context c, String json, JSONArray ids) {
        synchronized (LOCK) {
            Set<String> done = new HashSet<>();
            if (ids != null) for (int i = 0; i < ids.length(); i++) done.add(ids.optString(i));
            SharedPreferences.Editor ed = sp(c).edit();
            if (json != null && json.length() > 1) {
                try {
                    new JSONObject(json); // solo se guarda JSON válido
                    ed.putString("snap", json);
                } catch (Exception ignored) { /* conserva la instantánea anterior */ }
            }
            if (!done.isEmpty()) {
                JSONArray keep = new JSONArray();
                JSONArray cur = ops(c);
                for (int i = 0; i < cur.length(); i++) {
                    JSONObject o = cur.optJSONObject(i);
                    if (o != null && !done.contains(o.optString("id"))) keep.put(o);
                }
                ed.putString("ops", keep.toString());
            }
            ed.commit(); // síncrono: debe sobrevivir si el proceso muere justo después
        }
    }

    /** Añade una operación a la cola. Devuelve false si ya había una igual pendiente (evita duplicados por pulsaciones repetidas). */
    static boolean addOp(Context c, JSONObject op, boolean dedupe) {
        synchronized (LOCK) {
            try {
                JSONArray cur = ops(c);
                if (dedupe) {
                    for (int i = 0; i < cur.length(); i++) {
                        JSONObject o = cur.optJSONObject(i);
                        if (o != null && o.optString("k").equals(op.optString("k")) && o.optLong("id2") == op.optLong("id2")
                                && o.optString("k").length() > 0 && op.has("id2")) return false;
                    }
                }
                op.put("id", UUID.randomUUID().toString());
                op.put("at", System.currentTimeMillis());
                JSONArray next = new JSONArray();
                int start = Math.max(0, cur.length() - (OPS_MAX - 1));
                for (int i = start; i < cur.length(); i++) next.put(cur.get(i));
                next.put(op);
                sp(c).edit().putString("ops", next.toString()).commit();
                return true;
            } catch (Exception e) {
                return false;
            }
        }
    }

    /* ------------------------------ vista = instantánea + operaciones pendientes ------------------------------ */

    /** Devuelve null si Áurea aún no ha publicado datos. */
    static JSONObject view(Context c) {
        JSONObject s = snapshotRaw(c);
        if (s == null) return null;
        try {
            normalizeDay(s);
            JSONArray ops = ops(c);
            for (int i = 0; i < ops.length(); i++) {
                JSONObject op = ops.optJSONObject(i);
                if (op != null) applyOp(s, op);
            }
        } catch (Exception ignored) { /* si algo falla se muestra la instantánea tal cual */ }
        return s;
    }

    /** Si la instantánea es de un día anterior (app sin abrir desde entonces) se descuenta lo que solo valía "para ayer". */
    private static void normalizeDay(JSONObject s) throws Exception {
        String today = today();
        if (today.equals(s.optString("day"))) return;
        JSONObject w = s.optJSONObject("water");
        if (w != null && !today.equals(w.optString("day"))) {
            w.put("ml", 0);
            w.put("day", today);
        }
        JSONArray hs = s.optJSONArray("habits");
        if (hs != null) for (int i = 0; i < hs.length(); i++) hs.getJSONObject(i).put("done", 0);
        JSONArray ts = s.optJSONArray("tasks");
        int p = 0;
        if (ts != null) {
            for (int i = 0; i < ts.length(); i++) {
                String k = taskKey(ts.getJSONObject(i));
                if (k.length() > 0 && k.compareTo(today) <= 0) p++;
            }
        }
        JSONObject td = s.optJSONObject("td");
        if (td == null) { td = new JSONObject(); s.put("td", td); }
        td.put("p", p);
        td.put("d", 0);
    }

    static String taskKey(JSONObject t) {
        String plan = t.optString("plan", "");
        return plan.length() > 0 ? plan : t.optString("due", "");
    }

    private static void applyOp(JSONObject s, JSONObject op) throws Exception {
        String k = op.optString("k");
        if ("tc".equals(k)) {
            JSONArray ts = s.optJSONArray("tasks");
            if (ts == null) return;
            long id = op.optLong("id2");
            JSONArray keep = new JSONArray();
            boolean removed = false;
            for (int i = 0; i < ts.length(); i++) {
                JSONObject t = ts.getJSONObject(i);
                if (t.optLong("id") == id) removed = true; else keep.put(t);
            }
            if (removed) {
                s.put("tasks", keep);
                JSONObject td = s.optJSONObject("td");
                if (td != null) {
                    td.put("p", Math.max(0, td.optInt("p") - 1));
                    td.put("d", td.optInt("d") + 1);
                }
            }
        } else if ("hl".equals(k)) {
            JSONArray hs = s.optJSONArray("habits");
            long id = op.optLong("id2");
            if (hs != null) for (int i = 0; i < hs.length(); i++) {
                JSONObject h = hs.getJSONObject(i);
                if (h.optLong("id") == id) h.put("done", 1);
            }
        } else if ("w".equals(k)) {
            JSONObject w = s.optJSONObject("water");
            if (w != null) w.put("ml", w.optInt("ml") + Math.max(0, Math.min(2000, op.optInt("ml"))));
        } else if ("fp".equals(k)) {
            JSONObject f = s.optJSONObject("focus");
            if (f != null && "run".equals(f.optString("mode"))) {
                long at = op.optLong("at");
                if (f.optInt("kind") == 2) {
                    f.put("up", Math.max(0, (at - f.optLong("start")) / 1000));
                } else {
                    f.put("left", Math.max(0, (long) Math.ceil((f.optLong("end") - at) / 1000.0)));
                }
                f.put("mode", "pause");
                f.put("end", 0);
            }
        } else if ("fs".equals(k)) {
            JSONObject f = s.optJSONObject("focus");
            if (f != null && !"run".equals(f.optString("mode"))) {
                long at = op.optLong("at");
                if (f.optInt("kind") == 2) {
                    f.put("start", at - f.optLong("up") * 1000);
                } else {
                    f.put("end", at + f.optLong("left") * 1000);
                    f.put("start", at - f.optLong("up") * 1000);
                }
                f.put("mode", "run");
            }
        }
        // "cq" (captura) no cambia nada visible: se aplica al abrir Áurea.
    }

    /* ------------------------------ ajustes por widget ------------------------------ */

    static JSONObject cfg(Context c, int widgetId) {
        try {
            String s = sp(c).getString("cfg_" + widgetId, null);
            if (s != null) return new JSONObject(s);
        } catch (Exception ignored) { }
        return new JSONObject();
    }

    static void setCfg(Context c, int widgetId, JSONObject o) {
        sp(c).edit().putString("cfg_" + widgetId, o.toString()).commit();
    }

    static void deleteCfg(Context c, int[] ids) {
        SharedPreferences.Editor ed = sp(c).edit();
        for (int id : ids) ed.remove("cfg_" + id);
        ed.commit();
    }
}
