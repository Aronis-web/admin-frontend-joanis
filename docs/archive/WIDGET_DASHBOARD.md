# Widget de Dashboard para Android

## 📱 Descripción

Widget nativo de Android que muestra el resumen de ventas y compras del día anterior directamente en la pantalla principal del celular.

## ✨ Características

- 📊 **Métricas completas**: Ventas Brutas, Notas de Crédito, Ventas Netas, Compras, Prosegur, Izipay y Top Proveedor
- 🔘 **Filtros interactivos**: Hoy, Ayer, Esta Semana, Este Mes
- 🔄 Se actualiza automáticamente cada 30 minutos
- 📅 Fecha por defecto: Ayer
- 🎨 Diseño moderno con colores del dashboard
- 👆 Al tocar el título, abre la aplicación
- 💾 Guarda el filtro seleccionado entre actualizaciones

## 🚀 Instalación

### 1. Instalar dependencias

```bash
npm install
```

### 2. Compilar la aplicación

```bash
# Generar APK
npx eas-cli build --platform android --profile production

# O compilar localmente
cd android
./gradlew assembleRelease
```

### 3. Instalar en el dispositivo

```bash
# Si compilaste localmente
adb install android/app/build/outputs/apk/release/app-release.apk
```

## 📲 Cómo agregar el widget a la pantalla principal

1. **Mantén presionado** en un espacio vacío de la pantalla principal de tu Android
2. Selecciona **"Widgets"** o **"Añadir widgets"**
3. Busca **"PanelAdminGrit"** en la lista de widgets
4. Arrastra el widget **"Dashboard"** a la pantalla principal
5. Ajusta el tamaño según tus preferencias

## 🎨 Diseño del Widget

El widget muestra:

```
┌─────────────────────────────────┐
│ 📊 ERP-aio      Ayer - 20/12/24 │
├─────────────────────────────────┤
│ [Hoy] [Ayer] [Semana] [Mes]    │ ← Filtros interactivos
├─────────────────────────────────┤
│ 💵 Ventas Brutas │ 📝 N. Crédito│
│ S/ 15,234.50     │ S/ 1,200.00  │
├─────────────────────────────────┤
│ ✅ Ventas Netas  │ 🛒 Compras   │
│ S/ 14,034.50     │ S/ 8,450.00  │
├─────────────────────────────────┤
│ 🏦 Prosegur      │ 💳 Izipay    │
│ S/ 12,034.50     │ S/ 3,200.00  │
├─────────────────────────────────┤
│ 🏆 Top Proveedor                │
│ Proveedor ABC - S/ 2,500.00     │
└─────────────────────────────────┘
```

## 🔧 Configuración

### Tamaño mínimo del widget
- **Ancho**: 320dp (aproximadamente 4 columnas)
- **Alto**: 380dp (aproximadamente 5 filas)

### Frecuencia de actualización
- **Automática**: Cada 30 minutos (1800000 ms)
- **Manual**: Al tocar el widget se abre la app

## 📝 Archivos creados

### React Native / TypeScript
- `src/widgets/DashboardWidget.tsx` - Componente del widget
- `src/widgets/index.tsx` - Registro del widget

### Android Nativo
- `android/app/src/main/java/com/paneladmin/grit/DashboardWidgetProvider.kt` - Provider del widget
- `android/app/src/main/res/xml/dashboard_widget_info.xml` - Configuración del widget
- `android/app/src/main/res/layout/dashboard_widget.xml` - Layout del widget
- `android/app/src/main/res/drawable/widget_background.xml` - Fondo del widget
- `android/app/src/main/res/drawable/card_ventas_background.xml` - Fondo de tarjeta de ventas
- `android/app/src/main/res/drawable/card_compras_background.xml` - Fondo de tarjeta de compras

## 🔄 Actualización de datos

Actualmente el widget muestra valores por defecto (S/ 0.00). Para conectarlo con datos reales:

1. Edita `DashboardWidgetProvider.kt`
2. Implementa la lógica para obtener datos de la API
3. Actualiza los valores en `updateAppWidget()`

### Ejemplo de integración con API:

```kotlin
// En DashboardWidgetProvider.kt
private fun fetchDashboardData(context: Context): DashboardData {
    // Aquí puedes hacer una llamada a tu API
    // Por ahora retorna valores de ejemplo
    return DashboardData(
        ventasTotal = 0.0,
        comprasTotal = 0.0
    )
}
```

## 🐛 Troubleshooting

### El widget no aparece en la lista
- Asegúrate de haber compilado e instalado la app correctamente
- Verifica que el `AndroidManifest.xml` tenga el receiver registrado

### El widget no se actualiza
- Verifica que el `updatePeriodMillis` esté configurado en `dashboard_widget_info.xml`
- Reinicia el dispositivo

### Error al compilar
- Ejecuta `cd android && ./gradlew clean`
- Vuelve a compilar

## 📚 Recursos

- [Android App Widgets Documentation](https://developer.android.com/guide/topics/appwidgets)
- [React Native Android Widget](https://github.com/salRoid/react-native-android-widget)

## 🎯 Próximas mejoras

- [ ] Conectar con API real para obtener datos de ventas y compras
- [ ] Agregar gráfico de tendencia
- [ ] Permitir configurar el período (hoy, ayer, semana)
- [ ] Agregar más métricas (top productos, etc.)
- [ ] Soporte para temas claro/oscuro
