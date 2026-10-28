package de.bvgabfahrten;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

/** Holt Haltestellen und Abfahrten von v6.bvg.transport.rest. */
final class BvgClient {
    private static final String API = "https://v6.bvg.transport.rest";
    private static final int RADIUS_M = 500;
    private static final int MAX_STOPS = 6;
    private static final int WINDOW_MIN = 60;

    private BvgClient() {}

    static final class Result {
        final List<Stop> stops;
        final List<Departure> departures;

        Result(List<Stop> stops, List<Departure> departures) {
            this.stops = stops;
            this.departures = departures;
        }
    }

    /** Haltestellen im Umkreis des Standorts samt ihren Abfahrten. */
    static Result fetchNearby(double lat, double lon) throws Exception {
        JSONArray near = new JSONArray(get(API + "/locations/nearby?latitude=" + lat + "&longitude=" + lon
                + "&distance=" + RADIUS_M + "&results=" + MAX_STOPS
                + "&stops=true&poi=false&addresses=false"));

        List<Stop> stops = new ArrayList<>();
        for (int i = 0; i < near.length(); i++) {
            JSONObject s = near.getJSONObject(i);
            if ("stop".equals(s.optString("type"))) {
                stops.add(new Stop(s.getString("id"), shortName(s.optString("name")), s.optInt("distance")));
            }
        }
        if (stops.isEmpty()) throw new Exception("Keine Haltestelle im Umkreis von " + RADIUS_M + " m");
        return new Result(stops, fetchDepartures(stops));
    }

    /** Abfahrten für fest ausgewählte Haltestellen, unabhängig vom Standort. */
    static List<Departure> fetchDepartures(List<Stop> stops) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(stops.size());
        try {
            List<Future<JSONArray>> futures = new ArrayList<>();
            for (final Stop s : stops) {
                futures.add(pool.submit(new Callable<JSONArray>() {
                    @Override public JSONArray call() throws Exception {
                        JSONObject r = new JSONObject(get(API + "/stops/" + s.id + "/departures?duration="
                                + WINDOW_MIN + "&linesOfStops=false&remarks=false"));
                        return r.getJSONArray("departures");
                    }
                }));
            }
            // Nahe Haltestellen liefern oft dieselben Fahrten: jede Fahrt nur einmal,
            // bei der zuerst genannten Haltestelle.
            Set<String> seen = new HashSet<>();
            List<Departure> result = new ArrayList<>();
            SimpleDateFormat iso = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.GERMANY);
            for (int i = 0; i < stops.size(); i++) {
                JSONArray deps = futures.get(i).get();
                for (int j = 0; j < deps.length(); j++) {
                    JSONObject d = deps.getJSONObject(j);
                    if (!seen.add(d.optString("tripId"))) continue;
                    String when = d.isNull("when") ? d.optString("plannedWhen") : d.optString("when");
                    if (when.isEmpty()) continue;
                    JSONObject line = d.optJSONObject("line");
                    int delay = d.isNull("delay") ? 0 : Math.round(d.optInt("delay") / 60f);
                    result.add(new Departure(
                            line != null ? line.optString("name", "?") : "?",
                            line != null ? line.optString("product", "") : "",
                            shortName(d.optString("direction")),
                            stops.get(i).name,
                            iso.parse(when).getTime(),
                            delay,
                            d.optBoolean("cancelled") || d.isNull("when")));
                }
            }
            Collections.sort(result, (a, b) -> Long.compare(a.whenMillis, b.whenMillis));
            return result;
        } finally {
            pool.shutdownNow();
        }
    }

    /** Haltestellen zu einem eingetippten Namen. */
    static List<Stop> searchStops(String query) throws Exception {
        JSONArray arr = new JSONArray(get(API + "/locations?query=" + URLEncoder.encode(query, "UTF-8")
                + "&results=6&stops=true&addresses=false&poi=false"));
        List<Stop> result = new ArrayList<>();
        for (int i = 0; i < arr.length(); i++) {
            JSONObject s = arr.getJSONObject(i);
            if ("stop".equals(s.optString("type"))) {
                result.add(new Stop(s.getString("id"), shortName(s.optString("name")), 0));
            }
        }
        return result;
    }

    /** Nächste Verbindungen vom Standort (inkl. Fußweg) zu einer Zielhaltestelle; nur BVG-Verkehrsmittel. */
    static List<Journey> fetchJourneys(double lat, double lon, String destId) throws Exception {
        JSONObject r = new JSONObject(get(API + "/journeys?from.latitude=" + lat + "&from.longitude=" + lon
                + "&from.address=" + URLEncoder.encode("Mein Standort", "UTF-8") + "&to=" + destId
                + "&results=5&stopovers=false&remarks=false"
                + "&suburban=true&subway=true&tram=true&bus=true&ferry=true&express=false&regional=false"));
        JSONArray journeys = r.optJSONArray("journeys");
        List<Journey> result = new ArrayList<>();
        if (journeys == null) return result;
        SimpleDateFormat iso = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.GERMANY);
        for (int i = 0; i < journeys.length(); i++) {
            JSONArray legs = journeys.getJSONObject(i).getJSONArray("legs");
            List<JSONObject> transit = new ArrayList<>();
            for (int j = 0; j < legs.length(); j++) {
                JSONObject leg = legs.getJSONObject(j);
                if (leg.optJSONObject("line") != null) transit.add(leg);
            }
            if (transit.isEmpty()) continue; // reiner Fußweg
            JSONObject first = transit.get(0);
            JSONObject last = legs.getJSONObject(legs.length() - 1);
            StringBuilder lines = new StringBuilder();
            boolean cancelled = false;
            for (JSONObject t : transit) {
                if (lines.length() > 0) lines.append(" → ");
                lines.append(t.getJSONObject("line").optString("name", "?"));
                cancelled |= t.optBoolean("cancelled");
            }
            String dep = first.isNull("departure") ? first.optString("plannedDeparture") : first.optString("departure");
            String arr = last.isNull("arrival") ? last.optString("plannedArrival") : last.optString("arrival");
            JSONObject origin = first.optJSONObject("origin");
            List<Leg> allLegs = new ArrayList<>();
            for (int j = 0; j < legs.length(); j++) allLegs.add(parseLeg(legs.getJSONObject(j), iso));
            result.add(new Journey(
                    first.getJSONObject("line").optString("name", "?"),
                    first.getJSONObject("line").optString("product", ""),
                    lines.toString(),
                    origin != null ? shortName(origin.optString("name")) : "",
                    iso.parse(dep).getTime(),
                    iso.parse(arr).getTime(),
                    transit.size() - 1,
                    first.isNull("departureDelay") ? 0 : Math.round(first.optInt("departureDelay") / 60f),
                    cancelled,
                    allLegs));
        }
        return result;
    }

    private static Leg parseLeg(JSONObject leg, SimpleDateFormat iso) throws Exception {
        JSONObject line = leg.optJSONObject("line");
        String dep = leg.isNull("departure") ? leg.optString("plannedDeparture") : leg.optString("departure");
        String arr = leg.isNull("arrival") ? leg.optString("plannedArrival") : leg.optString("arrival");
        return new Leg(
                line == null ? null : line.optString("name", "?"),
                line == null ? "" : line.optString("product", ""),
                shortName(leg.optString("direction")),
                placeName(leg.optJSONObject("origin"), "Mein Standort"),
                placeName(leg.optJSONObject("destination"), "Ziel"),
                iso.parse(dep).getTime(),
                iso.parse(arr).getTime(),
                leg.isNull("departureDelay") ? 0 : Math.round(leg.optInt("departureDelay") / 60f),
                leg.isNull("arrivalDelay") ? 0 : Math.round(leg.optInt("arrivalDelay") / 60f),
                leg.isNull("departurePlatform") ? "" : leg.optString("departurePlatform"),
                leg.isNull("arrivalPlatform") ? "" : leg.optString("arrivalPlatform"),
                leg.optInt("distance"),
                leg.optBoolean("cancelled"));
    }

    /** Haltestellenname; freie Orte (Adresse/Standort) heißen so, wie angegeben. */
    private static String placeName(JSONObject place, String fallback) {
        if (place == null) return fallback;
        if ("stop".equals(place.optString("type"))) return shortName(place.optString("name"));
        return fallback;
    }

    private static String shortName(String name) {
        return name.replace(" (Berlin)", "").replaceFirst("^S\\+U ", "");
    }

    private static String get(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(10000);
        c.setReadTimeout(15000);
        try {
            int code = c.getResponseCode();
            if (code != 200) throw new Exception("BVG-Schnittstelle antwortet nicht (" + code + ")");
            StringBuilder sb = new StringBuilder();
            try (BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), "UTF-8"))) {
                String line;
                while ((line = r.readLine()) != null) sb.append(line);
            }
            return sb.toString();
        } finally {
            c.disconnect();
        }
    }
}
