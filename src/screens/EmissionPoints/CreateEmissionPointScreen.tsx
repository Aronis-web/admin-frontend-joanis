import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { useAuthStore } from '@/store/auth';
import { emissionPointsApi, EmissionType } from '@/services/api/emission-points';
import logger from '@/utils/logger';

interface CreateEmissionPointScreenProps {
  navigation: any;
}

export const CreateEmissionPointScreen: React.FC<CreateEmissionPointScreenProps> = ({
  navigation,
}) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [emissionType, setEmissionType] = useState<EmissionType>('POS');
  const [isActive, setIsActive] = useState(true);
  const [requiresApproval, setRequiresApproval] = useState(false);

  // Metadata fields for POS
  const [posNumber, setPosNumber] = useState('');
  const [cashierName, setCashierName] = useState('');
  const [location, setLocation] = useState('');
  const [terminalId, setTerminalId] = useState('');

  // Metadata fields for CAMPAIGN
  const [campaignCode, setCampaignCode] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [targetParticipants, setTargetParticipants] = useState('');

  // Metadata fields for INDIVIDUAL_SALE
  const [channel, setChannel] = useState('');
  const [platform, setPlatform] = useState('');

  const [loading, setLoading] = useState(false);
  const { currentSite, currentCompany } = useAuthStore();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const handleSubmit = async () => {
    // Validaciones
    if (!code.trim()) {
      Alert.alert('Error', 'El código es obligatorio');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Error', 'El nombre es obligatorio');
      return;
    }
    if (!currentSite?.id || !currentCompany?.id) {
      Alert.alert('Error', 'No hay sede o empresa seleccionada');
      return;
    }

    // Validar formato del código (sin espacios, máx 20 caracteres)
    if (code.includes(' ')) {
      Alert.alert('Error', 'El código no puede contener espacios');
      return;
    }
    if (code.length > 20) {
      Alert.alert('Error', 'El código no puede tener más de 20 caracteres');
      return;
    }

    try {
      setLoading(true);

      // Construir metadata según el tipo
      let metadata: any = {};

      if (emissionType === 'POS') {
        metadata = {
          posNumber: posNumber ? parseInt(posNumber) : undefined,
          cashierName: cashierName || undefined,
          location: location || undefined,
          terminalId: terminalId || undefined,
        };
      } else if (emissionType === 'CAMPAIGN') {
        metadata = {
          campaignCode: campaignCode || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          targetParticipants: targetParticipants ? parseInt(targetParticipants) : undefined,
        };
      } else if (emissionType === 'INDIVIDUAL_SALE') {
        metadata = {
          channel: channel || undefined,
          platform: platform || undefined,
        };
      }

      await emissionPointsApi.createEmissionPoint({
        companyId: currentCompany.id,
        siteId: currentSite.id,
        code: code.toUpperCase(),
        name,
        description: description || undefined,
        emissionType,
        isActive,
        requiresApproval,
        metadata,
      });

      Alert.alert('Éxito', 'Punto de emisión creado exitosamente', [
        {
          text: 'Aceptar',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      logger.error('Error creando punto de emisión:', error);
      Alert.alert('Error', error.response?.data?.message || 'No se pudo crear el punto de emisión');
    } finally {
      setLoading(false);
    }
  };

  const renderMetadataFields = () => {
    if (emissionType === 'POS') {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información Adicional - POS</Text>

          <Text style={styles.label}>Número de POS:</Text>
          <TextInput
            style={styles.input}
            value={posNumber}
            onChangeText={setPosNumber}
            placeholder="1"
            keyboardType="numeric"
          />

          <Text style={styles.label}>Nombre del Cajero:</Text>
          <TextInput
            style={styles.input}
            value={cashierName}
            onChangeText={setCashierName}
            placeholder="Juan Pérez"
          />

          <Text style={styles.label}>Ubicación:</Text>
          <TextInput
            style={styles.input}
            value={location}
            onChangeText={setLocation}
            placeholder="Piso 1"
          />

          <Text style={styles.label}>ID de Terminal:</Text>
          <TextInput
            style={styles.input}
            value={terminalId}
            onChangeText={setTerminalId}
            placeholder="TERM-001"
          />
        </View>
      );
    }

    if (emissionType === 'CAMPAIGN') {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información Adicional - Campaña</Text>

          <Text style={styles.label}>Código de Campaña:</Text>
          <TextInput
            style={styles.input}
            value={campaignCode}
            onChangeText={setCampaignCode}
            placeholder="VERANO2024"
          />

          <Text style={styles.label}>Fecha de Inicio:</Text>
          <TextInput
            style={styles.input}
            value={startDate}
            onChangeText={setStartDate}
            placeholder="2024-01-01"
          />

          <Text style={styles.label}>Fecha de Fin:</Text>
          <TextInput
            style={styles.input}
            value={endDate}
            onChangeText={setEndDate}
            placeholder="2024-03-31"
          />

          <Text style={styles.label}>Meta de Participantes:</Text>
          <TextInput
            style={styles.input}
            value={targetParticipants}
            onChangeText={setTargetParticipants}
            placeholder="5000"
            keyboardType="numeric"
          />
        </View>
      );
    }

    if (emissionType === 'INDIVIDUAL_SALE') {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información Adicional - Ventas Individuales</Text>

          <Text style={styles.label}>Canal de Venta:</Text>
          <TextInput
            style={styles.input}
            value={channel}
            onChangeText={setChannel}
            placeholder="web, móvil, teléfono"
          />

          <Text style={styles.label}>Plataforma:</Text>
          <TextInput
            style={styles.input}
            value={platform}
            onChangeText={setPlatform}
            placeholder="ecommerce"
          />
        </View>
      );
    }

    return null;
  };

  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <Text style={[styles.headerTitle, isTablet && styles.headerTitleTablet]}>
            Nuevo Punto de Emisión
          </Text>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.form}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tipo de Punto de Emisión *</Text>
              <View style={styles.radioGroup}>
                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => setEmissionType('CAMPAIGN')}
                >
                  <View style={styles.radio}>
                    {emissionType === 'CAMPAIGN' && <View style={styles.radioSelected} />}
                  </View>
                  <Text style={styles.radioLabel}>📢 Campaña</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => setEmissionType('INDIVIDUAL_SALE')}
                >
                  <View style={styles.radio}>
                    {emissionType === 'INDIVIDUAL_SALE' && <View style={styles.radioSelected} />}
                  </View>
                  <Text style={styles.radioLabel}>🛒 Ventas Individuales</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => setEmissionType('POS')}
                >
                  <View style={styles.radio}>
                    {emissionType === 'POS' && <View style={styles.radioSelected} />}
                  </View>
                  <Text style={styles.radioLabel}>🏪 Punto de Venta (POS)</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Código: *</Text>
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={(text) => setCode(text.toUpperCase())}
                placeholder="CAJA-01"
                maxLength={20}
                autoCapitalize="characters"
              />
              <Text style={styles.hint}>(Máx. 20 caracteres, sin espacios)</Text>

              <Text style={styles.label}>Nombre: *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Caja 1 - Tienda Principal"
              />

              <Text style={styles.label}>Descripción:</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Caja principal del primer piso"
                multiline
                numberOfLines={3}
              />
            </View>

            {renderMetadataFields()}

            <View style={styles.section}>
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => setIsActive(!isActive)}
              >
                <View style={styles.checkboxBox}>
                  {isActive && <Text style={styles.checkboxCheck}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>Activo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => setRequiresApproval(!requiresApproval)}
              >
                <View style={styles.checkboxBox}>
                  {requiresApproval && <Text style={styles.checkboxCheck}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>Requiere aprobación antes de emitir</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => navigation.goBack()}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.submitButton, loading && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Crear Punto</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTablet: {
    padding: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerTitleTablet: {
    fontSize: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  form: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  radioGroup: {
    gap: 12,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6366F1',
  },
  radioLabel: {
    fontSize: 14,
    color: '#111827',
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxCheck: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#111827',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#6366F1',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
