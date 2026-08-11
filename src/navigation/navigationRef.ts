/**
 * Referencia global al NavigationContainer.
 * Permite despachar acciones desde utilidades (fuera de componentes) —
 * por ejemplo, remount de la ruta actual desde el botón universal de recarga.
 */
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<any>();

export default navigationRef;
