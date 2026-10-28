package de.bvgabfahrten;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

/** Startseite der App: kurze Anleitung und Knopf zum Standort-Erlauben. */
public class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        int pad = (int) (24 * getResources().getDisplayMetrics().density);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(pad, pad * 2, pad, pad);
        root.setBackgroundColor(Color.parseColor("#F4F4F2"));

        TextView title = new TextView(this);
        title.setText("BVG-Abfahrten");
        title.setTextSize(24);
        title.setTextColor(Color.parseColor("#1B1B1B"));
        title.setGravity(Gravity.START);
        root.addView(title);

        TextView help = new TextView(this);
        help.setText("So legst du das Widget auf den Startbildschirm:\n\n"
                + "1. Lange auf eine freie Stelle des Startbildschirms tippen\n"
                + "2. „Widgets“ wählen\n"
                + "3. „Abfahrten“ suchen und auf den Startbildschirm ziehen\n\n"
                + "Auf das Widget tippen (oder auf ⟳), um Standort und Abfahrten zu aktualisieren.\n\n"
                + "Das ✕ im Widget setzt alle Auswahlen auf einmal zurück.\n\nAuf die Titelzeile des Widgets tippen, um Haltestellen, Linien und Richtungen auszuwählen oder ein Ziel einzugeben (Verbindung vom aktuellen Standort). Bei einem Ziel zeigt ein Tipp auf eine Verbindung den ganzen Verlauf mit Umstiegen.");
        help.setTextSize(16);
        help.setTextColor(Color.parseColor("#1B1B1B"));
        help.setPadding(0, pad, 0, pad);
        root.addView(help);

        Button go = new Button(this);
        go.setText("Standort erlauben & jetzt laden");
        go.setOnClickListener(v -> startActivity(new Intent(this, RefreshActivity.class)));
        root.addView(go);

        Button reset = new Button(this);
        reset.setText("Alle Auswahlen zurücksetzen");
        reset.setOnClickListener(v -> {
            Cache.clearSettings(this);
            WidgetRenderer.updateAll(this);
            Toast.makeText(this, "Haltestellen, Filter und Ziel zurückgesetzt", Toast.LENGTH_SHORT).show();
        });
        root.addView(reset);

        setContentView(root);
    }
}
