package de.bvgabfahrten;

import org.json.JSONException;
import org.json.JSONObject;

/** Ein Abschnitt einer Verbindung: Fußweg (line == null) oder Fahrt. */
final class Leg {
    final String line;       // null = Fußweg
    final String product;
    final String direction;
    final String from;
    final String to;
    final long departMillis;
    final long arriveMillis;
    final int departDelayMin;
    final int arriveDelayMin;
    final String departPlatform;
    final String arrivePlatform;
    final int distance;      // Meter, nur Fußweg
    final boolean cancelled;

    Leg(String line, String product, String direction, String from, String to,
        long departMillis, long arriveMillis, int departDelayMin, int arriveDelayMin,
        String departPlatform, String arrivePlatform, int distance, boolean cancelled) {
        this.line = line;
        this.product = product;
        this.direction = direction;
        this.from = from;
        this.to = to;
        this.departMillis = departMillis;
        this.arriveMillis = arriveMillis;
        this.departDelayMin = departDelayMin;
        this.arriveDelayMin = arriveDelayMin;
        this.departPlatform = departPlatform;
        this.arrivePlatform = arrivePlatform;
        this.distance = distance;
        this.cancelled = cancelled;
    }

    boolean isWalk() {
        return line == null;
    }

    JSONObject toJson() throws JSONException {
        return new JSONObject()
                .put("line", line == null ? JSONObject.NULL : line).put("product", product)
                .put("direction", direction).put("from", from).put("to", to)
                .put("depart", departMillis).put("arrive", arriveMillis)
                .put("depDelay", departDelayMin).put("arrDelay", arriveDelayMin)
                .put("depPlatform", departPlatform).put("arrPlatform", arrivePlatform)
                .put("distance", distance).put("cancelled", cancelled);
    }

    static Leg fromJson(JSONObject o) {
        return new Leg(o.isNull("line") ? null : o.optString("line"), o.optString("product"),
                o.optString("direction"), o.optString("from"), o.optString("to"),
                o.optLong("depart"), o.optLong("arrive"), o.optInt("depDelay"), o.optInt("arrDelay"),
                o.optString("depPlatform"), o.optString("arrPlatform"),
                o.optInt("distance"), o.optBoolean("cancelled"));
    }
}
