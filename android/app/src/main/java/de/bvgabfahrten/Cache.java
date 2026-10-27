package de.bvgabfahrten;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/** Letzter Abruf, damit das Widget auch ohne neue Abfrage etwas anzeigt. */
final class Cache {
    private static final String PREFS = "cache";
    private static final String KEY = "last";

    static final class State {
        long updatedAt;
        String error;
        List<Departure> departures = new ArrayList<>();
    }

    private Cache() {}

    static void saveDepartures(Context ctx, List<Departure> deps) {
        try {
            JSONArray arr = new JSONArray();
            for (Departure d : deps) arr.put(d.toJson());
            put(ctx, new JSONObject().put("updatedAt", System.currentTimeMillis()).put("deps", arr));
        } catch (Exception ignored) {
        }
    }

    /** Fehler merken, die zuletzt geladenen Abfahrten bleiben erhalten. */
    static void saveError(Context ctx, String message) {
        try {
            JSONObject o = new JSONObject(prefs(ctx).getString(KEY, "{}"));
            put(ctx, o.put("error", message));
        } catch (Exception ignored) {
        }
    }

    static State load(Context ctx) {
        State s = new State();
        try {
            JSONObject o = new JSONObject(prefs(ctx).getString(KEY, "{}"));
            s.updatedAt = o.optLong("updatedAt");
            s.error = o.optString("error", null);
            JSONArray arr = o.optJSONArray("deps");
            if (arr != null) {
                for (int i = 0; i < arr.length(); i++) s.departures.add(Departure.fromJson(arr.getJSONObject(i)));
            }
        } catch (Exception ignored) {
        }
        return s;
    }

    private static void put(Context ctx, JSONObject o) {
        prefs(ctx).edit().putString(KEY, o.toString()).apply();
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
