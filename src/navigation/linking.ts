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

/**
 * Pantallas registradas en el navegador con nombre literal (no están en
 * MAIN_ROUTES). Sin esta lista su URL no se reconocía al recargar (F5) o al
 * usar atrás/adelante del navegador.
 */
const EXTRA_ROUTES = [
  'Warehouses',
  'WarehouseAreas',
  'EditCampaignParticipant',
  'RepartoCampaignDetail',
  'RepartoParticipantDetail',
  'BizlinksEmitirBoleta',
  'BizlinksEmitirNotaCredito',
  'BizlinksEmitirNotaDebito',
  'BizlinksEmitirGuiaRemision',
  'Vehicles',
  'VehicleDetail',
  'Drivers',
  'DriverDetail',
  'Transporters',
  'TransporterDetail',
  'CreateTransporter',
];

const screens: ScreensMap = {
  ...buildScreensMap(AUTH_ROUTES),
  ...buildScreensMap(MAIN_ROUTES),
  ...buildScreensMap(Object.fromEntries(EXTRA_ROUTES.map((r) => [r, r]))),
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

/**
 * `initialRouteName`: al abrir o recargar (F5) una URL profunda en web, React
 * Navigation solo crea esa pantalla y el botón "volver" de la app no tiene a
 * dónde ir. Con esta opción la pantalla inicial (Dashboard/Inicio) queda debajo
 * en la pila, así "volver" siempre funciona. Las rutas que no existen en el
 * navegador actual (p. ej. Dashboard estando en Login) se descartan solas.
 */
export const buildLinking = (
  initialRouteName?: string
): LinkingOptions<Record<string, unknown>> => ({
  prefixes,
  config: {
    ...(initialRouteName ? { initialRouteName } : {}),
    screens,
  },
});

export const linking = buildLinking();

export default linking;
