package com.leonar2if.aurea;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.content.Intent;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;

import org.json.JSONObject;

import java.util.Locale;

/** Ajustes nativos de cada widget: tema, privacidad y, donde tiene sentido, qué mostrar. Se abre al añadirlo y al reconfigurarlo. */
public class WConfigActivity extends Activity {
    private int wid = AppWidgetManager.INVALID_APPWIDGET_ID;
    private String kind = "";
    private RadioGroup themeGroup, scopeGroup;
    private Switch priv, hideDone;
    private WTheme th;

    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    private GradientDrawable rounded(int color, int r) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(color);
        g.setCornerRadius(dp(r));
        return g;
    }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        setResult(RESULT_CANCELED);
        Intent in = getIntent();
        if (in != null && in.getExtras() != null) wid = in.getExtras().getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        if (wid == AppWidgetManager.INVALID_APPWIDGET_ID) { finish(); return; }
        AppWidgetProviderInfo info = AppWidgetManager.getInstance(this).getAppWidgetInfo(wid);
        if (info != null && info.provider != null) {
            String cn = info.provider.getClassName();
            int i = cn.lastIndexOf('$');
            kind = (i >= 0 ? cn.substring(i + 1) : cn).toLowerCase(Locale.ROOT);
        }
        JSONObject cfg = WStore.cfg(this, wid);
        th = WTheme.of(this, 0, WStore.snapshotRaw(this));
        boolean sensitiveDefault = "money".equals(kind) || "diary".equals(kind);

        LinearLayout outer = new LinearLayout(this);
        outer.setGravity(Gravity.CENTER);
        outer.setPadding(dp(18), dp(18), dp(18), dp(18));
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setBackground(rounded(th.surface, 22));
        card.setPadding(dp(20), dp(18), dp(20), dp(16));
        ScrollView sv = new ScrollView(this);
        sv.addView(card);
        outer.addView(sv, new LinearLayout.LayoutParams(-1, -2));

        card.addView(text("Ajustes del widget", 20, th.ink, true));
        card.addView(text(titleOf(kind), 12, th.muted, false));

        card.addView(label("Tema"));
        themeGroup = new RadioGroup(this);
        String[] tn = {"Automático (el de Áurea)", "Claro", "Oscuro"};
        for (int i = 0; i < 3; i++) {
            RadioButton rb = radio(tn[i], i);
            themeGroup.addView(rb);
        }
        themeGroup.check(100 + cfg.optInt("theme", 0));
        card.addView(themeGroup);

        if ("tasks".equals(kind)) {
            card.addView(label("Qué tareas mostrar"));
            scopeGroup = new RadioGroup(this);
            scopeGroup.addView(radio("Todas las pendientes (por prioridad)", 0));
            scopeGroup.addView(radio("Solo las de hoy y vencidas", 1));
            scopeGroup.check(100 + cfg.optInt("scope", 0));
            card.addView(scopeGroup);
        }
        if ("habits".equals(kind)) {
            card.addView(label("Hábitos"));
            hideDone = toggle("Ocultar los ya registrados hoy", cfg.optBoolean("hideDone", false));
            card.addView(hideDone);
        }
        if (!"water".equals(kind) && !"capture".equals(kind)) {
            card.addView(label("Privacidad"));
            priv = toggle("Ocultar información sensible (títulos, nombres e importes)", cfg.optBoolean("priv", sensitiveDefault));
            card.addView(priv);
        }

        LinearLayout btns = new LinearLayout(this);
        btns.setGravity(Gravity.END);
        LinearLayout.LayoutParams bp = new LinearLayout.LayoutParams(-1, -2);
        bp.topMargin = dp(18);
        card.addView(btns, bp);
        TextView cancel = button("Cancelar", false);
        cancel.setOnClickListener(v -> finish());
        TextView ok = button("Guardar", true);
        ok.setOnClickListener(v -> save());
        btns.addView(cancel);
        LinearLayout.LayoutParams op = new LinearLayout.LayoutParams(-2, -2);
        op.leftMargin = dp(8);
        btns.addView(ok, op);
        setContentView(outer);
    }

    private static String titleOf(String k) {
        switch (k) {
            case "myday": return "Mi día";
            case "tasks": return "Tareas";
            case "habits": return "Hábitos";
            case "agenda": return "Agenda";
            case "focus": return "Enfoque";
            case "water": return "Agua";
            case "capture": return "Captura rápida";
            case "projects": return "Proyectos";
            case "goals": return "Objetivos";
            case "money": return "Dinero";
            case "diary": return "Diario";
            case "stats": return "Estadísticas";
            default: return "Áurea";
        }
    }

    private TextView text(String s, int sp, int color, boolean serif) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(sp);
        t.setTextColor(color);
        if (serif) t.setTypeface(android.graphics.Typeface.SERIF);
        return t;
    }

    private TextView label(String s) {
        TextView t = text(s.toUpperCase(new Locale("es")), 11, th.muted, false);
        t.setLetterSpacing(0.08f);
        t.setPadding(0, dp(16), 0, dp(4));
        return t;
    }

    private RadioButton radio(String s, int id) {
        RadioButton r = new RadioButton(this);
        r.setId(100 + id); // ids 100+ (0 y -1 tienen significado especial en RadioGroup)
        r.setText(s);
        r.setTextColor(th.ink);
        r.setTextSize(14);
        return r;
    }

    private Switch toggle(String s, boolean on) {
        Switch sw = new Switch(this);
        sw.setText(s);
        sw.setTextColor(th.ink);
        sw.setTextSize(14);
        sw.setChecked(on);
        return sw;
    }

    private TextView button(String s, boolean primary) {
        TextView t = text(s, 14, primary ? (th.dark ? 0xFF0E1514 : 0xFFF7F1E5) : th.ink, false);
        t.setGravity(Gravity.CENTER);
        t.setPadding(dp(18), dp(10), dp(18), dp(10));
        t.setBackground(rounded(primary ? th.accent : th.base, 100));
        return t;
    }

    private void save() {
        try {
            JSONObject cfg = WStore.cfg(this, wid);
            cfg.put("theme", Math.max(0, themeGroup.getCheckedRadioButtonId() - 100));
            if (priv != null) cfg.put("priv", priv.isChecked());
            if (scopeGroup != null) cfg.put("scope", Math.max(0, scopeGroup.getCheckedRadioButtonId() - 100));
            if (hideDone != null) cfg.put("hideDone", hideDone.isChecked());
            WStore.setCfg(this, wid, cfg);
        } catch (Exception ignored) { }
        AppWidgetManager m = AppWidgetManager.getInstance(this);
        WUpdater.update(this, m, wid, kind);
        Intent r = new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, wid);
        setResult(RESULT_OK, r);
        finish();
    }
}
