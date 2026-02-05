import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { Camera, CameraType } from 'expo-camera';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAMERA_SIZE = SCREEN_WIDTH * 0.9;

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
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedFrames, setCapturedFrames] = useState<string[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const cameraRef = useRef<Camera>(null);
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Solicitar permisos de cámara
  React.useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  // Iniciar captura con countdown
  const startCapture = useCallback(() => {
    setCountdown(3);
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownInterval);
          // Iniciar captura de frames
          setTimeout(() => {
            setCountdown(null);
            beginFrameCapture();
          }, 1000);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Capturar frames automáticamente
  const beginFrameCapture = useCallback(() => {
    setIsCapturing(true);
    const frames: string[] = [];
    let frameCount = 0;

    captureIntervalRef.current = setInterval(async () => {
      if (frameCount >= targetFrames) {
        // Captura completa
        if (captureIntervalRef.current) {
          clearInterval(captureIntervalRef.current);
        }
        setIsCapturing(false);
        onCaptureComplete(frames);
        return;
      }

      try {
        if (cameraRef.current) {
          const photo = await cameraRef.current.takePictureAsync({
            quality: 0.8,
            base64: false,
            skipProcessing: true,
          });

          // Redimensionar imagen para reducir tamaño
          const manipulatedImage = await ImageManipulator.manipulateAsync(
            photo.uri,
            [{ resize: { width: 640 } }],
            { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
          );

          if (manipulatedImage.base64) {
            const base64Image = `data:image/jpeg;base64,${manipulatedImage.base64}`;
            frames.push(base64Image);
            setCapturedFrames([...frames]);
            frameCount++;
          }
        }
      } catch (error) {
        console.error('Error capturando frame:', error);
      }
    }, captureInterval);
  }, [targetFrames, captureInterval, onCaptureComplete]);

  // Cancelar captura
  const handleCancel = useCallback(() => {
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
    }
    setIsCapturing(false);
    setCapturedFrames([]);
    setCountdown(null);
    onCancel();
  }, [onCancel]);

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Solicitando permisos de cámara...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <MaterialIcons name="camera-alt" size={64} color="#999" />
        <Text style={styles.errorText}>No se otorgaron permisos de cámara</Text>
        <TouchableOpacity style={styles.button} onPress={onCancel}>
          <Text style={styles.buttonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.cameraContainer}>
        <Camera
          ref={cameraRef}
          style={styles.camera}
          type={CameraType.front}
          ratio="1:1"
        />

        {/* Overlay con guía facial */}
        <View style={styles.overlay}>
          <View style={styles.faceGuide} />
        </View>

        {/* Countdown */}
        {countdown !== null && (
          <View style={styles.countdownContainer}>
            <Text style={styles.countdownText}>{countdown}</Text>
          </View>
        )}

        {/* Indicador de captura */}
        {isCapturing && (
          <View style={styles.capturingIndicator}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.capturingText}>
              Capturando {capturedFrames.length}/{targetFrames}
            </Text>
          </View>
        )}
      </View>

      {/* Instrucciones */}
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>Instrucciones:</Text>
        <Text style={styles.instructionsText}>
          • Coloca tu rostro dentro del marco
        </Text>
        <Text style={styles.instructionsText}>
          • Mantén buena iluminación
        </Text>
        <Text style={styles.instructionsText}>
          • Mira directamente a la cámara
        </Text>
        <Text style={styles.instructionsText}>
          • No te muevas durante la captura
        </Text>
      </View>

      {/* Botones */}
      <View style={styles.buttonsContainer}>
        {!isCapturing && countdown === null && (
          <>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
            >
              <Text style={styles.buttonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.captureButton]}
              onPress={startCapture}
            >
              <MaterialIcons name="camera" size={24} color="#fff" />
              <Text style={styles.buttonText}>Capturar</Text>
            </TouchableOpacity>
          </>
        )}
        {isCapturing && (
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={handleCancel}
          >
            <Text style={styles.buttonText}>Cancelar</Text>
          </TouchableOpacity>
        )}
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceGuide: {
    width: CAMERA_SIZE * 0.7,
    height: CAMERA_SIZE * 0.85,
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: CAMERA_SIZE * 0.35,
    opacity: 0.5,
  },
  countdownContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  countdownText: {
    fontSize: 120,
    fontWeight: 'bold',
    color: '#fff',
  },
  capturingIndicator: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  capturingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
  },
  instructionsContainer: {
    marginTop: 30,
    paddingHorizontal: 20,
    width: '100%',
  },
  instructionsTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  instructionsText: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 5,
  },
  buttonsContainer: {
    flexDirection: 'row',
    marginTop: 30,
    gap: 15,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#666',
  },
  captureButton: {
    backgroundColor: '#007AFF',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
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
