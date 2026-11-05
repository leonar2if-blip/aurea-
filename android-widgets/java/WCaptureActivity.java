package com.leonar2if.aurea;

import android.app.Activity;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

/** Captura rápida desde el widget: una tarjeta pequeña con campo de texto. Funciona con Áurea cerrada; se guarda en la cola y la app la aplica. */
public class WCaptureActivity extends Activity {
    private String type = "task";
    private TextView[] chips;
    private EditText input;
    private WTheme th;

    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    private GradientDrawable rounded(int color, int radiusDp) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(color);
        g.setCornerRadius(dp(radiusDp));
        return g;
    }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        String t = getIntent().getStringExtra("type");
        if ("note".equals(t) || "idea".equals(t)) type = t;
        th = WTheme.of(this, 0, WStore.snapshotRaw(this));
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE | WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);

        LinearLayout outer = new LinearLayout(this);
        outer.setGravity(Gravity.CENTER);
        outer.setPadding(dp(20), dp(20), dp(20), dp(20));
        outer.setOnClickListener(v -> finish());

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setBackground(rounded(th.surface, 22));
        card.setPadding(dp(18), dp(16), dp(18), dp(16));
        card.setClickable(true);
        outer.addView(card, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        TextView title = new TextView(this);
        title.setText("Captura rápida");
        title.setTextSize(20);
        title.setTypeface(android.graphics.Typeface.SERIF);
        title.setTextColor(th.ink);
        card.addView(title);

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        LinearLayout.LayoutParams rp = new LinearLayout.LayoutParams(-1, -2);
        rp.topMargin = dp(12);
        card.addView(row, rp);
        String[] labels = {"Tarea", "Nota", "Idea"};
        final String[] types = {"task", "note", "idea"};
        chips = new TextView[3];
        for (int i = 0; i < 3; i++) {
            final int idx = i;
            TextView c = new TextView(this);
            c.setText(labels[i]);
            c.setTextSize(13);
            c.setGravity(Gravity.CENTER);
            c.setPadding(dp(14), dp(8), dp(14), dp(8));
            c.setOnClickListener(v -> { type = types[idx]; paint(); });
            LinearLayout.LayoutParams cp = new LinearLayout.LayoutParams(0, -2, 1f);
            if (i > 0) cp.leftMargin = dp(8);
            row.addView(c, cp);
            chips[i] = c;
        }

        input = new EditText(this);
        input.setHint("Escribe aquí…");
        input.setHintTextColor(th.muted);
        input.setTextColor(th.ink);
        input.setTextSize(15);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        input.setMaxLines(4);
        input.setBackground(rounded(th.base, 14));
        input.setPadding(dp(14), dp(12), dp(14), dp(12));
        LinearLayout.LayoutParams ip = new LinearLayout.LayoutParams(-1, -2);
        ip.topMargin = dp(12);
        card.addView(input, ip);

        LinearLayout btns = new LinearLayout(this);
        btns.setOrientation(LinearLayout.HORIZONTAL);
        btns.setGravity(Gravity.END);
        LinearLayout.LayoutParams bp = new LinearLayout.LayoutParams(-1, -2);
        bp.topMargin = dp(14);
        card.addView(btns, bp);
        TextView cancel = button("Cancelar", false);
        cancel.setOnClickListener(v -> finish());
        TextView save = button("Guardar", true);
        save.setOnClickListener(v -> save());
        btns.addView(cancel);
        LinearLayout.LayoutParams sp = new LinearLayout.LayoutParams(-2, -2);
        sp.leftMargin = dp(8);
        btns.addView(save, sp);

        setContentView(outer);
        paint();
    }

    private TextView button(String s, boolean primary) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(14);
        t.setGravity(Gravity.CENTER);
        t.setPadding(dp(18), dp(10), dp(18), dp(10));
        t.setTextColor(primary ? (th.dark ? 0xFF0E1514 : 0xFFF7F1E5) : th.ink);
        t.setBackground(rounded(primary ? th.accent : th.base, 100));
        return t;
    }

    private void paint() {
        String[] types = {"task", "note", "idea"};
        for (int i = 0; i < 3; i++) {
            boolean on = types[i].equals(type);
            chips[i].setBackground(rounded(on ? th.accent : th.base, 100));
            chips[i].setTextColor(on ? (th.dark ? 0xFF0E1514 : 0xFFF7F1E5) : th.ink);
        }
    }

    private void save() {
        String text = input.getText().toString().trim();
        if (text.length() == 0) {
            input.requestFocus();
            return;
        }
        try {
            JSONObject op = new JSONObject();
            op.put("k", "cq").put("type", type).put("text", text.length() > 500 ? text.substring(0, 500) : text);
            if (WStore.addOp(this, op, false)) {
                WUpdater.updateAll(this);
                AureaWidgetsPlugin.ping();
                Toast.makeText(this, "Guardado · se añadirá a Áurea", Toast.LENGTH_SHORT).show();
                finish();
                return;
            }
        } catch (Exception ignored) { }
        Toast.makeText(this, "No se pudo guardar", Toast.LENGTH_SHORT).show();
    }
}
