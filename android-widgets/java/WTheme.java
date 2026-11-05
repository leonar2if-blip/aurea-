package com.leonar2if.aurea;

import android.content.Context;
import android.content.res.Configuration;

import org.json.JSONObject;

/** Paleta real de Áurea (variables CSS de Aurea.html): claro #f7f1e5 / oscuro #162120. */
final class WTheme {
    final boolean dark;
    final int surface, base, ink, muted, accent, line;

    private WTheme(boolean dark) {
        this.dark = dark;
        if (dark) {
            surface = 0xFF162120; base = 0xFF0E1514; ink = 0xFFE3EEEA; muted = 0xFF86A39D; accent = 0xFF5CC2B5; line = 0x1AE3EEEA;
        } else {
            surface = 0xFFF7F1E5; base = 0xFFECE4D6; ink = 0xFF26261F; muted = 0xFF6F7468; accent = 0xFF237A74; line = 0x1F26261F;
        }
    }

    /** setting: 0 = automático (tema configurado en Áurea; si nunca se eligió, el del sistema), 1 = claro, 2 = oscuro. */
    static WTheme of(Context c, int setting, JSONObject view) {
        if (setting == 1) return new WTheme(false);
        if (setting == 2) return new WTheme(true);
        int dk = view == null ? -1 : view.optInt("dk", -1);
        if (dk == 0) return new WTheme(false);
        if (dk == 1) return new WTheme(true);
        boolean night = (c.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        return new WTheme(night);
    }
}
