import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { FaceCaptureCamera } from '@/components/FaceRecognition/FaceCaptureCamera';
import { biometricApi } from '@/services/api/biometric';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface VerifyFaceScreenProps {
  route?: {
    params?: {
      prefilledEntityType?: string;
      prefilledEntityId?: string;
    };
  };
}

export const VerifyFaceScreen: React.FC<VerifyFaceScreenProps> = ({ route }) => {
  const [step, setStep] = useState<'form' | 'camera' | 'processing'>('form');
  const [entityType, setEntityType] = useState(route?.params?.prefilledEntityType || 'employee');
  const [entityId, setEntityId] = useState(route?.params?.prefilledEntityId || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleStartVerification = () => {
    if (!entityId.trim()) {
      Alert.alert('Error', 'Por favor ingresa un ID');
      return;
    }

    // Validate UUID format
    if (!UUID_REGEX.test(entityId.trim())) {
      Alert.alert(
        'Error',
        'El ID debe ser un UUID válido (formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)'
      );
      return;
    }

    setStep('camera');
  };

  const handleCaptureComplete = async (frames: string[]) => {
    setStep('processing');
    setIsLoading(true);

    try {
      const response = await biometricApi.verifyBiometric(frames, {
        entityType,
        entityId: entityId.trim(),
        metadata: {
          verifiedAt: new Date().toISOString(),
          useCase: 'face_verification',
        },
      });

      setIsLoading(false);

      if (response.success) {
        const icon = response.verified ? '✅' : '❌';
        const title = response.verified ? 'Verificación Exitosa' : 'Verificación Fallida';
        let message = `${icon} ${response.message}\n\n` +
          `Confianza: ${response.confidence.toFixed(1)}%\n` +
          `Liveness: ${response.livenessScore.toFixed(1)}%\n` +
          `Similitud: ${response.similarityScore.toFixed(1)}%`;

        if (!response.verified && response.failureReason) {
          message += `\n\nRazón: ${response.failureReason}`;
        }

        Alert.alert(title, message, [
          {
            text: 'OK',
            onPress: () => {
              setEntityId('');
              setStep('form');
            },
          },
        ]);
      } else {
        Alert.alert('Error', response.message || 'No se pudo verificar el rostro');
        setStep('form');
      }
    } catch (error: any) {
      setIsLoading(false);
      console.error('Error verificando rostro:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || error.message || 'Error al verificar el rostro'
      );
      setStep('form');
    }
  };

  const handleCancel = () => {
    setStep('form');
  };

  if (step === 'camera') {
    return (
      <SafeAreaView style={styles.cameraContainer} edges={['top']}>
        <FaceCaptureCamera onCaptureComplete={handleCaptureComplete} onCancel={handleCancel} />
      </SafeAreaView>
    );
  }

  if (step === 'processing') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.processingText}>Verificando rostro...</Text>
          <Text style={styles.processingSubtext}>Esto puede tomar unos segundos</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <MaterialIcons name="verified-user" size={64} color="#34C759" />
            <Text style={styles.title}>Verificar Rostro</Text>
            <Text style={styles.subtitle}>
              Verifica la identidad de una persona comparando su rostro con el perfil registrado
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tipo de Entidad</Text>
              <View style={styles.pickerContainer}>
                <TouchableOpacity
                  style={[
                    styles.pickerOption,
                    entityType === 'employee' && styles.pickerOptionSelected,
                  ]}
                  onPress={() => setEntityType('employee')}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      entityType === 'employee' && styles.pickerOptionTextSelected,
                    ]}
                  >
                    Empleado
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.pickerOption,
                    entityType === 'user' && styles.pickerOptionSelected,
                  ]}
                  onPress={() => setEntityType('user')}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      entityType === 'user' && styles.pickerOptionTextSelected,
                    ]}
                  >
                    Usuario
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.pickerOption,
                    entityType === 'visitor' && styles.pickerOptionSelected,
                  ]}
                  onPress={() => setEntityType('visitor')}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      entityType === 'visitor' && styles.pickerOptionTextSelected,
                    ]}
                  >
                    Visitante
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                ID a Verificar (UUID) <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: 550e8400-e29b-41d4-a716-446655440000"
                value={entityId}
                onChangeText={setEntityId}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.helperText}>Ingresa el UUID del perfil registrado</Text>
            </View>

            <TouchableOpacity
              style={[styles.verifyButton, !entityId.trim() && styles.verifyButtonDisabled]}
              onPress={handleStartVerification}
              disabled={!entityId.trim()}
            >
              <MaterialIcons name="camera-alt" size={24} color="#fff" />
              <Text style={styles.verifyButtonText}>Iniciar Verificación</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoBox}>
            <MaterialIcons name="info-outline" size={24} color="#34C759" />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>¿Cómo funciona?</Text>
              <Text style={styles.infoText}>
                1. Ingresa el ID de la persona a verificar
              </Text>
              <Text style={styles.infoText}>
                2. Captura el rostro con la cámara
              </Text>
              <Text style={styles.infoText}>
                3. El sistema comparará con el perfil registrado
              </Text>
              <Text style={styles.infoText}>
                4. Recibirás el resultado de la verificación
              </Text>
            </View>
          </View>

          <View style={styles.warningBox}>
            <MaterialIcons name="warning" size={24} color="#FF9500" />
            <View style={styles.warningContent}>
              <Text style={styles.warningText}>
                Asegúrate de que la persona esté presente y que el ID sea correcto antes de
                iniciar la verificación.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 15,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  required: {
    color: '#ff3b30',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  pickerContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  pickerOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  pickerOptionSelected: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  pickerOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  pickerOptionTextSelected: {
    color: '#fff',
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34C759',
    paddingVertical: 16,
    borderRadius: 10,
    marginTop: 10,
    gap: 10,
  },
  verifyButtonDisabled: {
    backgroundColor: '#ccc',
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 15,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34C759',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  warningContent: {
    flex: 1,
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
  },
  processingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  processingText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
  },
  processingSubtext: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
});
