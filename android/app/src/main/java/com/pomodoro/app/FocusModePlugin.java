package com.pomodoro.app;

import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Silences the phone for the length of a focus session.
 *
 * A timer only measures focus; the thing that breaks it is the phone itself.
 * Do Not Disturb is left to the OS rather than reimplemented: alarms stay
 * audible under the priority filter, so the end-of-session alarm still rings.
 *
 * Switching DND needs notification-policy access, which only the user can give
 * in system settings, so every call degrades quietly when it is missing.
 */
@CapacitorPlugin(name = "FocusMode")
public class FocusModePlugin extends Plugin {

    private NotificationManager manager() {
        return (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
    }

    @PluginMethod
    public void isGranted(PluginCall call) {
        NotificationManager nm = manager();
        JSObject result = new JSObject();
        result.put("granted", nm != null && nm.isNotificationPolicyAccessGranted());
        call.resolve(result);
    }

    /** Opens the system screen where the user grants Do Not Disturb access. */
    @PluginMethod
    public void requestAccess(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        } catch (Exception e) {
            call.reject("Could not open Do Not Disturb settings");
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void set(PluginCall call) {
        // The switching itself lives in FocusMode, because the session can also
        // end, pause or resume with none of this app's JavaScript running.
        FocusMode.set(getContext(), Boolean.TRUE.equals(call.getBoolean("enable", false)));
        call.resolve();
    }
}
