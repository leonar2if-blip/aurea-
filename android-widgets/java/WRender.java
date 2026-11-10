package com.leonar2if.aurea;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.SystemClock;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

/** Construye el RemoteViews de cada widget según su tipo, tamaño real, tema y privacidad. Solo usa datos reales de la vista (instantánea + pendientes). */
final class WRender {
    private static final Locale ES = new Locale("es");
    private static final int[] RW = {R.id.r1, R.id.r2, R.id.r3, R.id.r4, R.id.r5, R.id.r6};
    private static final int[] RB = {R.id.r1b, R.id.r2b, R.id.r3b, R.id.r4b, R.id.r5b, R.id.r6b};
    private static final int[] RT = {R.id.r1t, R.id.r2t, R.id.r3t, R.id.r4t, R.id.r5t, R.id.r6t};
    private static final int[] RS = {R.id.r1s, R.id.r2s, R.id.r3s, R.id.r4s, R.id.r5s, R.id.r6s};
    private static final int[] RE = {R.id.r1e, R.id.r2e, R.id.r3e, R.id.r4e, R.id.r5e, R.id.r6e};
    private static final String DOTS = "••••";

    private WRender() {}

    /* ------------------------------ contexto de dibujo ------------------------------ */

    private static final class X {
        Context c; int wid; WTheme t; boolean priv; boolean tiny; int w, h; JSONObject v, cfg; RemoteViews rv;
    }

    static RemoteViews error(Context c) {
        RemoteViews rv = new RemoteViews(c.getPackageName(), R.layout.w_loading);
        rv.setTextViewText(R.id.w_empty, "No se pudo mostrar\nAbre Áurea");
        rv.setOnClickPendingIntent(R.id.w_root, open(c, "tasks"));
        return rv;
    }

    static RemoteViews build(Context c, String kind, int wid, JSONObject v, JSONObject cfg, Bundle opt) throws Exception {
        X x = new X();
        x.c = c; x.wid = wid; x.v = v; x.cfg = cfg;
        x.w = opt != null ? opt.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 110) : 110;
        x.h = opt != null ? opt.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110) : 110;
        if (x.w <= 0) x.w = 110;
        if (x.h <= 0) x.h = 110;
        x.tiny = x.w < 100 && x.h < 100;
        x.t = WTheme.of(c, cfg.optInt("theme", 0), v);
        boolean sensitiveDefault = "money".equals(kind) || "diary".equals(kind);
        x.priv = cfg.optBoolean("priv", sensitiveDefault);

        if (v == null) return waiting(x, kind);
        switch (kind) {
            case "myday": return myDay(x);
            case "tasks": return tasks(x);
            case "habits": return habits(x);
            case "agenda": return agenda(x);
            case "focus": return focus(x);
            case "water": return water(x);
            case "capture": return capture(x);
            case "projects": return projects(x);
            case "goals": return goals(x);
            case "money": return money(x);
            case "diary": return diary(x);
            case "stats": return stats(x);
            default: return error(c);
        }
    }

    /* ------------------------------ utilidades ------------------------------ */

    private static RemoteViews inflate(X x, int layout) {
        x.rv = new RemoteViews(x.c.getPackageName(), layout);
        x.rv.setInt(R.id.w_bg, "setColorFilter", x.t.surface);
        return x.rv;
    }

    private static int icon(String kind) {
        switch (kind) {
            case "myday": return R.drawable.wi_home;
            case "tasks": return R.drawable.wi_tasks;
            case "habits": return R.drawable.wi_habits;
            case "agenda": return R.drawable.wi_cal;
            case "focus": return R.drawable.wi_focus;
            case "water": return R.drawable.wi_drop;
            case "capture": return R.drawable.wi_plus;
            case "projects": return R.drawable.wi_projects;
            case "goals": return R.drawable.wi_goals;
            case "money": return R.drawable.wi_money;
            case "diary": return R.drawable.wi_diary;
            default: return R.drawable.wi_stats;
        }
    }

    private static String title(String kind) {
        switch (kind) {
            case "myday": return "Mi día";
            case "tasks": return "Tareas";
            case "habits": return "Hábitos";
            case "agenda": return "Agenda";
            case "focus": return "Enfoque";
            case "water": return "Agua";
            case "capture": return "Captura";
            case "projects": return "Proyectos";
            case "goals": return "Objetivos";
            case "money": return "Dinero";
            case "diary": return "Diario";
            default: return "Estadísticas";
        }
    }

    /** Cabecera: icono + título (+ dato a la derecha). En 1×1 solo queda el icono. */
    private static void head(X x, String kind, String aux) {
        RemoteViews rv = x.rv;
        rv.setImageViewResource(R.id.w_icon, icon(kind));
        rv.setInt(R.id.w_icon, "setColorFilter", x.t.accent);
        rv.setTextViewText(R.id.w_title, title(kind).toUpperCase(ES));
        rv.setTextColor(R.id.w_title, x.t.muted);
        boolean showTitle = !x.tiny && x.w >= 100;
        rv.setViewVisibility(R.id.w_title, showTitle ? View.VISIBLE : View.GONE);
        boolean showAux = aux != null && aux.length() > 0 && x.w >= 140;
        rv.setViewVisibility(R.id.w_aux, showAux ? View.VISIBLE : View.GONE);
        if (showAux) {
            rv.setTextViewText(R.id.w_aux, aux);
            rv.setTextColor(R.id.w_aux, x.t.ink);
        }
    }

    private static void text(X x, int id, String s, int color, boolean show) {
        if (show && s != null && s.length() > 0) {
            x.rv.setViewVisibility(id, View.VISIBLE);
            x.rv.setTextViewText(id, s);
            x.rv.setTextColor(id, color);
        } else {
            x.rv.setViewVisibility(id, View.GONE);
        }
    }

    private static void big(X x, String s) { text(x, R.id.w_big, s, x.t.ink, true); }

    private static void sub(X x, String s) { text(x, R.id.w_sub, s, x.t.muted, true); }

    private static void empty(X x, String s) {
        text(x, R.id.w_empty, s, x.t.muted, true);
        x.rv.setViewVisibility(R.id.w_rows, View.GONE);
    }

    /** Cuántas filas caben de verdad (36 dp cada una) según la altura actual del widget. */
    private static int rowsFit(X x, boolean hasBig, boolean hasSub) {
        if (x.tiny) return 0;
        int avail = x.h - 22 - 20 - (hasBig ? 36 : 0) - (hasSub ? 16 : 0);
        return Math.max(0, Math.min(6, avail / 36));
    }

    private static PendingIntent open(Context c, String path) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("aurea://open/" + path));
        i.setPackage(c.getPackageName());
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(c, path.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent act(X x, String k, long id2, int ml) {
        Intent i = new Intent(x.c, WActionReceiver.class).setAction(WActionReceiver.ACTION);
        i.setData(Uri.parse("aurea-w://op/" + k + "/" + id2 + "/" + ml + "/" + x.wid));
        i.putExtra("k", k).putExtra("id2", id2).putExtra("ml", ml).putExtra("wid", x.wid);
        return PendingIntent.getBroadcast(x.c, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void openOn(X x, int viewId, String path) {
        x.rv.setOnClickPendingIntent(viewId, open(x.c, path));
    }

    private static String clip(X x, String s, String hidden) {
        if (x.priv) return hidden;
        return s == null ? "" : s;
    }

    private static String dayLabel(String iso) {
        if (iso == null || iso.length() < 10) return "";
        String today = WStore.today();
        if (iso.equals(today)) return "Hoy";
        try {
            SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            Date d = f.parse(iso);
            Calendar t = Calendar.getInstance();
            t.add(Calendar.DAY_OF_YEAR, 1);
            if (iso.equals(f.format(t.getTime()))) return "Mañana";
            long days = Math.round((d.getTime() - f.parse(today).getTime()) / 86400000.0);
            if (days < 0) return days == -1 ? "Venció ayer" : "Venció hace " + (-days) + " d";
            return new SimpleDateFormat("EEE d MMM", ES).format(d).replace(".", "");
        } catch (Exception e) {
            return iso;
        }
    }

    private static String fmtMs(long sec) {
        sec = Math.max(0, sec);
        long h = sec / 3600, m = (sec % 3600) / 60, s = sec % 60;
        return h > 0 ? String.format(Locale.US, "%d:%02d:%02d", h, m, s) : String.format(Locale.US, "%02d:%02d", m, s);
    }

    private static void rowOpen(X x, int i, String path) { x.rv.setOnClickPendingIntent(RW[i], open(x.c, path)); }

    /** Dibuja una fila; btn: 0 = sin botón, 1 = aro, 2 = aro con marca (hecho). */
    private static void row(X x, int i, int btn, PendingIntent btnClick, String t, String s, String e, boolean accentEnd) {
        RemoteViews rv = x.rv;
        rv.setViewVisibility(RW[i], View.VISIBLE);
        text(x, RT[i], t, x.t.ink, true);
        text(x, RS[i], s, x.t.muted, x.w >= 130);
        text(x, RE[i], e, accentEnd ? x.t.accent : x.t.muted, x.w >= 150);
        if (btn == 0) {
            rv.setViewVisibility(RB[i], View.GONE);
        } else {
            rv.setViewVisibility(RB[i], View.VISIBLE);
            rv.setImageViewResource(RB[i], btn == 2 ? R.drawable.wi_ringcheck : R.drawable.wi_ring);
            rv.setInt(RB[i], "setColorFilter", btn == 2 ? x.t.accent : x.t.muted);
            if (btnClick != null) rv.setOnClickPendingIntent(RB[i], btnClick);
            rv.setContentDescription(RB[i], btn == 2 ? "Hecho" : "Marcar como hecho");
        }
    }

    private static void hideRowsFrom(X x, int from) {
        for (int i = from; i < 6; i++) x.rv.setViewVisibility(RW[i], View.GONE);
    }

    /* ------------------------------ sin datos todavía ------------------------------ */

    private static RemoteViews waiting(X x, String kind) {
        RemoteViews rv = inflate(x, "myday".equals(kind) ? R.layout.w_myday : R.layout.w_list);
        if ("myday".equals(kind)) {
            head(x, kind, null);
            rv.setViewVisibility(R.id.w_big, View.GONE);
            rv.setViewVisibility(R.id.w_bar_l, View.GONE);
            rv.setViewVisibility(R.id.w_bar_d, View.GONE);
            rv.setViewVisibility(R.id.w_sub, View.GONE);
            rv.setViewVisibility(R.id.w_next, View.GONE);
        } else if ("water".equals(kind) || "focus".equals(kind) || "capture".equals(kind)) {
            // estos tienen su propio diseño; para el aviso se usa la lista genérica
            rv = inflate(x, R.layout.w_list);
            head(x, kind, null);
            rv.setViewVisibility(R.id.w_big, View.GONE);
            rv.setViewVisibility(R.id.w_sub, View.GONE);
        } else {
            head(x, kind, null);
            rv.setViewVisibility(R.id.w_big, View.GONE);
            rv.setViewVisibility(R.id.w_sub, View.GONE);
        }
        text(x, R.id.w_empty, x.tiny ? "Abre Áurea" : "Abre Áurea una vez para activar este widget", x.t.muted, true);
        rv.setViewVisibility(R.id.w_rows, View.GONE);
        rv.setOnClickPendingIntent(R.id.w_root, open(x.c, "tasks"));
        return rv;
    }

    /* ------------------------------ Mi día ------------------------------ */

    private static RemoteViews myDay(X x) {
        JSONObject v = x.v;
        RemoteViews rv = inflate(x, R.layout.w_myday);
        JSONObject td = v.optJSONObject("td");
        int p = td == null ? 0 : td.optInt("p"), d = td == null ? 0 : td.optInt("d"), total = p + d;
        String date = new SimpleDateFormat("EEEE d 'de' MMMM", ES).format(new Date());
        date = date.length() > 0 ? Character.toUpperCase(date.charAt(0)) + date.substring(1) : date;
        head(x, "myday", null);
        if (!x.tiny && x.w >= 100) { rv.setTextViewText(R.id.w_title, date.toUpperCase(ES)); }
        int pct = total == 0 ? 0 : Math.round(100f * d / total);
        boolean dark = x.t.dark;
        rv.setViewVisibility(R.id.w_bar_l, !dark && total > 0 && !x.tiny ? View.VISIBLE : View.GONE);
        rv.setViewVisibility(R.id.w_bar_d, dark && total > 0 && !x.tiny ? View.VISIBLE : View.GONE);
        rv.setProgressBar(dark ? R.id.w_bar_d : R.id.w_bar_l, 100, pct, false);
        if (total == 0) {
            text(x, R.id.w_big, "—", x.t.ink, true);
            text(x, R.id.w_sub, "Sin tareas para hoy", x.t.muted, !x.tiny);
        } else {
            text(x, R.id.w_big, pct + " %", x.t.ink, true);
            text(x, R.id.w_sub, d + (d == 1 ? " hecha" : " hechas") + " · " + p + (p == 1 ? " pendiente" : " pendientes"), x.t.muted, !x.tiny);
        }
        rv.setTextViewTextSize(R.id.w_big, TypedValue.COMPLEX_UNIT_SP, x.tiny ? 22 : (x.h < 110 ? 26 : 34));
        rv.setViewVisibility(R.id.w_empty, View.GONE);
        // próximo compromiso: primer evento que aún no ha pasado
        JSONObject next = nextEvent(v);
        boolean room = !x.tiny && x.h >= 110;
        if (next != null && room) {
            rv.setViewVisibility(R.id.w_next, View.VISIBLE);
            text(x, R.id.w_nl, "PRÓXIMO COMPROMISO", x.t.muted, true);
            text(x, R.id.w_nt, clip(x, next.optString("t"), "Evento privado"), x.t.ink, true);
            String tm = next.optString("time");
            text(x, R.id.w_ns, dayLabel(next.optString("day")) + (tm.length() > 0 ? " · " + tm : next.optInt("all") == 1 ? " · Todo el día" : ""), x.t.muted, true);
        } else {
            rv.setViewVisibility(R.id.w_next, View.GONE);
        }
        openOn(x, R.id.w_root, "tasks");
        return rv;
    }

    private static String nowHm() { return new SimpleDateFormat("HH:mm", Locale.US).format(new Date()); }

    private static JSONObject nextEvent(JSONObject v) {
        JSONArray ev = v.optJSONArray("events");
        if (ev == null) return null;
        String today = WStore.today(), now = nowHm();
        for (int i = 0; i < ev.length(); i++) {
            JSONObject e = ev.optJSONObject(i);
            if (e == null) continue;
            String day = e.optString("day");
            if (day.compareTo(today) < 0) continue;
            if (day.equals(today) && e.optInt("all") == 0) {
                String end = e.optString("end"), time = e.optString("time");
                String ref = end.length() > 0 ? end : time;
                if (ref.length() > 0 && ref.compareTo(now) < 0) continue; // ya terminó
            }
            return e;
        }
        return null;
    }

    /* ------------------------------ Tareas ------------------------------ */

    private static RemoteViews tasks(X x) throws Exception {
        RemoteViews rv = inflate(x, R.layout.w_list);
        JSONArray ts = x.v.optJSONArray("tasks");
        JSONObject td = x.v.optJSONObject("td");
        int pToday = td == null ? 0 : td.optInt("p");
        boolean onlyToday = x.cfg.optInt("scope", 0) == 1;
        String today = WStore.today();
        int n = 0;
        JSONArray list = new JSONArray();
        if (ts != null) for (int i = 0; i < ts.length(); i++) {
            JSONObject t = ts.getJSONObject(i);
            String k = WStore.taskKey(t);
            if (onlyToday && !(k.length() > 0 && k.compareTo(today) <= 0)) continue;
            list.put(t);
        }
        head(x, "tasks", pToday + (pToday == 1 ? " hoy" : " hoy"));
        int fit = rowsFit(x, false, false);
        if (x.tiny) {
            big(x, String.valueOf(pToday));
            sub(x, "hoy");
            rv.setTextViewTextSize(R.id.w_big, TypedValue.COMPLEX_UNIT_SP, 26);
        } else {
            rv.setViewVisibility(R.id.w_big, View.GONE);
            rv.setViewVisibility(R.id.w_sub, View.GONE);
        }
        rv.setViewVisibility(R.id.w_rows, View.VISIBLE);
        rv.setViewVisibility(R.id.w_empty, View.GONE);
        for (int i = 0; i < Math.min(fit, list.length()); i++, n++) {
            JSONObject t = list.getJSONObject(i);
            long id = t.optLong("id");
            String k = WStore.taskKey(t), time = t.optString("time");
            boolean blocked = t.optInt("dep") == 1;
            String when = k.length() > 0 ? dayLabel(k) : "Sin fecha";
            String s = (time.length() > 0 ? time + " · " : "") + (blocked ? "Bloqueada" : when);
            String e = t.optInt("u") == 2 ? "Alta" : "";
            row(x, i, 1, blocked ? open(x.c, "tasks/" + id) : act(x, "tc", id, 0), clip(x, t.optString("t"), "Tarea privada"), x.priv ? "" : s, e, true);
            rowOpen(x, i, "tasks/" + id);
        }
        hideRowsFrom(x, n);
        if (list.length() == 0 && !x.tiny) empty(x, onlyToday ? "Nada pendiente para hoy" : "Sin tareas pendientes");
        openOn(x, R.id.w_root, "tasks");
        return rv;
    }

    /* ------------------------------ Hábitos ------------------------------ */

    private static RemoteViews habits(X x) throws Exception {
        RemoteViews rv = inflate(x, R.layout.w_list);
        JSONArray hs = x.v.optJSONArray("habits");
        boolean hideDone = x.cfg.optBoolean("hideDone", false);
        int total = hs == null ? 0 : hs.length(), done = 0;
        for (int i = 0; i < total; i++) if (hs.getJSONObject(i).optInt("done") == 1) done++;
        head(x, "habits", total > 0 ? done + "/" + total : null);
        if (x.tiny) {
            big(x, total > 0 ? done + "/" + total : "—");
            sub(x, "hábitos");
            rv.setTextViewTextSize(R.id.w_big, TypedValue.COMPLEX_UNIT_SP, 24);
        } else {
            rv.setViewVisibility(R.id.w_big, View.GONE);
            rv.setViewVisibility(R.id.w_sub, View.GONE);
        }
        rv.setViewVisibility(R.id.w_rows, View.VISIBLE);
        rv.setViewVisibility(R.id.w_empty, View.GONE);
        int fit = rowsFit(x, false, false), n = 0;
        for (int i = 0; i < total && n < fit; i++) {
            JSONObject h = hs.getJSONObject(i);
            boolean isDone = h.optInt("done") == 1;
            if (hideDone && isDone) continue;
            long id = h.optLong("id");
            int streak = h.optInt("s");
            String s = x.priv ? "" : (streak > 0 ? streak + (streak == 1 ? " día de racha" : " días de racha") : "Sin racha");
            row(x, n, isDone ? 2 : 1, isDone ? open(x.c, "habits/" + id) : act(x, "hl", id, 0),
                    clip(x, h.optString("n"), "Hábito privado"), s, x.priv ? "" : h.optString("tm"), false);
            rowOpen(x, n, "habits/" + id);
            n++;
        }
        hideRowsFrom(x, n);
        if (total == 0 && !x.tiny) empty(x, "Aún no tienes hábitos");
        else if (n == 0 && !x.tiny) empty(x, "¡Hábitos de hoy completados!");
        openOn(x, R.id.w_root, "habits");
        return rv;
    }

    /* ------------------------------ Agenda ------------------------------ */

    private static RemoteViews agenda(X x) throws Exception {
        RemoteViews rv = inflate(x, R.layout.w_list);
        JSONArray ev = x.v.optJSONArray("events");
        String today = WStore.today(), now = nowHm();
        JSONArray list = new JSONArray();
        int todayCount = 0;
        if (ev != null) for (int i = 0; i < ev.length(); i++) {
            JSONObject e = ev.getJSONObject(i);
            String day = e.optString("day");
            if (day.compareTo(today) < 0) continue;
            if (day.equals(today) && e.optInt("all") == 0) {
                String end = e.optString("end"), time = e.optString("time");
                String ref = end.length() > 0 ? end : time;
                if (ref.length() > 0 && ref.compareTo(now) < 0) continue;
            }
            if (day.equals(today)) todayCount++;
            list.put(e);
        }
        head(x, "agenda", todayCount > 0 ? todayCount + (todayCount == 1 ? " hoy" : " hoy") : null);
        JSONObject first = list.length() > 0 ? list.getJSONObject(0) : null;
        if (x.tiny) {
            String tm = first == null ? "—" : (first.optString("time").length() > 0 ? first.optString("time") : "Hoy");
            big(x, tm);
            sub(x, first == null ? "sin eventos" : "próximo");
            rv.setTextViewTextSize(R.id.w_big, TypedValue.COMPLEX_UNIT_SP, 22);
        } else {
            rv.setViewVisibility(R.id.w_big, View.GONE);
            rv.setViewVisibility(R.id.w_sub, View.GONE);
        }
        rv.setViewVisibility(R.id.w_rows, View.VISIBLE);
        rv.setViewVisibility(R.id.w_empty, View.GONE);
        int fit = rowsFit(x, false, false), n = 0;
        for (int i = 0; i < Math.min(fit, list.length()); i++, n++) {
            JSONObject e = list.getJSONObject(i);
            long id = e.optLong("id");
            String time = e.optString("time"), end = e.optString("end");
            String rng = time.length() > 0 ? (end.length() > 0 ? time + "–" + end : time) : "Todo el día";
            String loc = e.optString("loc");
            String s = dayLabel(e.optString("day")) + (!x.priv && loc.length() > 0 ? " · " + loc : "") + (e.optInt("rem") == 1 ? " · con aviso" : "");
            row(x, i, 0, null, clip(x, e.optString("t"), "Evento privado"), s, rng, true);
            rowOpen(x, i, "cal/" + id);
        }
        hideRowsFrom(x, n);
        if (list.length() == 0 && !x.tiny) empty(x, "Sin eventos próximos");
        openOn(x, R.id.w_root, "cal");
        return rv;
    }

    /* ------------------------------ Enfoque ------------------------------ */

    private static RemoteViews focus(X x) {
        RemoteViews rv = inflate(x, R.layout.w_focus);
        JSONObject f = x.v.optJSONObject("focus");
        if (f == null) f = new JSONObject();
        String mode = f.optString("mode", "idle");
        int kind = f.optInt("kind");
        long now = System.currentTimeMillis();
        boolean running = "run".equals(mode);
        // Chronometer en cuenta atrás necesita Android 7 (API 24); en versiones anteriores se muestra el tiempo restante sin segundero
        boolean ticks = kind == 2 || android.os.Build.VERSION.SDK_INT >= 24;
        boolean finished = running && kind != 2 && f.optLong("end") <= now;
        String phase = f.optString("phase", "work");
        String label = kind == 1 ? "Cuenta atrás" : kind == 2 ? "Cronómetro" : "work".equals(phase) ? "Enfoque" : "short".equals(phase) ? "Descanso corto" : "Descanso largo";
        head(x, "focus", null);
        rv.setViewVisibility(R.id.w_head, x.tiny ? View.GONE : View.VISIBLE);
        if (!x.tiny && x.w >= 100) rv.setTextViewText(R.id.w_title, label.toUpperCase(ES));
        float sp = x.tiny ? 18 : (x.h < 110 ? 26 : 34);
        rv.setTextViewTextSize(R.id.w_chrono, TypedValue.COMPLEX_UNIT_SP, sp);
        rv.setTextViewTextSize(R.id.w_big, TypedValue.COMPLEX_UNIT_SP, sp);
        rv.setTextColor(R.id.w_chrono, x.t.ink);
        if (running && !finished && ticks) {
            long base = SystemClock.elapsedRealtime() + (kind == 2 ? -(now - f.optLong("start")) : (f.optLong("end") - now));
            rv.setViewVisibility(R.id.w_chrono, View.VISIBLE);
            rv.setViewVisibility(R.id.w_big, View.GONE);
            if (android.os.Build.VERSION.SDK_INT >= 24) rv.setChronometerCountDown(R.id.w_chrono, kind != 2);
            rv.setChronometer(R.id.w_chrono, base, null, true);
        } else {
            rv.setViewVisibility(R.id.w_chrono, View.GONE);
            long sec = finished ? 0 : running && kind != 2 ? Math.max(0, (f.optLong("end") - now) / 1000) : kind == 2 ? f.optLong("up") : f.optLong("left");
            text(x, R.id.w_big, fmtMs(sec), x.t.ink, true);
        }
        String tk = f.optString("taskT");
        String st = finished ? "Tiempo cumplido · abre Áurea" : running ? (tk.length() > 0 && !x.priv ? tk : "En marcha") : "pause".equals(mode) ? "En pausa" : "Listo para empezar";
        if (tk.length() > 0 && x.priv && !finished) st = "Tarea privada";
        text(x, R.id.w_sub, st, x.t.muted, !x.tiny && x.h >= 90);
        // botón principal: iniciar / pausar / continuar (mismo gesto, estado según los datos reales)
        rv.setViewVisibility(R.id.w_btns, x.h >= 90 || x.tiny ? View.VISIBLE : View.GONE);
        rv.setInt(R.id.w_f1bg, "setColorFilter", x.t.accent);
        rv.setImageViewResource(R.id.w_f1i, running && !finished ? R.drawable.wi_pause : R.drawable.wi_play);
        rv.setInt(R.id.w_f1i, "setColorFilter", x.t.dark ? 0xFF0E1514 : 0xFFF7F1E5);
        rv.setContentDescription(R.id.w_f1, running && !finished ? "Pausar" : "pause".equals(mode) ? "Continuar" : "Iniciar");
        rv.setOnClickPendingIntent(R.id.w_f1, act(x, "f", 0, 0));
        rv.setViewVisibility(R.id.w_f2, x.tiny ? View.GONE : View.VISIBLE);
        rv.setInt(R.id.w_f2bg, "setColorFilter", x.t.base);
        rv.setInt(R.id.w_f2i, "setColorFilter", x.t.ink);
        rv.setContentDescription(R.id.w_f2, "Abrir Enfoque en Áurea");
        rv.setOnClickPendingIntent(R.id.w_f2, open(x.c, "focus"));
        openOn(x, R.id.w_root, "focus");
        // los botones deben ganar al toque del fondo
        rv.setOnClickPendingIntent(R.id.w_f1, act(x, "f", 0, 0));
        return rv;
    }

    /* ------------------------------ Agua ------------------------------ */

    private static String ml(int v) { return String.format(new Locale("es"), "%,d", v); }

    private static RemoteViews water(X x) {
        RemoteViews rv = inflate(x, R.layout.w_water);
        JSONObject w = x.v.optJSONObject("water");
        int cur = w == null ? 0 : w.optInt("ml"), goal = w == null ? 2500 : Math.max(500, w.optInt("goal", 2500));
        int pct = Math.min(100, Math.round(100f * cur / goal));
        boolean short_ = x.h < 110;
        head(x, "water", pct + " %");
        rv.setViewVisibility(R.id.w_head, x.tiny || short_ ? View.GONE : View.VISIBLE);
        big(x, x.tiny ? ml(cur) : ml(cur) + " ml");
        rv.setTextViewTextSize(R.id.w_big, TypedValue.COMPLEX_UNIT_SP, x.tiny ? 18 : short_ ? 22 : 32);
        text(x, R.id.w_sub, "de " + ml(goal) + " ml" + (cur >= goal ? " · ¡meta cumplida!" : ""), x.t.muted, !x.tiny && !short_);
        boolean showBar = !x.tiny && !short_;
        rv.setViewVisibility(R.id.w_bar_l, showBar && !x.t.dark ? View.VISIBLE : View.GONE);
        rv.setViewVisibility(R.id.w_bar_d, showBar && x.t.dark ? View.VISIBLE : View.GONE);
        rv.setProgressBar(x.t.dark ? R.id.w_bar_d : R.id.w_bar_l, 100, pct, false);
        rv.setViewVisibility(R.id.w_btns, x.tiny ? View.GONE : View.VISIBLE);
        for (int[] b : new int[][]{{R.id.w_a1, R.id.w_a1bg, R.id.w_a1t, 250}, {R.id.w_a2, R.id.w_a2bg, R.id.w_a2t, 500}}) {
            rv.setInt(b[1], "setColorFilter", x.t.base);
            rv.setTextViewText(b[2], "+" + b[3] + " ml");
            rv.setTextColor(b[2], x.t.ink);
            rv.setOnClickPendingIntent(b[0], act(x, "w", 0, b[3]));
            rv.setContentDescription(b[0], "Añadir " + b[3] + " mililitros de agua");
        }
        // 1×1: todo el widget suma 250 ml; el resto de tamaños abren Áurea desde el fondo
        if (x.tiny) rv.setOnClickPendingIntent(R.id.w_root, act(x, "w", 0, 250));
        else openOn(x, R.id.w_root, "habits");
        return rv;
    }

    /* ------------------------------ Captura rápida ------------------------------ */

    private static PendingIntent cap(X x, String type) {
        Intent i = new Intent(x.c, WCaptureActivity.class).putExtra("type", type);
        i.setData(Uri.parse("aurea-w://cap/" + type + "/" + x.wid));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(x.c, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static RemoteViews capture(X x) {
        RemoteViews rv = inflate(x, R.layout.w_capture);
        String[] ty = {"task", "note", "idea"}, lb = {"Tarea", "Nota", "Idea"};
        int[] cell = {R.id.c1, R.id.c2, R.id.c3}, ci = {R.id.c1i, R.id.c2i, R.id.c3i}, cl = {R.id.c1l, R.id.c2l, R.id.c3l};
        boolean labels = x.h >= 70 && !x.tiny;
        for (int i = 0; i < 3; i++) {
            boolean show = !x.tiny || i == 0;
            rv.setViewVisibility(cell[i], show ? View.VISIBLE : View.GONE);
            rv.setInt(ci[i], "setColorFilter", x.t.accent);
            rv.setTextViewText(cl[i], lb[i]);
            rv.setTextColor(cl[i], x.t.ink);
            rv.setViewVisibility(cl[i], labels ? View.VISIBLE : View.GONE);
            rv.setOnClickPendingIntent(cell[i], cap(x, ty[i]));
            rv.setContentDescription(cell[i], "Captura rápida: " + lb[i].toLowerCase(ES));
        }
        if (x.tiny) rv.setImageViewResource(R.id.c1i, R.drawable.wi_plus);
        rv.setOnClickPendingIntent(R.id.w_root, cap(x, "task"));
        // las celdas (hijas) ganan al fondo
        for (int i = 0; i < 3; i++) rv.setOnClickPendingIntent(cell[i], cap(x, ty[i]));
        return rv;
    }

    /* ------------------------------ complementarios ------------------------------ */

    /** Cabecera + cifra grande. La cifra grande solo se muestra en 1×1 o, si es lo principal del widget, cuando hay altura. Devuelve si se mostró. */
    private static boolean listHeadBig(X x, String kind, String aux, String bigText, String subText, int bigSp, boolean mainBig) {
        head(x, kind, aux);
        boolean showBig = bigText != null && (x.tiny || (mainBig && x.h >= 90));
        text(x, R.id.w_big, bigText, x.t.ink, showBig);
        text(x, R.id.w_sub, subText, x.t.muted, showBig && (x.tiny || x.w >= 110));
        if (showBig) x.rv.setTextViewTextSize(R.id.w_big, TypedValue.COMPLEX_UNIT_SP, x.tiny ? Math.min(bigSp, 24) : bigSp);
        x.rv.setViewVisibility(R.id.w_rows, View.VISIBLE);
        x.rv.setViewVisibility(R.id.w_empty, View.GONE);
        return showBig && !x.tiny;
    }

    private static RemoteViews projects(X x) throws Exception {
        RemoteViews rv = inflate(x, R.layout.w_list);
        JSONArray ps = x.v.optJSONArray("projects");
        int total = ps == null ? 0 : ps.length();
        listHeadBig(x, "projects", total > 0 ? total + (total == 1 ? " activo" : " activos") : null, total > 0 ? String.valueOf(total) : null, total == 1 ? "proyecto activo" : "proyectos activos", 28, false);
        int fit = rowsFit(x, false, false);
        int n = 0;
        for (int i = 0; i < Math.min(fit, total); i++, n++) {
            JSONObject p = ps.getJSONObject(i);
            long id = p.optLong("id");
            String due = p.optString("due");
            int late = p.optInt("late");
            String s = x.priv ? "" : (late > 0 ? late + (late == 1 ? " tarea vencida" : " tareas vencidas") : due.length() > 0 ? "Límite: " + dayLabel(due) : "Sin fecha límite");
            row(x, i, 0, null, clip(x, p.optString("n"), "Proyecto privado"), s, p.optInt("p") + " %", true);
            rowOpen(x, i, "projects/" + id);
        }
        hideRowsFrom(x, n);
        if (total == 0 && !x.tiny) empty(x, "Sin proyectos activos");
        openOn(x, R.id.w_root, "projects");
        return rv;
    }

    private static RemoteViews goals(X x) throws Exception {
        RemoteViews rv = inflate(x, R.layout.w_list);
        JSONArray gs = x.v.optJSONArray("goals");
        int total = gs == null ? 0 : gs.length();
        listHeadBig(x, "goals", total > 0 ? String.valueOf(total) : null, total > 0 ? String.valueOf(total) : null, total == 1 ? "objetivo" : "objetivos", 28, false);
        int fit = rowsFit(x, false, false), n = 0;
        for (int i = 0; i < Math.min(fit, total); i++, n++) {
            JSONObject g = gs.getJSONObject(i);
            long id = g.optLong("id");
            String date = g.optString("date");
            row(x, i, 0, null, clip(x, g.optString("n"), "Objetivo privado"), x.priv ? "" : (date.length() > 0 ? "Para: " + dayLabel(date) : "Sin fecha"), g.optInt("p") + " %", true);
            rowOpen(x, i, "goals/" + id);
        }
        hideRowsFrom(x, n);
        if (total == 0 && !x.tiny) empty(x, "Sin objetivos activos");
        openOn(x, R.id.w_root, "goals");
        return rv;
    }

    private static RemoteViews money(X x) {
        RemoteViews rv = inflate(x, R.layout.w_list);
        JSONObject m = x.v.optJSONObject("money");
        if (m == null) {
            listHeadBig(x, "money", null, null, null, 28, false);
            hideRowsFrom(x, 0);
            empty(x, "Sin movimientos registrados");
        } else {
            boolean sb = listHeadBig(x, "money", null, x.priv ? DOTS : m.optString("disp"), "disponible", 26, true);
            int fit = rowsFit(x, sb, sb), n = 0;
            String[][] r = {{"Ingresos del mes", m.optString("inc")}, {"Gastos del mes", m.optString("exp")}};
            for (int i = 0; i < Math.min(fit, 2); i++, n++) row(x, i, 0, null, r[i][0], "", x.priv ? DOTS : r[i][1], false);
            hideRowsFrom(x, n);
        }
        openOn(x, R.id.w_root, "money");
        return rv;
    }

    private static RemoteViews diary(X x) {
        RemoteViews rv = inflate(x, R.layout.w_list);
        JSONObject d = x.v.optJSONObject("diary");
        if (d == null) {
            listHeadBig(x, "diary", null, null, null, 28, false);
            hideRowsFrom(x, 0);
            empty(x, "Aún no hay entradas");
        } else {
            int st = d.optInt("streak");
            boolean sb = listHeadBig(x, "diary", null, x.priv ? DOTS : String.valueOf(st), st == 1 ? "día seguido" : "días seguidos", 28, true);
            int fit = rowsFit(x, sb, sb), n = 0;
            String[][] r = {{"Hoy", d.optInt("today") == 1 ? "Escrito" : "Pendiente"}, {"Entradas", String.valueOf(d.optInt("n"))}};
            for (int i = 0; i < Math.min(fit, 2); i++, n++) row(x, i, 0, null, r[i][0], "", x.priv ? DOTS : r[i][1], false);
            hideRowsFrom(x, n);
        }
        openOn(x, R.id.w_root, "diary"); // nunca muestra texto del diario, solo recuento y racha
        return rv;
    }

    private static RemoteViews stats(X x) {
        RemoteViews rv = inflate(x, R.layout.w_list);
        JSONObject s = x.v.optJSONObject("stats");
        if (s == null || !s.optBoolean("hasData")) {
            listHeadBig(x, "stats", null, null, null, 28, false);
            hideRowsFrom(x, 0);
            empty(x, "Aún no hay datos suficientes");
        } else {
            int wd = s.optInt("weekDone");
            boolean sb = listHeadBig(x, "stats", null, String.valueOf(wd), wd == 1 ? "tarea hecha esta semana" : "tareas hechas esta semana", 28, true);
            int fit = rowsFit(x, sb, sb), n = 0;
            String[][] r = {{"Enfoque hoy", s.optInt("focusMin") + " min"}, {"Constancia de hábitos", s.optInt("habitPct") + " %"}};
            for (int i = 0; i < Math.min(fit, 2); i++, n++) row(x, i, 0, null, r[i][0], "", r[i][1], false);
            hideRowsFrom(x, n);
        }
        openOn(x, R.id.w_root, "stats");
        return rv;
    }
}
