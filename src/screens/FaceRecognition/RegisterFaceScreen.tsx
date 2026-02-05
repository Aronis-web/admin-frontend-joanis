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
    setStep('camera');
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
        },
      });

      setIsLoading(false);

      if (response.success) {
        Alert.alert(
          'Éxito',
          `Rostro registrado correctamente\n\nCalidad: ${(response.quality * 100).toFixed(1)}%`,
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
        <FaceCaptureCamera onCaptureComplete={handleCaptureComplete} onCancel={handleCancel} />
      </SafeAreaView>
    );
  }

  if (step === 'processing') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
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
            <MaterialIcons name="face" size={64} color="#007AFF" />
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
                ID <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: EMP001, USR123"
                value={entityId}
                onChangeText={setEntityId}
                autoCapitalize="characters"
              />
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
              <MaterialIcons name="camera-alt" size={24} color="#fff" />
              <Text style={styles.captureButtonText}>Iniciar Captura</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoBox}>
            <MaterialIcons name="info-outline" size={24} color="#007AFF" />
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
    fontSize: 16,
    backgroundColor: '#fff',
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
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  pickerOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  pickerOptionTextSelected: {
    color: '#fff',
  },
  captureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 10,
    marginTop: 10,
    gap: 10,
  },
  captureButtonDisabled: {
    backgroundColor: '#ccc',
  },
  captureButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
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
