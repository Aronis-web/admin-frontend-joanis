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
import { Audio } from 'expo-av';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAMERA_SIZE = SCREEN_WIDTH * 0.9;

// Instrucciones para cada frame con ángulos diferentes
const FRAME_INSTRUCTIONS = [
  { angle: 'Frente', icon: '😊', description: 'Mira directamente a la cámara', color: '#007AFF' },
  { angle: 'Izquierda', icon: '👈', description: 'Gira tu cara ligeramente a la izquierda', color: '#34C759' },
  { angle: 'Derecha', icon: '👉', description: 'Gira tu cara ligeramente a la derecha', color: '#FF9500' },
  { angle: 'Arriba', icon: '👆', description: 'Inclina tu cara ligeramente hacia arriba', color: '#5856D6' },
  { angle: 'Abajo', icon: '👇', description: 'Inclina tu cara ligeramente hacia abajo', color: '#FF2D55' },
  { angle: 'Frente', icon: '😊', description: 'Mira directamente a la cámara nuevamente', color: '#007AFF' },
];

interface FaceCaptureCameraProps {
  onCaptureComplete: (frames: string[]) => void;
  onCancel: () => void;
  targetFrames?: number;
  captureInterval?: number;
}

export const FaceCaptureCamera: React.FC<FaceCaptureCameraProps> = ({
  onCaptureComplete,
  onCancel,
  targetFrames = 6,
  captureInterval = 500,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedFrames, setCapturedFrames] = useState<string[]>([]);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const cameraRef = useRef<CameraView>(null);

  // Animaciones para la guía visual
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Solicitar permisos de cámara al montar
  React.useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

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
    const currentInstruction = FRAME_INSTRUCTIONS[capturedFrames.length % FRAME_INSTRUCTIONS.length];
    let targetRotation = 0;

    // Determinar rotación según el ángulo
    if (currentInstruction.angle === 'Izquierda') {
      targetRotation = -0.2;
    } else if (currentInstruction.angle === 'Derecha') {
      targetRotation = 0.2;
    } else if (currentInstruction.angle === 'Arriba') {
      targetRotation = -0.15;
    } else if (currentInstruction.angle === 'Abajo') {
      targetRotation = 0.15;
    }

    Animated.spring(rotateAnim, {
      toValue: targetRotation,
      useNativeDriver: true,
      friction: 5,
    }).start();
  }, [capturedFrames.length, rotateAnim]);

  // Animación de fade cuando se captura un frame
  const triggerCaptureAnimation = useCallback(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0.3,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim]);

  // Cambiar entre cámara frontal y trasera
  const toggleCameraFacing = useCallback(() => {
    setFacing((current) => (current === 'front' ? 'back' : 'front'));
  }, []);

  // Capturar un frame manualmente
  const captureFrame = useCallback(async () => {
    if (capturedFrames.length >= targetFrames) {
      Alert.alert('Límite alcanzado', `Ya has capturado ${targetFrames} frames`);
      return;
    }

    setIsCapturing(true);
    triggerCaptureAnimation(); // Activar animación de captura

    try {
      // Silenciar el audio del sistema antes de capturar
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
      });

      if (cameraRef.current) {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
          skipProcessing: true,
        });

        if (photo && photo.uri) {
          // Redimensionar imagen para reducir tamaño
          const manipulatedImage = await ImageManipulator.manipulateAsync(
            photo.uri,
            [{ resize: { width: 640 } }],
            { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
          );

          if (manipulatedImage.base64) {
            const base64Image = `data:image/jpeg;base64,${manipulatedImage.base64}`;
            const newFrames = [...capturedFrames, base64Image];
            setCapturedFrames(newFrames);

            // Si alcanzamos el objetivo, mostrar opción de finalizar
            if (newFrames.length >= targetFrames) {
              Alert.alert(
                'Captura completa',
                `Has capturado ${newFrames.length} frames. ¿Deseas finalizar?`,
                [
                  {
                    text: 'Capturar más',
                    style: 'cancel',
                  },
                  {
                    text: 'Finalizar',
                    onPress: () => onCaptureComplete(newFrames),
                  },
                ]
              );
            }
          }
        }
      }
    } catch (error) {
      console.error('Error capturando frame:', error);
      Alert.alert('Error', 'No se pudo capturar la imagen');
    } finally {
      setIsCapturing(false);

      // Restaurar configuración de audio
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: false,
          allowsRecordingIOS: true,
          staysActiveInBackground: false,
        });
      } catch (audioError) {
        console.error('Error restaurando audio:', audioError);
      }
    }
  }, [capturedFrames, targetFrames, onCaptureComplete, triggerCaptureAnimation]);

  // Finalizar captura manualmente
  const handleFinish = useCallback(() => {
    if (capturedFrames.length === 0) {
      Alert.alert('Error', 'Debes capturar al menos 1 frame');
      return;
    }

    if (capturedFrames.length < targetFrames) {
      Alert.alert(
        'Advertencia',
        `Solo has capturado ${capturedFrames.length} de ${targetFrames} frames recomendados. ¿Deseas continuar?`,
        [
          {
            text: 'Cancelar',
            style: 'cancel',
          },
          {
            text: 'Continuar',
            onPress: () => onCaptureComplete(capturedFrames),
          },
        ]
      );
    } else {
      onCaptureComplete(capturedFrames);
    }
  }, [capturedFrames, targetFrames, onCaptureComplete]);

  // Limpiar frames capturados
  const handleClear = useCallback(() => {
    Alert.alert('Limpiar frames', '¿Deseas eliminar todos los frames capturados?', [
      {
        text: 'Cancelar',
        style: 'cancel',
      },
      {
        text: 'Limpiar',
        style: 'destructive',
        onPress: () => setCapturedFrames([]),
      },
    ]);
  }, []);

  // Cancelar y volver
  const handleCancel = useCallback(() => {
    if (capturedFrames.length > 0) {
      Alert.alert('Cancelar', '¿Deseas cancelar? Se perderán los frames capturados.', [
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
  }, [capturedFrames, onCancel]);

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Solicitando permisos de cámara...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <MaterialIcons name="camera-alt" size={64} color="#999" />
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

  // Obtener la instrucción actual
  const currentInstruction = FRAME_INSTRUCTIONS[capturedFrames.length % FRAME_INSTRUCTIONS.length];

  return (
    <View style={styles.container}>
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
        >
          {/* Botón para cambiar cámara */}
          <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
            <MaterialIcons name="flip-camera-ios" size={32} color="#fff" />
          </TouchableOpacity>

          {/* Contador de frames */}
          <View style={styles.frameCounter}>
            <Text style={styles.frameCounterText}>
              {capturedFrames.length}/{targetFrames}
            </Text>
          </View>

          {/* Guía visual animada con overlay de fade */}
          <Animated.View style={[styles.guideOverlay, { opacity: fadeAnim }]}>
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
                  borderColor: currentInstruction.color,
                },
              ]}
            >
              {/* Esquinas del marco */}
              <View style={[styles.corner, styles.cornerTopLeft, { borderColor: currentInstruction.color }]} />
              <View style={[styles.corner, styles.cornerTopRight, { borderColor: currentInstruction.color }]} />
              <View style={[styles.corner, styles.cornerBottomLeft, { borderColor: currentInstruction.color }]} />
              <View style={[styles.corner, styles.cornerBottomRight, { borderColor: currentInstruction.color }]} />
            </Animated.View>

            {/* Indicador de dirección animado */}
            <Animated.View
              style={[
                styles.directionIndicator,
                {
                  backgroundColor: currentInstruction.color,
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            >
              <Text style={styles.directionIcon}>{currentInstruction.icon}</Text>
            </Animated.View>
          </Animated.View>

          {/* Indicador de captura */}
          {isCapturing && (
            <View style={styles.capturingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}
        </CameraView>
      </View>

      {/* Instrucciones dinámicas */}
      <View style={[styles.instructionsContainer, { backgroundColor: currentInstruction.color + '20' }]}>
        <View style={styles.instructionHeader}>
          <Text style={styles.instructionIcon}>{currentInstruction.icon}</Text>
          <View style={styles.instructionTextContainer}>
            <Text style={[styles.instructionsTitle, { color: currentInstruction.color }]}>
              {currentInstruction.angle}
            </Text>
            <Text style={styles.instructionsDescription}>
              {currentInstruction.description}
            </Text>
          </View>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${(capturedFrames.length / targetFrames) * 100}%`,
                backgroundColor: currentInstruction.color,
              },
            ]}
          />
        </View>
      </View>

      {/* Botones de acción */}
      <View style={styles.actionsContainer}>
        <View style={styles.topActions}>
          {capturedFrames.length > 0 && (
            <TouchableOpacity style={styles.actionButton} onPress={handleClear}>
              <MaterialIcons name="delete" size={24} color="#EF4444" />
              <Text style={styles.actionButtonText}>Limpiar</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.mainActions}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={handleCancel}
          >
            <MaterialIcons name="close" size={24} color="#fff" />
            <Text style={styles.buttonText}>Cancelar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.captureButton, isCapturing && styles.buttonDisabled]}
            onPress={captureFrame}
            disabled={isCapturing}
          >
            <MaterialIcons name="camera" size={32} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.finishButton,
              capturedFrames.length === 0 && styles.buttonDisabled,
            ]}
            onPress={handleFinish}
            disabled={capturedFrames.length === 0}
          >
            <MaterialIcons name="check" size={24} color="#fff" />
            <Text style={styles.buttonText}>Finalizar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraContainer: {
    width: CAMERA_SIZE,
    height: CAMERA_SIZE,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  flipButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 30,
    padding: 10,
    zIndex: 10,
  },
  frameCounter: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    zIndex: 10,
  },
  frameCounterText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  capturingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
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
    borderTopLeftRadius: 20,
  },
  cornerTopRight: {
    top: -2,
    right: -2,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopRightRadius: 20,
  },
  cornerBottomLeft: {
    bottom: -2,
    left: -2,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomLeftRadius: 20,
  },
  cornerBottomRight: {
    bottom: -2,
    right: -2,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomRightRadius: 20,
  },
  directionIndicator: {
    position: 'absolute',
    top: 40,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  directionIcon: {
    fontSize: 32,
  },
  instructionsContainer: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 15,
    width: '100%',
    borderRadius: 12,
    marginHorizontal: 20,
  },
  instructionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    marginBottom: 10,
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
    marginBottom: 4,
  },
  instructionsDescription: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  actionsContainer: {
    marginTop: 20,
    width: '100%',
    paddingHorizontal: 20,
  },
  topActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 15,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  actionButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  mainActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 8,
    flex: 1,
  },
  cancelButton: {
    backgroundColor: '#666',
    flex: 0.8,
  },
  captureButton: {
    backgroundColor: '#007AFF',
    width: 70,
    height: 70,
    borderRadius: 35,
    flex: 0,
  },
  finishButton: {
    backgroundColor: '#34C759',
    flex: 0.8,
  },
  buttonDisabled: {
    backgroundColor: '#444',
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 20,
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 20,
    marginBottom: 20,
    textAlign: 'center',
  },
});
