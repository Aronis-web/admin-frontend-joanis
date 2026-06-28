/**
 * EtiquetasScreen — Módulo de etiquetas electrónicas (Leeka ESL 1.54_BWRY).
 *
 * Modo "scanner continuo":
 *  - Captura keypresses globales del lector (no requiere foco en input).
 *  - Ciclo: escanea etiqueta → escanea producto → reset automático.
 *  - Todo el render + conexión + envío corre en segundo plano (cola serial).
 *  - El historial de la sesión se muestra abajo para seguimiento.
 *  - Si el producto matchea varios SKUs, se muestra grid con fotos.
 *
 * Nota: precio = `costCents` por ahora (PV vive en perfiles de precio).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View, Image } from 'react-native';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { Body, Caption, Card, Heading, Input, Label } from '@/design-system/components';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { productsApi, Product } from '@/services/api/products';
import { canvasToLeekaBitmap, drawTicket } from '@/utils/esl/eslRender';
import { requestLeekaTag, sendBitmap } from '@/utils/esl/eslBleClient';
import { cleanProductTitle } from '@/utils/esl/cleanProductTitle';
import { DEFAULT_LEEKA_MODEL } from '@/types/esl';
import { logger } from '@/utils/logger';

interface EtiquetasScreenProps {
  navigation: any;
}

type Mode = 'AWAIT_TAG' | 'PAIRING' | 'AWAIT_PRODUCT' | 'SELECTING';

interface HistoryItem {
  id: string;
  tagCode: string;
  productTitle: string;
  productSku: string;
  status: 'sending' | 'done' | 'error';
  message?: string;
  ts: number;
}

const MAX_HISTORY = 50;

function productPriceSoles(product: Product): number {
  const cents = product.costCents ?? product.priceCents ?? 0;
  return cents / 100;
}

function isUserCancel(err: unknown): boolean {
  const e = err as { name?: string; message?: string } | null;
  return (
    !!e &&
    e.name === 'NotFoundError' &&
    (e.message?.includes('cancelled') || e.message?.includes('User')) === true
  );
}

function formatBleError(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { name?: string; message?: string };
    if (e.name === 'NotFoundError') return 'Etiqueta no encontrada o cancelada.';
    if (e.name === 'NetworkError') return 'Conexión BLE perdida.';
    if (e.message) return `${e.name ?? 'Error'}: ${e.message}`;
  }
  return String(err);
}

function randomOriginalPriceStable(seed: string, price: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const pct = 18 + (Math.abs(h) % 21);
  const original = price * (1 + pct / 100);
  const rounded = Math.round(original * 10) / 10;
  const cents = Math.round((rounded - Math.floor(rounded)) * 10) >= 5 ? 0.9 : 0.5;
  return Math.floor(rounded) + cents;
}

export const EtiquetasScreen: React.FC<EtiquetasScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const isWeb = Platform.OS === 'web';

  const [mode, setMode] = useState<Mode>('AWAIT_TAG');
  const [tagCode, setTagCode] = useState('');
  const [candidates, setCandidates] = useState<Product[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [busyCount, setBusyCount] = useState(0);
  const [hint, setHint] = useState<string>('');
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState('');

  // device BLE de la etiqueta actualmente "armada" (esperando producto).
  const pairedDeviceRef = useRef<{ code: string; device: any } | null>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const modeRef = useRef<Mode>('AWAIT_TAG');
  const bufferRef = useRef<string>('');
  const lastKeyRef = useRef<number>(0);
  const queueLockRef = useRef<boolean>(false);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // ---- procesador serial: render + send + disconnect ----
  const processSend = useCallback(
    async (id: string, tag: string, device: any, product: Product) => {
      // esperar turno
      while (queueLockRef.current) {
        await new Promise((r) => setTimeout(r, 50));
      }
      queueLockRef.current = true;
      try {
        if (!offscreenRef.current) {
          offscreenRef.current = document.createElement('canvas');
        }
        const price = productPriceSoles(product);
        const original = randomOriginalPriceStable(product.id, price);
        const discount = Math.max(1, Math.round(((original - price) / original) * 100));
        const { canvas } = drawTicket(
          {
            title: product.title,
            sku: product.sku,
            price,
            originalPrice: original,
            tagCode: tag,
            bannerText: `OFERTA -${discount}%`,
          },
          { canvas: offscreenRef.current }
        );
        const bitmap = canvasToLeekaBitmap(canvas);

        await sendBitmap(device, bitmap, {
          model: DEFAULT_LEEKA_MODEL,
          keepConnected: false,
        });
        setHistory((h) => h.map((it) => (it.id === id ? { ...it, status: 'done' } : it)));
      } catch (err) {
        logger.error('Error enviando ESL', formatBleError(err));
        setHistory((h) =>
          h.map((it) =>
            it.id === id ? { ...it, status: 'error', message: formatBleError(err) } : it
          )
        );
      } finally {
        try {
          device?.gatt?.disconnect?.();
        } catch {
          /* ignore */
        }
        queueLockRef.current = false;
        setBusyCount((c) => Math.max(0, c - 1));
      }
    },
    []
  );

  /** Encola un envío y dispara el procesador. El `device` queda en posesión de la cola. */
  const enqueueSend = useCallback(
    (tag: string, device: any, product: Product) => {
      const id = `${Date.now()}-${product.id}`;
      const item: HistoryItem = {
        id,
        tagCode: tag,
        productTitle: cleanProductTitle(product.title),
        productSku: product.sku,
        status: 'sending',
        ts: Date.now(),
      };
      setHistory((h) => [item, ...h].slice(0, MAX_HISTORY));
      setBusyCount((c) => c + 1);
      void processSend(id, tag, device, product);
    },
    [processSend]
  );

  // ---- emparejar BLE: requiere gesto fresco (la pulsación Enter del lector cuenta) ----
  const pairTag = useCallback(async (tag: string): Promise<any | null> => {
    try {
      const { device } = await requestLeekaTag(tag);
      return device;
    } catch (err) {
      if (!isUserCancel(err)) {
        logger.error('Error emparejando etiqueta', formatBleError(err));
      }
      return null;
    }
  }, []);

  // ---- lookup producto ----
  const lookupProduct = useCallback(async (code: string): Promise<Product[]> => {
    try {
      const res = await productsApi.searchProductsV2({
        q: code,
        limit: 12,
        includePhotos: true,
      });
      return res.results;
    } catch (err) {
      logger.error('Error buscando producto', err);
      return [];
    }
  }, []);

  /** Reset al estado inicial (sin desconectar — el device queda con la cola). */
  const resetToTagMode = useCallback(() => {
    pairedDeviceRef.current = null;
    setTagCode('');
    setMode('AWAIT_TAG');
  }, []);

  /** Selecciona un producto y dispara el envío en background + reset inmediato. */
  const dispatchProduct = useCallback(
    (product: Product) => {
      const tag = pairedDeviceRef.current?.code;
      const device = pairedDeviceRef.current?.device;
      if (!tag || !device) {
        setHint('Sesión BLE perdida. Re-escanea la etiqueta.');
        resetToTagMode();
        return;
      }
      enqueueSend(tag, device, product);
      setHint(`✓ ${cleanProductTitle(product.title)} → LK${tag}`);
      setCandidates([]);
      resetToTagMode();
    },
    [enqueueSend, resetToTagMode]
  );

  // ---- procesamiento de un código escaneado ----
  const handleScanned = useCallback(
    async (raw: string) => {
      const code = raw.trim();
      if (!code) return;

      if (modeRef.current === 'AWAIT_TAG') {
        setHint('');
        setTagCode(code);
        setMode('PAIRING');
        const device = await pairTag(code);
        if (!device) {
          setHint(`No se pudo emparejar LK${code}. Reintenta el escaneo.`);
          setTagCode('');
          setMode('AWAIT_TAG');
          return;
        }
        pairedDeviceRef.current = { code, device };
        setMode('AWAIT_PRODUCT');
        setHint('');
        return;
      }

      if (modeRef.current === 'AWAIT_PRODUCT') {
        const results = await lookupProduct(code);
        if (results.length === 0) {
          setHint(`Producto "${code}" no encontrado. Escanea otro.`);
          return;
        }
        if (results.length === 1) {
          dispatchProduct(results[0]);
          return;
        }
        // múltiples → mostrar selector
        setCandidates(results);
        setMode('SELECTING');
        setHint(`${results.length} coincidencias para "${code}". Toca una.`);
      }
    },
    [pairTag, lookupProduct, dispatchProduct]
  );

  // ---- listener global de teclas (modo scanner) ----
  useEffect(() => {
    if (!isWeb || typeof window === 'undefined') return;
    const onKey = (ev: KeyboardEvent) => {
      // Bloquear lectura mientras emparejamos o el usuario está eligiendo.
      if (modeRef.current === 'SELECTING' || modeRef.current === 'PAIRING') return;
      const t = ev.target as HTMLElement | null;
      const tagName = t?.tagName?.toUpperCase();
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || t?.isContentEditable) {
        return;
      }
      const now = Date.now();
      if (now - lastKeyRef.current > 200) bufferRef.current = '';
      lastKeyRef.current = now;
      if (ev.key === 'Enter') {
        const raw = bufferRef.current;
        bufferRef.current = '';
        if (raw.length >= 3) {
          ev.preventDefault();
          void handleScanned(raw);
        }
        return;
      }
      if (ev.key.length === 1) bufferRef.current += ev.key;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isWeb, handleScanned]);

  const onManualSubmit = useCallback(() => {
    const v = manualValue.trim();
    if (!v) return;
    setManualValue('');
    void handleScanned(v);
  }, [manualValue, handleScanned]);

  const onCancelSelection = useCallback(() => {
    setCandidates([]);
    setMode('AWAIT_PRODUCT');
    setHint('Selección cancelada. Escanea otro producto.');
  }, []);

  /** Botón "Cancelar etiqueta" (descarta la etiqueta armada). */
  const onCancelPairing = useCallback(() => {
    try {
      pairedDeviceRef.current?.device?.gatt?.disconnect?.();
    } catch {
      /* ignore */
    }
    pairedDeviceRef.current = null;
    setTagCode('');
    setCandidates([]);
    setMode('AWAIT_TAG');
    setHint('');
  }, []);

  const onClearHistory = useCallback(() => {
    setHistory((h) => h.filter((it) => it.status === 'sending'));
  }, []);

  // ---- UI: paneles ----
  const stepBanner = useMemo(() => {
    if (mode === 'AWAIT_TAG') {
      return {
        icon: '📷',
        title: 'Escanea la etiqueta',
        sub: 'Apunta el lector al código impreso al pie de la etiqueta física.',
        color: theme.color.brand.primary,
      };
    }
    if (mode === 'PAIRING') {
      return {
        icon: '🔗',
        title: `Conectando LK${tagCode}…`,
        sub: 'Espera mientras se establece la conexión BLE. Lector pausado.',
        color: theme.color.state.warning.border,
      };
    }
    if (mode === 'AWAIT_PRODUCT') {
      return {
        icon: '📦',
        title: 'Escanea el producto',
        sub: `Etiqueta lista: LK${tagCode}. Escanea el código del producto.`,
        color: theme.color.state.success.border,
      };
    }
    return {
      icon: '🔍',
      title: 'Selecciona el producto correcto',
      sub: 'Toca el producto que corresponde.',
      color: theme.color.state.warning.border,
    };
  }, [mode, tagCode, theme]);

  return (
    <ScreenLayout navigation={navigation}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Heading size="large">Etiquetas electrónicas</Heading>
            <Caption color="muted">
              Modo scanner · Leeka 1.54&quot; BWRY · precio = costo
              {busyCount > 0 ? ` · ${busyCount} en envío` : ''}
            </Caption>
          </View>
          {mode === 'AWAIT_PRODUCT' && (
            <Pressable onPress={onCancelPairing} style={styles.resetBtn}>
              <Caption color="muted">✕ Cancelar etiqueta</Caption>
            </Pressable>
          )}
        </View>

        {/* Banner del paso actual */}
        <Card style={{ ...styles.banner, borderColor: stepBanner.color }}>
          <Body style={styles.bannerIcon}>{stepBanner.icon}</Body>
          <Heading size="medium" style={{ color: stepBanner.color }}>
            {stepBanner.title}
          </Heading>
          <Caption color="muted" style={styles.bannerSub}>
            {stepBanner.sub}
          </Caption>
          {(mode === 'AWAIT_TAG' || mode === 'AWAIT_PRODUCT') && (
            <View style={styles.manualBox}>
              {!manualOpen ? (
                <Pressable onPress={() => setManualOpen(true)} style={styles.manualToggle}>
                  <Caption color="muted">✏️ Escribir manualmente</Caption>
                </Pressable>
              ) : (
                <View style={styles.manualRow}>
                  <View style={{ flex: 1 }}>
                    <Input
                      autoFocus
                      value={manualValue}
                      onChangeText={setManualValue}
                      placeholder={
                        mode === 'AWAIT_TAG'
                          ? 'Código de etiqueta (ej. 16637999)'
                          : 'Código / SKU / nombre de producto'
                      }
                      onSubmitEditing={onManualSubmit}
                      returnKeyType="send"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  <Pressable onPress={onManualSubmit} style={styles.manualSendBtn}>
                    <Caption style={{ color: theme.color.text.inverse }}>Enviar</Caption>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setManualOpen(false);
                      setManualValue('');
                    }}
                    style={styles.resetBtn}
                  >
                    <Caption color="muted">✕</Caption>
                  </Pressable>
                </View>
              )}
            </View>
          )}
          {!!hint && (
            <Body
              color={
                hint.startsWith('✓')
                  ? 'success'
                  : hint.startsWith('No') ||
                      hint.startsWith('Producto') ||
                      hint.startsWith('Sesión')
                    ? 'danger'
                    : 'muted'
              }
              style={styles.hint}
            >
              {hint}
            </Body>
          )}
        </Card>

        {/* Selector de candidatos */}
        {mode === 'SELECTING' && candidates.length > 0 && (
          <Card style={styles.card}>
            <View style={styles.selectorHeader}>
              <Heading size="small">Elige el producto</Heading>
              <Pressable onPress={onCancelSelection}>
                <Caption color="muted">✕ Cancelar</Caption>
              </Pressable>
            </View>
            <View style={styles.grid}>
              {candidates.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => dispatchProduct(p)}
                  style={({ pressed }) => [styles.gridItem, pressed && { opacity: 0.7 }]}
                >
                  <View style={styles.gridPhoto}>
                    {p.imageUrl || p.photos?.[0] ? (
                      <Image
                        source={{ uri: p.imageUrl || p.photos?.[0] }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                      />
                    ) : (
                      <Body color="muted">sin foto</Body>
                    )}
                  </View>
                  <Body numberOfLines={2} style={styles.gridTitle}>
                    {cleanProductTitle(p.title)}
                  </Body>
                  <Caption color="muted">
                    {p.sku} · S/ {productPriceSoles(p).toFixed(2)}
                  </Caption>
                </Pressable>
              ))}
            </View>
          </Card>
        )}

        {/* Historial de la sesión */}
        {history.length > 0 && (
          <Card style={styles.card}>
            <View style={styles.selectorHeader}>
              <Heading size="small">Historial ({history.length})</Heading>
              <Pressable onPress={onClearHistory}>
                <Caption color="muted">Limpiar completados</Caption>
              </Pressable>
            </View>
            {history.map((it) => (
              <View key={it.id} style={styles.historyRow}>
                <Body style={styles.historyIcon}>
                  {it.status === 'done' ? '✅' : it.status === 'error' ? '❌' : '⏳'}
                </Body>
                <View style={{ flex: 1 }}>
                  <Body numberOfLines={1}>{it.productTitle}</Body>
                  <Caption color="muted">
                    LK{it.tagCode} · {it.productSku}
                  </Caption>
                  {it.status === 'error' && !!it.message && (
                    <Caption color="danger">{it.message}</Caption>
                  )}
                </View>
              </View>
            ))}
          </Card>
        )}

        {!isWeb && (
          <Card style={styles.card}>
            <Label color="warning">BLE solo disponible en Electron/Web por ahora.</Label>
          </Card>
        )}
      </ScrollView>
    </ScreenLayout>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { padding: 16, gap: 16, paddingBottom: 64 },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    resetBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: theme.color.background.muted,
    },
    banner: { padding: 24, gap: 8, alignItems: 'center', borderWidth: 2 },
    bannerIcon: { fontSize: 48, lineHeight: 56 },
    bannerSub: { textAlign: 'center' },
    hint: { marginTop: 8, textAlign: 'center' },
    card: { padding: 16, gap: 12 },
    selectorHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    gridItem: {
      width: 160,
      gap: 4,
      padding: 8,
      borderRadius: 8,
      backgroundColor: theme.color.background.muted,
    },
    gridPhoto: {
      width: '100%',
      aspectRatio: 1,
      backgroundColor: theme.color.background.subtle,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    gridTitle: { fontWeight: 'bold' },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 6,
    },
    historyIcon: { fontSize: 18, lineHeight: 22, width: 24 },
    manualBox: { width: '100%', marginTop: 12 },
    manualToggle: {
      alignSelf: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: theme.color.background.muted,
    },
    manualRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    manualSendBtn: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 6,
      backgroundColor: theme.color.brand.primary,
    },
  });
