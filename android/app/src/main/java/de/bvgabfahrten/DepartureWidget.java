package de.bvgabfahrten;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

public class DepartureWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] appWidgetIds) {
        WidgetRenderer.update(context, mgr, appWidgetIds, null);
    }
}
