import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image as RNImage,
  LayoutChangeEvent,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import * as ImageManipulator from 'expo-image-manipulator';

import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

const MAX_SCALE = 6;
const MAX_OUTPUT = 1800;

interface ImageCropModalProps {
  visible: boolean;
  /** URL/URI de la imagen a recortar (remota, `data:` o local). */
  imageUri: string | null;
  title?: string;
  onCancel: () => void;
  /** Devuelve una uri/data-uri ya recortada a 1:1. */
  onConfirm: (croppedUri: string) => void;
}

/** Recorta en web usando un `<canvas>` a partir de la región en px de la fuente. */
const cropWeb = (uri: string, originX: number, originY: number, size: number): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const output = Math.min(Math.round(size), MAX_OUTPUT);
        const canvas = document.createElement('canvas');
        canvas.width = output;
        canvas.height = output;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(uri);
          return;
        }
        ctx.drawImage(img, originX, originY, size, size, 0, 0, output, output);
        resolve(canvas.toDataURL('image/jpeg', 0.95));
      } catch {
        // Canvas "tainted" por CORS: devolvemos la original sin romper.
        resolve(uri);
      }
    };
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
    img.src = uri;
  });

/**
 * Modal de recorte manual 1:1. El usuario encuadra el producto con pan + zoom
 * dentro de un marco cuadrado y confirma. Funciona en web y nativo.
 */
export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  visible,
  imageUri,
  title = 'Encuadrar foto',
  onCancel,
  onConfirm,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [viewport, setViewport] = useState(0);
  const [imgSize, setImgSize] = useState<{ width: number; height: number } | null>(null);
  // URI efectiva usada para mostrar y recortar. En nativo puede ser una copia con
  // la orientación EXIF ya "horneada" para que medidas y recorte coincidan.
  const [workingUri, setWorkingUri] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Valores base compartidos para acotar el pan dentro de los worklets.
  const dispW = useSharedValue(0);
  const dispH = useSharedValue(0);
  const vpSize = useSharedValue(0);

  // baseScale: la dimensión menor de la imagen llena exactamente el marco (cover).
  const baseScale = useMemo(() => {
    if (!imgSize || !viewport) return 0;
    return viewport / Math.min(imgSize.width, imgSize.height);
  }, [imgSize, viewport]);

  const displayed = useMemo(() => {
    if (!imgSize || !baseScale) return null;
    return { width: imgSize.width * baseScale, height: imgSize.height * baseScale };
  }, [imgSize, baseScale]);

  const resetTransform = useCallback(() => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, [scale, savedScale, translateX, translateY, savedTranslateX, savedTranslateY]);

  // Resuelve el tamaño natural de la imagen al abrir.
  useEffect(() => {
    if (!visible || !imageUri) {
      setImgSize(null);
      setWorkingUri(null);
      return;
    }
    let cancelled = false;
    resetTransform();

    const measure = (uri: string) => {
      RNImage.getSize(
        uri,
        (width, height) => {
          if (cancelled) return;
          setWorkingUri(uri);
          setImgSize({ width, height });
        },
        () => {
          if (cancelled) return;
          setWorkingUri(uri);
          setImgSize(null);
        }
      );
    };

    if (Platform.OS === 'web') {
      measure(imageUri);
    } else {
      // Nativo (Android/iOS): re-encodamos la imagen sin operaciones para "hornear"
      // la orientación EXIF. Así las dimensiones reportadas y el sistema de
      // coordenadas del recorte coinciden con lo que se muestra. Sin esto, en
      // Android el recorte quedaba desplazado y ampliado (solo una porción).
      (async () => {
        try {
          const normalized = await ImageManipulator.manipulateAsync(imageUri, [], {
            compress: 1,
            format: ImageManipulator.SaveFormat.JPEG,
          });
          if (cancelled) return;
          setWorkingUri(normalized.uri);
          setImgSize({ width: normalized.width, height: normalized.height });
        } catch {
          if (!cancelled) measure(imageUri);
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [visible, imageUri, resetTransform]);

  // Sincroniza los shared values usados para acotar el pan.
  useEffect(() => {
    vpSize.value = viewport;
    dispW.value = displayed?.width ?? 0;
    dispH.value = displayed?.height ?? 0;
  }, [viewport, displayed, vpSize, dispW, dispH]);

  const onCropAreaLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const side = Math.floor(Math.min(width, height));
    setViewport((prev) => (prev === side ? prev : side));
  }, []);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      const next = savedScale.value * event.scale;
      scale.value = Math.min(Math.max(next, 1), MAX_SCALE);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      const maxX = Math.max(0, (dispW.value * scale.value - vpSize.value) / 2);
      const maxY = Math.max(0, (dispH.value * scale.value - vpSize.value) / 2);
      translateX.value = Math.min(Math.max(translateX.value, -maxX), maxX);
      translateY.value = Math.min(Math.max(translateY.value, -maxY), maxY);
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const panGesture = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      const maxX = Math.max(0, (dispW.value * scale.value - vpSize.value) / 2);
      const maxY = Math.max(0, (dispH.value * scale.value - vpSize.value) / 2);
      translateX.value = Math.min(
        Math.max(savedTranslateX.value + event.translationX, -maxX),
        maxX
      );
      translateY.value = Math.min(
        Math.max(savedTranslateY.value + event.translationY, -maxY),
        maxY
      );
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  // Zoom por botones (imprescindible en escritorio/web donde no hay pellizco).
  const applyZoom = useCallback(
    (factor: number) => {
      const next = Math.min(Math.max(scale.value * factor, 1), MAX_SCALE);
      scale.value = next;
      savedScale.value = next;
      const maxX = Math.max(0, (dispW.value * next - vpSize.value) / 2);
      const maxY = Math.max(0, (dispH.value * next - vpSize.value) / 2);
      translateX.value = Math.min(Math.max(translateX.value, -maxX), maxX);
      translateY.value = Math.min(Math.max(translateY.value, -maxY), maxY);
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    },
    [
      scale,
      savedScale,
      dispW,
      dispH,
      vpSize,
      translateX,
      translateY,
      savedTranslateX,
      savedTranslateY,
    ]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const handleConfirm = useCallback(async () => {
    const sourceUri = workingUri || imageUri;
    if (!sourceUri || !imgSize || !baseScale) {
      onCancel();
      return;
    }
    try {
      setProcessing(true);
      const s = scale.value;
      const tx = translateX.value;
      const ty = translateY.value;

      // Región cuadrada del marco expresada en px de la imagen fuente.
      const cropSize = viewport / (baseScale * s);
      let originX = imgSize.width / 2 - (viewport / 2 + tx) / (baseScale * s);
      let originY = imgSize.height / 2 - (viewport / 2 + ty) / (baseScale * s);

      originX = Math.max(0, Math.min(originX, imgSize.width - cropSize));
      originY = Math.max(0, Math.min(originY, imgSize.height - cropSize));

      if (Platform.OS === 'web') {
        const uri = await cropWeb(sourceUri, originX, originY, cropSize);
        onConfirm(uri);
        return;
      }

      const result = await ImageManipulator.manipulateAsync(
        sourceUri,
        [
          {
            crop: {
              originX: Math.round(originX),
              originY: Math.round(originY),
              width: Math.round(cropSize),
              height: Math.round(cropSize),
            },
          },
        ],
        { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG }
      );
      onConfirm(result.uri || sourceUri);
    } catch {
      // Si algo falla, entregamos la original para no bloquear al usuario.
      onConfirm(sourceUri);
    } finally {
      setProcessing(false);
    }
  }, [
    imageUri,
    workingUri,
    imgSize,
    baseScale,
    viewport,
    scale,
    translateX,
    translateY,
    onConfirm,
    onCancel,
  ]);

  const ready = !!imgSize && !!displayed && !!workingUri && viewport > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <TouchableOpacity style={styles.closeButton} onPress={onCancel} disabled={processing}>
            <Text style={styles.closeText}>Cancelar</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>Arrastra y pellizca para encuadrar el producto (1:1)</Text>

        <GestureHandlerRootView style={styles.cropOuter}>
          <View style={styles.cropArea} onLayout={onCropAreaLayout}>
            {ready ? (
              <GestureDetector gesture={composedGesture}>
                <Animated.View style={styles.gestureFill}>
                  <Animated.Image
                    source={{ uri: workingUri! }}
                    style={[
                      {
                        width: displayed!.width,
                        height: displayed!.height,
                      },
                      animatedStyle,
                    ]}
                    resizeMode="cover"
                  />
                </Animated.View>
              </GestureDetector>
            ) : (
              <ActivityIndicator color={theme.color.brand.accent} />
            )}
            {/* Marco guía */}
            <View pointerEvents="none" style={styles.frameOverlay} />
          </View>
        </GestureHandlerRootView>

        <View style={styles.zoomRow}>
          <TouchableOpacity
            style={styles.zoomButton}
            onPress={() => applyZoom(1 / 1.25)}
            disabled={!ready || processing}
          >
            <Text style={styles.zoomButtonText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.zoomLabel}>Zoom</Text>
          <TouchableOpacity
            style={styles.zoomButton}
            onPress={() => applyZoom(1.25)}
            disabled={!ready || processing}
          >
            <Text style={styles.zoomButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.secondaryButton} onPress={onCancel} disabled={processing}>
            <Text style={styles.secondaryButtonText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, (!ready || processing) && styles.buttonDisabled]}
            onPress={() => void handleConfirm()}
            disabled={!ready || processing}
          >
            {processing ? (
              <ActivityIndicator size="small" color={theme.color.text.inverse} />
            ) : (
              <Text style={styles.primaryButtonText}>Usar recorte</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: theme.color.overlay.strong,
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.space[2],
    },
    title: {
      flex: 1,
      color: theme.color.text.inverse,
      fontSize: 16,
      fontWeight: '700',
      marginRight: theme.space[2],
    },
    closeButton: {
      paddingVertical: theme.space[1.5],
      paddingHorizontal: theme.space[3],
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.surface.subtle,
    },
    closeText: {
      color: theme.color.text.heading,
      fontWeight: '700',
      fontSize: 12,
    },
    hint: {
      color: theme.color.text.inverse,
      opacity: 0.85,
      fontSize: 12,
      textAlign: 'center',
      marginBottom: theme.space[2],
    },
    cropOuter: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cropArea: {
      width: '100%',
      aspectRatio: 1,
      maxWidth: 520,
      maxHeight: '100%',
      alignSelf: 'center',
      borderRadius: theme.radii.md,
      overflow: 'hidden',
      backgroundColor: theme.color.overlay.strong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gestureFill: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    frameOverlay: {
      ...StyleSheet.absoluteFillObject,
      borderWidth: 2,
      borderColor: theme.color.brand.accent,
      borderRadius: theme.radii.md,
    },
    zoomRow: {
      marginTop: theme.space[3],
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space[3],
    },
    zoomButton: {
      width: 44,
      height: 44,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.surface.subtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    zoomButtonText: {
      color: theme.color.text.heading,
      fontSize: 22,
      fontWeight: '700',
      lineHeight: 24,
    },
    zoomLabel: {
      color: theme.color.text.inverse,
      opacity: 0.85,
      fontSize: 12,
      fontWeight: '600',
      minWidth: 44,
      textAlign: 'center',
    },
    actions: {
      marginTop: theme.space[3],
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: theme.space[2],
    },
    primaryButton: {
      minWidth: 120,
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[3],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.brand.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: {
      color: theme.color.text.inverse,
      fontWeight: '700',
      fontSize: 12,
    },
    secondaryButton: {
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[3],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.surface.subtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryButtonText: {
      color: theme.color.text.heading,
      fontWeight: '700',
      fontSize: 12,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
  });

export default ImageCropModal;
