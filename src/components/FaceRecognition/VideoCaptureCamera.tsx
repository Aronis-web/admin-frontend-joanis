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
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import Alert from '@/utils/alert';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAMERA_SIZE = SCREEN_WIDTH * 0.9;

const RECORDING_DURATION = 10000; // 10 segundos
const MAX_VIDEO_DURATION_SECONDS = 10; // 10 segundos

// Paleta fija para UI de cámara (presentación dark, independiente del tema)
const CAMERA_BG = '#171717';
const CAMERA_TEXT = '#FFFFFF';
const CAMERA_TEXT_MUTED = '#D4D4D4';
const CAMERA_TEXT_SUBTLE = '#A3A3A3';
const CAMERA_OVERLAY_MEDIUM = 'rgba(0, 0, 0, 0.5)';
const CAMERA_BTN_NEUTRAL = '#737373';
const CAMERA_BTN_STOP = '#404040';
const POSITION_PRIMARY = '#737373';
const POSITION_DANGER = '#EF4444';

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
  const styles = useThemedStyles(createStyles);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const cameraRef = useRef<CameraView>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const stopTimerRef = useRef<NodeJS.Timeout | null>(null);

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
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
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
      setCountdown(10);

      // Iniciar animación de progreso
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: RECORDING_DURATION,
        useNativeDriver: false,
      }).start();

      // Countdown visual (5, 4, 3, 2, 1)
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

      console.log('🎥 Iniciando grabación de video (max ' + MAX_VIDEO_DURATION_SECONDS + 's)...');

      // Crear una promesa que se resuelve cuando el timer termina
      const timerPromise = new Promise<void>((resolve) => {
        stopTimerRef.current = setTimeout(() => {
          console.log('⏱️ Timer de seguridad: Forzando detención de grabación...');
          if (cameraRef.current) {
            try {
              cameraRef.current.stopRecording();
              console.log('✅ stopRecording() llamado exitosamente');
            } catch (e) {
              console.log('Error en stopRecording del timer:', e);
            }
          }
          resolve();
        }, RECORDING_DURATION);
      });

      // Iniciar grabación - NO usar maxDuration ya que no funciona correctamente
      // En su lugar, confiar en el stopRecording() del timer
      const recordPromise = cameraRef.current.recordAsync();

      // Esperar a que termine la grabación (ya sea por el timer o naturalmente)
      const video = await recordPromise;

      // Limpiar timer si el video terminó antes
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }

      // Limpiar countdown
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }

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
      // Limpiar timer en caso de error
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
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
        <ActivityIndicator size="large" color={POSITION_PRIMARY} />
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
        <MaterialIcons name="videocam-off" size={64} color={CAMERA_TEXT_SUBTLE} />
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
              { borderColor: isRecording ? POSITION_DANGER : POSITION_PRIMARY },
            ]}
          >
            <View style={[styles.corner, styles.cornerTopLeft, { borderColor: isRecording ? POSITION_DANGER : POSITION_PRIMARY }]} />
            <View style={[styles.corner, styles.cornerTopRight, { borderColor: isRecording ? POSITION_DANGER : POSITION_PRIMARY }]} />
            <View style={[styles.corner, styles.cornerBottomLeft, { borderColor: isRecording ? POSITION_DANGER : POSITION_PRIMARY }]} />
            <View style={[styles.corner, styles.cornerBottomRight, { borderColor: isRecording ? POSITION_DANGER : POSITION_PRIMARY }]} />
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
          color={isRecording ? POSITION_DANGER : POSITION_PRIMARY}
        />
        <Text style={styles.instructionsTitle}>
          {isRecording ? 'Grabando...' : 'Grabar Video de Registro'}
        </Text>
        <Text style={styles.instructionsDescription}>
          {isRecording
            ? 'Mantén tu rostro dentro del marco y mira a la cámara'
            : 'Se grabará un video de 10 segundos para el registro facial'}
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
  recordingIndicator: {
    position: 'absolute',
    top: theme.space[5],
    left: theme.space[5],
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: theme.radii['2xl'],
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2],
    gap: theme.space[2],
    zIndex: 10,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: POSITION_DANGER,
  },
  recordingText: {
    color: POSITION_DANGER,
    fontSize: 14,
    fontWeight: 'bold',
  },
  countdownText: {
    color: CAMERA_TEXT,
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
    backgroundColor: POSITION_DANGER,
  },
  instructionsContainer: {
    marginTop: theme.space[5],
    paddingHorizontal: theme.space[5],
    alignItems: 'center',
    gap: theme.space[2],
  },
  instructionsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: CAMERA_TEXT,
  },
  instructionsDescription: {
    fontSize: 14,
    color: CAMERA_TEXT_MUTED,
    textAlign: 'center',
  },
  actionsContainer: {
    marginTop: theme.space[5],
    width: '100%',
    paddingHorizontal: theme.space[5],
    flexDirection: 'row',
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
  recordButton: {
    backgroundColor: POSITION_DANGER,
    flex: 1,
  },
  stopButton: {
    backgroundColor: CAMERA_BTN_STOP,
    flex: 1,
  },
  buttonText: {
    color: CAMERA_TEXT,
    fontSize: 16,
    fontWeight: 'bold',
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
    marginBottom: theme.space[3],
    textAlign: 'center',
    paddingHorizontal: theme.space[5],
  },
  permissionStatus: {
    color: CAMERA_TEXT_MUTED,
    fontSize: 14,
    marginBottom: theme.space[5],
    textAlign: 'center',
  },
});
