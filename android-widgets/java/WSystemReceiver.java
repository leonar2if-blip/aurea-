package com.leonar2if.aurea;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Reinicio, actualización de la app, cambio de día/hora/zona y la alarma propia: vuelve a dibujar todo desde los datos guardados. */
public class WSystemReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        try {
            WUpdater.updateAll(c);
        } catch (Throwable ignored) { }
    }
}
