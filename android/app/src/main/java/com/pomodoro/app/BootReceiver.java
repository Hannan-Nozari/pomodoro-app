package com.pomodoro.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Puts a session back together after a reboot or an app update.
 *
 * AlarmManager forgets everything on a restart, and so does the shade, so a
 * session that was still counting down would quietly lose its alarm and its
 * notification — the user would simply never be told their time was up. The
 * session itself survives in TimerState, so everything around it is rebuilt
 * from there.
 */
public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (TimerState.isRunning(context)) {
            long deadline = TimerState.deadline(context);
            AlarmPlugin.scheduleAlarm(context, deadline, TimerState.alarmTitle(context),
                TimerState.alarmBody(context), TimerState.alarmSound(context),
                TimerState.alarmStyle(context));
            TimerNotification.scheduleSelfClear(context, deadline);
            TimerNotification.scheduleTick(context);
        }
        // Covers the paused case too: it has no alarms to re-arm, but its
        // notification went with the restart like everything else.
        TimerNotification.show(context);
        TimerWidget.refresh(context);
        TimerTileService.refresh(context);
    }
}
