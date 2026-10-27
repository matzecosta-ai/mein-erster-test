package de.bvgabfahrten;

import org.json.JSONException;
import org.json.JSONObject;

/** Eine Haltestelle; distance in Metern vom Standort (0, wenn unbekannt). */
final class Stop {
    final String id;
    final String name;
    final int distance;

    Stop(String id, String name, int distance) {
        this.id = id;
        this.name = name;
        this.distance = distance;
    }

    JSONObject toJson() throws JSONException {
        return new JSONObject().put("id", id).put("name", name).put("distance", distance);
    }

    static Stop fromJson(JSONObject o) {
        return new Stop(o.optString("id"), o.optString("name"), o.optInt("distance"));
    }
}
