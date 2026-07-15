import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth';
import { expensesService, sitesService } from '@/services/api';
import { CreateExpenseProjectRequest, ProjectStatus } from '@/types/expenses';
import { DatePicker } from '@/components/DatePicker';
import { formatDateToString, getTodayString } from '@/utils/dateHelpers';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import Alert from '@/utils/alert';

interface CreateExpenseProjectScreenProps {
  navigation: any;
}

export const CreateExpenseProjectScreen: React.FC<CreateExpenseProjectScreenProps> = ({
  navigation,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { currentSite, currentCompany } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [sites, setSites] = useState<any[]>([]);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [formData, setFormData] = useState<CreateExpenseProjectRequest>({
    companyId: currentCompany?.id || '',
    siteId: '',
    name: '',
    description: '',
    budgetCents: 0,
    currency: 'PEN',
    startDate: getTodayString(),
    endDate: '',
    status: ProjectStatus.PLANNING,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CreateExpenseProjectRequest, string>>>(
    {}
  );

  useEffect(() => {
    loadSites();
  }, []);

  const loadSites = async () => {
    try {
      const sitesRes = await sitesService.getSites({ page: 1, limit: 100 });
      setSites(sitesRes.data || []);
    } catch (error: any) {
      console.error('❌ Error loading sites:', error);
      Alert.alert('Error', 'No se pudieron cargar las sedes');
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof CreateExpenseProjectRequest, string>> = {};

    if (!formData.name || formData.name.trim().length === 0) {
      newErrors.name = 'El nombre es requerido';
    }

    if (!formData.siteId) {
      newErrors.siteId = 'Debe seleccionar una sede';
    }

    if (!formData.budgetCents || formData.budgetCents <= 0) {
      newErrors.budgetCents = 'El presupuesto debe ser mayor a 0';
    }

    if (!formData.startDate) {
      newErrors.startDate = 'La fecha de inicio es requerida';
    }

    if (formData.endDate && new Date(formData.endDate) < new Date(formData.startDate)) {
      newErrors.endDate = 'La fecha de fin debe ser posterior a la fecha de inicio';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const response = await expensesService.createProject({
        ...formData,
        name: formData.name.trim(),
        description: formData.description?.trim(),
      });

      Alert.alert('Éxito', 'Proyecto creado correctamente', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      console.error('Error creating project:', error);
      Alert.alert('Error', error.response?.data?.message || 'No se pudo crear el proyecto');
    } finally {
      setLoading(false);
    }
  };

  const updateField = <K extends keyof CreateExpenseProjectRequest>(
    field: K,
    value: CreateExpenseProjectRequest[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const formatDateDisplay = (dateString: string): string => {
    if (!dateString) {
      return '';
    }
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const handleStartDateConfirm = (date: Date) => {
    const dateString = formatDateToString(date);
    updateField('startDate', dateString);
    setShowStartDatePicker(false);
  };

  const handleEndDateConfirm = (date: Date) => {
    const dateString = formatDateToString(date);
    updateField('endDate', dateString);
    setShowEndDatePicker(false);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.color.icon.default} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nuevo Proyecto</Text>
          <TouchableOpacity onPress={handleSubmit} style={styles.saveButton} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color={theme.color.brand.accent} />
            ) : (
              <Text style={styles.saveButtonText}>Guardar</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Información del Proyecto</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nombre *</Text>
              <TextInput
                style={[styles.input, errors.name && styles.inputError]}
                placeholder="Nombre del proyecto"
                value={formData.name}
                onChangeText={(value) => updateField('name', value)}
                editable={!loading}
              />
              {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Descripción</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Descripción del proyecto (opcional)"
                value={formData.description}
                onChangeText={(value) => updateField('description', value)}
                multiline
                numberOfLines={4}
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Sede *</Text>
              <View style={[styles.pickerContainer, errors.siteId && styles.inputError]}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.pickerScroll}
                >
                  {sites.map((site) => (
                    <TouchableOpacity
                      key={site.id}
                      style={[
                        styles.pickerOption,
                        formData.siteId === site.id && styles.pickerOptionActive,
                      ]}
                      onPress={() => updateField('siteId', site.id)}
                      disabled={loading}
                    >
                      <Text
                        style={[
                          styles.pickerOptionText,
                          formData.siteId === site.id && styles.pickerOptionTextActive,
                        ]}
                      >
                        {site.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              {errors.siteId && <Text style={styles.errorText}>{errors.siteId}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Presupuesto (S/) *</Text>
              <TextInput
                style={[styles.input, errors.budgetCents && styles.inputError]}
                placeholder="0.00"
                value={formData.budgetCents > 0 ? (formData.budgetCents / 100).toFixed(2) : ''}
                onChangeText={(value) => {
                  const cents = Math.round(parseFloat(value || '0') * 100);
                  updateField('budgetCents', isNaN(cents) ? 0 : cents);
                }}
                keyboardType="decimal-pad"
                editable={!loading}
              />
              {errors.budgetCents && <Text style={styles.errorText}>{errors.budgetCents}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Fecha de Inicio *</Text>
              <TouchableOpacity
                style={[styles.dateInput, errors.startDate && styles.inputError]}
                onPress={() => !loading && setShowStartDatePicker(true)}
                disabled={loading}
              >
                <Text style={formData.startDate ? styles.dateText : styles.datePlaceholder}>
                  {formData.startDate ? formatDateDisplay(formData.startDate) : 'Seleccionar fecha'}
                </Text>
                <Ionicons name="calendar" size={20} color={theme.color.brand.accent} />
              </TouchableOpacity>
              {errors.startDate && <Text style={styles.errorText}>{errors.startDate}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Fecha de Fin</Text>
              <TouchableOpacity
                style={[styles.dateInput, errors.endDate && styles.inputError]}
                onPress={() => !loading && setShowEndDatePicker(true)}
                disabled={loading}
              >
                <Text style={formData.endDate ? styles.dateText : styles.datePlaceholder}>
                  {formData.endDate
                    ? formatDateDisplay(formData.endDate)
                    : 'Seleccionar fecha (opcional)'}
                </Text>
                <Ionicons name="calendar" size={20} color={theme.color.brand.accent} />
              </TouchableOpacity>
              {errors.endDate && <Text style={styles.errorText}>{errors.endDate}</Text>}
            </View>
          </View>

          <View style={styles.infoSection}>
            <View style={styles.infoItem}>
              <Ionicons name="information-circle" size={20} color={theme.color.brand.accent} />
              <Text style={styles.infoText}>El proyecto se creará con estado "Planificación"</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Date Pickers */}
      <DatePicker
        visible={showStartDatePicker}
        date={formData.startDate ? new Date(formData.startDate) : new Date()}
        onConfirm={handleStartDateConfirm}
        onCancel={() => setShowStartDatePicker(false)}
        title="Fecha de Inicio"
      />

      <DatePicker
        visible={showEndDatePicker}
        date={formData.endDate ? new Date(formData.endDate) : new Date()}
        onConfirm={handleEndDateConfirm}
        onCancel={() => setShowEndDatePicker(false)}
        title="Fecha de Fin"
      />
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.color.surface.base,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.text.heading,
    flex: 1,
    textAlign: 'center',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.brand.accent,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  formSection: {
    backgroundColor: theme.color.surface.base,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.text.heading,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.body,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.color.text.heading,
    backgroundColor: theme.color.surface.base,
  },
  inputError: {
    borderColor: theme.color.state.danger.border,
  },
  dateInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: theme.color.surface.base,
  },
  dateText: {
    fontSize: 16,
    color: theme.color.text.heading,
  },
  datePlaceholder: {
    fontSize: 16,
    color: theme.color.text.placeholder,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 12,
    color: theme.color.state.danger.text,
    marginTop: 4,
  },
  infoSection: {
    backgroundColor: theme.color.brand.primarySoft,
    borderRadius: 12,
    padding: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: theme.color.text.body,
    lineHeight: 20,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    borderRadius: 8,
    backgroundColor: theme.color.surface.base,
    paddingVertical: 8,
  },
  pickerScroll: {
    paddingHorizontal: 8,
  },
  pickerOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: theme.color.surface.subtle,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    marginRight: 8,
  },
  pickerOptionActive: {
    backgroundColor: theme.color.brand.accent,
    borderColor: theme.color.brand.accent,
  },
  pickerOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.body,
  },
  pickerOptionTextActive: {
    color: theme.color.text.inverse,
  },
});

export default CreateExpenseProjectScreen;
