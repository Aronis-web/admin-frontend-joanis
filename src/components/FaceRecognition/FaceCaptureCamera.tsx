import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Animated,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import { colors, spacing, borderRadius } from '@/design-system/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAMERA_SIZE = SCREEN_WIDTH * 0.9;

// Instrucciones para las posiciones de la cara (se ciclan durante la captura)
const FACE_POSITIONS = [
  { angle: 'Frente', icon: '😊', description: 'Mira directamente a la cámara', color: colors.primary[500] },
  { angle: 'Izquierda', icon: '👈', description: 'Gira tu cara ligeramente a la izquierda', color: colors.success[500] },
  { angle: 'Derecha', icon: '👉', description: 'Gira tu cara ligeramente a la derecha', color: colors.warning[500] },
  { angle: 'Arriba', icon: '👆', description: 'Inclina tu cara ligeramente hacia arriba', color: colors.primary[600] },
  { angle: 'Abajo', icon: '👇', description: 'Inclina tu cara ligeramente hacia abajo', color: colors.danger[500] },
  { angle: 'Frente Final', icon: '😊', description: 'Mira directamente a la cámara', color: colors.primary[500] },
];

interface FaceCaptureCameraProps {
  onCaptureComplete: (frames: string[]) => void;
  onCancel: () => void;
  targetFrames?: number; // 100 para registro, 15 para verificación
}

export const FaceCaptureCamera: React.FC<FaceCaptureCameraProps> = ({
  onCaptureComplete,
  onCancel,
  targetFrames = 100,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [currentPositionIndex, setCurrentPositionIndex] = useState(0);
  const [capturedFrames, setCapturedFrames] = useState<string[]>([]);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const cameraRef = useRef<CameraView>(null);
  const positionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCapturingRef = useRef(false);

  // Animaciones para la guía visual
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Solicitar permisos de cámara al montar
  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Limpiar intervalos al desmontar
  useEffect(() => {
    return () => {
      if (positionIntervalRef.current) clearInterval(positionIntervalRef.current);
      if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
    };
  }, []);

  // Animación de pulso para la guía visual
  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    pulseAnimation.start();

    return () => {
      pulseAnimation.stop();
    };
  }, [pulseAnim]);

  // Animación de rotación para indicadores de dirección
  useEffect(() => {
    const currentPosition = FACE_POSITIONS[currentPositionIndex];
    let targetRotation = 0;

    // Determinar rotación según el ángulo
    if (currentPosition.angle === 'Izquierda') {
      targetRotation = -0.2;
    } else if (currentPosition.angle === 'Derecha') {
      targetRotation = 0.2;
    } else if (currentPosition.angle === 'Arriba') {
      targetRotation = -0.15;
    } else if (currentPosition.angle === 'Abajo') {
      targetRotation = 0.15;
    }

    Animated.spring(rotateAnim, {
      toValue: targetRotation,
      useNativeDriver: true,
      friction: 5,
    }).start();
  }, [currentPositionIndex, rotateAnim]);



  // Cambiar entre cámara frontal y trasera
  const toggleCameraFacing = useCallback(() => {
    setFacing((current) => (current === 'front' ? 'back' : 'front'));
  }, []);

  // Capturar una foto
  const capturePhoto = useCallback(async () => {
    if (!cameraRef.current || !isCapturingRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: false,
        skipProcessing: true,
      });

      // Redimensionar y convertir a base64
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 640 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      if (manipulatedImage.base64) {
        const base64Image = `data:image/jpeg;base64,${manipulatedImage.base64}`;
        setCapturedFrames((prev) => {
          const newFrames = [...prev, base64Image];
          console.log(`📸 Foto ${newFrames.length}/${targetFrames} capturada`);

          // Si alcanzamos el objetivo, detener captura
          if (newFrames.length >= targetFrames) {
            stopCapture();
            onCaptureComplete(newFrames);
          }

          return newFrames;
        });
      }
    } catch (error) {
      console.error('Error capturando foto:', error);
    }
  }, [targetFrames, onCaptureComplete, stopCapture]);

  // Iniciar captura automática
  const startCapture = useCallback(async () => {
    if (!cameraRef.current) return;

    try {
      setHasStarted(true);
      setIsCapturing(true);
      isCapturingRef.current = true;
      setCapturedFrames([]);

      // Cambiar posiciones cada 3 segundos
      positionIntervalRef.current = setInterval(() => {
        setCurrentPositionIndex((prev) => (prev + 1) % FACE_POSITIONS.length);
      }, 3000);

      // Capturar fotos automáticamente cada 50ms
      captureIntervalRef.current = setInterval(() => {
        capturePhoto();
      }, 50);

      console.log('📸 Iniciando captura automática de fotos...');
    } catch (error) {
      console.error('Error iniciando captura:', error);
      Alert.alert('Error', 'No se pudo iniciar la captura');
      stopCapture();
    }
  }, [capturePhoto]);

  // Detener captura
  const stopCapture = useCallback(() => {
    isCapturingRef.current = false;

    if (positionIntervalRef.current) {
      clearInterval(positionIntervalRef.current);
      positionIntervalRef.current = null;
    }
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }

    setIsCapturing(false);
  }, []);

  // Cancelar y volver
  const handleCancel = useCallback(() => {
    stopCapture();
    if (hasStarted) {
      Alert.alert('Cancelar', '¿Deseas cancelar? Se perderá el progreso.', [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: onCancel,
        },
      ]);
    } else {
      onCancel();
    }
  }, [hasStarted, onCancel, stopCapture]);

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Solicitando permisos de cámara...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <MaterialIcons name="camera-alt" size={64} color={colors.neutral[400]} />
        <Text style={styles.errorText}>No se otorgaron permisos de cámara</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Solicitar Permisos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onCancel}>
          <Text style={styles.buttonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Obtener la posición actual
  const currentPosition = FACE_POSITIONS[currentPositionIndex];

  return (
    <View style={styles.container}>
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
        >
          {/* Botón para cambiar cámara (solo si no ha iniciado) */}
          {!hasStarted && (
            <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
              <MaterialIcons name="flip-camera-ios" size={32} color="#fff" />
            </TouchableOpacity>
          )}

          {/* Contador de progreso */}
          <View style={styles.topBar}>
            {isCapturing && (
              <View style={styles.captureIndicator}>
                <View style={styles.captureDot} />
                <Text style={styles.captureText}>
                  {capturedFrames.length}/{targetFrames}
                </Text>
              </View>
            )}
          </View>

          {/* Guía visual animada (sin flash) */}
          <View style={styles.guideOverlay}>
            {/* Marco de guía facial con animación de pulso */}
            <Animated.View
              style={[
                styles.faceGuide,
                {
                  transform: [
                    { scale: pulseAnim },
                    { rotate: rotateAnim.interpolate({
                      inputRange: [-1, 1],
                      outputRange: ['-30deg', '30deg'],
                    })},
                  ],
                  borderColor: currentPosition.color,
                },
              ]}
            >
              {/* Esquinas del marco */}
              <View style={[styles.corner, styles.cornerTopLeft, { borderColor: currentPosition.color }]} />
              <View style={[styles.corner, styles.cornerTopRight, { borderColor: currentPosition.color }]} />
              <View style={[styles.corner, styles.cornerBottomLeft, { borderColor: currentPosition.color }]} />
              <View style={[styles.corner, styles.cornerBottomRight, { borderColor: currentPosition.color }]} />
            </Animated.View>

            {/* Indicador de dirección animado */}
            <Animated.View
              style={[
                styles.directionIndicator,
                {
                  backgroundColor: currentPosition.color,
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            >
              <Text style={styles.directionIcon}>{currentPosition.icon}</Text>
            </Animated.View>
          </View>

          {/* Overlay de captura */}
          {isCapturing && (
            <View style={styles.capturingOverlay}>
              <View style={styles.capturingIndicator}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.capturingText}>Capturando fotos...</Text>
                <Text style={styles.capturingSubtext}>{capturedFrames.length}/{targetFrames}</Text>
              </View>
            </View>
          )}
        </CameraView>
      </View>

      {/* Instrucciones dinámicas */}
      <View style={[styles.instructionsContainer, { backgroundColor: currentPosition.color + '20' }]}>
        <View style={styles.instructionHeader}>
          <Text style={styles.instructionIcon}>{currentPosition.icon}</Text>
          <View style={styles.instructionTextContainer}>
            <Text style={[styles.instructionsTitle, { color: currentPosition.color }]}>
              {currentPosition.angle}
            </Text>
            <Text style={styles.instructionsDescription}>
              {isCapturing ? currentPosition.description : 'Presiona Iniciar para comenzar'}
            </Text>
          </View>
        </View>
        {isCapturing && (
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${(capturedFrames.length / targetFrames) * 100}%`,
                  backgroundColor: currentPosition.color,
                },
              ]}
            />
          </View>
        )}
      </View>

      {/* Botones de acción */}
      <View style={styles.actionsContainer}>
        {!hasStarted ? (
          <View style={styles.mainActions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
            >
              <MaterialIcons name="close" size={24} color="#fff" />
              <Text style={styles.buttonText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.startButton]}
              onPress={startCapture}
            >
              <MaterialIcons name="camera-alt" size={32} color="#fff" />
              <Text style={styles.buttonText}>Iniciar Captura</Text>
            </TouchableOpacity>
          </View>
        ) : isCapturing ? (
          <View style={styles.mainActions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
            >
              <MaterialIcons name="close" size={24} color="#fff" />
              <Text style={styles.buttonText}>Cancelar</Text>
            </TouchableOpacity>

            <View style={styles.statusContainer}>
              <View style={styles.captureDot} />
              <Text style={styles.statusText}>Capturando {capturedFrames.length}/{targetFrames}...</Text>
            </View>
          </View>
        ) : (
          <View style={styles.mainActions}>
            <View style={styles.statusContainer}>
              <ActivityIndicator size="small" color={colors.primary[500]} />
              <Text style={styles.statusText}>Finalizando...</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[900],
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraContainer: {
    width: CAMERA_SIZE,
    height: CAMERA_SIZE,
    borderRadius: borderRadius['2xl'],
    overflow: 'hidden',
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  flipButton: {
    position: 'absolute',
    top: spacing[5],
    right: spacing[5],
    backgroundColor: colors.overlay.medium,
    borderRadius: borderRadius.full,
    padding: spacing[2.5],
    zIndex: 10,
  },
  topBar: {
    position: 'absolute',
    top: spacing[5],
    left: spacing[5],
    right: spacing[5],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  captureIndicator: {
    backgroundColor: 'rgba(52, 199, 89, 0.9)',
    borderRadius: borderRadius['2xl'],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  captureDot: {
    width: 12,
    height: 12,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[0],
  },
  captureText: {
    color: colors.neutral[0],
    fontSize: 18,
    fontWeight: 'bold',
  },
  capturingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlay.light,
  },
  capturingIndicator: {
    alignItems: 'center',
    gap: spacing[2.5],
  },
  capturingText: {
    color: colors.neutral[0],
    fontSize: 16,
    fontWeight: '600',
  },
  capturingSubtext: {
    color: colors.neutral[0],
    fontSize: 14,
    opacity: 0.8,
  },
  guideOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  faceGuide: {
    width: CAMERA_SIZE * 0.6,
    height: CAMERA_SIZE * 0.75,
    borderWidth: 3,
    borderRadius: 120,
    borderStyle: 'dashed',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderWidth: 4,
  },
  cornerTopLeft: {
    top: -2,
    left: -2,
    borderBottomWidth: 0,
    borderRightWidth: 0,
    borderTopLeftRadius: borderRadius['2xl'],
  },
  cornerTopRight: {
    top: -2,
    right: -2,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopRightRadius: borderRadius['2xl'],
  },
  cornerBottomLeft: {
    bottom: -2,
    left: -2,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomLeftRadius: borderRadius['2xl'],
  },
  cornerBottomRight: {
    bottom: -2,
    right: -2,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomRightRadius: borderRadius['2xl'],
  },
  directionIndicator: {
    position: 'absolute',
    top: spacing[10],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2.5],
    borderRadius: borderRadius.full,
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  directionIcon: {
    fontSize: 32,
  },
  instructionsContainer: {
    marginTop: spacing[5],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    width: '100%',
    borderRadius: borderRadius.xl,
    marginHorizontal: spacing[5],
  },
  instructionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    marginBottom: spacing[2.5],
  },
  instructionIcon: {
    fontSize: 40,
  },
  instructionTextContainer: {
    flex: 1,
  },
  instructionsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: spacing[1],
  },
  instructionsDescription: {
    color: colors.neutral[0],
    fontSize: 14,
    opacity: 0.9,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: borderRadius.sm,
  },
  actionsContainer: {
    marginTop: spacing[5],
    width: '100%',
    paddingHorizontal: spacing[5],
  },
  mainActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing[4],
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[3.5],
    paddingHorizontal: spacing[6],
    borderRadius: borderRadius.xl,
    gap: spacing[2],
    flex: 1,
  },
  cancelButton: {
    backgroundColor: colors.neutral[500],
    flex: 0.4,
  },
  startButton: {
    backgroundColor: colors.success[500],
    flex: 1,
  },
  buttonDisabled: {
    backgroundColor: colors.neutral[700],
    opacity: 0.5,
  },
  buttonText: {
    color: colors.neutral[0],
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2.5],
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
    paddingVertical: spacing[3.5],
    paddingHorizontal: spacing[5],
    borderRadius: borderRadius.xl,
  },
  statusText: {
    color: colors.success[500],
    fontSize: 14,
    fontWeight: '600',
  },
  loadingText: {
    color: colors.neutral[0],
    fontSize: 16,
    marginTop: spacing[5],
  },
  errorText: {
    color: colors.neutral[0],
    fontSize: 16,
    marginTop: spacing[5],
    marginBottom: spacing[5],
    textAlign: 'center',
  },
});
