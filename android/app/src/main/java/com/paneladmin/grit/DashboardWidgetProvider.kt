package com.paneladmin.grit

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import android.app.PendingIntent
import android.content.SharedPreferences
import java.text.SimpleDateFormat
import java.util.*

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
            else -> return
        }

        editor.apply()

        // Actualizar todos los widgets
        val appWidgetManager = AppWidgetManager.getInstance(context)
        val appWidgetIds = appWidgetManager.getAppWidgetIds(
            android.content.ComponentName(context, DashboardWidgetProvider::class.java)
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
        val views = RemoteViews(context.packageName, R.layout.dashboard_widget)
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val currentFilter = prefs.getString(PREF_FILTER, FILTER_YESTERDAY) ?: FILTER_YESTERDAY

        // Configurar fecha según filtro
        val (dateText, startDate, endDate) = getDateRange(currentFilter)
        views.setTextViewText(R.id.widget_date, dateText)

        // Configurar botones de filtro
        setupFilterButtons(context, views, appWidgetId, currentFilter)

        // Configurar valores (por ahora valores de ejemplo)
        // TODO: Aquí deberías hacer una llamada a la API para obtener datos reales
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

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun setupFilterButtons(
        context: Context,
        views: RemoteViews,
        appWidgetId: Int,
        currentFilter: String
    ) {
        // Configurar cada botón
        setupFilterButton(context, views, R.id.btn_today, ACTION_FILTER_TODAY,
            currentFilter == FILTER_TODAY, appWidgetId)
        setupFilterButton(context, views, R.id.btn_yesterday, ACTION_FILTER_YESTERDAY,
            currentFilter == FILTER_YESTERDAY, appWidgetId)
        setupFilterButton(context, views, R.id.btn_week, ACTION_FILTER_WEEK,
            currentFilter == FILTER_WEEK, appWidgetId)
        setupFilterButton(context, views, R.id.btn_month, ACTION_FILTER_MONTH,
            currentFilter == FILTER_MONTH, appWidgetId)
    }

    private fun setupFilterButton(
        context: Context,
        views: RemoteViews,
        buttonId: Int,
        action: String,
        isActive: Boolean,
        appWidgetId: Int
    ) {
        val intent = Intent(context, DashboardWidgetProvider::class.java)
        intent.action = action

        val pendingIntent = PendingIntent.getBroadcast(
            context,
            buttonId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        views.setOnClickPendingIntent(buttonId, pendingIntent)

        // Cambiar el fondo según si está activo
        if (isActive) {
            views.setInt(buttonId, "setBackgroundResource", R.drawable.filter_button_active)
            views.setTextColor(buttonId, 0xFFFFFFFF.toInt())
        } else {
            views.setInt(buttonId, "setBackgroundResource", R.drawable.filter_button)
            views.setTextColor(buttonId, 0xFF64748B.toInt())
        }
    }

    private fun getDateRange(filter: String): Triple<String, Date, Date> {
        val calendar = Calendar.getInstance()
        val dateFormat = SimpleDateFormat("dd/MM/yyyy", Locale("es", "PE"))

        return when (filter) {
            FILTER_TODAY -> {
                val today = calendar.time
                Triple("Hoy - ${dateFormat.format(today)}", today, today)
            }
            FILTER_YESTERDAY -> {
                calendar.add(Calendar.DAY_OF_YEAR, -1)
                val yesterday = calendar.time
                Triple("Ayer - ${dateFormat.format(yesterday)}", yesterday, yesterday)
            }
            FILTER_WEEK -> {
                // Esta semana (desde el lunes)
                val dayOfWeek = calendar.get(Calendar.DAY_OF_WEEK)
                val diff = if (dayOfWeek == Calendar.SUNDAY) 6 else dayOfWeek - Calendar.MONDAY
                calendar.add(Calendar.DAY_OF_YEAR, -diff)
                val startOfWeek = calendar.time

                calendar.add(Calendar.DAY_OF_YEAR, 6)
                val endOfWeek = calendar.time

                Triple("Esta Semana", startOfWeek, endOfWeek)
            }
            FILTER_MONTH -> {
                // Este mes
                calendar.set(Calendar.DAY_OF_MONTH, 1)
                val startOfMonth = calendar.time

                calendar.set(Calendar.DAY_OF_MONTH, calendar.getActualMaximum(Calendar.DAY_OF_MONTH))
                val endOfMonth = calendar.time

                Triple("Este Mes", startOfMonth, endOfMonth)
            }
            else -> {
                calendar.add(Calendar.DAY_OF_YEAR, -1)
                val yesterday = calendar.time
                Triple("Ayer - ${dateFormat.format(yesterday)}", yesterday, yesterday)
            }
        }
    }
}
