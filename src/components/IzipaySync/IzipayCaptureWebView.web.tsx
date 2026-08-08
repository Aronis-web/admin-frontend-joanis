/**
 * Izipay Capture WebView — implementación WEB (React Native Web).
 *
 * En Electron: usa el tag <webview> (habilitado con webviewTag: true en main.js).
 *   - Bypassa X-Frame-Options (no es un iframe).
 *   - Inyecta un interceptor de Authorization vía executeJavaScript.
 *   - Captura el token escuchando `console-message` con prefijo `IZI_TOKEN::`.
 *   - Persiste cookies con partition="persist:izipay-panel".
 *
 * En navegador puro: muestra un fallback (los sitios bloquean iframe embed).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { logger } from '@/utils/logger';

export const PANEL_URL = 'https://panel.izipay.pe';

// Script inyectado dentro del <webview> tras dom-ready.
// Hookea fetch/XHR para capturar el header Authorization y lo emite como
// `console.log('IZI_TOKEN::<jwt>')`, que el renderer escucha vía el evento
// `console-message` del <webview>.
const INJECT_SCRIPT = `
(function(){
  if (window.__IZI_HOOKED__) return;
  window.__IZI_HOOKED__ = true;
  var clean = function(v){ return String(v||'').replace(/^Bearer\\s+/i, ''); };
  var emit = function(t){
    if (!t || t.length < 20) return;
    if (window.__IZI_LAST__ === t) return;
    window.__IZI_LAST__ = t;
    try { console.log('IZI_TOKEN::' + t); } catch(e){}
  };
  var of = window.fetch;
  if (of) {
    window.fetch = function(input, init){
      try {
        var a = null;
        if (init && init.headers) {
          if (typeof init.headers.get === 'function') a = init.headers.get('Authorization') || init.headers.get('authorization');
          else a = init.headers['Authorization'] || init.headers['authorization'];
        }
        if (a) emit(clean(a));
      } catch(e){}
      return of.apply(this, arguments);
    };
  }
  var oSet = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function(k,v){
    try { if (/^authorization$/i.test(k)) emit(clean(v)); } catch(e){}
    return oSet.apply(this, arguments);
  };
  try { console.log('IZI_HOOK_READY'); } catch(e){}
})();
`;

const isElectron = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = String(navigator.userAgent || '').toLowerCase();
  return ua.includes('electron');
};

interface Props {
  onToken: (token: string) => void;
  height?: number | string;
  /** Se llama con true cuando se inyecta el hook con éxito. */
  onHookReady?: (ready: boolean) => void;
}

// Tipos mínimos para el elemento <webview> de Electron (no está en JSX.IntrinsicElements por defecto).
type ElectronWebview = HTMLElement & {
  src: string;
  partition: string;
  addEventListener: (type: string, listener: (ev: any) => void) => void;
  removeEventListener: (type: string, listener: (ev: any) => void) => void;
  executeJavaScript: (code: string, userGesture?: boolean) => Promise<any>;
  reload: () => void;
  loadURL: (url: string) => Promise<void>;
  getURL: () => string;
  isLoading: () => boolean;
};

export const IzipayCaptureWebView: React.FC<Props> = ({ onToken, height = 480, onHookReady }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const webviewRef = useRef<ElectronWebview | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [electronAvailable] = useState<boolean>(isElectron);

  // Callback estable (evita re-mounts del webview cuando el padre re-renderiza).
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);
  const onHookReadyRef = useRef(onHookReady);
  useEffect(() => {
    onHookReadyRef.current = onHookReady;
  }, [onHookReady]);

  // ==========================================================================
  // Mount webview element (Electron only)
  // ==========================================================================

  useEffect(() => {
    if (!electronAvailable) return;
    const container = containerRef.current;
    if (!container) return;

    // Creamos el <webview> imperativamente porque React no reconoce el tag.
    const wv = document.createElement('webview') as unknown as ElectronWebview;
    wv.src = PANEL_URL;
    wv.partition = 'persist:izipay-panel';
    // @ts-ignore - atributos custom del tag <webview>
    wv.setAttribute('allowpopups', 'true');
    wv.style.width = '100%';
    wv.style.height = '100%';
    wv.style.border = '0';
    wv.style.display = 'flex';

    const onDomReady = () => {
      setLoading(false);
      wv.executeJavaScript(INJECT_SCRIPT, true).catch((err) => {
        logger.error('Error inyectando hook Izipay en webview', err);
      });
    };

    const onDidStartLoading = () => setLoading(true);
    const onDidStopLoading = () => setLoading(false);
    const onDidFailLoad = (e: any) => {
      // -3 = aborted; ignorar
      if (e && e.errorCode === -3) return;
      logger.error('webview izipay did-fail-load', e);
    };

    const onConsoleMessage = (e: any) => {
      const msg = String(e?.message || '');
      if (msg === 'IZI_HOOK_READY') {
        setReady(true);
        onHookReadyRef.current?.(true);
        return;
      }
      if (msg.startsWith('IZI_TOKEN::')) {
        const tok = msg.slice('IZI_TOKEN::'.length).trim();
        if (tok && tok.length >= 20) {
          onTokenRef.current(tok);
        }
      }
    };

    wv.addEventListener('dom-ready', onDomReady);
    wv.addEventListener('did-start-loading', onDidStartLoading);
    wv.addEventListener('did-stop-loading', onDidStopLoading);
    wv.addEventListener('did-fail-load', onDidFailLoad);
    wv.addEventListener('console-message', onConsoleMessage);

    container.appendChild(wv);
    webviewRef.current = wv;

    return () => {
      try {
        wv.removeEventListener('dom-ready', onDomReady);
        wv.removeEventListener('did-start-loading', onDidStartLoading);
        wv.removeEventListener('did-stop-loading', onDidStopLoading);
        wv.removeEventListener('did-fail-load', onDidFailLoad);
        wv.removeEventListener('console-message', onConsoleMessage);
      } catch {
        /* noop */
      }
      try {
        container.removeChild(wv);
      } catch {
        /* noop */
      }
      webviewRef.current = null;
    };
  }, [electronAvailable]);

  const handleReload = useCallback(() => {
    try {
      webviewRef.current?.reload();
    } catch (err) {
      logger.error('Error recargando webview izipay', err);
    }
  }, []);

  const handleOpenExternal = useCallback(() => {
    Linking.openURL(PANEL_URL).catch((err) => logger.error('Error abriendo panel Izipay', err));
  }, []);

  // ==========================================================================
  // Render
  // ==========================================================================

  const heightStyle = useMemo(
    () => ({ height: typeof height === 'number' ? height : (height as any) }),
    [height]
  );

  if (!electronAvailable) {
    return (
      <View style={[styles.container, heightStyle]}>
        <View style={styles.fallbackBody}>
          <Ionicons name="alert-circle-outline" size={28} color={theme.color.state.warning.text} />
          <Text style={styles.fallbackTitle}>Panel embebido no disponible</Text>
          <Text style={styles.fallbackText}>
            En el navegador web no podemos incrustar panel.izipay.pe (bloqueado por el propio
            panel). Usa la app de escritorio para captura automática, o pega el token manualmente en
            el campo de abajo.
          </Text>
          <TouchableOpacity style={styles.fallbackBtn} onPress={handleOpenExternal}>
            <Ionicons name="open-outline" size={16} color={theme.color.text.body} />
            <Text style={styles.fallbackBtnText}>Abrir panel Izipay en otra pestaña</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, heightStyle]}>
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <View style={styles.toolbarLeft}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: ready ? theme.color.state.success.text : theme.color.text.muted },
            ]}
          />
          <Text style={styles.toolbarText}>
            {loading
              ? 'Cargando panel Izipay…'
              : ready
                ? 'Interceptor activo · loguéate y navega'
                : 'Panel cargado · inyectando interceptor…'}
          </Text>
        </View>
        <View style={styles.toolbarActions}>
          <TouchableOpacity style={styles.toolbarBtn} onPress={handleReload}>
            <Ionicons name="refresh" size={14} color={theme.color.text.body} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarBtn} onPress={handleOpenExternal}>
            <Ionicons name="open-outline" size={14} color={theme.color.text.body} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Contenedor del <webview> imperativo */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          display: 'flex',
          width: '100%',
          minHeight: 0,
          backgroundColor: '#fff',
        }}
      />
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.base,
      overflow: 'hidden',
    },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2],
      backgroundColor: theme.color.surface.subtle,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      gap: theme.space[2],
    },
    toolbarLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      flex: 1,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
    },
    toolbarText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.color.text.body,
    },
    toolbarActions: {
      flexDirection: 'row',
      gap: 4,
    },
    toolbarBtn: {
      padding: 6,
      borderRadius: theme.radii.sm,
      backgroundColor: theme.color.surface.muted,
    },
    fallbackBody: {
      flex: 1,
      padding: theme.space[4],
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space[2],
    },
    fallbackTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    fallbackText: {
      fontSize: 12,
      color: theme.color.text.muted,
      textAlign: 'center',
      lineHeight: 18,
    },
    fallbackBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.surface.muted,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      marginTop: theme.space[2],
    },
    fallbackBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.body,
    },
  });

export default IzipayCaptureWebView;
