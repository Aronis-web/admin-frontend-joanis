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
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '@/design-system/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAMERA_SIZE = SCREEN_WIDTH * 0.9;

const RECORDING_DURATION = 5000; // 5 segundos

interface VideoCaptureResult {
  uri: string;
  type: string;
  name: string;
}

interface VideoCaptureCameraProps {
  onCaptureComplete: (video: VideoCaptureResult) => void;
  onCancel: () => void;
}

export const VideoCaptureCamera: React.FC<VideoCaptureCameraProps> = ({
  onCaptureComplete,
  onCancel,
}) => {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const cameraRef = useRef<CameraView>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Animaciones
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Solicitar permisos de cámara y micrófono al montar
  useEffect(() => {
    const requestPermissions = async () => {
      if (!cameraPermission?.granted) {
        await requestCameraPermission();
      }
      if (!microphonePermission?.granted) {
        await requestMicrophonePermission();
      }
    };
    requestPermissions();
  }, [cameraPermission, microphonePermission, requestCameraPermission, requestMicrophonePermission]);

  // Limpiar intervalos al desmontar
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  // Animación de pulso durante grabación
  useEffect(() => {
    if (isRecording) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      return () => pulseAnimation.stop();
    }
  }, [isRecording, pulseAnim]);

  // Cambiar entre cámara frontal y trasera
  const toggleCameraFacing = useCallback(() => {
    setFacing((current) => (current === 'front' ? 'back' : 'front'));
  }, []);

  // Iniciar grabación de video
  const startRecording = useCallback(async () => {
    if (!cameraRef.current) return;

    try {
      setIsRecording(true);
      setCountdown(5);

      // Iniciar animación de progreso
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: RECORDING_DURATION,
        useNativeDriver: false,
      }).start();

      // Countdown visual
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      console.log('🎥 Iniciando grabación de video...');

      // Grabar video
      const video = await cameraRef.current.recordAsync({
        maxDuration: 5,
      });

      console.log('🎥 Video grabado:', video?.uri);

      if (video?.uri) {
        const videoResult: VideoCaptureResult = {
          uri: video.uri,
          type: 'video/mp4',
          name: 'registro.mp4',
        };
        onCaptureComplete(videoResult);
      } else {
        Alert.alert('Error', 'No se pudo grabar el video');
        setIsRecording(false);
        progressAnim.setValue(0);
      }
    } catch (error) {
      console.error('Error grabando video:', error);
      Alert.alert('Error', 'No se pudo grabar el video');
      setIsRecording(false);
      progressAnim.setValue(0);
    }
  }, [onCaptureComplete, progressAnim]);

  // Detener grabación manualmente
  const stopRecording = useCallback(async () => {
    if (cameraRef.current && isRecording) {
      try {
        cameraRef.current.stopRecording();
      } catch (error) {
        console.error('Error deteniendo grabación:', error);
      }
    }

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    setIsRecording(false);
    progressAnim.setValue(0);
  }, [isRecording, progressAnim]);

  // Cancelar y volver
  const handleCancel = useCallback(() => {
    if (isRecording) {
      Alert.alert('Cancelar', '¿Deseas cancelar la grabación?', [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            await stopRecording();
            onCancel();
          },
        },
      ]);
    } else {
      onCancel();
    }
  }, [isRecording, onCancel, stopRecording]);

  if (!cameraPermission || !microphonePermission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Solicitando permisos...</Text>
      </View>
    );
  }

  if (!cameraPermission.granted || !microphonePermission.granted) {
    const handleRequestPermissions = async () => {
      if (!cameraPermission.granted) {
        await requestCameraPermission();
      }
      if (!microphonePermission.granted) {
        await requestMicrophonePermission();
      }
    };

    return (
      <View style={styles.container}>
        <MaterialIcons name="videocam-off" size={64} color={colors.neutral[400]} />
        <Text style={styles.errorText}>
          Se requieren permisos de cámara y micrófono para grabar video
        </Text>
        <Text style={styles.permissionStatus}>
          Cámara: {cameraPermission.granted ? '✅' : '❌'} | Micrófono: {microphonePermission.granted ? '✅' : '❌'}
        </Text>
        <TouchableOpacity style={styles.button} onPress={handleRequestPermissions}>
          <Text style={styles.buttonText}>Solicitar Permisos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onCancel}>
          <Text style={styles.buttonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.cameraContainer}>
        {/* CameraView sin children - expo-camera no soporta children */}
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          mode="video"
        />

        {/* Overlay elements con posicionamiento absoluto */}
        {/* Botón para cambiar cámara (solo si no está grabando) */}
        {!isRecording && (
          <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
            <MaterialIcons name="flip-camera-ios" size={32} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Indicador de grabación */}
        {isRecording && (
          <View style={styles.recordingIndicator}>
            <Animated.View
              style={[
                styles.recordingDot,
                { transform: [{ scale: pulseAnim }] },
              ]}
            />
            <Text style={styles.recordingText}>REC</Text>
            <Text style={styles.countdownText}>{countdown}s</Text>
          </View>
        )}

        {/* Guía visual para el rostro */}
        <View style={styles.guideOverlay}>
          <View
            style={[
              styles.faceGuide,
              { borderColor: isRecording ? colors.danger[500] : colors.primary[500] },
            ]}
          >
            <View style={[styles.corner, styles.cornerTopLeft, { borderColor: isRecording ? colors.danger[500] : colors.primary[500] }]} />
            <View style={[styles.corner, styles.cornerTopRight, { borderColor: isRecording ? colors.danger[500] : colors.primary[500] }]} />
            <View style={[styles.corner, styles.cornerBottomLeft, { borderColor: isRecording ? colors.danger[500] : colors.primary[500] }]} />
            <View style={[styles.corner, styles.cornerBottomRight, { borderColor: isRecording ? colors.danger[500] : colors.primary[500] }]} />
          </View>
        </View>

        {/* Barra de progreso */}
        {isRecording && (
          <View style={styles.progressBarContainer}>
            <Animated.View
              style={[
                styles.progressBar,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        )}
      </View>

      {/* Instrucciones */}
      <View style={styles.instructionsContainer}>
        <MaterialIcons
          name={isRecording ? 'videocam' : 'face'}
          size={32}
          color={isRecording ? colors.danger[500] : colors.primary[500]}
        />
        <Text style={styles.instructionsTitle}>
          {isRecording ? 'Grabando...' : 'Grabar Video de Registro'}
        </Text>
        <Text style={styles.instructionsDescription}>
          {isRecording
            ? 'Mantén tu rostro dentro del marco y mira a la cámara'
            : 'Se grabará un video de 5 segundos para el registro facial'}
        </Text>
      </View>

      {/* Botones de acción */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={handleCancel}
        >
          <MaterialIcons name="close" size={24} color="#fff" />
          <Text style={styles.buttonText}>Cancelar</Text>
        </TouchableOpacity>

        {!isRecording ? (
          <TouchableOpacity
            style={[styles.button, styles.recordButton]}
            onPress={startRecording}
          >
            <MaterialIcons name="videocam" size={32} color="#fff" />
            <Text style={styles.buttonText}>Grabar Video</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.stopButton]}
            onPress={stopRecording}
          >
            <MaterialIcons name="stop" size={32} color="#fff" />
            <Text style={styles.buttonText}>Detener</Text>
          </TouchableOpacity>
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
  recordingIndicator: {
    position: 'absolute',
    top: spacing[5],
    left: spacing[5],
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: borderRadius['2xl'],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    gap: spacing[2],
    zIndex: 10,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.danger[500],
  },
  recordingText: {
    color: colors.danger[500],
    fontSize: 14,
    fontWeight: 'bold',
  },
  countdownText: {
    color: colors.neutral[0],
    fontSize: 18,
    fontWeight: 'bold',
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
  progressBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.danger[500],
  },
  instructionsContainer: {
    marginTop: spacing[5],
    paddingHorizontal: spacing[5],
    alignItems: 'center',
    gap: spacing[2],
  },
  instructionsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.neutral[0],
  },
  instructionsDescription: {
    fontSize: 14,
    color: colors.neutral[300],
    textAlign: 'center',
  },
  actionsContainer: {
    marginTop: spacing[5],
    width: '100%',
    paddingHorizontal: spacing[5],
    flexDirection: 'row',
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
  recordButton: {
    backgroundColor: colors.danger[500],
    flex: 1,
  },
  stopButton: {
    backgroundColor: colors.neutral[700],
    flex: 1,
  },
  buttonText: {
    color: colors.neutral[0],
    fontSize: 16,
    fontWeight: 'bold',
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
    marginBottom: spacing[3],
    textAlign: 'center',
    paddingHorizontal: spacing[5],
  },
  permissionStatus: {
    color: colors.neutral[300],
    fontSize: 14,
    marginBottom: spacing[5],
    textAlign: 'center',
  },
});
