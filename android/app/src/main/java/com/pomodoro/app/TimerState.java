package com.pomodoro.app;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * The running session, mirrored out of the WebView.
 *
 * The timer itself lives in the web layer, but the widget, the Quick Settings
 * tile and the ongoing notification's own buttons are handled by the system
 * while the app is asleep and cannot read its localStorage. So the few fields
 * they need are mirrored here, and the web layer stays the single place the
 * timer is actually decided — it reconciles with this store when it wakes up.
 */
final class TimerState {

    private static final String PREFS = "pomodoro_timer_state";
    private static final String KEY_DEADLINE = "deadline";
    private static final String KEY_LABEL = "label";
    private static final String KEY_RUNNING = "running";
    private static final String KEY_TASK = "task";
    private static final String KEY_SESSION = "session";
    private static final String KEY_TOTAL = "total";
    private static final String KEY_REMAINING = "remaining";
    private static final String KEY_SILENCE = "silence";
    private static final String KEY_DND_OWNED = "dnd_owned";
    private static final String KEY_PENDING_ACTION = "pending_action";
    private static final String KEY_PENDING_VALUE = "pending_value";
    private static final String KEY_ALARM_TITLE = "alarm_title";
    private static final String KEY_ALARM_BODY = "alarm_body";
    private static final String KEY_ALARM_SOUND = "alarm_sound";
    private static final String KEY_ALARM_STYLE = "alarm_style";

    static final String ACTION_START = "start";
    static final String ACTION_PAUSE = "pause";
    static final String ACTION_RESUME = "resume";
    static final String ACTION_RESET = "reset";

    private TimerState() {}

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    // commit(), not apply(), everywhere below. apply() writes in the
    // background, and everything that reads this store reads it after this
    // app has stopped running — the widget, the shade's buttons, the alarm,
    // the boot receiver. A session started seconds before the phone restarts
    // would otherwise be gone when the receiver looked for it.

    private static String orEmpty(String s) {
        return s == null ? "" : s;
    }

    /** A session that is counting down towards `deadline`. */
    static void saveRunning(Context context, long deadline, String label, String task,
                            String session, int totalSeconds) {
        prefs(context).edit()
            .putBoolean(KEY_RUNNING, true)
            .putLong(KEY_DEADLINE, deadline)
            .putString(KEY_LABEL, orEmpty(label))
            .putString(KEY_TASK, orEmpty(task))
            .putString(KEY_SESSION, orEmpty(session))
            .putInt(KEY_TOTAL, totalSeconds)
            .putInt(KEY_REMAINING, (int) Math.max(0, (deadline - System.currentTimeMillis()) / 1000))
            .commit();
        notifySurfaces(context);
    }

    /** A session held at `remainingSeconds`, with no deadline to count towards. */
    static void savePaused(Context context, int remainingSeconds, String label, String task,
                           String session, int totalSeconds) {
        prefs(context).edit()
            .putBoolean(KEY_RUNNING, false)
            .putLong(KEY_DEADLINE, 0L)
            .putString(KEY_LABEL, orEmpty(label))
            .putString(KEY_TASK, orEmpty(task))
            .putString(KEY_SESSION, orEmpty(session))
            .putInt(KEY_TOTAL, totalSeconds)
            .putInt(KEY_REMAINING, Math.max(0, remainingSeconds))
            .commit();
        notifySurfaces(context);
    }

    /** No session in flight. */
    static void clear(Context context) {
        prefs(context).edit()
            .putBoolean(KEY_RUNNING, false)
            .putLong(KEY_DEADLINE, 0L)
            .putInt(KEY_REMAINING, 0)
            .commit();
        notifySurfaces(context);
    }

    private static void notifySurfaces(Context context) {
        TimerWidget.refresh(context);
        TimerTileService.refresh(context);
    }

    static boolean isRunning(Context context) {
        SharedPreferences p = prefs(context);
        // A deadline in the past means the session ended while nothing was
        // watching; treat it as stopped rather than showing negative time.
        return p.getBoolean(KEY_RUNNING, false) && p.getLong(KEY_DEADLINE, 0L) > System.currentTimeMillis();
    }

    /** True when a session exists but is held — the only state Resume applies to. */
    static boolean isPaused(Context context) {
        SharedPreferences p = prefs(context);
        return !p.getBoolean(KEY_RUNNING, false) && p.getInt(KEY_REMAINING, 0) > 0;
    }

    static long deadline(Context context) {
        return prefs(context).getLong(KEY_DEADLINE, 0L);
    }

    static String label(Context context) {
        return prefs(context).getString(KEY_LABEL, "");
    }

    static String task(Context context) {
        return prefs(context).getString(KEY_TASK, "");
    }

    static String session(Context context) {
        return prefs(context).getString(KEY_SESSION, "");
    }

    static int total(Context context) {
        return prefs(context).getInt(KEY_TOTAL, 0);
    }

    /** Seconds left: from the deadline while running, from the store while paused. */
    static int remaining(Context context) {
        if (isRunning(context)) {
            return (int) Math.max(0, (deadline(context) - System.currentTimeMillis()) / 1000);
        }
        return Math.max(0, prefs(context).getInt(KEY_REMAINING, 0));
    }

    /**
     * The end-of-session alarm's payload, kept so a Resume tapped in the shade
     * can re-arm exactly the alarm the web layer had scheduled.
     */
    static void saveAlarm(Context context, String title, String body, String sound, String style) {
        prefs(context).edit()
            .putString(KEY_ALARM_TITLE, orEmpty(title))
            .putString(KEY_ALARM_BODY, orEmpty(body))
            .putString(KEY_ALARM_SOUND, orEmpty(sound))
            .putString(KEY_ALARM_STYLE, style == null ? AlarmService.STYLE_ALARM : style)
            .commit();
    }

    static String alarmStyle(Context context) {
        return prefs(context).getString(KEY_ALARM_STYLE, AlarmService.STYLE_ALARM);
    }

    static String alarmTitle(Context context) {
        return prefs(context).getString(KEY_ALARM_TITLE, "Session complete");
    }

    static String alarmBody(Context context) {
        return prefs(context).getString(KEY_ALARM_BODY, "");
    }

    static String alarmSound(Context context) {
        return prefs(context).getString(KEY_ALARM_SOUND, "alarm_chime");
    }

    /**
     * Whether this session should silence the phone — the web layer's setting,
     * mirrored so that a Resume tapped in the shade can honour it.
     */
    static void setSilence(Context context, boolean silence) {
        prefs(context).edit().putBoolean(KEY_SILENCE, silence).commit();
    }

    static boolean silence(Context context) {
        return prefs(context).getBoolean(KEY_SILENCE, false);
    }

    /** Whether the Do Not Disturb currently in force is ours to lift. */
    static void setDndOwned(Context context, boolean owned) {
        prefs(context).edit().putBoolean(KEY_DND_OWNED, owned).commit();
    }

    static boolean isDndOwned(Context context) {
        return prefs(context).getBoolean(KEY_DND_OWNED, false);
    }

    /** Queued by the widget, the tile or a notification button, for the web layer. */
    static void setPendingAction(Context context, String action, int value) {
        prefs(context).edit()
            .putString(KEY_PENDING_ACTION, action)
            .putInt(KEY_PENDING_VALUE, value)
            .commit();
    }

    static void setPendingAction(Context context, String action) {
        setPendingAction(context, action, 0);
    }

    static String pendingAction(Context context) {
        return prefs(context).getString(KEY_PENDING_ACTION, null);
    }

    static int pendingValue(Context context) {
        return prefs(context).getInt(KEY_PENDING_VALUE, 0);
    }

    static void clearPendingAction(Context context) {
        prefs(context).edit().remove(KEY_PENDING_ACTION).remove(KEY_PENDING_VALUE).commit();
    }
}
