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

// Simple UUID v4 generator
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const RegisterFaceScreen: React.FC = () => {
  const [step, setStep] = useState<'form' | 'camera' | 'processing'>('form');
  const [entityType, setEntityType] = useState('employee');
  const [entityId, setEntityId] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleStartCapture = () => {
    if (!entityId.trim()) {
      Alert.alert('Error', 'Por favor ingresa un ID');
      return;
    }

    // Validate UUID format
    if (!UUID_REGEX.test(entityId.trim())) {
      Alert.alert(
        'Error',
        'El ID debe ser un UUID válido. Usa el botón "Generar UUID" para crear uno automáticamente.'
      );
      return;
    }

    setStep('camera');
  };

  const handleGenerateUUID = () => {
    const newUUID = generateUUID();
    setEntityId(newUUID);
  };

  const handleCaptureComplete = async (frames: string[]) => {
    setStep('processing');
    setIsLoading(true);

    try {
      const response = await biometricApi.registerBiometric(frames, {
        entityType,
        entityId: entityId.trim(),
        metadata: {
          name: name.trim() || undefined,
          registeredAt: new Date().toISOString(),
          useCase: 'face_registration',
        },
      });

      setIsLoading(false);

      if (response.success) {
        Alert.alert(
          'Éxito',
          `Rostro registrado correctamente\n\n` +
          `ID Perfil: ${response.biometricProfileId}\n` +
          `Calidad: ${response.qualityScore.toFixed(1)}%\n` +
          `Liveness: ${response.livenessScore.toFixed(1)}%`,
          [
            {
              text: 'OK',
              onPress: () => {
                // Resetear formulario
                setEntityId('');
                setName('');
                setStep('form');
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', response.message || 'No se pudo registrar el rostro');
        setStep('form');
      }
    } catch (error: any) {
      setIsLoading(false);
      console.error('Error registrando rostro:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || error.message || 'Error al registrar el rostro'
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
          targetFrames={100}
        />
      </SafeAreaView>
    );
  }

  if (step === 'processing') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text style={styles.processingText}>Procesando rostro...</Text>
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
            <MaterialIcons name="face" size={64} color={colors.primary[500]} />
            <Text style={styles.title}>Registrar Rostro</Text>
            <Text style={styles.subtitle}>
              Captura el rostro de una persona para registrarlo en el sistema
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
                ID (UUID) <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputWithButton}>
                <TextInput
                  style={styles.inputFlex}
                  placeholder="Ej: 550e8400-e29b-41d4-a716-446655440000"
                  value={entityId}
                  onChangeText={setEntityId}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity style={styles.generateButton} onPress={handleGenerateUUID}>
                  <MaterialIcons name="refresh" size={20} color={colors.primary[500]} />
                  <Text style={styles.generateButtonText}>Generar</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.helperText}>El ID debe ser un UUID válido</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nombre (Opcional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Nombre de la persona"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>

            <TouchableOpacity
              style={[styles.captureButton, !entityId.trim() && styles.captureButtonDisabled]}
              onPress={handleStartCapture}
              disabled={!entityId.trim()}
            >
              <MaterialIcons name="camera-alt" size={24} color={colors.neutral[0]} />
              <Text style={styles.captureButtonText}>Iniciar Captura</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoBox}>
            <MaterialIcons name="info-outline" size={24} color={colors.primary[500]} />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Consejos para una buena captura:</Text>
              <Text style={styles.infoText}>• Asegúrate de tener buena iluminación</Text>
              <Text style={styles.infoText}>• Mira directamente a la cámara</Text>
              <Text style={styles.infoText}>• Mantén el rostro dentro del marco</Text>
              <Text style={styles.infoText}>• No uses lentes oscuros o gorras</Text>
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
    fontSize: 16,
    backgroundColor: colors.surface.primary,
  },
  inputWithButton: {
    flexDirection: 'row',
    gap: spacing[2.5],
    alignItems: 'center',
  },
  inputFlex: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    fontSize: 14,
    backgroundColor: colors.surface.primary,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary[500],
    backgroundColor: colors.surface.primary,
  },
  generateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary[500],
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
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  pickerOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  pickerOptionTextSelected: {
    color: colors.neutral[0],
  },
  captureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[500],
    paddingVertical: spacing[4],
    borderRadius: borderRadius.lg,
    marginTop: spacing[2.5],
    gap: spacing[2.5],
  },
  captureButtonDisabled: {
    backgroundColor: colors.neutral[300],
  },
  captureButtonText: {
    color: colors.neutral[0],
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    gap: spacing[3],
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary[500],
    marginBottom: spacing[2],
  },
  infoText: {
    fontSize: 14,
    color: colors.neutral[600],
    marginBottom: spacing[1],
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
