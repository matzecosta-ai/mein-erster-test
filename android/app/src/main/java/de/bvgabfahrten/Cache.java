package de.bvgabfahrten;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/** Letzter Abruf und gewählte Haltestellen, damit das Widget auch ohne neue Abfrage etwas anzeigt. */
final class Cache {
    private static final String PREFS = "cache";
    private static final String KEY = "last";
    private static final String KEY_SELECTION = "selection";

    static final class State {
        long updatedAt;
        String error;
        List<Stop> stops = new ArrayList<>();
        List<Departure> departures = new ArrayList<>();
    }

    private Cache() {}

    /** stops == null: bisherige Haltestellenliste behalten (Abruf für feste Auswahl). */
    static void saveResult(Context ctx, List<Stop> stops, List<Departure> deps) {
        try {
            JSONObject o = new JSONObject(prefs(ctx).getString(KEY, "{}"));
            o.remove("error");
            o.put("updatedAt", System.currentTimeMillis());
            JSONArray d = new JSONArray();
            for (Departure x : deps) d.put(x.toJson());
            o.put("deps", d);
            if (stops != null) {
                JSONArray s = new JSONArray();
                for (Stop x : stops) s.put(x.toJson());
                o.put("stops", s);
            }
            put(ctx, o);
        } catch (Exception ignored) {
        }
    }

    /** Fehler merken, die zuletzt geladenen Abfahrten bleiben erhalten. */
    static void saveError(Context ctx, String message) {
        try {
            put(ctx, new JSONObject(prefs(ctx).getString(KEY, "{}")).put("error", message));
        } catch (Exception ignored) {
        }
    }

    static State load(Context ctx) {
        State s = new State();
        try {
            JSONObject o = new JSONObject(prefs(ctx).getString(KEY, "{}"));
            s.updatedAt = o.optLong("updatedAt");
            s.error = o.optString("error", null);
            JSONArray d = o.optJSONArray("deps");
            if (d != null) for (int i = 0; i < d.length(); i++) s.departures.add(Departure.fromJson(d.getJSONObject(i)));
            JSONArray st = o.optJSONArray("stops");
            if (st != null) for (int i = 0; i < st.length(); i++) s.stops.add(Stop.fromJson(st.getJSONObject(i)));
        } catch (Exception ignored) {
        }
        return s;
    }

    /** Fest gewählte Haltestellen; leer = alle in der Nähe (per Standort). */
    static List<Stop> loadSelection(Context ctx) {
        List<Stop> result = new ArrayList<>();
        try {
            JSONArray a = new JSONArray(prefs(ctx).getString(KEY_SELECTION, "[]"));
            for (int i = 0; i < a.length(); i++) result.add(Stop.fromJson(a.getJSONObject(i)));
        } catch (Exception ignored) {
        }
        return result;
    }

    static void saveSelection(Context ctx, List<Stop> selection) {
        try {
            JSONArray a = new JSONArray();
            for (Stop s : selection) a.put(s.toJson());
            prefs(ctx).edit().putString(KEY_SELECTION, a.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    private static void put(Context ctx, JSONObject o) {
        prefs(ctx).edit().putString(KEY, o.toString()).apply();
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
