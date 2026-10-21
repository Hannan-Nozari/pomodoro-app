package com.pomodoro.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

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
        TimerNotification.hide(context);
        TimerNotification.cancelTick(context);
        // The widget and the tile are in the same position: nothing else is
        // awake to tell them the session is over.
        TimerState.clear(context);
        // And the phone has to come off Do Not Disturb even if the app that
        // put it there is long gone.
        FocusMode.release(context);
    }
}
