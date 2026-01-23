import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FormTextInput } from '@/components/ui/FormTextInput';
import { FormPicker } from '@/components/ui/FormPicker';
import { FormDatePicker } from '@/components/ui/FormDatePicker';
import {
  DOCUMENT_TYPE_OPTIONS,
  GENDER_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  EPP_SIZE_OPTIONS,
  EMERGENCY_RELATIONSHIP_OPTIONS,
} from '@/constants/userProfile';

interface WorkerProfileFieldsProps {
  formData: {
    document_type?: string;
    document_number?: string;
    birth_date?: string;
    gender?: string;
    nationality?: string;
    marital_status?: string;
    address?: string;
    ubigeo?: string;
    phone?: string;
    emergency_contact_name?: string;
    emergency_contact_relationship?: string;
    emergency_contact_phone?: string;
    photo_url?: string;
    epp_size?: string;
  };
  onFieldChange: (field: string, value: string) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}

export const WorkerProfileFields: React.FC<WorkerProfileFieldsProps> = ({
  formData,
  onFieldChange,
  errors = {},
  disabled = false,
}) => {
  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>👤 Perfil del Trabajador</Text>
        <Text style={styles.sectionSubtitle}>
          Información adicional opcional del trabajador
        </Text>
      </View>

      {/* Identification Section */}
      <View style={styles.subsection}>
        <Text style={styles.subsectionTitle}>Identificación</Text>

        <FormPicker
          label="Tipo de Documento"
          placeholder="Seleccionar tipo..."
          value={formData.document_type}
          options={DOCUMENT_TYPE_OPTIONS}
          onValueChange={(value) => onFieldChange('document_type', value)}
          error={errors.document_type}
          disabled={disabled}
        />

        <FormTextInput
          label="Número de Documento"
          placeholder="12345678"
          value={formData.document_number}
          onChangeText={(text) => onFieldChange('document_number', text)}
          error={errors.document_number}
          keyboardType="default"
          editable={!disabled}
        />
      </View>

      {/* Personal Information Section */}
      <View style={styles.subsection}>
        <Text style={styles.subsectionTitle}>Datos Personales</Text>

        <FormDatePicker
          label="Fecha de Nacimiento"
          placeholder="Seleccionar fecha..."
          value={formData.birth_date}
          onValueChange={(value) => onFieldChange('birth_date', value)}
          error={errors.birth_date}
          disabled={disabled}
          maximumDate={new Date()}
        />

        <FormPicker
          label="Género"
          placeholder="Seleccionar género..."
          value={formData.gender}
          options={GENDER_OPTIONS}
          onValueChange={(value) => onFieldChange('gender', value)}
          error={errors.gender}
          disabled={disabled}
        />

        <FormTextInput
          label="Nacionalidad"
          placeholder="Peruana"
          value={formData.nationality}
          onChangeText={(text) => onFieldChange('nationality', text)}
          error={errors.nationality}
          editable={!disabled}
        />

        <FormPicker
          label="Estado Civil"
          placeholder="Seleccionar estado civil..."
          value={formData.marital_status}
          options={MARITAL_STATUS_OPTIONS}
          onValueChange={(value) => onFieldChange('marital_status', value)}
          error={errors.marital_status}
          disabled={disabled}
        />
      </View>

      {/* Contact Information Section */}
      <View style={styles.subsection}>
        <Text style={styles.subsectionTitle}>Información de Contacto</Text>

        <FormTextInput
          label="Teléfono"
          placeholder="+51987654321"
          value={formData.phone}
          onChangeText={(text) => onFieldChange('phone', text)}
          error={errors.phone}
          keyboardType="phone-pad"
          editable={!disabled}
        />

        <FormTextInput
          label="Dirección"
          placeholder="Av. Principal 123, Dpto 456"
          value={formData.address}
          onChangeText={(text) => onFieldChange('address', text)}
          error={errors.address}
          multiline
          numberOfLines={2}
          editable={!disabled}
        />

        <FormTextInput
          label="Ubigeo"
          placeholder="150101"
          value={formData.ubigeo}
          onChangeText={(text) => onFieldChange('ubigeo', text)}
          error={errors.ubigeo}
          keyboardType="default"
          editable={!disabled}
        />
      </View>

      {/* Emergency Contact Section */}
      <View style={styles.subsection}>
        <Text style={styles.subsectionTitle}>Contacto de Emergencia</Text>

        <FormTextInput
          label="Nombre del Contacto"
          placeholder="María Pérez"
          value={formData.emergency_contact_name}
          onChangeText={(text) => onFieldChange('emergency_contact_name', text)}
          error={errors.emergency_contact_name}
          editable={!disabled}
        />

        <FormPicker
          label="Relación"
          placeholder="Seleccionar relación..."
          value={formData.emergency_contact_relationship}
          options={EMERGENCY_RELATIONSHIP_OPTIONS}
          onValueChange={(value) => onFieldChange('emergency_contact_relationship', value)}
          error={errors.emergency_contact_relationship}
          disabled={disabled}
        />

        <FormTextInput
          label="Teléfono de Emergencia"
          placeholder="+51912345678"
          value={formData.emergency_contact_phone}
          onChangeText={(text) => onFieldChange('emergency_contact_phone', text)}
          error={errors.emergency_contact_phone}
          keyboardType="phone-pad"
          editable={!disabled}
        />
      </View>

      {/* Additional Information Section */}
      <View style={styles.subsection}>
        <Text style={styles.subsectionTitle}>Información Adicional</Text>

        <FormTextInput
          label="URL de Foto"
          placeholder="https://example.com/photo.jpg"
          value={formData.photo_url}
          onChangeText={(text) => onFieldChange('photo_url', text)}
          error={errors.photo_url}
          keyboardType="url"
          autoCapitalize="none"
          editable={!disabled}
        />

        <FormPicker
          label="Talla de EPP"
          placeholder="Seleccionar talla..."
          value={formData.epp_size}
          options={EPP_SIZE_OPTIONS}
          onValueChange={(value) => onFieldChange('epp_size', value)}
          error={errors.epp_size}
          disabled={disabled}
        />
      </View>

      {/* Info Note */}
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          ℹ️ Todos estos campos son opcionales. Puedes completarlos ahora o más tarde.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  sectionHeader: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#64748B',
  },
  subsection: {
    marginBottom: 24,
  },
  subsectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 12,
    paddingLeft: 4,
  },
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  infoText: {
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
});

export default WorkerProfileFields;
