package com.pomodoro.app;

import android.app.NotificationManager;
import android.content.Context;

/**
 * Do Not Disturb, applied from wherever the session actually changes.
 *
 * The setting is the web layer's — it decides whether a focus session should
 * silence the phone — but the end of a session is not: the alarm fires, and the
 * notification's own buttons work, with nothing of the app running. Lifting the
 * filter had to move here too, or a session that ended while the app was
 * asleep would leave the phone silenced until it was next opened.
 *
 * Only ever undoes its own silencing: the flag says whether this app turned the
 * filter on, so a Do Not Disturb the user set for themselves is left alone.
 */
final class FocusMode {

    private FocusMode() {}

    /**
     * Asked for by the web layer, which keeps its own record of what it
     * silenced, so it is taken at its word.
     */
    static void set(Context context, boolean silence) {
        switchFilter(context, silence);
    }

    /**
     * Asked for by the native side at a moment the web layer may not be alive
     * for — the end of a session, a button in the shade. Here the flag decides:
     * never silence twice, and never lift a Do Not Disturb that is not ours.
     */
    static void apply(Context context, boolean silence) {
        if (silence == TimerState.isDndOwned(context)) return;
        switchFilter(context, silence);
    }

    private static void switchFilter(Context context, boolean silence) {
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null || !nm.isNotificationPolicyAccessGranted()) return;

        try {
            // PRIORITY rather than NONE, so alarms — including this app's own —
            // still come through.
            nm.setInterruptionFilter(silence
                ? NotificationManager.INTERRUPTION_FILTER_PRIORITY
                : NotificationManager.INTERRUPTION_FILTER_ALL);
            TimerState.setDndOwned(context, silence);
        } catch (Exception e) {
            // Some OEMs refuse; the session is unaffected either way.
        }
    }

    /** Lift the filter if, and only if, this app is what turned it on. */
    static void release(Context context) {
        apply(context, false);
    }
}
