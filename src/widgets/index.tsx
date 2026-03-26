import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { DashboardWidget, widgetTaskHandler } from './DashboardWidget';

// Registrar el widget
export function registerWidgets() {
  registerWidgetTaskHandler(widgetTaskHandler);
}

export { DashboardWidget };
