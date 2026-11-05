package com.leonar2if.aurea;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AureaWidgetsPlugin.class); // widgets de pantalla de inicio (debe registrarse antes de super.onCreate)
        super.onCreate(savedInstanceState);
    }
}
