package com.pomodoro.app;

import android.app.PendingIntent;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;

/**
 * Quick Settings tile: start a session, or see the one running, from the shade.
 *
 * The tile is only alive while the shade is open, so the state it shows comes
 * from TimerState rather than from this service holding anything itself.
 */
public class TimerTileService extends TileService {

    @Override
    public void onStartListening() {
        super.onStartListening();
        paint(this, getQsTile());
    }

    @Override
    public void onClick() {
        super.onClick();
        boolean running = TimerState.isRunning(this);
        // An idle tile starts the next session; a running one only opens the
        // app, so a stray tap in the shade cannot cancel the session.
        if (!running) TimerState.setPendingAction(this, TimerState.ACTION_START);

        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(
            this, 2, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startActivityAndCollapse(pi);
        } else {
            startActivityAndCollapse(open);
        }
    }

    private static void paint(Context context, Tile tile) {
        if (tile == null) return;
        boolean running = TimerState.isRunning(context);
        boolean paused = TimerState.isPaused(context);
        tile.setState(running ? Tile.STATE_ACTIVE : Tile.STATE_INACTIVE);
        tile.setLabel(context.getString(R.string.tile_label));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            tile.setSubtitle(running
                ? TimerState.label(context)
                : context.getString(paused ? R.string.widget_resume : R.string.widget_tap));
        }
        try {
            tile.setIcon(Icon.createWithResource(context, R.drawable.ic_stat_pomodoro));
        } catch (Exception ignored) {
            // Keep the default icon rather than losing the tile.
        }
        tile.updateTile();
    }

    /** Ask the system to re-poll the tile after the timer changes. */
    static void refresh(Context context) {
        try {
            requestListeningState(context, new ComponentName(context, TimerTileService.class));
        } catch (Exception ignored) {
            // The tile may not be added; nothing to update.
        }
    }
}
