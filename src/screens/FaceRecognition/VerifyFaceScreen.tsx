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
import { colors, spacing, borderRadius } from '@/design-system/tokens';
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
  const prefilledEntityType = route?.params?.prefilledEntityType;
  const prefilledEntityId = route?.params?.prefilledEntityId;

  // Si viene con datos pre-llenados, ir directo a la cámara
  const initialStep = (prefilledEntityType && prefilledEntityId) ? 'camera' : 'form';

  const [step, setStep] = useState<'form' | 'camera' | 'processing'>(initialStep);
  const [entityType, setEntityType] = useState(prefilledEntityType || 'employee');
  const [entityId, setEntityId] = useState(prefilledEntityId || '');
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
        <FaceCaptureCamera
          onCaptureComplete={handleCaptureComplete}
          onCancel={handleCancel}
          targetFrames={15}
        />
      </SafeAreaView>
    );
  }

  if (step === 'processing') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
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
            <MaterialIcons name="verified-user" size={64} color={colors.success[500]} />
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
              <MaterialIcons name="camera-alt" size={24} color={colors.neutral[0]} />
              <Text style={styles.verifyButtonText}>Iniciar Verificación</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoBox}>
            <MaterialIcons name="info-outline" size={24} color={colors.success[500]} />
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
            <MaterialIcons name="warning" size={24} color={colors.warning[500]} />
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
    backgroundColor: colors.background.secondary,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: colors.neutral[950],
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[5],
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing[8],
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.neutral[800],
    marginTop: spacing[4],
  },
  subtitle: {
    fontSize: 16,
    color: colors.neutral[500],
    textAlign: 'center',
    marginTop: spacing[2],
  },
  form: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[5],
    marginBottom: spacing[5],
    shadowColor: colors.neutral[950],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputGroup: {
    marginBottom: spacing[5],
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: spacing[2],
  },
  required: {
    color: colors.danger[500],
  },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    fontSize: 14,
    backgroundColor: colors.surface.primary,
  },
  helperText: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: spacing[1],
  },
  pickerContainer: {
    flexDirection: 'row',
    gap: spacing[2.5],
  },
  pickerOption: {
    flex: 1,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    alignItems: 'center',
    backgroundColor: colors.surface.primary,
  },
  pickerOptionSelected: {
    backgroundColor: colors.success[500],
    borderColor: colors.success[500],
  },
  pickerOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  pickerOptionTextSelected: {
    color: colors.neutral[0],
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success[500],
    paddingVertical: spacing[4],
    borderRadius: borderRadius.lg,
    marginTop: spacing[2.5],
    gap: spacing[2.5],
  },
  verifyButtonDisabled: {
    backgroundColor: colors.neutral[300],
  },
  verifyButtonText: {
    color: colors.neutral[0],
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: colors.success[50],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.success[500],
    marginBottom: spacing[2],
  },
  infoText: {
    fontSize: 14,
    color: colors.neutral[600],
    marginBottom: spacing[1],
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: colors.warning[100],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    gap: spacing[3],
  },
  warningContent: {
    flex: 1,
  },
  warningText: {
    fontSize: 14,
    color: colors.warning[800],
  },
  processingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[5],
  },
  processingText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.neutral[800],
    marginTop: spacing[5],
  },
  processingSubtext: {
    fontSize: 16,
    color: colors.neutral[500],
    marginTop: spacing[2],
  },
});
