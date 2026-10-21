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
 * Schedules the end-of-session alert.
 *
 * The alarm style uses AlarmManager.setAlarmClock(), the API meant for alarms a
 * user is waiting on: exempt from Doze deferral, and shown in the system's own
 * next-alarm indicator. The quieter styles use an exact alarm that also fires
 * through Doze but stays out of that indicator.
 *
 * The scheduling itself is static, because a Resume tapped in the notification
 * shade has to re-arm the same alarm with no WebView running to ask.
 */
@CapacitorPlugin(name = "Alarm")
public class AlarmPlugin extends Plugin {

    private static final int REQUEST_CODE = 7;

    private static PendingIntent pendingIntent(Context context, String title, String body,
                                               String sound, String style) {
        Intent intent = new Intent(context, AlarmReceiver.class);
        intent.putExtra(AlarmService.EXTRA_TITLE, title);
        intent.putExtra(AlarmService.EXTRA_BODY, body);
        intent.putExtra(AlarmService.EXTRA_SOUND, sound);
        intent.putExtra(AlarmService.EXTRA_STYLE, style);
        return PendingIntent.getBroadcast(
            context, REQUEST_CODE, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Arm the end-of-session alert, from anywhere in the app. */
    static void scheduleAlarm(Context context, long at, String title, String body,
                              String sound, String style) {
        if (at <= System.currentTimeMillis()) return;

        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;

        // Remembered so the shade's Resume button can re-arm this exact alarm.
        TimerState.saveAlarm(context, title, body, sound, style);

        PendingIntent fire = pendingIntent(context, title, body, sound, style);

        // Only the alarm style registers as an alarm clock. That is what puts
        // the clock icon in the status bar and the time in the shade, which is
        // exactly what someone who chose a quieter ending did not ask for.
        // Both fire on time; the quieter ones just do it without announcing it.
        if (!AlarmService.STYLE_ALARM.equals(style)) {
            try {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, fire);
            } catch (SecurityException e) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, fire);
            }
            return;
        }
        // Tapping the system's alarm indicator should open the app.
        Intent show = new Intent(context, MainActivity.class);
        PendingIntent showPi = PendingIntent.getActivity(
            context, REQUEST_CODE + 1, show,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        try {
            am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, showPi), fire);
        } catch (SecurityException e) {
            // Exact alarms not permitted — still better to fire late than never.
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, fire);
        }
    }

    static void cancelAlarm(Context context) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(pendingIntent(context, null, null, null, null));
        AlarmService.stop(context);
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        long at = call.getLong("at", 0L);
        String title = call.getString("title", "Session complete");
        String body = call.getString("body", "");
        String sound = call.getString("sound", "alarm_chime");
        String style = call.getString("style", AlarmService.STYLE_ALARM);

        scheduleAlarm(getContext(), at, title, body, sound, style);
        call.resolve();
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        cancelAlarm(getContext());
        call.resolve();
    }

    /** Silence a ringing alarm, e.g. when the user opens the app. */
    @PluginMethod
    public void stopRinging(PluginCall call) {
        AlarmService.stop(getContext());
        call.resolve();
    }
}
