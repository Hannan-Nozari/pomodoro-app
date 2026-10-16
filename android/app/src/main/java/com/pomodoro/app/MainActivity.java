package com.pomodoro.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(OngoingTimerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
