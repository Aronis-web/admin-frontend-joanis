import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { transmisionesApi } from '@/services/api';
import { priceProfilesApi } from '@/services/api/price-profiles';
import {
  CreateTransmisionRequest,
  TransmisionStatus,
  getTransmisionStatusLabel,
} from '@/types/transmisiones';
import { PriceProfile } from '@/types/price-profiles';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';

interface CreateTransmisionScreenProps {
  navigation: any;
}

export const CreateTransmisionScreen: React.FC<CreateTransmisionScreenProps> = ({ navigation }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TransmisionStatus>(TransmisionStatus.DRAFT);
  const [priceProfileId, setPriceProfileId] = useState<string>('');
  const [priceProfiles, setPriceProfiles] = useState<PriceProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProfiles, setLoadingProfiles] = useState(false);

  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;

  // Load price profiles on mount
  useEffect(() => {
    loadPriceProfiles();
  }, []);

  const loadPriceProfiles = async () => {
    try {
      setLoadingProfiles(true);
      const profiles = await priceProfilesApi.getActivePriceProfiles();
      setPriceProfiles(profiles);
    } catch (error) {
      console.error('Error loading price profiles:', error);
      // No mostrar error, los perfiles son opcionales
    } finally {
      setLoadingProfiles(false);
    }
  };

  const handleCreate = async () => {
    // Validation
    if (!name.trim()) {
      Alert.alert('Error', 'El nombre es requerido');
      return;
    }

    try {
      setLoading(true);

      const data: CreateTransmisionRequest = {
        name: name.trim(),
        description: description.trim() || undefined,
        status,
        priceProfileId: priceProfileId || undefined,
      };

      const transmision = await transmisionesApi.createTransmision(data);

      Alert.alert('Éxito', 'Transmisión creada correctamente', [
        {
          text: 'OK',
          onPress: () => {
            navigation.replace('TransmisionDetail', { transmisionId: transmision.id });
          },
        },
      ]);
    } catch (error: any) {
      console.error('Error creating transmision:', error);
      Alert.alert('Error', error.message || 'No se pudo crear la transmisión');
    } finally {
      setLoading(false);
    }
  };

  const renderStatusSelector = () => {
    const statuses = [TransmisionStatus.DRAFT, TransmisionStatus.IN_PROGRESS];

    return (
      <View style={styles.section}>
        <Text style={[styles.label, isTablet && styles.labelTablet]}>Estado</Text>
        <View style={styles.statusContainer}>
          {statuses.map((s) => (
            <TouchableOpacity
              key={s}
              style={[
                styles.statusButton,
                isTablet && styles.statusButtonTablet,
                status === s && styles.statusButtonActive,
              ]}
              onPress={() => setStatus(s)}
            >
              <Text
                style={[
                  styles.statusButtonText,
                  isTablet && styles.statusButtonTextTablet,
                  status === s && styles.statusButtonTextActive,
                ]}
              >
                {getTransmisionStatusLabel(s)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Volver</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isTablet && styles.headerTitleTablet]}>
            Nueva Transmisión
          </Text>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          <View style={styles.section}>
            <Text style={[styles.label, isTablet && styles.labelTablet]}>
              Nombre <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, isTablet && styles.inputTablet]}
              value={name}
              onChangeText={setName}
              placeholder="Ej: Transmisión Enero 2024"
              placeholderTextColor="#9CA3AF"
              editable={!loading}
            />
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, isTablet && styles.labelTablet]}>Descripción</Text>
            <TextInput
              style={[styles.input, styles.textArea, isTablet && styles.inputTablet]}
              value={description}
              onChangeText={setDescription}
              placeholder="Descripción opcional de la transmisión"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!loading}
            />
          </View>

          {renderStatusSelector()}

          <View style={styles.section}>
            <Text style={[styles.label, isTablet && styles.labelTablet]}>
              Perfil de Precio (Opcional)
            </Text>
            {loadingProfiles ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#0EA5E9" size="small" />
                <Text style={styles.loadingText}>Cargando perfiles...</Text>
              </View>
            ) : (
              <>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={priceProfileId}
                    onValueChange={(value) => setPriceProfileId(value)}
                    enabled={!loading}
                    style={styles.picker}
                  >
                    <Picker.Item label="Sin perfil de precio" value="" />
                    {priceProfiles.map((profile) => (
                      <Picker.Item
                        key={profile.id}
                        label={`${profile.name} (Factor: ${typeof profile.factorToCost === 'string' ? profile.factorToCost : profile.factorToCost.toFixed(2)}x)`}
                        value={profile.id}
                      />
                    ))}
                  </Picker>
                </View>
                <Text style={styles.hint}>
                  💡 Si seleccionas un perfil, los precios de venta se calcularán automáticamente al
                  agregar productos
                </Text>
              </>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.createButton,
              isTablet && styles.createButtonTablet,
              loading && styles.createButtonDisabled,
            ]}
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={[styles.createButtonText, isTablet && styles.createButtonTextTablet]}>
                Crear Transmisión
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTablet: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  backButton: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#0EA5E9',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  headerTitleTablet: {
    fontSize: 28,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  labelTablet: {
    fontSize: 16,
  },
  required: {
    color: '#EF4444',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
  },
  inputTablet: {
    padding: 16,
    fontSize: 18,
    borderRadius: 12,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusButtonTablet: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  statusButtonActive: {
    backgroundColor: '#0EA5E9',
    borderColor: '#0EA5E9',
  },
  statusButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  statusButtonTextTablet: {
    fontSize: 16,
  },
  statusButtonTextActive: {
    color: '#FFFFFF',
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    color: '#1F2937',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  hint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
  createButton: {
    backgroundColor: '#0EA5E9',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  createButtonTablet: {
    padding: 20,
    borderRadius: 12,
  },
  createButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  createButtonTextTablet: {
    fontSize: 18,
  },
});
