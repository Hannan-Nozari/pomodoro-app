package com.pomodoro.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioDeviceInfo;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;

import androidx.core.app.NotificationCompat;

/**
 * Tells the user a session is over, in the way they chose.
 *
 * Three styles, set in the app:
 *
 *  - alarm: rings like an alarm clock. Alarm volume, heard even on silent,
 *    wakes the screen with a full-screen alert. Plays twice.
 *  - notification: behaves like a message. Notification volume, follows the
 *    ringer — silent means silent — and never takes over the screen.
 *  - vibrate: no sound at all, just a buzz and the notification.
 *
 * Headphones change where the sound goes, not whether it plays. The alarm
 * stream is routed to the phone's own speaker on many phones even with
 * Bluetooth headphones connected — Samsung's among them — so someone wearing
 * earbuds heard nothing while their phone chimed on the desk. With headphones
 * connected the sound is played on the media route instead, which is the one
 * the headphones are actually on, and audio focus is taken so whatever is
 * playing in them pauses for it.
 */
public class AlarmService extends Service {

    static final String CHANNEL_ID = "alarm_alert";
    static final String QUIET_CHANNEL_ID = "session_done";
    static final int NOTIFICATION_ID = 43;

    static final String EXTRA_TITLE = "title";
    static final String EXTRA_BODY = "body";
    static final String EXTRA_SOUND = "sound";
    static final String EXTRA_STYLE = "style";
    static final String ACTION_STOP = "com.pomodoro.app.STOP_ALARM";

    static final String STYLE_ALARM = "alarm";
    static final String STYLE_NOTIFICATION = "notification";
    static final String STYLE_VIBRATE = "vibrate";

    /** How many times the alarm sound plays before it falls silent. */
    private static final int ALARM_PLAY_COUNT = 2;

    /** Backstop in case a sound never reports completion. */
    private static final long MAX_RING_MS = 30_000L;

    private MediaPlayer player;
    private int playsLeft = 0;
    private Vibrator vibrator;
    private PowerManager.WakeLock wakeLock;
    private AudioManager audioManager;
    private AudioFocusRequest focusRequest;
    private boolean keepNotification = false;
    private final Handler handler = new Handler(Looper.getMainLooper());

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
        String style = intent != null ? intent.getStringExtra(EXTRA_STYLE) : null;
        if (title == null) title = "Session complete";
        if (body == null) body = "";
        if (style == null) style = STYLE_ALARM;

        // The session is over, so the phone comes off Do Not Disturb before
        // anything plays — otherwise a notification-style sound would be muted
        // by the very filter this app put on for the session.
        FocusMode.release(this);

        boolean alarm = STYLE_ALARM.equals(style);
        // Only the alarm takes the screen and clears itself when it stops; the
        // quieter styles leave their notification behind like any message.
        keepNotification = !alarm;

        ensureChannels();
        Notification notification = alarm
            ? buildAlarmNotification(title, body)
            : buildQuietNotification(title, body);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(NOTIFICATION_ID, notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            // Android 12+ can refuse a foreground start from the background;
            // posting the notification directly still shows the alert.
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.notify(NOTIFICATION_ID, notification);
        }

        acquireWakeLock();
        audioManager = getSystemService(AudioManager.class);

        if (alarm) {
            playSound(sound, true, ALARM_PLAY_COUNT);
            vibrate(new long[] { 0, 600, 500, 600 });
        } else if (STYLE_NOTIFICATION.equals(style)) {
            int ringer = audioManager != null ? audioManager.getRingerMode() : AudioManager.RINGER_MODE_NORMAL;
            // Follows the ringer like any notification: sound only when the
            // phone is allowed to make sound, a buzz when it is on vibrate.
            if (ringer == AudioManager.RINGER_MODE_NORMAL) playSound(sound, false, 1);
            if (ringer != AudioManager.RINGER_MODE_SILENT) vibrate(new long[] { 0, 400 });
            if (player == null) finishSoon();
        } else {
            vibrate(new long[] { 0, 400, 300, 400 });
            finishSoon();
        }

        handler.postDelayed(this::finish, MAX_RING_MS);
        return START_NOT_STICKY;
    }

    /** Nothing left to play: let the vibration run, then step aside. */
    private void finishSoon() {
        handler.postDelayed(this::finish, 2_000L);
    }

    /**
     * Stop the service. A quiet style detaches its notification first, so it
     * stays in the shade like any message rather than vanishing with the
     * service that posted it.
     */
    private void finish() {
        if (keepNotification) stopForeground(STOP_FOREGROUND_DETACH);
        stopSelf();
    }

    private void ensureChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;

        if (manager.getNotificationChannel(CHANNEL_ID) == null) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Session alarm", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Rings when a focus session or break ends");
            // Silent on purpose: the service plays the audio itself, so it can
            // choose the stream and the device.
            channel.setSound(null, null);
            channel.enableVibration(false);
            channel.setBypassDnd(true);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            manager.createNotificationChannel(channel);
        }

        if (manager.getNotificationChannel(QUIET_CHANNEL_ID) == null) {
            NotificationChannel channel = new NotificationChannel(
                QUIET_CHANNEL_ID, "Session finished", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("A notification when a session ends, without the alarm");
            channel.setSound(null, null);
            channel.enableVibration(false);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            manager.createNotificationChannel(channel);
        }
    }

    private PendingIntent openAppIntent() {
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(
            this, 30, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private Notification buildAlarmNotification(String title, String body) {
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

    /** A plain heads-up notification: no screen takeover, dismissible. */
    private Notification buildQuietNotification(String title, String body) {
        return new NotificationCompat.Builder(this, QUIET_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_pomodoro)
            .setColor(0xFFE05252)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setContentIntent(openAppIntent())
            .build();
    }

    private void acquireWakeLock() {
        PowerManager pm = getSystemService(PowerManager.class);
        if (pm == null) return;
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "pomodoro:alarm");
        wakeLock.setReferenceCounted(false);
        wakeLock.acquire(MAX_RING_MS + 5_000L);
    }

    /**
     * The output to play on when the user has headphones — or any other
     * personal audio route, a car stereo included — connected, or null when
     * the sound belongs on the phone itself.
     */
    private AudioDeviceInfo headphones() {
        if (audioManager == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return null;
        for (AudioDeviceInfo device : audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
            switch (device.getType()) {
                case AudioDeviceInfo.TYPE_BLUETOOTH_A2DP:
                case AudioDeviceInfo.TYPE_WIRED_HEADSET:
                case AudioDeviceInfo.TYPE_WIRED_HEADPHONES:
                case AudioDeviceInfo.TYPE_USB_HEADSET:
                    return device;
                default:
                    break;
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                    && (device.getType() == AudioDeviceInfo.TYPE_BLE_HEADSET
                        || device.getType() == AudioDeviceInfo.TYPE_BLE_SPEAKER)) {
                return device;
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                    && device.getType() == AudioDeviceInfo.TYPE_HEARING_AID) {
                return device;
            }
        }
        return null;
    }

    private void playSound(String sound, boolean alarm, int plays) {
        try {
            int resId = 0;
            if (sound != null && !sound.isEmpty()) {
                resId = getResources().getIdentifier(sound, "raw", getPackageName());
            }
            if (resId == 0) resId = R.raw.alarm_chime;

            AudioDeviceInfo headset = headphones();
            // With headphones in, the media route is where the user is
            // listening. Without them, the alarm stream for an alarm — loud
            // and heard on silent — and the notification stream otherwise.
            int usage = headset != null
                ? AudioAttributes.USAGE_MEDIA
                : alarm ? AudioAttributes.USAGE_ALARM : AudioAttributes.USAGE_NOTIFICATION;
            AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(usage)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();

            requestFocus(attrs);

            Uri uri = Uri.parse("android.resource://" + getPackageName() + "/" + resId);
            player = new MediaPlayer();
            player.setAudioAttributes(attrs);
            player.setDataSource(this, uri);
            if (headset != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                player.setPreferredDevice(headset);
            }
            // Deliberately not looping: it plays a fixed number of times and
            // stops, so a missed session does not leave the phone wailing.
            player.setLooping(false);
            playsLeft = plays;
            player.setOnCompletionListener(mp -> {
                if (--playsLeft > 0) {
                    mp.seekTo(0);
                    mp.start();
                } else {
                    silence();
                    // The quiet styles have nothing left to do; the alarm keeps
                    // its screen up until it is dismissed.
                    if (keepNotification) finish();
                }
            });
            player.prepare();
            player.start();
        } catch (Exception e) {
            // Audio unavailable — the vibration and the notification still fire.
            silence();
        }
    }

    /** Pause whatever is playing — music in the headphones, most likely. */
    private void requestFocus(AudioAttributes attrs) {
        if (audioManager == null) return;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                    .setAudioAttributes(attrs)
                    .build();
                audioManager.requestAudioFocus(focusRequest);
            } else {
                audioManager.requestAudioFocus(null, AudioManager.STREAM_MUSIC,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT);
            }
        } catch (Exception ignored) {
            // Without focus the sound still plays, just over the music.
        }
    }

    private void abandonFocus() {
        if (audioManager == null) return;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (focusRequest != null) audioManager.abandonAudioFocusRequest(focusRequest);
            } else {
                audioManager.abandonAudioFocus(null);
            }
        } catch (Exception ignored) {
        }
        focusRequest = null;
    }

    private void vibrate(long[] pattern) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vm = getSystemService(VibratorManager.class);
                vibrator = vm != null ? vm.getDefaultVibrator() : null;
            } else {
                vibrator = getSystemService(Vibrator.class);
            }
            if (vibrator != null && vibrator.hasVibrator()) {
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

    /** Stop the noise; the alarm's screen and notification stay in place. */
    private void silence() {
        if (player != null) {
            try { player.stop(); } catch (Exception ignored) {}
            player.release();
            player = null;
        }
        // Hand the headphones back to whatever was playing in them.
        abandonFocus();
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        silence();
        if (vibrator != null) {
            try { vibrator.cancel(); } catch (Exception ignored) {}
            vibrator = null;
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
            wakeLock = null;
        }
        if (!keepNotification) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.cancel(NOTIFICATION_ID);
        }
        super.onDestroy();
    }

    /** Stop a ringing alarm, and clear its notification, from anywhere in the app. */
    static void stop(Context context) {
        context.stopService(new Intent(context, AlarmService.class));
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm != null) nm.cancel(NOTIFICATION_ID);
    }
}
