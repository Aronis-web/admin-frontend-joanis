/**
 * Linking configuration for React Navigation.
 *
 * Sincroniza la URL del navegador (en web) y los deep-links (en móvil/desktop)
 * con la pila de navegación. Esto permite que:
 *   - El botón "atrás" del navegador funcione como esperado.
 *   - Recargar la página web mantenga la ruta actual (no vuelve al dashboard).
 *   - Compartir un enlace tipo `/PurchaseDetail?id=123` abra directo esa vista.
 *
 * Convención: el path coincide con el nombre de la ruta (Ej. `Dashboard` →
 * `/Dashboard`). Los parámetros viajan como query-string, sin necesidad de
 * declararlos uno por uno.
 */
import type { LinkingOptions } from '@react-navigation/native';
import { Platform } from 'react-native';
import { AUTH_ROUTES, MAIN_ROUTES } from '@/constants/routes';

type ScreensMap = Record<string, string>;

const buildScreensMap = (routes: Record<string, string>): ScreensMap =>
  Object.values(routes).reduce<ScreensMap>((acc, routeName) => {
    acc[routeName] = routeName;
    return acc;
  }, {});

const screens: ScreensMap = {
  ...buildScreensMap(AUTH_ROUTES),
  ...buildScreensMap(MAIN_ROUTES),
};

/**
 * Prefijos válidos para deep-linking:
 *   - `joanis://` — esquema propio para APK / Electron.
 *   - `https://joanis.app` — dominio público (ajustar cuando exista).
 *   - En web, el prefijo real es la URL del sitio actual; React Navigation lo
 *     detecta automáticamente a partir de `window.location`.
 */
const prefixes = [
  'joanis://',
  'https://joanis.app',
  ...(Platform.OS === 'web' && typeof window !== 'undefined' ? [window.location.origin] : []),
];

export const linking: LinkingOptions<Record<string, unknown>> = {
  prefixes,
  config: {
    screens,
  },
};

export default linking;
