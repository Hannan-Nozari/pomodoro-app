package com.pomodoro.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.app.NotificationManagerCompat;

/**
 * Clears the running-timer notification the moment the session ends.
 *
 * Without this the chronometer would sail past zero into negative time, because
 * the app that would otherwise clear it is frozen in the background — which is
 * exactly the case this notification exists to serve.
 */
public class TimerDoneReceiver extends BroadcastReceiver {
    static final int NOTIFICATION_ID = 42;

    @Override
    public void onReceive(Context context, Intent intent) {
        NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID);
    }
}
