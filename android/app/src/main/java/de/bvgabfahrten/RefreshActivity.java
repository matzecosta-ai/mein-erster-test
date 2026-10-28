package de.bvgabfahrten;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.List;

/**
 * Unsichtbare Activity, die beim Tippen aufs Widget startet: Standort holen,
 * Abfahrten laden, Widget aktualisieren, wieder schließen.
 */
public class RefreshActivity extends Activity {
    private static final int REQ_LOCATION = 1;
    private static final long[] TIMEOUTS_MS = {8000, 15000}; // Netzwerk-Standort, dann GPS

    private final Handler main = new Handler(Looper.getMainLooper());
    private LocationManager lm;
    private List<String> providers;
    private boolean finished;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        lm = (LocationManager) getSystemService(LOCATION_SERVICE);
        List<Stop> selection = Cache.loadSelection(this);
        if (!selection.isEmpty() && Cache.loadDestination(this) == null) {
            loadSelection(selection); // feste Haltestellen: kein Standort nötig
        } else if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            start();
        } else {
            requestPermissions(new String[]{
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_LOCATION);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        boolean ok = false;
        for (int r : grantResults) ok |= r == PackageManager.PERMISSION_GRANTED;
        if (ok) start();
        else fail("Standortzugriff fehlt – in den App-Einstellungen erlauben");
    }

    private void start() {
        WidgetRenderer.updateAll(this, "Standort wird ermittelt …");
        providers = new ArrayList<>();
        if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) providers.add(LocationManager.NETWORK_PROVIDER);
        if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) providers.add(LocationManager.GPS_PROVIDER);
        if (providers.isEmpty()) {
            fail("Standort ist am Handy ausgeschaltet");
            return;
        }
        tryProvider(0);
    }

    @SuppressLint("MissingPermission")
    private void tryProvider(final int idx) {
        if (idx >= providers.size()) {
            Location last = bestLastKnown();
            if (last != null) load(last);
            else fail("Standort konnte nicht ermittelt werden");
            return;
        }
        final String provider = providers.get(idx);
        final boolean[] done = {false};
        final LocationListener listener = new LocationListener() {
            @Override public void onLocationChanged(Location l) {
                if (done[0]) return;
                done[0] = true;
                main.removeCallbacksAndMessages(null);
                load(l);
            }
            @Override public void onProviderEnabled(String p) {}
            @Override public void onProviderDisabled(String p) {}
            @Override @SuppressWarnings("deprecation") public void onStatusChanged(String p, int s, Bundle e) {}
        };
        // Ein frischer Standort der letzten zwei Minuten reicht.
        Location last = lm.getLastKnownLocation(provider);
        if (last != null && System.currentTimeMillis() - last.getTime() < 120_000) {
            load(last);
            return;
        }
        if (Build.VERSION.SDK_INT >= 30) {
            lm.getCurrentLocation(provider, null, getMainExecutor(), l -> {
                if (l != null) listener.onLocationChanged(l);
            });
        } else {
            lm.requestSingleUpdate(provider, listener, Looper.getMainLooper());
        }
        main.postDelayed(() -> {
            if (done[0]) return;
            done[0] = true;
            lm.removeUpdates(listener);
            tryProvider(idx + 1);
        }, TIMEOUTS_MS[Math.min(idx, TIMEOUTS_MS.length - 1)]);
    }

    @SuppressLint("MissingPermission")
    private Location bestLastKnown() {
        Location best = null;
        for (String p : providers) {
            Location l = lm.getLastKnownLocation(p);
            if (l != null && (best == null || l.getTime() > best.getTime())) best = l;
        }
        return best;
    }

    private void loadSelection(final List<Stop> selection) {
        WidgetRenderer.updateAll(this, "Lade Abfahrten …");
        final android.content.Context app = getApplicationContext();
        new Thread(() -> {
            try {
                Cache.saveResult(app, null, BvgClient.fetchDepartures(selection));
            } catch (Exception e) {
                Cache.saveError(app, e.getMessage() != null ? e.getMessage() : "Fehler beim Laden");
            }
            WidgetRenderer.updateAll(app);
            main.post(this::finishQuietly);
        }).start();
    }

    private void load(final Location loc) {
        if (finished) return;
        Toast.makeText(this, "Lade Abfahrten …", Toast.LENGTH_SHORT).show();
        WidgetRenderer.updateAll(this, "Lade Abfahrten …");
        final android.content.Context app = getApplicationContext();
        new Thread(() -> {
            try {
                Stop dest = Cache.loadDestination(app);
                if (dest != null) {
                    Cache.saveJourneys(app, BvgClient.fetchJourneys(loc.getLatitude(), loc.getLongitude(), dest.id));
                } else {
                    BvgClient.Result r = BvgClient.fetchNearby(loc.getLatitude(), loc.getLongitude());
                    Cache.saveResult(app, r.stops, r.departures);
                }
            } catch (Exception e) {
                Cache.saveError(app, e.getMessage() != null ? e.getMessage() : "Fehler beim Laden");
            }
            WidgetRenderer.updateAll(app);
            main.post(this::finishQuietly);
        }).start();
    }

    private void fail(String message) {
        Cache.saveError(getApplicationContext(), message);
        WidgetRenderer.updateAll(getApplicationContext());
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
        finishQuietly();
    }

    private void finishQuietly() {
        finished = true;
        finish();
        overridePendingTransition(0, 0);
    }
}
