package de.bvgabfahrten;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/** Letzter Abruf und gewählte Haltestellen, damit das Widget auch ohne neue Abfrage etwas anzeigt. */
final class Cache {
    private static final String PREFS = "cache";
    private static final String KEY = "last";
    private static final String KEY_SELECTION = "selection";
    private static final String KEY_FILTER = "filter";
    private static final String KEY_DESTINATION = "destination";

    static final class State {
        long updatedAt;
        String error;
        List<Stop> stops = new ArrayList<>();
        List<Departure> departures = new ArrayList<>();
        List<Journey> journeys = new ArrayList<>();
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

    static void saveJourneys(Context ctx, List<Journey> journeys) {
        try {
            JSONObject o = new JSONObject(prefs(ctx).getString(KEY, "{}"));
            o.remove("error");
            o.put("updatedAt", System.currentTimeMillis());
            JSONArray a = new JSONArray();
            for (Journey j : journeys) a.put(j.toJson());
            o.put("journeys", a);
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
            JSONArray jo = o.optJSONArray("journeys");
            if (jo != null) for (int i = 0; i < jo.length(); i++) s.journeys.add(Journey.fromJson(jo.getJSONObject(i)));
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

    /** Zielhaltestelle für den Verbindungsmodus; null = normale Abfahrtsliste. */
    static Stop loadDestination(Context ctx) {
        try {
            String s = prefs(ctx).getString(KEY_DESTINATION, null);
            return s == null ? null : Stop.fromJson(new JSONObject(s));
        } catch (Exception e) {
            return null;
        }
    }

    static void saveDestination(Context ctx, Stop dest) {
        try {
            if (dest == null) prefs(ctx).edit().remove(KEY_DESTINATION).apply();
            else prefs(ctx).edit().putString(KEY_DESTINATION, dest.toJson().toString()).apply();
        } catch (Exception ignored) {
        }
    }

    /** Gewählte "Linie|Richtung"-Kombinationen; leer = alles zeigen. */
    static Set<String> loadFilter(Context ctx) {
        Set<String> result = new LinkedHashSet<>();
        try {
            JSONArray a = new JSONArray(prefs(ctx).getString(KEY_FILTER, "[]"));
            for (int i = 0; i < a.length(); i++) result.add(a.getString(i));
        } catch (Exception ignored) {
        }
        return result;
    }

    static void saveFilter(Context ctx, Set<String> filter) {
        prefs(ctx).edit().putString(KEY_FILTER, new JSONArray(filter).toString()).apply();
    }

    /** Ist etwas ausgewählt (Haltestellen, Filter oder Ziel)? */
    static boolean hasActiveSettings(Context ctx) {
        return !loadSelection(ctx).isEmpty() || !loadFilter(ctx).isEmpty() || loadDestination(ctx) != null;
    }

    /** Alles abwählen: Haltestellen, Linien-/Richtungsfilter und Ziel. */
    static void clearSettings(Context ctx) {
        prefs(ctx).edit().remove(KEY_SELECTION).remove(KEY_FILTER).remove(KEY_DESTINATION).apply();
    }

    private static void put(Context ctx, JSONObject o) {
        prefs(ctx).edit().putString(KEY, o.toString()).apply();
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
