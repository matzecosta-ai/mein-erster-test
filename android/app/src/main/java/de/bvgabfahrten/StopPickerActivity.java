package de.bvgabfahrten;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.os.Bundle;

import java.util.ArrayList;
import java.util.List;

/** Dialog zur Auswahl der Haltestellen, die das Widget anzeigen soll. */
public class StopPickerActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        final List<Stop> candidates = new ArrayList<>(Cache.load(this).stops);
        final List<Stop> selection = Cache.loadSelection(this);
        // Gewählte Haltestellen, die nicht mehr in der Nähe-Liste stehen, bleiben wählbar.
        for (Stop sel : selection) {
            boolean known = false;
            for (Stop c : candidates) known |= c.id.equals(sel.id);
            if (!known) candidates.add(sel);
        }

        if (candidates.isEmpty()) {
            new AlertDialog.Builder(this)
                    .setTitle("Haltestellen wählen")
                    .setMessage("Noch keine Haltestellen bekannt. Tippe auf ⟳, damit das Widget "
                            + "zuerst Standort und Haltestellen lädt.")
                    .setPositiveButton("Jetzt laden", (d, w) -> refresh())
                    .setNegativeButton("Abbrechen", null)
                    .setOnDismissListener(d -> finish())
                    .show();
            return;
        }

        String[] labels = new String[candidates.size()];
        final boolean[] checked = new boolean[candidates.size()];
        for (int i = 0; i < labels.length; i++) {
            Stop s = candidates.get(i);
            labels[i] = s.distance > 0 ? s.name + "  (" + s.distance + " m)" : s.name;
            for (Stop sel : selection) checked[i] |= sel.id.equals(s.id);
        }

        new AlertDialog.Builder(this)
                .setTitle("Nur diese Haltestellen zeigen")
                .setMultiChoiceItems(labels, checked, (d, which, isChecked) -> checked[which] = isChecked)
                .setPositiveButton("Übernehmen", (d, w) -> {
                    List<Stop> chosen = new ArrayList<>();
                    for (int i = 0; i < checked.length; i++) if (checked[i]) chosen.add(candidates.get(i));
                    Cache.saveSelection(this, chosen); // nichts gewählt = alle in der Nähe
                    refresh();
                })
                .setNeutralButton("Alle in der Nähe", (d, w) -> {
                    Cache.saveSelection(this, new ArrayList<Stop>());
                    refresh();
                })
                .setNegativeButton("Abbrechen", null)
                .setOnDismissListener(d -> finish())
                .show();
    }

    private void refresh() {
        startActivity(new Intent(this, RefreshActivity.class));
    }
}
