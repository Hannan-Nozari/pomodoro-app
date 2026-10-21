package com.pomodoro.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * The ongoing notification's own buttons, and the minute tick behind its
 * progress bar.
 *
 * Pause and Resume have to take effect immediately — the shade is exactly where
 * the app is not running — so the alarm is cancelled and re-armed here rather
 * than waiting for the WebView to wake up and do it. The web layer still owns
 * the timer: what happened is left in TimerState as a pending action, and it
 * reconciles the moment it is next in the foreground.
 */
public class TimerActionReceiver extends BroadcastReceiver {

    static final String ACTION_PAUSE = "com.pomodoro.app.PAUSE";
    static final String ACTION_RESUME = "com.pomodoro.app.RESUME";
    static final String ACTION_RESET = "com.pomodoro.app.RESET";
    static final String ACTION_TICK = "com.pomodoro.app.TICK";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent == null ? null : intent.getAction();
        if (action == null) return;

        switch (action) {
            case ACTION_PAUSE:   pause(context);  break;
            case ACTION_RESUME:  resume(context); break;
            case ACTION_RESET:   reset(context);  break;
            case ACTION_TICK:    tick(context);   break;
            default: break;
        }
    }

    private void pause(Context context) {
        if (!TimerState.isRunning(context)) return;
        int remaining = TimerState.remaining(context);

        AlarmPlugin.cancelAlarm(context);
        TimerNotification.cancelSelfClear(context);
        TimerNotification.cancelTick(context);

        TimerState.savePaused(context, remaining, TimerState.label(context),
            TimerState.task(context), TimerState.session(context), TimerState.total(context));
        TimerState.setPendingAction(context, TimerState.ACTION_PAUSE, remaining);
        FocusMode.release(context);
        TimerNotification.show(context);
        OngoingTimerPlugin.notifyAction(TimerState.ACTION_PAUSE);
    }

    private void resume(Context context) {
        if (!TimerState.isPaused(context)) return;
        int remaining = TimerState.remaining(context);
        if (remaining <= 0) return;
        long deadline = System.currentTimeMillis() + remaining * 1000L;

        AlarmPlugin.scheduleAlarm(context, deadline, TimerState.alarmTitle(context),
            TimerState.alarmBody(context), TimerState.alarmSound(context),
                TimerState.alarmStyle(context));

        TimerState.saveRunning(context, deadline, TimerState.label(context),
            TimerState.task(context), TimerState.session(context), TimerState.total(context));
        TimerState.setPendingAction(context, TimerState.ACTION_RESUME, remaining);

        // Back into focus, so back into Do Not Disturb if that is the setting.
        FocusMode.apply(context, TimerState.silence(context));
        TimerNotification.scheduleSelfClear(context, deadline);
        TimerNotification.scheduleTick(context);
        TimerNotification.show(context);
        OngoingTimerPlugin.notifyAction(TimerState.ACTION_RESUME);
    }

    private void reset(Context context) {
        AlarmPlugin.cancelAlarm(context);
        TimerNotification.cancelSelfClear(context);
        TimerNotification.cancelTick(context);
        TimerNotification.hide(context);
        TimerState.clear(context);
        FocusMode.release(context);
        TimerState.setPendingAction(context, TimerState.ACTION_RESET);
        OngoingTimerPlugin.notifyAction(TimerState.ACTION_RESET);
    }

    /** Move the progress bar on, then line up the next minute. */
    private void tick(Context context) {
        if (!TimerState.isRunning(context)) return;
        TimerNotification.show(context);
        TimerNotification.scheduleTick(context);
    }
}
