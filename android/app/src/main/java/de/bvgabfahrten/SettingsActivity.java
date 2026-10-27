package de.bvgabfahrten;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.os.Bundle;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

/** Einstellungen des Widgets: Haltestellen wählen, nach Linien und Richtungen filtern. */
public class SettingsActivity extends Activity {
    /** true, solange ein Dialog nur durch den Wechsel zum nächsten geschlossen wird. */
    private boolean navigating;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        showMenu();
    }

    private void showMenu() {
        Set<String> filter = Cache.loadFilter(this);
        List<Stop> selection = Cache.loadSelection(this);
        String[] items = {
                selection.isEmpty() ? "Haltestellen wählen" : "Haltestellen wählen (" + selection.size() + " gewählt)",
                filter.isEmpty() ? "Linien & Richtungen filtern" : "Linien & Richtungen filtern (" + filter.size() + " gewählt)",
        };
        show(new AlertDialog.Builder(this)
                .setTitle("Widget einstellen")
                .setItems(items, (d, which) -> {
                    navigating = true;
                    if (which == 0) showStops();
                    else showFilter();
                })
                .setNegativeButton("Abbrechen", null));
    }

    private void showStops() {
        final List<Stop> candidates = new ArrayList<>(Cache.load(this).stops);
        final List<Stop> selection = Cache.loadSelection(this);
        // Gewählte Haltestellen, die nicht mehr in der Nähe-Liste stehen, bleiben wählbar.
        for (Stop sel : selection) {
            boolean known = false;
            for (Stop c : candidates) known |= c.id.equals(sel.id);
            if (!known) candidates.add(sel);
        }

        if (candidates.isEmpty()) {
            show(new AlertDialog.Builder(this)
                    .setTitle("Haltestellen wählen")
                    .setMessage("Noch keine Haltestellen bekannt. Tippe auf ⟳, damit das Widget "
                            + "zuerst Standort und Haltestellen lädt.")
                    .setPositiveButton("Jetzt laden", (d, w) -> refresh())
                    .setNegativeButton("Abbrechen", null));
            return;
        }

        String[] labels = new String[candidates.size()];
        final boolean[] checked = new boolean[candidates.size()];
        for (int i = 0; i < labels.length; i++) {
            Stop s = candidates.get(i);
            labels[i] = s.distance > 0 ? s.name + "  (" + s.distance + " m)" : s.name;
            for (Stop sel : selection) checked[i] |= sel.id.equals(s.id);
        }

        show(new AlertDialog.Builder(this)
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
                .setNegativeButton("Abbrechen", null));
    }

    private void showFilter() {
        // Alle Linie→Richtung-Kombinationen aus dem letzten Abruf, nach Linie sortiert.
        Map<String, String> labelByKey = new TreeMap<>(this::compareKeys);
        for (Departure d : Cache.load(this).departures) labelByKey.put(d.filterKey(), d.line + "  →  " + d.direction);
        final Set<String> current = Cache.loadFilter(this);
        // Aktive Filter, die im letzten Abruf nicht vorkommen, bleiben sichtbar und wählbar.
        for (String key : current) {
            if (!labelByKey.containsKey(key)) {
                int bar = key.indexOf('|');
                labelByKey.put(key, key.substring(0, bar) + "  →  " + key.substring(bar + 1));
            }
        }

        if (labelByKey.isEmpty()) {
            show(new AlertDialog.Builder(this)
                    .setTitle("Linien & Richtungen")
                    .setMessage("Noch keine Abfahrten bekannt. Tippe auf ⟳, damit das Widget zuerst Abfahrten lädt.")
                    .setPositiveButton("Jetzt laden", (d, w) -> refresh())
                    .setNegativeButton("Abbrechen", null));
            return;
        }

        final List<String> keys = new ArrayList<>(labelByKey.keySet());
        String[] labels = new String[keys.size()];
        final boolean[] checked = new boolean[keys.size()];
        for (int i = 0; i < labels.length; i++) {
            labels[i] = labelByKey.get(keys.get(i));
            checked[i] = current.contains(keys.get(i));
        }

        show(new AlertDialog.Builder(this)
                .setTitle("Nur diese Linien & Richtungen")
                .setMultiChoiceItems(labels, checked, (d, which, isChecked) -> checked[which] = isChecked)
                .setPositiveButton("Übernehmen", (d, w) -> {
                    Set<String> chosen = new LinkedHashSet<>();
                    for (int i = 0; i < checked.length; i++) if (checked[i]) chosen.add(keys.get(i));
                    applyFilter(chosen); // nichts gewählt = alles zeigen
                })
                .setNeutralButton("Alle zeigen", (d, w) -> applyFilter(new LinkedHashSet<String>()))
                .setNegativeButton("Abbrechen", null));
    }

    /** Linien natürlich sortieren (U2 vor U12, M5 vor U2 usw.), dann nach Richtung. */
    private int compareKeys(String a, String b) {
        String[] x = a.split("\\|", 2);
        String[] y = b.split("\\|", 2);
        int c = compareLines(x[0], y[0]);
        return c != 0 ? c : x[1].compareTo(y[1]);
    }

    private static int compareLines(String a, String b) {
        String pa = a.replaceAll("[0-9]+$", "");
        String pb = b.replaceAll("[0-9]+$", "");
        int c = pa.compareTo(pb);
        if (c != 0) return c;
        String na = a.substring(pa.length());
        String nb = b.substring(pb.length());
        if (!na.isEmpty() && !nb.isEmpty()) return Integer.compare(Integer.parseInt(na), Integer.parseInt(nb));
        return a.compareTo(b);
    }

    private void applyFilter(Set<String> chosen) {
        Cache.saveFilter(this, chosen);
        WidgetRenderer.updateAll(this); // nur neu zeichnen, kein neuer Abruf nötig
    }

    private void refresh() {
        startActivity(new Intent(this, RefreshActivity.class));
    }

    /** Zeigt den Dialog; die Activity schließt sich, wenn kein weiterer Dialog folgt. */
    private void show(AlertDialog.Builder b) {
        b.setOnDismissListener(d -> {
            if (navigating) navigating = false;
            else finish();
        }).show();
    }
}
