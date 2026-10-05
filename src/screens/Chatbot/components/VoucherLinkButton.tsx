/**
 * Botón "🧾 Ver voucher": pide al backend un enlace firmado temporal (15 min,
 * público, sin token) y muestra la imagen dentro de la app en un visor a
 * pantalla completa con zoom. Como el enlace no necesita cabecera de
 * autorización, `<Image source={{ uri }}>` lo carga igual en Android/iOS, web y
 * Electron. El enlace se pide de nuevo cada vez que se abre (caduca).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Button } from '@/design-system';
import { borderRadius, spacing } from '@/design-system/tokens';
import { chatbotOrdersApi } from '@/services/api/chatbot-orders';
import { logger } from '@/utils/logger';

const errorMessage = (err: unknown): string => {
  const e = err as { response?: { data?: { message?: unknown } } } | null;
  const msg = e?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join('\n');
  if (typeof msg === 'string' && msg.trim()) return msg;
  return 'No se pudo cargar el voucher.';
};

type Phase = 'link' | 'image' | 'ready' | 'error';

export const VoucherLinkButton: React.FC<{
  /** Voucher de la conversación. */
  voucherId?: string;
  /** Voucher guardado en el pedido (si no hay `voucherId`). */
  orderId?: string;
  title?: string;
}> = ({ voucherId, orderId, title = '🧾 Ver voucher' }) => {
  const [open, setOpen] = useState(false);
  if (!voucherId && !orderId) return null;
  return (
    <>
      <Button title={title} variant="outline" size="small" onPress={() => setOpen(true)} />
      {open ? (
        <VoucherViewer voucherId={voucherId} orderId={orderId} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
};

const VoucherViewer: React.FC<{
  voucherId?: string;
  orderId?: string;
  onClose: () => void;
}> = ({ voucherId, orderId, onClose }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('link');
  const [error, setError] = useState('');

  // Zoom (pellizcar), arrastre y doble toque.
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const resetZoom = useCallback(() => {
    scale.value = 1;
    savedScale.value = 1;
    tx.value = 0;
    ty.value = 0;
    savedTx.value = 0;
    savedTy.value = 0;
  }, [scale, savedScale, tx, ty, savedTx, savedTy]);

  /** Pide un enlace nuevo (el anterior puede haber caducado). */
  const loadLink = useCallback(async () => {
    setPhase('link');
    setError('');
    setUrl(null);
    resetZoom();
    try {
      const res = voucherId
        ? await chatbotOrdersApi.voucherLink(voucherId)
        : await chatbotOrdersApi.orderVoucherLink(orderId as string);
      if (!res?.url) throw new Error('Sin enlace');
      setUrl(res.url);
      setPhase('image');
    } catch (err) {
      logger.error('Error obteniendo enlace del voucher', err);
      setError(errorMessage(err));
      setPhase('error');
    }
  }, [voucherId, orderId, resetZoom]);

  useEffect(() => {
    loadLink();
  }, [loadLink]);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, Math.min(savedScale.value * e.scale, 6));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1) {
        tx.value = 0;
        ty.value = 0;
        savedTx.value = 0;
        savedTy.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value <= 1) return;
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const next = scale.value > 1 ? 1 : 2.5;
      scale.value = withTiming(next);
      savedScale.value = next;
      if (next === 1) {
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        savedTx.value = 0;
        savedTy.value = 0;
      }
    });

  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>Voucher</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="Cerrar">
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {url && phase !== 'error' ? (
            <GestureDetector gesture={gesture}>
              <Animated.View style={[styles.imageWrap, animatedStyle]}>
                <Image
                  source={{ uri: url }}
                  style={styles.image}
                  resizeMode="contain"
                  onLoad={() => setPhase('ready')}
                  onError={() => {
                    setError('No se pudo cargar la imagen del voucher.');
                    setPhase('error');
                  }}
                />
              </Animated.View>
            </GestureDetector>
          ) : null}

          {phase === 'link' || phase === 'image' ? (
            <View style={styles.overlay} pointerEvents="none">
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={styles.hint}>Cargando voucher…</Text>
            </View>
          ) : null}

          {phase === 'error' ? (
            <View style={styles.overlay}>
              <Ionicons name="alert-circle" size={56} color="#FCA5A5" />
              <Text style={styles.hint}>{error || 'No se pudo cargar el voucher.'}</Text>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => loadLink()}>
                <Text style={styles.outlineBtnText}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={styles.footer}>
          {phase === 'ready' ? (
            <Text style={styles.hint}>Pellizca para hacer zoom · doble toque para acercar</Text>
          ) : null}
          <TouchableOpacity style={styles.outlineBtn} onPress={onClose}>
            <Text style={styles.outlineBtnText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[8],
    paddingBottom: spacing[3],
  },
  title: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  body: { flex: 1, overflow: 'hidden' },
  imageWrap: { flex: 1 },
  image: { width: '100%', height: '100%' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[6],
  },
  footer: {
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[6],
  },
  hint: { color: '#D1D5DB', fontSize: 13, textAlign: 'center' },
  outlineBtn: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  outlineBtnText: { color: '#FFFFFF', fontWeight: '700' },
});
