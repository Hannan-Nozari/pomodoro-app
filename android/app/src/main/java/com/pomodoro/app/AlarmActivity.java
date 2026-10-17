package com.pomodoro.app;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.widget.TextView;

/**
 * The screen you actually see when a session ends.
 *
 * Launched by the alarm notification's full-screen intent, so it appears over
 * the lock screen and turns the display on — a notification on its own does
 * neither, which is why a finished session was easy to miss.
 */
public class AlarmActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = getSystemService(KeyguardManager.class);
            if (km != null) km.requestDismissKeyguard(this, null);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                    | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        setContentView(R.layout.activity_alarm);

        Intent intent = getIntent();
        String title = intent != null ? intent.getStringExtra(AlarmService.EXTRA_TITLE) : null;
        String body = intent != null ? intent.getStringExtra(AlarmService.EXTRA_BODY) : null;

        TextView titleView = findViewById(R.id.alarm_title);
        TextView bodyView = findViewById(R.id.alarm_body);
        titleView.setText(title != null ? title : "Session complete");
        bodyView.setText(body != null ? body : "");

        findViewById(R.id.alarm_stop).setOnClickListener(v -> dismiss(false));
        findViewById(R.id.alarm_open).setOnClickListener(v -> dismiss(true));
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }

    private void dismiss(boolean openApp) {
        AlarmService.stop(this);
        if (openApp) {
            Intent open = new Intent(this, MainActivity.class);
            open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            startActivity(open);
        }
        finish();
    }

    @Override
    public void onBackPressed() {
        // Silence it rather than leaving it ringing behind the user.
        dismiss(false);
    }
}
