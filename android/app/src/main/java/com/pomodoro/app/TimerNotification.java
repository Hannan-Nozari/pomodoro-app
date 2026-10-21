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

import java.text.DateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * The ongoing notification: the session, drawn in the shade.
 *
 * It is built here rather than in the plugin because the notification outlives
 * the WebView. Its own Pause and Reset buttons, and the minute tick that moves
 * the progress bar, all redraw it while the app is frozen or gone, so the whole
 * thing reads from TimerState and needs nothing from JavaScript.
 *
 * Two clocks on purpose: the countdown in the header is a system chronometer
 * driven from the deadline, so it ticks every second for free, while the
 * progress bar is redrawn once a minute by an alarm. Nothing here can animate
 * itself — a frozen app cannot update a notification — so the bar moves in
 * minute steps and the seconds come from the part the system animates on our
 * behalf.
 */
final class TimerNotification {

    static final String CHANNEL_ID = "timer_progress";
    static final int NOTIFICATION_ID = TimerDoneReceiver.NOTIFICATION_ID;

    // Distinct from the widget's and the tile's, which open the same activity:
    // a PendingIntent is identified by requestCode and intent, not by extras,
    // so sharing a code would have them overwrite each other.
    private static final int REQ_CONTENT = 20;
    private static final int REQ_SELF_CLEAR = 1;
    private static final int REQ_TICK = 2;

    private TimerNotification() {}

    static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
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

    private static String mmss(int seconds) {
        int s = Math.max(0, seconds);
        return String.format(Locale.US, "%02d:%02d", s / 60, s % 60);
    }

    /** Draw (or redraw) the notification from whatever TimerState currently holds. */
    static void show(Context context) {
        boolean running = TimerState.isRunning(context);
        boolean paused = TimerState.isPaused(context);
        if (!running && !paused) {
            hide(context);
            return;
        }

        ensureChannel(context);

        String label = TimerState.label(context);
        String task = TimerState.task(context);
        String session = TimerState.session(context);
        int total = TimerState.total(context);
        int remaining = TimerState.remaining(context);

        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
            context, REQ_CONTENT, open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_pomodoro)
            .setColor(0xFFE05252)
            // The collapsed card shows the title and the progress bar, and
            // drops the text line, so a held session has to say so up here.
            .setContentTitle(running || label.isEmpty()
                ? (label.isEmpty() ? "Focus" : label)
                : label + " · paused")
            .setContentIntent(contentIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setOngoing(running);

        // The task sits in the header line, next to the app name, so the title
        // stays the session and the text stays the progress.
        if (!task.isEmpty()) builder.setSubText(task);

        if (total > 0) {
            builder.setProgress(total, Math.max(0, total - remaining), false);
        }

        if (running) {
            // System-drawn, ticking every second from the deadline.
            builder.setWhen(TimerState.deadline(context))
                   .setShowWhen(true)
                   .setUsesChronometer(true)
                   .setChronometerCountDown(true)
                   .setContentText(runningText(session, TimerState.deadline(context)));

            builder.addAction(0, "Pause",
                actionIntent(context, TimerActionReceiver.ACTION_PAUSE, 10));
            builder.addAction(0, "Reset",
                actionIntent(context, TimerActionReceiver.ACTION_RESET, 11));
        } else {
            // A chronometer would keep counting, so a paused session shows the
            // frozen time as plain text instead.
            StringBuilder text = new StringBuilder("Paused · ").append(mmss(remaining)).append(" left");
            if (!session.isEmpty()) text.append(" · ").append(session);
            builder.setShowWhen(false).setContentText(text.toString());

            builder.addAction(0, "Resume",
                actionIntent(context, TimerActionReceiver.ACTION_RESUME, 12));
            builder.addAction(0, "Reset",
                actionIntent(context, TimerActionReceiver.ACTION_RESET, 13));
        }

        try {
            NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build());
        } catch (SecurityException e) {
            // Notifications not granted — the timer itself is unaffected.
        }
    }

    /**
     * Deliberately no "N min left": the countdown is right there in the header,
     * ticking every second, and a minutes figure redrawn once a minute would
     * spend most of its life contradicting it.
     */
    private static String runningText(String session, long deadline) {
        StringBuilder text = new StringBuilder();
        if (!session.isEmpty()) text.append(session).append(" · ");
        text.append("ends ").append(
            DateFormat.getTimeInstance(DateFormat.SHORT).format(new Date(deadline)));
        return text.toString();
    }

    private static PendingIntent actionIntent(Context context, String action, int requestCode) {
        Intent intent = new Intent(context, TimerActionReceiver.class).setAction(action);
        return PendingIntent.getBroadcast(
            context, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void hide(Context context) {
        NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID);
    }

    // ── Timekeeping for a notification nobody is awake to update ─────────────

    private static AlarmManager alarms(Context context) {
        return (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    }

    private static PendingIntent selfClearIntent(Context context) {
        Intent done = new Intent(context, TimerDoneReceiver.class);
        return PendingIntent.getBroadcast(
            context, REQ_SELF_CLEAR, done,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent tickIntent(Context context) {
        Intent tick = new Intent(context, TimerActionReceiver.class)
            .setAction(TimerActionReceiver.ACTION_TICK);
        return PendingIntent.getBroadcast(
            context, REQ_TICK, tick,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Have the OS clear this at the deadline, since we will be frozen by then. */
    static void scheduleSelfClear(Context context, long deadline) {
        AlarmManager am = alarms(context);
        if (am == null) return;
        try {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, deadline, selfClearIntent(context));
        } catch (SecurityException e) {
            am.set(AlarmManager.RTC_WAKEUP, deadline, selfClearIntent(context));
        }
    }

    static void cancelSelfClear(Context context) {
        AlarmManager am = alarms(context);
        if (am != null) am.cancel(selfClearIntent(context));
    }

    /**
     * Redraw once a minute to move the progress bar along.
     *
     * RTC, not RTC_WAKEUP: this only matters when someone is looking at the
     * shade, so it fires while the device is awake and never wakes it to update
     * a bar nobody can see.
     *
     * The tick lands on the minute of the countdown, not a minute from now, so
     * "N min left" changes at the moment N changes rather than drifting up to a
     * minute away from the clock beside it.
     */
    static void scheduleTick(Context context) {
        AlarmManager am = alarms(context);
        if (am == null) return;
        long now = System.currentTimeMillis();
        long deadline = TimerState.deadline(context);
        long remaining = deadline - now;
        if (remaining <= 0) return;
        long minutes = (remaining + 59_999L) / 60_000L;
        long next = Math.max(now + 1_000L, deadline - (minutes - 1) * 60_000L);
        am.set(AlarmManager.RTC, next, tickIntent(context));
    }

    static void cancelTick(Context context) {
        AlarmManager am = alarms(context);
        if (am != null) am.cancel(tickIntent(context));
    }
}
