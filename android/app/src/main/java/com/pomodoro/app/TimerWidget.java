package com.pomodoro.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;

/**
 * Home-screen widget showing the session counting down.
 *
 * Like the ongoing notification, the countdown is a Chronometer driven from
 * the deadline, so the system redraws it every second and the widget stays
 * right without the app running or the widget being updated.
 */
public class TimerWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
        for (int id : widgetIds) {
            manager.updateAppWidget(id, build(context));
        }
    }

    static RemoteViews build(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.timer_widget);
        boolean running = TimerState.isRunning(context);

        if (running) {
            long remaining = TimerState.deadline(context) - System.currentTimeMillis();
            views.setChronometer(R.id.widget_time,
                SystemClock.elapsedRealtime() + remaining, "%s", true);
            views.setChronometerCountDown(R.id.widget_time, true);
            views.setViewVisibility(R.id.widget_time, View.VISIBLE);
            views.setViewVisibility(R.id.widget_idle, View.GONE);
            views.setTextViewText(R.id.widget_label, TimerState.label(context));
        } else {
            // A paused session keeps its time on the face; only a finished or
            // untouched timer invites a fresh start.
            boolean paused = TimerState.isPaused(context);
            int remaining = TimerState.remaining(context);
            views.setViewVisibility(R.id.widget_time, View.GONE);
            views.setViewVisibility(R.id.widget_idle, View.VISIBLE);
            views.setTextViewText(R.id.widget_idle, paused
                ? String.format(java.util.Locale.US, "%02d:%02d", remaining / 60, remaining % 60)
                : context.getString(R.string.widget_idle));
            views.setTextViewText(R.id.widget_label, context.getString(
                paused ? R.string.widget_resume : R.string.widget_tap));
        }

        // Tapping an idle widget starts a session; tapping a running one just
        // opens the app, so a stray tap cannot cancel what is in progress.
        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (!running) open.putExtra(MainActivity.EXTRA_ACTION, TimerState.ACTION_START);
        PendingIntent pi = PendingIntent.getActivity(
            context, running ? 0 : 1, open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pi);

        return views;
    }

    /** Redraw every placed widget after the timer changes. */
    static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName component = new ComponentName(context, TimerWidget.class);
        int[] ids = manager.getAppWidgetIds(component);
        if (ids == null || ids.length == 0) return;
        RemoteViews views = build(context);
        for (int id : ids) manager.updateAppWidget(id, views);
    }
}
