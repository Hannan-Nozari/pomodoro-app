package com.pomodoro.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The web layer's handle on the ongoing notification.
 *
 * It only writes the session into TimerState and asks for a redraw: the
 * notification is built in TimerNotification, which also runs when nothing of
 * this app is alive — its buttons and its minute tick both arrive as broadcasts
 * long after the WebView has been frozen.
 */
@CapacitorPlugin(name = "OngoingTimer")
public class OngoingTimerPlugin extends Plugin {

    // Held so a notification button can reach the web layer while the app is
    // alive. Pulling down the shade does not stop the activity, so the page
    // never sees a visibility change and would otherwise keep counting a
    // session that has just been paused out from under it.
    private static OngoingTimerPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) instance = null;
        super.handleOnDestroy();
    }

    /** Tell the web layer to come and collect what just happened. */
    static void notifyAction(String action) {
        OngoingTimerPlugin plugin = instance;
        if (plugin == null) return;
        try {
            JSObject data = new JSObject();
            data.put("action", action);
            plugin.notifyListeners("timerAction", data);
        } catch (Exception e) {
            // No live bridge — the pending action in TimerState covers it.
        }
    }

    @PluginMethod
    public void show(PluginCall call) {
        String label = call.getString("label", "Focus");
        String task = call.getString("task", "");
        String session = call.getString("session", "");
        long deadline = call.getLong("deadline", 0L);
        int total = call.getInt("total", 0);
        int remaining = call.getInt("remaining", 0);
        boolean running = Boolean.TRUE.equals(call.getBoolean("running", true));
        TimerState.setSilence(getContext(), Boolean.TRUE.equals(call.getBoolean("silence", false)));

        if (running && deadline > 0) {
            TimerState.saveRunning(getContext(), deadline, label, task, session, total);
            TimerNotification.scheduleSelfClear(getContext(), deadline);
            TimerNotification.scheduleTick(getContext());
        } else {
            TimerState.savePaused(getContext(), remaining, label, task, session, total);
            TimerNotification.cancelSelfClear(getContext());
            TimerNotification.cancelTick(getContext());
        }

        TimerNotification.show(getContext());
        call.resolve();
    }

    @PluginMethod
    public void hide(PluginCall call) {
        TimerNotification.cancelSelfClear(getContext());
        TimerNotification.cancelTick(getContext());
        TimerNotification.hide(getContext());
        TimerState.clear(getContext());
        call.resolve();
    }

    /**
     * Hands over whatever the widget, the tile or a notification button did
     * while the web layer was asleep, along with the session as this side sees
     * it now.
     *
     * The state matters as much as the action: a pending action is consumed
     * once, so an app that is killed and relaunched twice would otherwise have
     * nothing left to tell it that the session it remembers was paused, or that
     * one it thinks is paused has been resumed and is counting down.
     */
    @PluginMethod
    public void takeAction(PluginCall call) {
        JSObject result = new JSObject();
        String action = TimerState.pendingAction(getContext());
        result.put("action", action);
        result.put("value", TimerState.pendingValue(getContext()));
        result.put("deadline", TimerState.deadline(getContext()));
        result.put("running", TimerState.isRunning(getContext()));
        result.put("paused", TimerState.isPaused(getContext()));
        result.put("remaining", TimerState.remaining(getContext()));
        if (action != null) TimerState.clearPendingAction(getContext());
        call.resolve(result);
    }
}
