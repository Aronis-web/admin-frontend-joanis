package com.paneladmin.grit

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import android.app.PendingIntent
import java.text.SimpleDateFormat
import java.util.*

class DashboardWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        // Actualizar cada widget
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onEnabled(context: Context) {
        // Widget habilitado por primera vez
    }

    override fun onDisabled(context: Context) {
        // Último widget deshabilitado
    }

    companion object {
        internal fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            // Crear RemoteViews
            val views = RemoteViews(context.packageName, R.layout.dashboard_widget)

            // Configurar fecha (ayer)
            val calendar = Calendar.getInstance()
            calendar.add(Calendar.DAY_OF_YEAR, -1)
            val dateFormat = SimpleDateFormat("dd/MM/yyyy", Locale("es", "PE"))
            val yesterday = dateFormat.format(calendar.time)
            views.setTextViewText(R.id.widget_date, "Ayer - $yesterday")

            // Configurar valores por defecto
            views.setTextViewText(R.id.widget_ventas, "S/ 0.00")
            views.setTextViewText(R.id.widget_compras, "S/ 0.00")

            // Intent para abrir la app al tocar el widget
            val intent = Intent(context, MainActivity::class.java)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            val pendingIntent = PendingIntent.getActivity(
                context,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_title, pendingIntent)

            // Actualizar el widget
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
