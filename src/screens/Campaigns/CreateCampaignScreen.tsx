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
import { Ionicons } from '@expo/vector-icons';
import { campaignsService, sitesService } from '@/services/api';
import { CreateCampaignRequest } from '@/types/campaigns';
import { Site } from '@/types/sites';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { DatePicker } from '@/components/DatePicker';
import { Picker } from '@react-native-picker/picker';

interface CreateCampaignScreenProps {
  navigation: any;
}

export const CreateCampaignScreen: React.FC<CreateCampaignScreenProps> = ({ navigation }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [remainderSiteId, setRemainderSiteId] = useState<string>('');
  const [sites, setSites] = useState<Site[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const { width, height } = useWindowDimensions();

  const isTablet = width >= 768 || height >= 768;

  useEffect(() => {
    loadSites();
  }, []);

  const loadSites = async () => {
    setLoadingSites(true);
    try {
      const response = await sitesService.getSites({ limit: 100, isActive: true });
      setSites(response.data || []);
    } catch (error) {
      console.error('Error loading sites:', error);
      Alert.alert('Error', 'No se pudieron cargar las sedes');
    } finally {
      setLoadingSites(false);
    }
  };

  const formatDate = (date: Date | undefined): string => {
    if (!date) {
      return '';
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDisplayDate = (date: Date | undefined): string => {
    if (!date) {
      return 'Seleccionar fecha';
    }
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleCreate = async () => {
    // Validations
    if (!name.trim()) {
      Alert.alert('Error', 'El nombre de la campaña es obligatorio');
      return;
    }

    if (!remainderSiteId) {
      Alert.alert('Error', 'La sede de remanente es obligatoria');
      return;
    }

    if (startDate && endDate) {
      if (endDate < startDate) {
        Alert.alert('Error', 'La fecha de fin debe ser mayor o igual a la fecha de inicio');
        return;
      }
    }

    setLoading(true);

    try {
      const data: CreateCampaignRequest = {
        name: name.trim(),
        description: description.trim() || undefined,
        startDate: formatDate(startDate) || undefined,
        endDate: formatDate(endDate) || undefined,
        notes: notes.trim() || undefined,
        remainderSiteId: remainderSiteId,
      };

      const campaign = await campaignsService.createCampaign(data);

      Alert.alert('Éxito', 'Campaña creada exitosamente', [
        {
          text: 'OK',
          onPress: () => {
            navigation.replace('CampaignDetail', { campaignId: campaign.id });
          },
        },
      ]);
    } catch (error: any) {
      console.error('Error creating campaign:', error);
      Alert.alert('Error', error.response?.data?.message || 'No se pudo crear la campaña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={[styles.backButtonText, isTablet && styles.backButtonTextTablet]}>
              ← Volver
            </Text>
          </TouchableOpacity>
          <Text style={[styles.title, isTablet && styles.titleTablet]}>Nueva Campaña</Text>
        </View>

        {/* Form */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}
        >
          <View style={[styles.formCard, isTablet && styles.formCardTablet]}>
            {/* Name */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>
                Nombre de la Campaña *
              </Text>
              <TextInput
                style={[styles.input, isTablet && styles.inputTablet]}
                value={name}
                onChangeText={setName}
                placeholder="Ej: Campaña Navidad 2024"
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* Description */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>Descripción</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  isTablet && styles.inputTablet,
                  isTablet && styles.textAreaTablet,
                ]}
                value={description}
                onChangeText={setDescription}
                placeholder="Descripción de la campaña"
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Start Date */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>Fecha de Inicio</Text>
              <TouchableOpacity
                style={[styles.dateButton, isTablet && styles.dateButtonTablet]}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color="#6366F1" />
                <Text
                  style={[
                    styles.dateButtonText,
                    isTablet && styles.dateButtonTextTablet,
                    !startDate && styles.dateButtonPlaceholder,
                  ]}
                >
                  {formatDisplayDate(startDate)}
                </Text>
              </TouchableOpacity>
            </View>

            {/* End Date */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>Fecha de Fin</Text>
              <TouchableOpacity
                style={[styles.dateButton, isTablet && styles.dateButtonTablet]}
                onPress={() => setShowEndDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color="#6366F1" />
                <Text
                  style={[
                    styles.dateButtonText,
                    isTablet && styles.dateButtonTextTablet,
                    !endDate && styles.dateButtonPlaceholder,
                  ]}
                >
                  {formatDisplayDate(endDate)}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Notes */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>Notas</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  isTablet && styles.inputTablet,
                  isTablet && styles.textAreaTablet,
                ]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Notas adicionales"
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Remainder Site */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>
                Sede de Remanente (Redondeo) *
              </Text>
              <Text style={[styles.helperText, isTablet && styles.helperTextTablet]}>
                Sede que absorberá las unidades sobrantes del redondeo en los repartos
              </Text>
              <View style={[styles.pickerContainer, isTablet && styles.pickerContainerTablet]}>
                {loadingSites ? (
                  <ActivityIndicator color="#6366F1" />
                ) : (
                  <Picker
                    selectedValue={remainderSiteId}
                    onValueChange={(value) => setRemainderSiteId(value)}
                    style={styles.picker}
                  >
                    <Picker.Item label="Seleccionar sede de remanente" value="" />
                    {sites.map((site) => (
                      <Picker.Item
                        key={site.id}
                        label={`${site.code} - ${site.name}`}
                        value={site.id}
                      />
                    ))}
                  </Picker>
                )}
              </View>
            </View>

            {/* Info Box */}
            <View style={[styles.infoBox, isTablet && styles.infoBoxTablet]}>
              <Text style={[styles.infoTitle, isTablet && styles.infoTitleTablet]}>
                ℹ️ Información
              </Text>
              <Text style={[styles.infoText, isTablet && styles.infoTextTablet]}>
                • La campaña se creará en estado BORRADOR{'\n'}• Podrás agregar participantes y
                productos después{'\n'}• Las fechas son opcionales{'\n'}• La sede de remanente es
                OBLIGATORIA y absorberá las unidades del redondeo{'\n'}• Debes activar la campaña
                para generar repartos
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Footer Actions */}
        <View style={[styles.footer, isTablet && styles.footerTablet]}>
          <TouchableOpacity
            style={[styles.cancelButton, isTablet && styles.cancelButtonTablet]}
            onPress={() => navigation.goBack()}
            disabled={loading}
          >
            <Text style={[styles.cancelButtonText, isTablet && styles.cancelButtonTextTablet]}>
              Cancelar
            </Text>
          </TouchableOpacity>

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
                Crear Campaña
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Date Pickers */}
      <DatePicker
        visible={showStartDatePicker}
        date={startDate || new Date()}
        onConfirm={(date) => {
          setStartDate(date);
          setShowStartDatePicker(false);
        }}
        onCancel={() => setShowStartDatePicker(false)}
        title="Fecha de Inicio"
      />

      <DatePicker
        visible={showEndDatePicker}
        date={endDate || new Date()}
        onConfirm={(date) => {
          setEndDate(date);
          setShowEndDatePicker(false);
        }}
        onCancel={() => setShowEndDatePicker(false)}
        minimumDate={startDate}
        title="Fecha de Fin"
      />
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTablet: {
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  backButton: {
    marginBottom: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#6366F1',
    fontWeight: '600',
  },
  backButtonTextTablet: {
    fontSize: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  titleTablet: {
    fontSize: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  scrollContentTablet: {
    padding: 32,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formCardTablet: {
    padding: 24,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  labelTablet: {
    fontSize: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1E293B',
    backgroundColor: '#FFFFFF',
  },
  inputTablet: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 10,
  },
  textAreaTablet: {
    minHeight: 120,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  dateButtonTablet: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#1E293B',
  },
  dateButtonTextTablet: {
    fontSize: 18,
  },
  dateButtonPlaceholder: {
    color: '#94A3B8',
  },
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
    marginTop: 8,
  },
  infoBoxTablet: {
    padding: 16,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 8,
  },
  infoTitleTablet: {
    fontSize: 16,
  },
  infoText: {
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 20,
  },
  infoTextTablet: {
    fontSize: 15,
    lineHeight: 24,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  footerTablet: {
    padding: 24,
    gap: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonTablet: {
    paddingVertical: 16,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  cancelButtonTextTablet: {
    fontSize: 18,
  },
  createButton: {
    flex: 1,
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonTablet: {
    paddingVertical: 16,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  createButtonTextTablet: {
    fontSize: 18,
  },
  helperText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
    lineHeight: 16,
  },
  helperTextTablet: {
    fontSize: 14,
    lineHeight: 18,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  pickerContainerTablet: {
    borderRadius: 10,
  },
  picker: {
    height: 50,
    color: '#1F2937',
  },
});
