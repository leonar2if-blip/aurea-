package com.leonar2if.aurea;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.Scope;

import java.util.Collections;

/**
 * Inicio de sesión con la cuenta de Google del teléfono (API de Autorización de Google Play Services), sin ID de cliente ni secreto
 * en la app. Pide solo el ámbito drive.file: Áurea únicamente ve los archivos que ella misma crea en tu Drive.
 * Devuelve un token de acceso de corta duración; si ya diste permiso, se renueva en silencio (interactive=false).
 * Requisito (una vez, del desarrollador): cliente OAuth tipo «Android» en Google Cloud con el paquete com.leonar2if.aurea y el SHA-1 de la firma.
 */
@CapacitorPlugin(name = "AureaGoogleAuth")
public class AureaGoogleAuthPlugin extends Plugin {
    private static final int REQ = 7421;
    private PluginCall pending;

    private AuthorizationRequest request() {
        return AuthorizationRequest.builder()
                .setRequestedScopes(Collections.singletonList(new Scope("https://www.googleapis.com/auth/drive.file")))
                .build();
    }

    private void deliver(PluginCall call, AuthorizationResult r) {
        JSObject o = new JSObject();
        o.put("accessToken", r.getAccessToken());
        try {
            if (r.toGoogleSignInAccount() != null && r.toGoogleSignInAccount().getEmail() != null) o.put("email", r.toGoogleSignInAccount().getEmail());
        } catch (Exception ignored) { /* el correo es opcional */ }
        o.put("cancelled", false);
        call.resolve(o);
    }

    @PluginMethod
    public void authorize(PluginCall call) {
        final boolean interactive = Boolean.TRUE.equals(call.getBoolean("interactive", false));
        Identity.getAuthorizationClient(getActivity()).authorize(request())
                .addOnSuccessListener(r -> {
                    if (!r.hasResolution()) {
                        if (r.getAccessToken() == null) { call.reject("Google no devolvió un token", "NO_TOKEN"); return; }
                        deliver(call, r);
                        return;
                    }
                    if (!interactive) { call.reject("Hay que iniciar sesión con Google", "NEEDS_SIGN_IN"); return; }
                    try {
                        PendingIntent pi = r.getPendingIntent();
                        if (pi == null) { call.reject("Google no pudo mostrar el inicio de sesión"); return; }
                        getBridge().saveCall(call);
                        pending = call;
                        getActivity().startIntentSenderForResult(pi.getIntentSender(), REQ, null, 0, 0, 0);
                    } catch (Exception e) {
                        pending = null;
                        call.reject("No se pudo abrir el inicio de sesión: " + e.getMessage());
                    }
                })
                .addOnFailureListener(e -> call.reject("Google: " + e.getMessage(), "GOOGLE_ERROR"));
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ) return;
        PluginCall call = pending;
        pending = null;
        if (call == null) return;
        if (resultCode != Activity.RESULT_OK || data == null) {
            JSObject o = new JSObject();
            o.put("cancelled", true);
            call.resolve(o);
            return;
        }
        try {
            deliver(call, Identity.getAuthorizationClient(getActivity()).getAuthorizationResultFromIntent(data));
        } catch (Exception e) {
            call.reject("Google: " + e.getMessage(), "GOOGLE_ERROR");
        }
    }
}
