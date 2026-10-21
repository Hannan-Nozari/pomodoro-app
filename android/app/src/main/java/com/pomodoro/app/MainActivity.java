package com.pomodoro.app;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /** Set by the widget when it is tapped while no session is running. */
    static final String EXTRA_ACTION = "pomodoro_action";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(OngoingTimerPlugin.class);
        registerPlugin(AlarmPlugin.class);
        registerPlugin(FocusModePlugin.class);
        super.onCreate(savedInstanceState);
        queueAction(getIntent());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        queueAction(intent);
    }

    /**
     * The web layer owns the timer, and it may not have booted yet when the
     * widget launches us, so the request is parked for it to collect.
     */
    private void queueAction(Intent intent) {
        if (intent == null) return;
        String action = intent.getStringExtra(EXTRA_ACTION);
        if (action != null) {
            TimerState.setPendingAction(this, action);
            intent.removeExtra(EXTRA_ACTION);
        }
    }
}
