package de.bvgabfahrten;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
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
    private static final int MAX_STOPS = 4;
    private static final int WINDOW_MIN = 40;

    private BvgClient() {}

    static List<Departure> fetch(double lat, double lon) throws Exception {
        JSONArray near = getArray(API + "/locations/nearby?latitude=" + lat + "&longitude=" + lon
                + "&distance=" + RADIUS_M + "&results=" + MAX_STOPS
                + "&stops=true&poi=false&addresses=false");

        final List<String[]> stops = new ArrayList<>(); // {id, Name}
        for (int i = 0; i < near.length(); i++) {
            JSONObject s = near.getJSONObject(i);
            if ("stop".equals(s.optString("type"))) {
                stops.add(new String[]{s.getString("id"), shortName(s.optString("name"))});
            }
        }
        if (stops.isEmpty()) throw new Exception("Keine Haltestelle im Umkreis von " + RADIUS_M + " m");

        ExecutorService pool = Executors.newFixedThreadPool(stops.size());
        try {
            List<Future<JSONArray>> futures = new ArrayList<>();
            for (final String[] s : stops) {
                futures.add(pool.submit(new Callable<JSONArray>() {
                    @Override public JSONArray call() throws Exception {
                        JSONObject r = getObject(API + "/stops/" + s[0] + "/departures?duration=" + WINDOW_MIN
                                + "&linesOfStops=false&remarks=false");
                        return r.getJSONArray("departures");
                    }
                }));
            }
            // Nahe Haltestellen liefern oft dieselben Fahrten: jede Fahrt nur einmal,
            // bei der nächstgelegenen Haltestelle.
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
                            d.optString("direction"),
                            stops.get(i)[1],
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

    private static String shortName(String name) {
        return name.replace(" (Berlin)", "").replaceFirst("^S\\+U ", "");
    }

    private static JSONArray getArray(String url) throws Exception {
        return new JSONArray(get(url));
    }

    private static JSONObject getObject(String url) throws Exception {
        return new JSONObject(get(url));
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
