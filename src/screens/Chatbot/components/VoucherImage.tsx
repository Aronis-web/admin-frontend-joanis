/**
 * Imagen de un voucher (comprobante de pago) guardado en almacenamiento privado.
 *
 * Se descarga con el token (`downloadWithAuth`) y se convierte a data URL con
 * FileReader: funciona igual en web y en Android/iOS. (Antes se usaba
 * `URL.createObjectURL`, que en React Native no genera una URI que `<Image>`
 * pueda mostrar, por eso el voucher no se veía en el celular.)
 *
 * - `VoucherThumbnail`: miniatura tocable.
 * - `VoucherViewerModal`: visor a pantalla completa con zoom (pellizcar,
 *   arrastrar y doble toque para volver al tamaño original).
 */
import React from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/design-system';
import { borderRadius, spacing } from '@/design-system/tokens';
import { config } from '@/utils/config';
import { downloadWithAuth } from '@/utils/downloadWithAuth';

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('No se pudo leer la imagen'));
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(blob);
  });

/** Imagen del voucher como data URL (cacheada: miniatura y visor comparten la descarga). */
export const useVoucherImage = (apiPath: string | null) =>
  useQuery<string>({
    queryKey: ['chatbot-voucher-image', apiPath],
    queryFn: async () => blobToDataUrl(await downloadWithAuth(`${config.API_URL}${apiPath}`)),
    enabled: !!apiPath,
    staleTime: 30 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });

export const VoucherThumbnail: React.FC<{
  apiPath: string;
  size?: number;
  onPress: () => void;
}> = ({ apiPath, size = 64, onPress }) => {
  const theme = useTheme();
  const { data, isLoading, isError } = useVoucherImage(apiPath);
  const box = {
    width: size,
    height: size,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: theme.color.border.default,
    backgroundColor: theme.color.background.subtle,
    overflow: 'hidden' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  return (
    <Pressable onPress={onPress} style={box} accessibilityLabel="Ver voucher">
      {data ? (
        <Image source={{ uri: data }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : isLoading ? (
        <ActivityIndicator size="small" color={theme.color.brand.accent} />
      ) : (
        <Ionicons
          name={isError ? 'alert-circle-outline' : 'image-outline'}
          size={22}
          color={theme.color.text.muted}
        />
      )}
    </Pressable>
  );
};

export const VoucherViewerModal: React.FC<{
  apiPath: string | null;
  title?: string;
  onClose: () => void;
}> = ({ apiPath, title = 'Voucher', onClose }) => {
  const { data, isLoading, isError, refetch } = useVoucherImage(apiPath);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const reset = () => {
    scale.value = withTiming(1);
    savedScale.value = 1;
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    savedTx.value = 0;
    savedTy.value = 0;
  };

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

  const close = () => {
    reset();
    onClose();
  };

  return (
    <Modal visible={!!apiPath} animationType="fade" onRequestClose={close} statusBarTranslucent>
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <TouchableOpacity onPress={close} hitSlop={10} accessibilityLabel="Cerrar">
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <View style={styles.body}>
          {isLoading ? (
            <ActivityIndicator size="large" color="#FFFFFF" />
          ) : isError || !data ? (
            <View style={{ alignItems: 'center', gap: spacing[3] }}>
              <Ionicons name="alert-circle" size={56} color="#FCA5A5" />
              <Text style={styles.hint}>No se pudo cargar la imagen del voucher.</Text>
              <TouchableOpacity style={styles.retry} onPress={() => refetch()}>
                <Text style={styles.retryText}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <GestureDetector gesture={gesture}>
              <Animated.View style={[styles.imageWrap, animatedStyle]}>
                <Image source={{ uri: data }} style={styles.image} resizeMode="contain" />
              </Animated.View>
            </GestureDetector>
          )}
        </View>
        <View style={styles.footer}>
          <Text style={styles.hint}>Pellizca para hacer zoom · doble toque para acercar</Text>
          <TouchableOpacity style={styles.retry} onPress={close}>
            <Text style={styles.retryText}>Cerrar</Text>
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
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[8],
    paddingBottom: spacing[3],
  },
  title: { flex: 1, color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  imageWrap: { width: '100%', height: '100%' },
  image: { width: '100%', height: '100%' },
  footer: {
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[6],
  },
  hint: { color: '#D1D5DB', fontSize: 13, textAlign: 'center' },
  retry: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
});
