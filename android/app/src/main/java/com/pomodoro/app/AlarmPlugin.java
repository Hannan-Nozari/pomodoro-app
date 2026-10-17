package com.pomodoro.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Schedules the end-of-session alarm with AlarmManager.setAlarmClock().
 *
 * setAlarmClock is the API meant for alarms a user is waiting on: it is exempt
 * from Doze deferral, so the alarm lands on time on a sleeping phone, and the
 * system shows its own next-alarm indicator.
 */
@CapacitorPlugin(name = "Alarm")
public class AlarmPlugin extends Plugin {

    private static final int REQUEST_CODE = 7;

    private PendingIntent pendingIntent(String title, String body, String sound) {
        Intent intent = new Intent(getContext(), AlarmReceiver.class);
        intent.putExtra(AlarmService.EXTRA_TITLE, title);
        intent.putExtra(AlarmService.EXTRA_BODY, body);
        intent.putExtra(AlarmService.EXTRA_SOUND, sound);
        return PendingIntent.getBroadcast(
            getContext(), REQUEST_CODE, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        long at = call.getLong("at", 0L);
        String title = call.getString("title", "Session complete");
        String body = call.getString("body", "");
        String sound = call.getString("sound", "alarm_chime");

        if (at <= System.currentTimeMillis()) {
            call.resolve();
            return;
        }

        AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
        if (am == null) {
            call.reject("AlarmManager unavailable");
            return;
        }

        PendingIntent fire = pendingIntent(title, body, sound);
        // Tapping the system's alarm indicator should open the app.
        Intent show = new Intent(getContext(), MainActivity.class);
        PendingIntent showPi = PendingIntent.getActivity(
            getContext(), REQUEST_CODE + 1, show,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        try {
            am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, showPi), fire);
        } catch (SecurityException e) {
            // Exact alarms not permitted — still better to fire late than never.
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, fire);
        }
        call.resolve();
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(pendingIntent(null, null, null));
        AlarmService.stop(getContext());
        call.resolve();
    }

    /** Silence a ringing alarm, e.g. when the user opens the app. */
    @PluginMethod
    public void stopRinging(PluginCall call) {
        AlarmService.stop(getContext());
        call.resolve();
    }
}
