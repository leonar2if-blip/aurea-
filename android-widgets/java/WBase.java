package com.leonar2if.aurea;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

/** Base común de todos los widgets de Áurea. Cada subclase solo indica qué widget es. */
public abstract class WBase extends AppWidgetProvider {
    abstract String kind();

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) WUpdater.update(c, m, id, kind());
        WUpdater.scheduleNext(c);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle opts) {
        WUpdater.update(c, m, id, kind()); // redimensionado: reorganiza y oculta lo secundario
    }

    @Override
    public void onDeleted(Context c, int[] ids) {
        WStore.deleteCfg(c, ids);
    }

    @Override
    public void onEnabled(Context c) {
        WUpdater.scheduleNext(c);
    }
}
