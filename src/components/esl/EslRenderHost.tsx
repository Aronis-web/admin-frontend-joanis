/**
 * Host invisible que mantiene un WebView listo para rasterizar tickets
 * Leeka 1.54_BWRY en Android/iOS. El renderer real corre en `eslRenderHtml.ts`.
 *
 * Uso:
 *   const hostRef = useRef<EslRenderHostHandle>(null);
 *   ...
 *   <EslRenderHost ref={hostRef} />
 *   const bitmap = await hostRef.current!.render(data);
 */

import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import WebView, { WebViewMessageEvent } from 'react-native-webview';

import { ESL_RENDER_HTML } from '@/utils/esl/eslRenderHtml';
import { EslTicketData } from '@/types/esl';
import { logger } from '@/utils/logger';

export interface EslRenderHostHandle {
  /** True una vez el WebView terminó de cargar el script. */
  isReady(): boolean;
  /** Rasteriza y devuelve los 10 000 bytes del frame BWRY. */
  render(data: EslTicketData): Promise<Uint8Array>;
}

type Pending = {
  resolve: (b: Uint8Array) => void;
  reject: (e: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

function base64ToBytes(b64: string): Uint8Array {
  const tbl = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < tbl.length; i++) lookup[tbl.charCodeAt(i)] = i;
  const clean = b64.replace(/=+$/, '');
  const len = Math.floor((clean.length * 3) / 4);
  const out = new Uint8Array(len);
  let oi = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const e0 = lookup[clean.charCodeAt(i)];
    const e1 = lookup[clean.charCodeAt(i + 1)] ?? 0;
    const e2 = lookup[clean.charCodeAt(i + 2)] ?? 0;
    const e3 = lookup[clean.charCodeAt(i + 3)] ?? 0;
    out[oi++] = (e0 << 2) | (e1 >> 4);
    if (i + 2 < clean.length) out[oi++] = ((e1 & 15) << 4) | (e2 >> 2);
    if (i + 3 < clean.length) out[oi++] = ((e2 & 3) << 6) | e3;
  }
  return out;
}

export const EslRenderHost = forwardRef<EslRenderHostHandle>((_props, ref) => {
  const webRef = useRef<WebView | null>(null);
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);
  const pendingRef = useRef<Map<string, Pending>>(new Map());
  const seqRef = useRef(0);

  const sendMessage = useCallback((obj: unknown) => {
    const json = JSON.stringify(obj);
    // injectJavaScript dispara los listeners message/document.message.
    const escaped = json.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    webRef.current?.injectJavaScript(
      `(function(){var d='${escaped}';` +
        `document.dispatchEvent(new MessageEvent('message',{data:d}));` +
        `window.dispatchEvent(new MessageEvent('message',{data:d}));})();true;`
    );
  }, []);

  const onMessage = useCallback((ev: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(ev.nativeEvent.data);
      if (msg.type === 'ready') {
        readyRef.current = true;
        setReady(true);
        return;
      }
      const id = msg.id as string | undefined;
      if (!id) return;
      const p = pendingRef.current.get(id);
      if (!p) return;
      pendingRef.current.delete(id);
      clearTimeout(p.timeout);
      if (msg.type === 'rendered') {
        p.resolve(base64ToBytes(String(msg.base64)));
      } else if (msg.type === 'error') {
        p.reject(new Error(String(msg.message || 'render error')));
      }
    } catch (err) {
      logger.warn('EslRenderHost mensaje inválido', err);
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      isReady: () => readyRef.current,
      render: (data: EslTicketData) => {
        return new Promise<Uint8Array>((resolve, reject) => {
          if (!readyRef.current) {
            reject(new Error('Renderer no está listo'));
            return;
          }
          const id = `r${++seqRef.current}`;
          const timeout = setTimeout(() => {
            pendingRef.current.delete(id);
            reject(new Error('Timeout rasterizando ticket'));
          }, 6000);
          pendingRef.current.set(id, { resolve, reject, timeout });
          sendMessage({ type: 'render', id, data });
        });
      },
    }),
    [sendMessage]
  );

  // En Web no hace falta el WebView (la canvas funciona directo).
  if (Platform.OS === 'web') return null;

  return (
    <View style={styles.host} pointerEvents="none">
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html: ESL_RENDER_HTML }}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        androidLayerType="hardware"
        // Sin interacción ni scroll.
        scrollEnabled={false}
        scalesPageToFit={false}
        // Errores silenciosos al log; no romper UX.
        onError={(e) => logger.error('EslRenderHost WebView error', e.nativeEvent)}
      />
      {!ready /* keep linter happy: variable usage */ && null}
    </View>
  );
});

EslRenderHost.displayName = 'EslRenderHost';

const styles = StyleSheet.create({
  // Visible "off-screen" para que el WebView monte y ejecute JS, pero
  // sin interferir con la UI principal.
  host: {
    position: 'absolute',
    left: -10000,
    top: 0,
    width: 200,
    height: 200,
    opacity: 0,
  },
});
