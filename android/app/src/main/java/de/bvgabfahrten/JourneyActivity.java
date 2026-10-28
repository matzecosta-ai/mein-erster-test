package de.bvgabfahrten;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/** Zeigt den ganzen Verlauf einer Verbindung: Fußwege, Fahrten, Haltestellen, Umstiege. */
public class JourneyActivity extends Activity {
    static final String EXTRA_DEPART = "depart";
    static final String EXTRA_LINES = "lines";

    private static final int TEXT = Color.parseColor("#1B1B1B");
    private static final int MUTED = Color.parseColor("#6B6B66");
    private static final int LATE = Color.parseColor("#C62828");

    private final SimpleDateFormat hm = new SimpleDateFormat("HH:mm", Locale.GERMANY);
    private float density;
    private LinearLayout box;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        density = getResources().getDisplayMetrics().density;

        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(Color.parseColor("#F4F4F2"));
        box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(20), dp(40), dp(20), dp(24));
        scroll.addView(box);
        setContentView(scroll);

        Journey journey = find(getIntent().getLongExtra(EXTRA_DEPART, 0), getIntent().getStringExtra(EXTRA_LINES));
        Stop dest = Cache.loadDestination(this);
        if (journey == null || journey.legs.isEmpty()) {
            box.addView(text("Diese Verbindung ist nicht mehr gespeichert. Tippe im Widget auf ⟳ und wähle sie neu.", 16, TEXT, false));
        } else {
            build(journey, dest);
        }

        Button close = new Button(this);
        close.setText("Schließen");
        close.setOnClickListener(v -> finish());
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.topMargin = dp(20);
        box.addView(close, lp);
    }

    private Journey find(long depart, String lines) {
        for (Journey j : Cache.load(this).journeys) {
            if (j.departMillis == depart && j.lines.equals(lines)) return j;
        }
        return null;
    }

    private void build(Journey j, Stop dest) {
        box.addView(text("→ " + (dest != null ? dest.name : "Ziel"), 22, TEXT, true));
        long dur = Math.max(1, Math.round((j.arriveMillis - j.departMillis) / 60000.0));
        String sum = "Abfahrt " + hm.format(new Date(j.departMillis)) + " · Ankunft " + hm.format(new Date(j.arriveMillis))
                + " · " + dur + " min · " + (j.transfers == 0 ? "ohne Umstieg" : j.transfers == 1 ? "1 Umstieg" : j.transfers + " Umstiege");
        TextView s = text(sum, 14, MUTED, false);
        s.setPadding(0, dp(4), 0, dp(16));
        box.addView(s);

        List<Leg> legs = j.legs;
        for (int i = 0; i < legs.size(); i++) {
            Leg leg = legs.get(i);
            if (leg.isWalk()) {
                boolean middle = i > 0 && i < legs.size() - 1;
                if (middle) box.addView(chip(transferText(legs.get(i - 1), leg, legs.get(i + 1))));
                else box.addView(walk(leg, i, legs.size()));
                continue;
            }
            // Zwei Fahrten direkt hintereinander: Umstieg ohne Fußweg anzeigen.
            if (i > 0 && !legs.get(i - 1).isWalk()) {
                box.addView(chip(transferText(legs.get(i - 1), null, leg)));
            }
            box.addView(transit(leg));
        }
    }

    /** Fußweg am Anfang (zur Haltestelle) oder Ende (zum Ziel). */
    private View walk(Leg leg, int index, int count) {
        long min = Math.max(1, Math.round((leg.arriveMillis - leg.departMillis) / 60000.0));
        String what = index == 0 ? "Fußweg zur Haltestelle" : "Fußweg zum Ziel";
        return plain("🚶  " + what + " · " + leg.distance + " m · ca. " + min + " min");
    }

    /** Umstieg zwischen zwei Fahrten, optional mit Fußweg dazwischen. */
    private String transferText(Leg prev, Leg walk, Leg next) {
        long wait = Math.max(0, Math.round((next.departMillis - prev.arriveMillis) / 60000.0));
        return "↻  Umsteigen in " + prev.to
                + (walk != null && walk.distance > 0 ? " · Fußweg " + walk.distance + " m" : "")
                + " · " + wait + " min Zeit"
                + (next.departPlatform.isEmpty() ? "" : " · weiter ab Gleis " + next.departPlatform);
    }

    private View transit(Leg leg) {
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setPadding(0, dp(8), 0, dp(8));

        col.addView(stopLine(leg.departMillis, leg.departDelayMin, leg.from, leg.departPlatform));

        LinearLayout mid = new LinearLayout(this);
        mid.setOrientation(LinearLayout.HORIZONTAL);
        mid.setGravity(Gravity.CENTER_VERTICAL);
        mid.setPadding(dp(56), dp(6), 0, dp(6));
        TextView badge = new TextView(this);
        badge.setText(leg.line);
        badge.setTextColor(Color.WHITE);
        badge.setTypeface(Typeface.DEFAULT_BOLD);
        badge.setTextSize(14);
        badge.setGravity(Gravity.CENTER);
        badge.setMinWidth(dp(46));
        badge.setPadding(dp(8), dp(3), dp(8), dp(3));
        badge.setBackground(rounded(productColor(leg.product), 6));
        mid.addView(badge);
        long dur = Math.max(1, Math.round((leg.arriveMillis - leg.departMillis) / 60000.0));
        TextView dir = text("  Richtung " + leg.direction + "  ·  " + dur + " min" + (leg.cancelled ? "  ·  entfällt" : ""), 14, MUTED, false);
        mid.addView(dir);
        col.addView(mid);

        col.addView(stopLine(leg.arriveMillis, leg.arriveDelayMin, leg.to, leg.arrivePlatform));
        return col;
    }

    private View stopLine(long millis, int delayMin, String stop, String platform) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);

        TextView time = text(hm.format(new Date(millis)), 16, delayMin >= 3 ? LATE : TEXT, true);
        time.setMinWidth(dp(56));
        row.addView(time);

        String label = stop + (platform.isEmpty() ? "" : "  ·  Gleis " + platform);
        row.addView(text(label, 16, TEXT, true));
        if (delayMin >= 1) row.addView(text("  +" + delayMin, 13, LATE, false));
        return row;
    }

    private View plain(String t) {
        TextView v = text(t, 14, MUTED, false);
        v.setPadding(0, dp(6), 0, dp(6));
        return v;
    }

    private View chip(String t) {
        TextView v = text(t, 14, TEXT, true);
        v.setPadding(dp(12), dp(8), dp(12), dp(8));
        v.setBackground(rounded(Color.parseColor("#FFF3B0"), 8));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.topMargin = dp(8);
        lp.bottomMargin = dp(8);
        v.setLayoutParams(lp);
        return v;
    }

    private TextView text(String t, int sp, int color, boolean bold) {
        TextView v = new TextView(this);
        v.setText(t);
        v.setTextSize(sp);
        v.setTextColor(color);
        if (bold) v.setTypeface(Typeface.DEFAULT_BOLD);
        return v;
    }

    private GradientDrawable rounded(int color, int radiusDp) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(color);
        d.setCornerRadius(dp(radiusDp));
        return d;
    }

    private static int productColor(String product) {
        switch (product) {
            case "subway": return Color.parseColor("#0D5FA8");
            case "suburban": return Color.parseColor("#1D8A3A");
            case "tram": return Color.parseColor("#C8102E");
            case "bus": return Color.parseColor("#9B2D8F");
            case "ferry": return Color.parseColor("#0F8FA3");
            default: return Color.parseColor("#666666");
        }
    }

    private int dp(int v) {
        return Math.round(v * density);
    }
}
