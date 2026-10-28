package de.bvgabfahrten;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Set;
import java.util.Locale;

/** Baut die Widget-Ansicht aus dem zuletzt gespeicherten Stand. */
final class WidgetRenderer {
    private static final int[][] ROWS = {
            {R.id.r1, R.id.r1_line, R.id.r1_dir, R.id.r1_stop, R.id.r1_min},
            {R.id.r2, R.id.r2_line, R.id.r2_dir, R.id.r2_stop, R.id.r2_min},
            {R.id.r3, R.id.r3_line, R.id.r3_dir, R.id.r3_stop, R.id.r3_min},
            {R.id.r4, R.id.r4_line, R.id.r4_dir, R.id.r4_stop, R.id.r4_min},
            {R.id.r5, R.id.r5_line, R.id.r5_dir, R.id.r5_stop, R.id.r5_min},
            {R.id.r6, R.id.r6_line, R.id.r6_dir, R.id.r6_stop, R.id.r6_min},
    };

    private WidgetRenderer() {}

    static void updateAll(Context ctx) {
        updateAll(ctx, null);
    }

    static void updateAll(Context ctx, String loadingText) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, DepartureWidget.class));
        update(ctx, mgr, ids, loadingText);
    }

    /** loadingText: wenn gesetzt, wird er statt des Status gezeigt (z. B. "Lade …"). */
    static void update(Context ctx, AppWidgetManager mgr, int[] ids, String loadingText) {
        if (ids.length == 0) return;
        mgr.updateAppWidget(ids, build(ctx, loadingText));
    }

    private static RemoteViews build(Context ctx, String loadingText) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_departures);
        Cache.State s = Cache.load(ctx);
        Stop destination = Cache.loadDestination(ctx);
        if (destination != null) return buildJourneys(ctx, v, s, destination, loadingText);

        long now = System.currentTimeMillis();
        Set<String> filter = Cache.loadFilter(ctx);
        int shown = 0;
        for (Departure d : s.departures) {
            if (shown == ROWS.length) break;
            if (d.whenMillis < now - 30_000) continue; // schon abgefahren
            if (!filter.isEmpty() && !filter.contains(d.filterKey())) continue;
            int[] r = ROWS[shown++];
            v.setViewVisibility(r[0], android.view.View.VISIBLE);
            v.setTextViewText(r[1], d.line);
            v.setInt(r[1], "setBackgroundResource", badge(d.product));
            v.setTextViewText(r[2], d.direction);
            v.setTextViewText(r[3], d.stopName);
            v.setTextViewText(r[4], minutesText(d, now));
            v.setTextColor(r[4], d.cancelled ? 0xFF9A9A94 : (d.delayMin >= 3 ? 0xFFFF6B6B : 0xFFFFFFFF));
        }
        for (int i = shown; i < ROWS.length; i++) v.setViewVisibility(ROWS[i][0], android.view.View.GONE);

        String status;
        if (loadingText != null) {
            status = loadingText;
        } else if (s.error != null && !s.error.isEmpty()) {
            status = s.error;
        } else if (s.updatedAt == 0) {
            status = "Zum Laden tippen";
        } else {
            status = "Stand " + new SimpleDateFormat("HH:mm", Locale.GERMANY).format(new Date(s.updatedAt))
                    + (filter.isEmpty() ? "" : " · Filter aktiv")
                    + (shown == 0 ? " · keine Abfahrten" : "");
        }
        v.setTextViewText(R.id.status, status);

        List<Stop> selection = Cache.loadSelection(ctx);
        v.setTextViewText(R.id.title, selection.isEmpty() ? "Abfahrten in der Nähe ▾" : titleFor(selection));

        wireClicks(ctx, v);
        return v;
    }

    /** Verbindungsmodus: nächste Fahrten vom Standort zum Ziel. */
    private static RemoteViews buildJourneys(Context ctx, RemoteViews v, Cache.State s, Stop dest, String loadingText) {
        SimpleDateFormat hm = new SimpleDateFormat("HH:mm", Locale.GERMANY);
        long now = System.currentTimeMillis();
        int shown = 0;
        for (Journey j : s.journeys) {
            if (shown == ROWS.length) break;
            if (j.departMillis < now - 30_000) continue; // schon abgefahren
            int[] r = ROWS[shown];
            v.setViewVisibility(r[0], android.view.View.VISIBLE);
            Intent detail = new Intent(ctx, JourneyActivity.class)
                    .putExtra(JourneyActivity.EXTRA_DEPART, j.departMillis)
                    .putExtra(JourneyActivity.EXTRA_LINES, j.lines);
            v.setOnClickPendingIntent(r[0], PendingIntent.getActivity(ctx, 10 + shown, detail,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
            shown++;
            v.setTextViewText(r[1], j.firstLine);
            v.setInt(r[1], "setBackgroundResource", badge(j.product));
            v.setTextViewText(r[2], j.lines + (j.transfers == 0 ? "" : " · " + j.transfers + " Umst."));
            long dur = Math.max(1, Math.round((j.arriveMillis - j.departMillis) / 60000.0));
            v.setTextViewText(r[3], "ab " + j.originStop + " · an " + hm.format(new Date(j.arriveMillis)) + " (" + dur + " min)");
            long min = Math.max(0, Math.round((j.departMillis - now) / 60000.0));
            v.setTextViewText(r[4], j.cancelled ? "entfällt" : (min == 0 ? "jetzt" : min + " min"));
            v.setTextColor(r[4], j.cancelled ? 0xFF9A9A94 : (j.delayMin >= 3 ? 0xFFFF6B6B : 0xFFFFFFFF));
        }
        for (int i = shown; i < ROWS.length; i++) v.setViewVisibility(ROWS[i][0], android.view.View.GONE);

        String status;
        if (loadingText != null) status = loadingText;
        else if (s.error != null && !s.error.isEmpty()) status = s.error;
        else if (s.updatedAt == 0) status = "Zum Laden tippen";
        else status = "Stand " + hm.format(new Date(s.updatedAt))
                + (shown == 0 ? " · keine Verbindung gefunden" : " · Verbindung antippen für Details");
        v.setTextViewText(R.id.status, status);
        v.setTextViewText(R.id.title, "→ " + dest.name + " ▾");
        wireClicks(ctx, v);
        return v;
    }

    private static void wireClicks(Context ctx, RemoteViews v) {
        Intent i = new Intent(ctx, RefreshActivity.class);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.root, pi);
        v.setOnClickPendingIntent(R.id.refresh, pi);

        PendingIntent picker = PendingIntent.getActivity(ctx, 1, new Intent(ctx, SettingsActivity.class),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.title, picker);

        // ✕ nur zeigen, wenn etwas ausgewählt ist; Tipp setzt alles zurück und lädt neu.
        boolean active = Cache.hasActiveSettings(ctx);
        v.setViewVisibility(R.id.reset, active ? android.view.View.VISIBLE : android.view.View.GONE);
        if (active) {
            Intent reset = new Intent(ctx, RefreshActivity.class).putExtra(RefreshActivity.EXTRA_RESET, true);
            v.setOnClickPendingIntent(R.id.reset, PendingIntent.getActivity(ctx, 2, reset,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        }
    }

    private static String titleFor(List<Stop> selection) {
        StringBuilder sb = new StringBuilder();
        for (Stop st : selection) {
            if (sb.length() > 0) sb.append(" · ");
            sb.append(st.name);
        }
        return sb.append(" ▾").toString();
    }

    private static String minutesText(Departure d, long now) {
        if (d.cancelled) return "entfällt";
        long min = Math.max(0, Math.round((d.whenMillis - now) / 60000.0));
        return min == 0 ? "jetzt" : min + " min";
    }

    private static int badge(String product) {
        switch (product) {
            case "subway": return R.drawable.badge_subway;
            case "suburban": return R.drawable.badge_suburban;
            case "tram": return R.drawable.badge_tram;
            case "bus": return R.drawable.badge_bus;
            case "ferry": return R.drawable.badge_ferry;
            default: return R.drawable.badge_other;
        }
    }
}
