package de.bvgabfahrten;

import org.json.JSONException;
import org.json.JSONObject;

/** Eine Verbindung vom Standort zum Ziel (ab dem ersten Fahrzeug). */
final class Journey {
    final String firstLine;
    final String product;
    final String lines;      // z. B. "U8 → S41"
    final String originStop; // Haltestelle des ersten Fahrzeugs
    final long departMillis; // Abfahrt des ersten Fahrzeugs
    final long arriveMillis;
    final int transfers;
    final int delayMin;
    final boolean cancelled;

    Journey(String firstLine, String product, String lines, String originStop,
            long departMillis, long arriveMillis, int transfers, int delayMin, boolean cancelled) {
        this.firstLine = firstLine;
        this.product = product;
        this.lines = lines;
        this.originStop = originStop;
        this.departMillis = departMillis;
        this.arriveMillis = arriveMillis;
        this.transfers = transfers;
        this.delayMin = delayMin;
        this.cancelled = cancelled;
    }

    JSONObject toJson() throws JSONException {
        return new JSONObject()
                .put("firstLine", firstLine).put("product", product).put("lines", lines)
                .put("origin", originStop).put("depart", departMillis).put("arrive", arriveMillis)
                .put("transfers", transfers).put("delay", delayMin).put("cancelled", cancelled);
    }

    static Journey fromJson(JSONObject o) {
        return new Journey(o.optString("firstLine"), o.optString("product"), o.optString("lines"),
                o.optString("origin"), o.optLong("depart"), o.optLong("arrive"),
                o.optInt("transfers"), o.optInt("delay"), o.optBoolean("cancelled"));
    }
}
