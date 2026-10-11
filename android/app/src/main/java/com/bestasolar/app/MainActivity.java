package com.bestasolar.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Module propre à l'application (PDF ouverts, envoyés au client sur
        // WhatsApp) : déclaré AVANT le démarrage du pont Capacitor.
        registerPlugin(FichiersNatifsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
