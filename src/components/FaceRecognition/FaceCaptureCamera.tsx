import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Animated,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import Alert from '@/utils/alert';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAMERA_SIZE = SCREEN_WIDTH * 0.9;

// Paleta fija para UI de cámara (presentación dark, independiente del tema)
const CAMERA_BG = '#171717';
const CAMERA_TEXT = '#FFFFFF';
const CAMERA_TEXT_SUBTLE = '#A3A3A3';
const CAMERA_OVERLAY_MEDIUM = 'rgba(0, 0, 0, 0.5)';
const CAMERA_OVERLAY_LIGHT = 'rgba(0, 0, 0, 0.3)';
const CAMERA_BTN_NEUTRAL = '#737373';
const CAMERA_BTN_DISABLED_BG = '#404040';
const POSITION_PRIMARY = '#737373';
const POSITION_PRIMARY_DARK = '#525252';
const POSITION_SUCCESS = '#22C55E';
const POSITION_WARNING = '#F59E0B';
const POSITION_DANGER = '#EF4444';

// Instrucciones para las posiciones de la cara (se ciclan durante la captura)
const FACE_POSITIONS = [
  { angle: 'Frente', icon: '😊', description: 'Mira directamente a la cámara', color: POSITION_PRIMARY },
  { angle: 'Izquierda', icon: '👈', description: 'Gira tu cara ligeramente a la izquierda', color: POSITION_SUCCESS },
  { angle: 'Derecha', icon: '👉', description: 'Gira tu cara ligeramente a la derecha', color: POSITION_WARNING },
  { angle: 'Arriba', icon: '👆', description: 'Inclina tu cara ligeramente hacia arriba', color: POSITION_PRIMARY_DARK },
  { angle: 'Abajo', icon: '👇', description: 'Inclina tu cara ligeramente hacia abajo', color: POSITION_DANGER },
  { angle: 'Frente Final', icon: '😊', description: 'Mira directamente a la cámara', color: POSITION_PRIMARY },
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
  const styles = useThemedStyles(createStyles);
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
        <ActivityIndicator size="large" color={POSITION_PRIMARY} />
        <Text style={styles.loadingText}>Solicitando permisos de cámara...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <MaterialIcons name="camera-alt" size={64} color={CAMERA_TEXT_SUBTLE} />
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
              <ActivityIndicator size="small" color={POSITION_PRIMARY} />
              <Text style={styles.statusText}>Finalizando...</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CAMERA_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraContainer: {
    width: CAMERA_SIZE,
    height: CAMERA_SIZE,
    borderRadius: theme.radii['2xl'],
    overflow: 'hidden',
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  flipButton: {
    position: 'absolute',
    top: theme.space[5],
    right: theme.space[5],
    backgroundColor: CAMERA_OVERLAY_MEDIUM,
    borderRadius: theme.radii.full,
    padding: theme.space[2.5],
    zIndex: 10,
  },
  topBar: {
    position: 'absolute',
    top: theme.space[5],
    left: theme.space[5],
    right: theme.space[5],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  captureIndicator: {
    backgroundColor: 'rgba(52, 199, 89, 0.9)',
    borderRadius: theme.radii['2xl'],
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
  },
  captureDot: {
    width: 12,
    height: 12,
    borderRadius: theme.radii.md,
    backgroundColor: CAMERA_TEXT,
  },
  captureText: {
    color: CAMERA_TEXT,
    fontSize: 18,
    fontWeight: 'bold',
  },
  capturingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CAMERA_OVERLAY_LIGHT,
  },
  capturingIndicator: {
    alignItems: 'center',
    gap: theme.space[2.5],
  },
  capturingText: {
    color: CAMERA_TEXT,
    fontSize: 16,
    fontWeight: '600',
  },
  capturingSubtext: {
    color: CAMERA_TEXT,
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
    borderTopLeftRadius: theme.radii['2xl'],
  },
  cornerTopRight: {
    top: -2,
    right: -2,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopRightRadius: theme.radii['2xl'],
  },
  cornerBottomLeft: {
    bottom: -2,
    left: -2,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomLeftRadius: theme.radii['2xl'],
  },
  cornerBottomRight: {
    bottom: -2,
    right: -2,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomRightRadius: theme.radii['2xl'],
  },
  directionIndicator: {
    position: 'absolute',
    top: theme.space[10],
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[2.5],
    borderRadius: theme.radii.full,
    shadowColor: CAMERA_BG,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  directionIcon: {
    fontSize: 32,
  },
  instructionsContainer: {
    marginTop: theme.space[5],
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
    width: '100%',
    borderRadius: theme.radii.xl,
    marginHorizontal: theme.space[5],
  },
  instructionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[4],
    marginBottom: theme.space[2.5],
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
    marginBottom: theme.space[1],
  },
  instructionsDescription: {
    color: CAMERA_TEXT,
    fontSize: 14,
    opacity: 0.9,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: theme.radii.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.radii.sm,
  },
  actionsContainer: {
    marginTop: theme.space[5],
    width: '100%',
    paddingHorizontal: theme.space[5],
  },
  mainActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.space[4],
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.space[3.5],
    paddingHorizontal: theme.space[6],
    borderRadius: theme.radii.xl,
    gap: theme.space[2],
    flex: 1,
  },
  cancelButton: {
    backgroundColor: CAMERA_BTN_NEUTRAL,
    flex: 0.4,
  },
  startButton: {
    backgroundColor: POSITION_SUCCESS,
    flex: 1,
  },
  buttonDisabled: {
    backgroundColor: CAMERA_BTN_DISABLED_BG,
    opacity: 0.5,
  },
  buttonText: {
    color: CAMERA_TEXT,
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space[2.5],
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
    paddingVertical: theme.space[3.5],
    paddingHorizontal: theme.space[5],
    borderRadius: theme.radii.xl,
  },
  statusText: {
    color: POSITION_SUCCESS,
    fontSize: 14,
    fontWeight: '600',
  },
  loadingText: {
    color: CAMERA_TEXT,
    fontSize: 16,
    marginTop: theme.space[5],
  },
  errorText: {
    color: CAMERA_TEXT,
    fontSize: 16,
    marginTop: theme.space[5],
    marginBottom: theme.space[5],
    textAlign: 'center',
  },
});
