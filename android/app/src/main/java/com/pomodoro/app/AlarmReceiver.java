package com.pomodoro.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.content.ContextCompat;

/** Fired by AlarmManager at the session deadline; hands off to the ringing service. */
public class AlarmReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        Intent ring = new Intent(context, AlarmService.class);
        ring.putExtra(AlarmService.EXTRA_TITLE, intent.getStringExtra(AlarmService.EXTRA_TITLE));
        ring.putExtra(AlarmService.EXTRA_BODY, intent.getStringExtra(AlarmService.EXTRA_BODY));
        ring.putExtra(AlarmService.EXTRA_SOUND, intent.getStringExtra(AlarmService.EXTRA_SOUND));
        // An exact alarm grants a brief allowance to start a foreground service.
        ContextCompat.startForegroundService(context, ring);
    }
}
