/**
 * Izipay Capture WebView — implementación NATIVA (Android/iOS).
 *
 * Usa `react-native-webview` con:
 *   - `injectedJavaScriptBeforeContentLoaded` para engancharse antes que el JS del panel.
 *   - Interceptor de fetch/XHR sobre el header Authorization.
 *   - Puentea el token al RN vía `window.ReactNativeWebView.postMessage(...)`.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { logger } from '@/utils/logger';

export const PANEL_URL = 'https://panel.izipay.pe';

const INJECT_SCRIPT = `
(function(){
  if (window.__IZI_HOOKED__) return;
  window.__IZI_HOOKED__ = true;
  var clean = function(v){ return String(v||'').replace(/^Bearer\\s+/i, ''); };
  var post = function(payload){
    try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(payload)); } catch(e){}
  };
  var emit = function(t){
    if (!t || t.length < 20) return;
    if (window.__IZI_LAST__ === t) return;
    window.__IZI_LAST__ = t;
    post({ type: 'token', value: t });
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
  post({ type: 'ready' });
  true;
})();
`;

interface Props {
  onToken: (token: string) => void;
  height?: number | string;
  onHookReady?: (ready: boolean) => void;
}

export const IzipayCaptureWebView: React.FC<Props> = ({ onToken, height = 480, onHookReady }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const webviewRef = useRef<WebView | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);

  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);
  const onHookReadyRef = useRef(onHookReady);
  useEffect(() => {
    onHookReadyRef.current = onHookReady;
  }, [onHookReady]);

  const handleMessage = useCallback((ev: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(ev.nativeEvent.data || '{}');
      if (data.type === 'ready') {
        setReady(true);
        onHookReadyRef.current?.(true);
      } else if (data.type === 'token' && typeof data.value === 'string') {
        const tok = data.value.trim();
        if (tok && tok.length >= 20) onTokenRef.current(tok);
      }
    } catch (err) {
      logger.error('Mensaje webview izipay inválido', err);
    }
  }, []);

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

  const heightStyle = useMemo(
    () => ({ height: typeof height === 'number' ? height : (height as any) }),
    [height]
  );

  return (
    <View style={[styles.container, heightStyle]}>
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

      <WebView
        ref={webviewRef}
        source={{ uri: PANEL_URL }}
        injectedJavaScriptBeforeContentLoaded={INJECT_SCRIPT}
        injectedJavaScript={INJECT_SCRIPT}
        onMessage={handleMessage}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        javaScriptEnabled
        domStorageEnabled
        style={{ flex: 1, backgroundColor: '#fff' }}
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
  });

export default IzipayCaptureWebView;
