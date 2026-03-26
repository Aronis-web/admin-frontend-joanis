package com.paneladmin.grit

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import android.app.PendingIntent
import android.content.ComponentName

class DashboardWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val PREFS_NAME = "DashboardWidgetPrefs"
        private const val PREF_FILTER = "filter"
        private const val FILTER_TODAY = "today"
        private const val FILTER_YESTERDAY = "yesterday"
        private const val FILTER_WEEK = "week"
        private const val FILTER_MONTH = "month"

        private const val ACTION_FILTER_TODAY = "com.paneladmin.grit.FILTER_TODAY"
        private const val ACTION_FILTER_YESTERDAY = "com.paneladmin.grit.FILTER_YESTERDAY"
        private const val ACTION_FILTER_WEEK = "com.paneladmin.grit.FILTER_WEEK"
        private const val ACTION_FILTER_MONTH = "com.paneladmin.grit.FILTER_MONTH"
        private const val ACTION_REFRESH = "com.paneladmin.grit.REFRESH"
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val editor = prefs.edit()

        when (intent.action) {
            ACTION_FILTER_TODAY -> editor.putString(PREF_FILTER, FILTER_TODAY)
            ACTION_FILTER_YESTERDAY -> editor.putString(PREF_FILTER, FILTER_YESTERDAY)
            ACTION_FILTER_WEEK -> editor.putString(PREF_FILTER, FILTER_WEEK)
            ACTION_FILTER_MONTH -> editor.putString(PREF_FILTER, FILTER_MONTH)
            ACTION_REFRESH -> {
                // Solo actualizar, sin cambiar filtro
            }
            else -> return
        }

        editor.apply()

        // Actualizar todos los widgets
        val appWidgetManager = AppWidgetManager.getInstance(context)
        val appWidgetIds = appWidgetManager.getAppWidgetIds(
            ComponentName(context, DashboardWidgetProvider::class.java)
        )

        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    private fun updateAppWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val currentFilter = prefs.getString(PREF_FILTER, FILTER_YESTERDAY) ?: FILTER_YESTERDAY

        val views = RemoteViews(context.packageName, R.layout.dashboard_widget)

        // Actualizar texto de fecha según filtro
        val dateText = when (currentFilter) {
            FILTER_TODAY -> "Hoy"
            FILTER_YESTERDAY -> "Ayer"
            FILTER_WEEK -> "Esta Semana"
            FILTER_MONTH -> "Este Mes"
            else -> "Ayer"
        }
        views.setTextViewText(R.id.widget_date, dateText)

        // Configurar botones de filtro
        setupFilterButtons(context, views, currentFilter)

        // Aquí irían las llamadas a la API para obtener datos reales
        // Por ahora, mostramos datos de ejemplo
        views.setTextViewText(R.id.widget_ventas_brutas, "S/ 0.00")
        views.setTextViewText(R.id.widget_notas_credito, "S/ 0.00")
        views.setTextViewText(R.id.widget_ventas_netas, "S/ 0.00")
        views.setTextViewText(R.id.widget_compras, "S/ 0.00")
        views.setTextViewText(R.id.widget_prosegur, "S/ 0.00")
        views.setTextViewText(R.id.widget_izipay, "S/ 0.00")
        views.setTextViewText(R.id.widget_top_proveedor, "Sin datos")

        // Intent para abrir la app
        val intent = Intent(context, MainActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_title, pendingIntent)

        // Configurar botón de actualización
        val refreshIntent = Intent(context, DashboardWidgetProvider::class.java)
        refreshIntent.action = ACTION_REFRESH
        val refreshPendingIntent = PendingIntent.getBroadcast(
            context,
            999,
            refreshIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.btn_refresh, refreshPendingIntent)

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun setupFilterButtons(context: Context, views: RemoteViews, currentFilter: String) {
        // Configurar intents para cada botón
        val todayIntent = Intent(context, DashboardWidgetProvider::class.java).apply {
            action = ACTION_FILTER_TODAY
        }
        val yesterdayIntent = Intent(context, DashboardWidgetProvider::class.java).apply {
            action = ACTION_FILTER_YESTERDAY
        }
        val weekIntent = Intent(context, DashboardWidgetProvider::class.java).apply {
            action = ACTION_FILTER_WEEK
        }
        val monthIntent = Intent(context, DashboardWidgetProvider::class.java).apply {
            action = ACTION_FILTER_MONTH
        }

        // Crear PendingIntents
        val todayPendingIntent = PendingIntent.getBroadcast(
            context, 1, todayIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val yesterdayPendingIntent = PendingIntent.getBroadcast(
            context, 2, yesterdayIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val weekPendingIntent = PendingIntent.getBroadcast(
            context, 3, weekIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val monthPendingIntent = PendingIntent.getBroadcast(
            context, 4, monthIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Asignar PendingIntents a los botones
        views.setOnClickPendingIntent(R.id.btn_today, todayPendingIntent)
        views.setOnClickPendingIntent(R.id.btn_yesterday, yesterdayPendingIntent)
        views.setOnClickPendingIntent(R.id.btn_week, weekPendingIntent)
        views.setOnClickPendingIntent(R.id.btn_month, monthPendingIntent)

        // Actualizar estilos de botones según filtro activo
        val activeBackground = R.drawable.filter_button_active
        val inactiveBackground = R.drawable.filter_button

        views.setInt(R.id.btn_today, "setBackgroundResource",
            if (currentFilter == FILTER_TODAY) activeBackground else inactiveBackground)
        views.setInt(R.id.btn_yesterday, "setBackgroundResource",
            if (currentFilter == FILTER_YESTERDAY) activeBackground else inactiveBackground)
        views.setInt(R.id.btn_week, "setBackgroundResource",
            if (currentFilter == FILTER_WEEK) activeBackground else inactiveBackground)
        views.setInt(R.id.btn_month, "setBackgroundResource",
            if (currentFilter == FILTER_MONTH) activeBackground else inactiveBackground)

        // Actualizar colores de texto
        val activeColor = 0xFFFFFFFF.toInt()
        val inactiveColor = 0xFF64748B.toInt()

        views.setTextColor(R.id.btn_today,
            if (currentFilter == FILTER_TODAY) activeColor else inactiveColor)
        views.setTextColor(R.id.btn_yesterday,
            if (currentFilter == FILTER_YESTERDAY) activeColor else inactiveColor)
        views.setTextColor(R.id.btn_week,
            if (currentFilter == FILTER_WEEK) activeColor else inactiveColor)
        views.setTextColor(R.id.btn_month,
            if (currentFilter == FILTER_MONTH) activeColor else inactiveColor)
    }
}
