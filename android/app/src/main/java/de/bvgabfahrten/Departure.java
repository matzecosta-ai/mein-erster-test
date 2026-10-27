package de.bvgabfahrten;

import org.json.JSONException;
import org.json.JSONObject;

/** Eine Abfahrt, wie sie im Widget angezeigt wird. */
final class Departure {
    final String line;
    final String product;
    final String direction;
    final String stopName;
    final long whenMillis;
    final int delayMin;
    final boolean cancelled;

    Departure(String line, String product, String direction, String stopName,
              long whenMillis, int delayMin, boolean cancelled) {
        this.line = line;
        this.product = product;
        this.direction = direction;
        this.stopName = stopName;
        this.whenMillis = whenMillis;
        this.delayMin = delayMin;
        this.cancelled = cancelled;
    }

    /** Schlüssel für den Linien-/Richtungsfilter. */
    String filterKey() {
        return line + "|" + direction;
    }

    JSONObject toJson() throws JSONException {
        return new JSONObject()
                .put("line", line).put("product", product).put("direction", direction)
                .put("stop", stopName).put("when", whenMillis)
                .put("delay", delayMin).put("cancelled", cancelled);
    }

    static Departure fromJson(JSONObject o) {
        return new Departure(o.optString("line"), o.optString("product"), o.optString("direction"),
                o.optString("stop"), o.optLong("when"), o.optInt("delay"), o.optBoolean("cancelled"));
    }
}
