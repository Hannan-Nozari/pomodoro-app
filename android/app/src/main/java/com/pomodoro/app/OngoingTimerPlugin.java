package com.pomodoro.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * A persistent notification that counts the running session down live.
 *
 * The countdown is drawn by the system's own chronometer, given the wall-clock
 * time the session ends. That matters: the WebView is frozen while the app is
 * backgrounded, so anything JavaScript had to tick would simply stop — which is
 * precisely when the user is looking at the shade instead of the app.
 */
@CapacitorPlugin(name = "OngoingTimer")
public class OngoingTimerPlugin extends Plugin {

    private static final String CHANNEL_ID = "timer_progress";
    private static final int NOTIFICATION_ID = TimerDoneReceiver.NOTIFICATION_ID;

    private PendingIntent donePendingIntent() {
        Intent done = new Intent(getContext(), TimerDoneReceiver.class);
        return PendingIntent.getBroadcast(
            getContext(), 1, done,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Have the OS clear this notification at the deadline, since we will be frozen. */
    private void scheduleSelfClear(long deadline) {
        AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        try {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, deadline, donePendingIntent());
        } catch (SecurityException e) {
            am.set(AlarmManager.RTC_WAKEUP, deadline, donePendingIntent());
        }
    }

    private void cancelSelfClear() {
        AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(donePendingIntent());
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getContext().getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;

        // IMPORTANCE_LOW: this is a status line, not an alert. The alert at the
        // end of the session is a separate, noisy notification.
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID, "Running timer", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Shows the countdown while a session is running");
        channel.setShowBadge(false);
        channel.setSound(null, null);
        channel.enableVibration(false);
        manager.createNotificationChannel(channel);
    }

    @PluginMethod
    public void show(PluginCall call) {
        String label = call.getString("label", "Focus");
        String detail = call.getString("detail", "");
        long deadline = call.getLong("deadline", 0L);
        boolean running = Boolean.TRUE.equals(call.getBoolean("running", true));

        ensureChannel();

        Intent intent = new Intent(getContext(), MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
            getContext(), 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(getContext(), CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_pomodoro)
            .setColor(0xFFE05252)
            .setContentTitle(label)
            .setContentIntent(contentIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setOngoing(running);

        if (running && deadline > 0) {
            // The system redraws this every second on its own.
            builder.setWhen(deadline)
                   .setShowWhen(true)
                   .setUsesChronometer(true);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                builder.setChronometerCountDown(true);
            }
            if (!detail.isEmpty()) builder.setContentText(detail);
        } else {
            // Paused: a live chronometer would keep counting, so show the frozen
            // remaining time as plain text instead.
            builder.setShowWhen(false).setContentText(detail);
        }

        if (running && deadline > 0) scheduleSelfClear(deadline);
        else cancelSelfClear();

        try {
            NotificationManagerCompat.from(getContext()).notify(NOTIFICATION_ID, builder.build());
        } catch (SecurityException e) {
            // Notifications not granted — the in-app timer is unaffected.
        }
        call.resolve();
    }

    @PluginMethod
    public void hide(PluginCall call) {
        cancelSelfClear();
        NotificationManagerCompat.from(getContext()).cancel(NOTIFICATION_ID);
        call.resolve();
    }
}
