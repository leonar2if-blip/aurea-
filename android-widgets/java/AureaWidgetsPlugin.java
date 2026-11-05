package com.leonar2if.aurea;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Puente JS <-> nativo de los widgets. La app (aurea-widgets.js) lee las operaciones pendientes con drainOps(),
 * las aplica a sus datos reales (IndexedDB) y entonces llama a commit() con la instantánea nueva y los ids aplicados.
 */
@CapacitorPlugin(name = "AureaWidgets")
public class AureaWidgetsPlugin extends Plugin {
    private static volatile AureaWidgetsPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    /** Avisa a la app (si está viva) de que hay operaciones nuevas. Si no lo está, se aplicarán al abrirla. */
    static void ping() {
        AureaWidgetsPlugin p = instance;
        if (p == null) return;
        try {
            p.notifyListeners("ops", new JSObject());
        } catch (Throwable ignored) { }
    }

    @PluginMethod
    public void drainOps(PluginCall call) {
        JSObject o = new JSObject();
        try {
            o.put("ops", WStore.ops(getContext()));
        } catch (Exception e) {
            call.reject("No se pudieron leer las acciones de los widgets");
            return;
        }
        call.resolve(o);
    }

    @PluginMethod
    public void commit(PluginCall call) {
        try {
            String json = call.getString("json");
            JSArray ids = call.getArray("ids");
            WStore.commit(getContext(), json, ids);
            WUpdater.syncOptional(getContext());
            WUpdater.updateAll(getContext());
            call.resolve();
        } catch (Throwable t) {
            call.reject("No se pudieron actualizar los widgets");
        }
    }
}
