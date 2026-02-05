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
import { CameraView, useCameraPermissions } from 'expo-camera';
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
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedFrames, setCapturedFrames] = useState<string[]>([]);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const cameraRef = useRef<CameraView>(null);

  // Solicitar permisos de cámara al montar
  React.useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

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
    try {
      if (cameraRef.current) {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
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
    }
  }, [capturedFrames, targetFrames, onCaptureComplete]);

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

          {/* Indicador de captura */}
          {isCapturing && (
            <View style={styles.capturingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}
        </CameraView>
      </View>

      {/* Instrucciones */}
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>
          Captura manual - {capturedFrames.length} de {targetFrames} frames
        </Text>
        <Text style={styles.instructionsText}>
          • Presiona el botón de captura para tomar cada foto
        </Text>
        <Text style={styles.instructionsText}>
          • Captura desde diferentes ángulos
        </Text>
        <Text style={styles.instructionsText}>
          • Usa el botón de cambio de cámara si es necesario
        </Text>
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
  instructionsContainer: {
    marginTop: 20,
    paddingHorizontal: 20,
    width: '100%',
  },
  instructionsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  instructionsText: {
    color: '#ccc',
    fontSize: 13,
    marginBottom: 4,
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
