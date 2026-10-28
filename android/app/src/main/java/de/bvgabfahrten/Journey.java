package de.bvgabfahrten;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

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
    final List<Leg> legs;    // alle Abschnitte inkl. Fußwege, für die Detailansicht

    Journey(String firstLine, String product, String lines, String originStop,
            long departMillis, long arriveMillis, int transfers, int delayMin, boolean cancelled,
            List<Leg> legs) {
        this.firstLine = firstLine;
        this.product = product;
        this.lines = lines;
        this.originStop = originStop;
        this.departMillis = departMillis;
        this.arriveMillis = arriveMillis;
        this.transfers = transfers;
        this.delayMin = delayMin;
        this.cancelled = cancelled;
        this.legs = legs;
    }

    JSONObject toJson() throws JSONException {
        JSONArray l = new JSONArray();
        for (Leg leg : legs) l.put(leg.toJson());
        return new JSONObject().put("legs", l)
                .put("firstLine", firstLine).put("product", product).put("lines", lines)
                .put("origin", originStop).put("depart", departMillis).put("arrive", arriveMillis)
                .put("transfers", transfers).put("delay", delayMin).put("cancelled", cancelled);
    }

    static Journey fromJson(JSONObject o) {
        List<Leg> legs = new ArrayList<>();
        JSONArray l = o.optJSONArray("legs");
        if (l != null) {
            for (int i = 0; i < l.length(); i++) {
                try {
                    legs.add(Leg.fromJson(l.getJSONObject(i)));
                } catch (JSONException ignored) {
                }
            }
        }
        return new Journey(o.optString("firstLine"), o.optString("product"), o.optString("lines"),
                o.optString("origin"), o.optLong("depart"), o.optLong("arrive"),
                o.optInt("transfers"), o.optInt("delay"), o.optBoolean("cancelled"), legs);
    }
}
