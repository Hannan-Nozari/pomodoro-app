package com.pomodoro.app;

import android.app.ForegroundServiceStartNotAllowedException;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;

import androidx.core.app.NotificationCompat;

/**
 * Rings the end-of-session alarm.
 *
 * A notification alone is not an alarm: it plays on the notification stream at
 * notification volume, once, and never wakes the screen — which is why a
 * finished session could pass unnoticed. This plays the sound through
 * USAGE_ALARM instead, so it uses the alarm volume and is heard when the ringer
 * is down, loops until dismissed, vibrates, and carries a full-screen intent so
 * the display turns on and shows AlarmActivity.
 */
public class AlarmService extends Service {

    static final String CHANNEL_ID = "alarm_alert";
    static final int NOTIFICATION_ID = 43;

    static final String EXTRA_TITLE = "title";
    static final String EXTRA_BODY = "body";
    static final String EXTRA_SOUND = "sound";
    static final String ACTION_STOP = "com.pomodoro.app.STOP_ALARM";

    /** How many times the alarm sound plays before it falls silent. */
    private static final int PLAY_COUNT = 2;

    /** Backstop in case a sound never reports completion. */
    private static final long MAX_RING_MS = 30_000L;

    private MediaPlayer player;
    private int playsDone = 0;
    private Vibrator vibrator;
    private PowerManager.WakeLock wakeLock;
    private final android.os.Handler handler = new android.os.Handler();

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String title = intent != null ? intent.getStringExtra(EXTRA_TITLE) : null;
        String body = intent != null ? intent.getStringExtra(EXTRA_BODY) : null;
        String sound = intent != null ? intent.getStringExtra(EXTRA_SOUND) : null;
        if (title == null) title = "Session complete";
        if (body == null) body = "";

        ensureChannel();
        try {
            startForeground(NOTIFICATION_ID, buildNotification(title, body));
        } catch (Exception e) {
            // Android 12+ can refuse a foreground start from the background; the
            // notification still carries the full-screen intent, so fall back to
            // posting it directly rather than dying.
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.notify(NOTIFICATION_ID, buildNotification(title, body));
        }

        acquireWakeLock();
        startRinging(sound);
        handler.postDelayed(this::stopSelf, MAX_RING_MS);
        return START_NOT_STICKY;
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID, "Session alarm", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Rings when a focus session or break ends");
        // Silent channel on purpose: the service plays the audio itself, through
        // the alarm stream, so it can loop and be heard over a lowered ringer.
        channel.setSound(null, null);
        channel.enableVibration(false);
        channel.setBypassDnd(true);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        manager.createNotificationChannel(channel);
    }

    private Notification buildNotification(String title, String body) {
        Intent full = new Intent(this, AlarmActivity.class);
        full.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        full.putExtra(EXTRA_TITLE, title);
        full.putExtra(EXTRA_BODY, body);
        PendingIntent fullPi = PendingIntent.getActivity(
            this, 0, full, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent stop = new Intent(this, AlarmService.class).setAction(ACTION_STOP);
        PendingIntent stopPi = PendingIntent.getService(
            this, 1, stop, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_pomodoro)
            .setColor(0xFFE05252)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            // Turns the screen on and shows AlarmActivity over the lock screen.
            .setFullScreenIntent(fullPi, true)
            .setContentIntent(fullPi)
            .addAction(0, "Stop", stopPi)
            .build();
    }

    private void acquireWakeLock() {
        PowerManager pm = getSystemService(PowerManager.class);
        if (pm == null) return;
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "pomodoro:alarm");
        wakeLock.setReferenceCounted(false);
        wakeLock.acquire(MAX_RING_MS + 5_000L);
    }

    private void startRinging(String sound) {
        try {
            int resId = 0;
            if (sound != null && !sound.isEmpty()) {
                resId = getResources().getIdentifier(sound, "raw", getPackageName());
            }
            if (resId == 0) resId = R.raw.alarm_chime;

            Uri uri = Uri.parse("android.resource://" + getPackageName() + "/" + resId);
            player = new MediaPlayer();
            player.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build());
            player.setDataSource(this, uri);
            // Deliberately not looping: it rings PLAY_COUNT times and stops, so
            // a missed session does not leave the phone wailing indefinitely.
            player.setLooping(false);
            player.setOnCompletionListener(mp -> {
                if (++playsDone < PLAY_COUNT) {
                    mp.seekTo(0);
                    mp.start();
                } else {
                    // Sound is done; the alarm screen stays up to be dismissed.
                    silence();
                }
            });
            player.prepare();
            player.start();
        } catch (Exception e) {
            // Audio unavailable — the vibration and full-screen alert still fire.
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vm = getSystemService(VibratorManager.class);
                vibrator = vm != null ? vm.getDefaultVibrator() : null;
            } else {
                vibrator = getSystemService(Vibrator.class);
            }
            if (vibrator != null && vibrator.hasVibrator()) {
                // One buzz per play, matched to PLAY_COUNT; no endless repeat.
                long[] pattern = { 0, 600, 500, 600 };
                vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1),
                    new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build());
            }
        } catch (Exception e) {
            // No vibrator — not fatal.
        }
    }

    /** Stop the noise but leave the alarm screen and notification in place. */
    private void silence() {
        if (player != null) {
            try { player.stop(); } catch (Exception ignored) {}
            player.release();
            player = null;
        }
        if (vibrator != null) {
            try { vibrator.cancel(); } catch (Exception ignored) {}
            vibrator = null;
        }
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (player != null) {
            try { player.stop(); } catch (Exception ignored) {}
            player.release();
            player = null;
        }
        if (vibrator != null) {
            try { vibrator.cancel(); } catch (Exception ignored) {}
            vibrator = null;
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
            wakeLock = null;
        }
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) nm.cancel(NOTIFICATION_ID);
        super.onDestroy();
    }

    /** Stop a ringing alarm from anywhere in the app. */
    static void stop(Context context) {
        context.stopService(new Intent(context, AlarmService.class));
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm != null) nm.cancel(NOTIFICATION_ID);
    }
}
