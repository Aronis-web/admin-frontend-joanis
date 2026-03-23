import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import { transportService } from '@/services/api/transport';
import { usePermissions } from '@/hooks/usePermissions';
import {
  CreateTransporterRequest,
  TransporterDocumentType,
  TransporterStatus,
  AuthorizedCode,
} from '@/types/transport';

export const CreateTransporterScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { hasPermission } = usePermissions();

  const canCreate = hasPermission('transport.transporters.create');

  // Form state
  const [formData, setFormData] = useState<CreateTransporterRequest>({
    numeroRuc: '',
    tipoDocumento: TransporterDocumentType.RUC,
    razonSocial: '',
    numeroRegistroMTC: '',
    numeroAutorizacion: '',
    codigoAutorizado: undefined,
    telefono: '',
    email: '',
    direccion: '',
    status: TransporterStatus.ACTIVE,
    isActive: true,
    notas: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Campos requeridos según la API
    if (!formData.numeroRuc.trim()) {
      newErrors.numeroRuc = 'El RUC es requerido';
    } else if (formData.numeroRuc.length !== 11) {
      newErrors.numeroRuc = 'El RUC debe tener 11 dígitos';
    } else if (!/^\d+$/.test(formData.numeroRuc)) {
      newErrors.numeroRuc = 'El RUC debe contener solo números';
    }

    if (!formData.razonSocial.trim()) {
      newErrors.razonSocial = 'La razón social es requerida';
    }

    if (!formData.numeroRegistroMTC?.trim()) {
      newErrors.numeroRegistroMTC = 'El número de registro MTC es requerido';
    }

    if (!formData.numeroAutorizacion?.trim()) {
      newErrors.numeroAutorizacion = 'El número de autorización es requerido';
    }

    if (!formData.codigoAutorizado) {
      newErrors.codigoAutorizado = 'El código autorizado es requerido';
    }

    // Validación de email (opcional pero debe ser válido si se proporciona)
    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        newErrors.email = 'El email no es válido';
      }
    }

    // Validación de teléfono (opcional pero debe ser válido si se proporciona)
    if (formData.telefono && formData.telefono.trim()) {
      if (!/^\d{7,15}$/.test(formData.telefono.replace(/\s/g, ''))) {
        newErrors.telefono = 'El teléfono debe tener entre 7 y 15 dígitos';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!canCreate) {
      Alert.alert('Sin permisos', 'No tienes permisos para crear transportistas');
      return;
    }

    if (!validateForm()) {
      Alert.alert('Error de validación', 'Por favor corrige los errores en el formulario');
      return;
    }

    setIsSubmitting(true);
    try {
      // Preparar datos para enviar (eliminar campos vacíos opcionales)
      const dataToSend: CreateTransporterRequest = {
        numeroRuc: formData.numeroRuc.trim(),
        tipoDocumento: formData.tipoDocumento,
        razonSocial: formData.razonSocial.trim(),
        numeroRegistroMTC: formData.numeroRegistroMTC?.trim(),
        numeroAutorizacion: formData.numeroAutorizacion?.trim(),
        codigoAutorizado: formData.codigoAutorizado,
        status: formData.status,
        isActive: formData.isActive,
      };

      // Agregar campos opcionales solo si tienen valor
      if (formData.telefono?.trim()) {
        dataToSend.telefono = formData.telefono.trim();
      }
      if (formData.email?.trim()) {
        dataToSend.email = formData.email.trim();
      }
      if (formData.direccion?.trim()) {
        dataToSend.direccion = formData.direccion.trim();
      }
      if (formData.notas?.trim()) {
        dataToSend.notas = formData.notas.trim();
      }

      const newTransporter = await transportService.createTransporter(dataToSend);

      Alert.alert(
        'Éxito',
        `Transportista "${newTransporter.razonSocial}" creado correctamente`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error creating transporter:', error);
      Alert.alert(
        'Error',
        error.message || 'No se pudo crear el transportista. Verifica que el RUC no esté duplicado.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (
      formData.numeroRuc ||
      formData.razonSocial ||
      formData.numeroRegistroMTC ||
      formData.numeroAutorizacion
    ) {
      Alert.alert(
        'Cancelar creación',
        '¿Estás seguro de cancelar? Se perderán los datos ingresados.',
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Sí, cancelar',
            style: 'destructive',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const updateField = (field: keyof CreateTransporterRequest, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Limpiar error del campo cuando el usuario empieza a escribir
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const getCodigoAutorizadoLabel = (codigo: AuthorizedCode): string => {
    const labels: Record<AuthorizedCode, string> = {
      [AuthorizedCode.TRANSPORTE_PRIVADO]: '01 - Transporte Privado',
      [AuthorizedCode.TRANSPORTE_PUBLICO]: '02 - Transporte Público',
      [AuthorizedCode.TRANSPORTE_CARGA]: '03 - Transporte de Carga',
      [AuthorizedCode.TRANSPORTE_PASAJEROS]: '04 - Transporte de Pasajeros',
      [AuthorizedCode.TRANSPORTE_MIXTO]: '05 - Transporte Mixto',
      [AuthorizedCode.TRANSPORTE_ESPECIAL]: '06 - Transporte Especial',
      [AuthorizedCode.TRANSPORTE_INTERNACIONAL]: '07 - Transporte Internacional',
    };
    return labels[codigo];
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleCancel}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nuevo Transportista</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Información Principal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información Principal</Text>
          <View style={styles.card}>
            {/* RUC */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                RUC <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.numeroRuc && styles.inputError]}
                value={formData.numeroRuc}
                onChangeText={(value) => updateField('numeroRuc', value)}
                placeholder="Ingrese el RUC (11 dígitos)"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                maxLength={11}
                editable={!isSubmitting}
              />
              {errors.numeroRuc && <Text style={styles.errorText}>{errors.numeroRuc}</Text>}
            </View>

            {/* Tipo de Documento */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Tipo de Documento <Text style={styles.required}>*</Text>
              </Text>
              <View style={[styles.pickerContainer, errors.tipoDocumento && styles.inputError]}>
                <Picker
                  selectedValue={formData.tipoDocumento}
                  onValueChange={(value) => updateField('tipoDocumento', value)}
                  enabled={!isSubmitting}
                  style={styles.picker}
                >
                  <Picker.Item label="6 - RUC" value={TransporterDocumentType.RUC} />
                  <Picker.Item label="1 - DNI" value={TransporterDocumentType.DNI} />
                </Picker>
              </View>
              {errors.tipoDocumento && <Text style={styles.errorText}>{errors.tipoDocumento}</Text>}
            </View>

            {/* Razón Social */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Razón Social <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.razonSocial && styles.inputError]}
                value={formData.razonSocial}
                onChangeText={(value) => updateField('razonSocial', value)}
                placeholder="Ingrese la razón social"
                placeholderTextColor="#9CA3AF"
                editable={!isSubmitting}
              />
              {errors.razonSocial && <Text style={styles.errorText}>{errors.razonSocial}</Text>}
            </View>
          </View>
        </View>

        {/* Información de Transporte */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información de Transporte</Text>
          <View style={styles.card}>
            {/* Número de Registro MTC */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Número de Registro MTC <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.numeroRegistroMTC && styles.inputError]}
                value={formData.numeroRegistroMTC}
                onChangeText={(value) => updateField('numeroRegistroMTC', value)}
                placeholder="Ej: 0215YUIO8548"
                placeholderTextColor="#9CA3AF"
                editable={!isSubmitting}
              />
              {errors.numeroRegistroMTC && (
                <Text style={styles.errorText}>{errors.numeroRegistroMTC}</Text>
              )}
            </View>

            {/* Número de Autorización */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Número de Autorización <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.numeroAutorizacion && styles.inputError]}
                value={formData.numeroAutorizacion}
                onChangeText={(value) => updateField('numeroAutorizacion', value)}
                placeholder="Ej: 026 5469"
                placeholderTextColor="#9CA3AF"
                editable={!isSubmitting}
              />
              {errors.numeroAutorizacion && (
                <Text style={styles.errorText}>{errors.numeroAutorizacion}</Text>
              )}
            </View>

            {/* Código Autorizado */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Código Autorizado <Text style={styles.required}>*</Text>
              </Text>
              <View style={[styles.pickerContainer, errors.codigoAutorizado && styles.inputError]}>
                <Picker
                  selectedValue={formData.codigoAutorizado}
                  onValueChange={(value) => updateField('codigoAutorizado', value)}
                  enabled={!isSubmitting}
                  style={styles.picker}
                >
                  <Picker.Item label="Seleccione un código" value={undefined} />
                  {Object.values(AuthorizedCode).map((code) => (
                    <Picker.Item
                      key={code}
                      label={getCodigoAutorizadoLabel(code)}
                      value={code}
                    />
                  ))}
                </Picker>
              </View>
              {errors.codigoAutorizado && (
                <Text style={styles.errorText}>{errors.codigoAutorizado}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Información de Contacto */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información de Contacto (Opcional)</Text>
          <View style={styles.card}>
            {/* Teléfono */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Teléfono</Text>
              <TextInput
                style={[styles.input, errors.telefono && styles.inputError]}
                value={formData.telefono}
                onChangeText={(value) => updateField('telefono', value)}
                placeholder="Ej: 014567890"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
                editable={!isSubmitting}
              />
              {errors.telefono && <Text style={styles.errorText}>{errors.telefono}</Text>}
            </View>

            {/* Email */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
                value={formData.email}
                onChangeText={(value) => updateField('email', value)}
                placeholder="Ej: contacto@empresa.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isSubmitting}
              />
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            {/* Dirección */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Dirección</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.direccion}
                onChangeText={(value) => updateField('direccion', value)}
                placeholder="Ingrese la dirección"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                editable={!isSubmitting}
              />
            </View>
          </View>
        </View>

        {/* Estado y Configuración */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estado y Configuración</Text>
          <View style={styles.card}>
            {/* Estado */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Estado</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formData.status}
                  onValueChange={(value) => updateField('status', value)}
                  enabled={!isSubmitting}
                  style={styles.picker}
                >
                  <Picker.Item label="Activo" value={TransporterStatus.ACTIVE} />
                  <Picker.Item label="Inactivo" value={TransporterStatus.INACTIVE} />
                  <Picker.Item label="Suspendido" value={TransporterStatus.SUSPENDED} />
                </Picker>
              </View>
            </View>

            {/* Activo */}
            <View style={styles.formGroup}>
              <View style={styles.checkboxRow}>
                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() => updateField('isActive', !formData.isActive)}
                  disabled={isSubmitting}
                >
                  <View
                    style={[
                      styles.checkboxBox,
                      formData.isActive && styles.checkboxBoxChecked,
                    ]}
                  >
                    {formData.isActive && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxLabel}>Transportista activo</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Notas */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Notas</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.notas}
                onChangeText={(value) => updateField('notas', value)}
                placeholder="Notas adicionales (opcional)"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!isSubmitting}
              />
            </View>
          </View>
        </View>

        {/* Botones de acción */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={handleCancel}
            disabled={isSubmitting}
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.submitButton, isSubmitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Crear Transportista</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#1F2937',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1F2937',
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  textArea: {
    minHeight: 80,
    paddingTop: 10,
  },
  pickerContainer: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    color: '#1F2937',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checkboxBoxChecked: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  checkboxLabel: {
    fontSize: 15,
    color: '#374151',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 20,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  submitButton: {
    backgroundColor: '#6366F1',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
