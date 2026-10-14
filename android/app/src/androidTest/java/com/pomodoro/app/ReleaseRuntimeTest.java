package com.pomodoro.app;

import static org.junit.Assert.*;

import android.app.Notification;
import android.app.NotificationManager;
import android.content.Context;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import android.service.notification.StatusBarNotification;
import androidx.lifecycle.Lifecycle;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.filters.SdkSuppress;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Runs against the signed, shrunk release with -PtestRelease. */
@RunWith(AndroidJUnit4.class)
public class ReleaseRuntimeTest {
    private ActivityScenario<MainActivity> scenario;

    private String js(String expression) throws Exception {
        AtomicReference<String> result = new AtomicReference<>();
        CountDownLatch ready = new CountDownLatch(1);
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            expression, value -> { result.set(value); ready.countDown(); }
        ));
        assertTrue("WebView result timed out", ready.await(10, TimeUnit.SECONDS));
        return result.get();
    }

    private void waitFor(String expression) throws Exception {
        long until = SystemClock.elapsedRealtime() + 15_000;
        do {
            if ("true".equals(js(expression))) return;
            SystemClock.sleep(100);
        } while (SystemClock.elapsedRealtime() < until);
        fail("Condition not reached: " + expression);
    }

    private void nativePromise(String expression) throws Exception {
        js("window.__testDone = false; window.__testError = null; Promise.resolve(" + expression
            + ").then(() => window.__testDone = true).catch(e => { window.__testError = String(e); window.__testDone = true; });");
        waitFor("window.__testDone === true");
        assertEquals("null", js("window.__testError"));
    }

    private void waitForPending(int count) throws Exception {
        long until = SystemClock.elapsedRealtime() + 15_000;
        do {
            nativePromise("window.Capacitor.Plugins.LocalNotifications.getPending().then(r => { window.__pending = r.notifications; })");
            if (String.valueOf(count).equals(js("window.__pending.length"))) return;
            SystemClock.sleep(100);
        } while (SystemClock.elapsedRealtime() < until);
        fail("Expected " + count + " pending notifications");
    }

    @Test
    @SdkSuppress(minSdkVersion = 33)
    public void releaseBridgeSchedulesCancelsAndDeliversBackgroundAlert() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        try (ParcelFileDescriptor ignored = InstrumentationRegistry.getInstrumentation().getUiAutomation()
            .executeShellCommand("pm grant " + context.getPackageName() + " android.permission.POST_NOTIFICATIONS")) {
            SystemClock.sleep(500);
        }
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        manager.cancelAll();
        try (ActivityScenario<MainActivity> opened = ActivityScenario.launch(MainActivity.class)) {
            scenario = opened;
            waitFor("document.querySelector('[aria-label=\"Start timer\"]') !== null");
            assertEquals("true", js("window.Capacitor.isNativePlatform()"));
            nativePromise("window.Capacitor.Plugins.LocalNotifications.cancel({notifications:[{id:1}]})");
            js("localStorage.clear(); localStorage.setItem('pomo_durations', JSON.stringify({work:1,shortBreak:5,longBreak:15})); location.reload()");
            waitFor("document.querySelector('[aria-label=\"Start timer\"]') !== null && document.body.innerText.includes('01:00')");
            js("document.querySelector('[aria-label=\"Start timer\"]').click()");
            waitFor("document.querySelector('[aria-label=\"Pause timer\"]') !== null");
            waitForPending(1);
            assertNotNull("R8 must preserve the alert sound", manager.getNotificationChannel("session-sound").getSound());
            js("document.querySelector('[aria-label=\"Pause timer\"]').click()");
            waitFor("document.querySelector('[aria-label=\"Start timer\"]') !== null");
            // Wait for the cancellation bridge call to settle, then inspect OS storage.
            waitForPending(0);

            js("document.querySelector('[aria-label=\"Reset timer\"]').click(); document.querySelector('[aria-label=\"Start timer\"]').click()");
            waitFor("document.querySelector('[aria-label=\"Pause timer\"]') !== null");
            // Change sound in the actual React UI while the session is running.
            js("Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Advanced')).click()");
            js("Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Sound notification')).click()");
            waitFor("localStorage.getItem('pomo_sound') === 'false'");
            long channelUntil = SystemClock.elapsedRealtime() + 15_000;
            while (manager.getNotificationChannel("session-silent") == null && SystemClock.elapsedRealtime() < channelUntil) {
                SystemClock.sleep(100);
            }
            assertNotNull("Silent notification channel must be created", manager.getNotificationChannel("session-silent"));
            assertEquals(2, manager.getNotificationChannel("session-silent").getImportance());
            String deadline = js("JSON.parse(localStorage.getItem('pomo_session')).deadline");
            // Stop/resume the Activity without removing the OS alert or moving its deadline.
            scenario.moveToState(Lifecycle.State.CREATED);
            SystemClock.sleep(2_000);
            scenario.moveToState(Lifecycle.State.RESUMED);
            assertEquals(deadline, js("JSON.parse(localStorage.getItem('pomo_session')).deadline"));
            scenario.moveToState(Lifecycle.State.CREATED);
            long until = SystemClock.elapsedRealtime() + 70_000;
            StatusBarNotification delivered = null;
            while (SystemClock.elapsedRealtime() < until) {
                for (StatusBarNotification notification : manager.getActiveNotifications()) {
                    if (notification.getId() == 1) delivered = notification;
                }
                if (delivered != null) break;
                SystemClock.sleep(500);
            }
            assertNotNull("OS alert must be delivered while Activity is stopped", delivered);
            assertEquals("session-silent", delivered.getNotification().getChannelId());
            assertEquals("Focus session complete", delivered.getNotification().extras.getString(Notification.EXTRA_TITLE));
            scenario.moveToState(Lifecycle.State.RESUMED);
            waitFor("JSON.parse(localStorage.getItem('pomo_session')).sessionType === 'shortBreak'");
            assertEquals("1", js("JSON.parse(localStorage.getItem('pomo_history')).length"));
            assertEquals(deadline, js("JSON.parse(localStorage.getItem('pomo_history'))[0].id"));
            assertEquals("false", js("!!document.querySelector('[aria-label=\"Pause timer\"]')"));
        }
    }
}
