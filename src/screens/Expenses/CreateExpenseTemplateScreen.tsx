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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { expensesService, sitesService, suppliersService } from '@/services/api';
import {
  RecurrenceType,
  RecurrenceTypeLabels,
  TemplateFrequency,
  TemplateFrequencyLabels,
  TemplateExpenseType,
  TemplateExpenseTypeLabels,
  CreateExpenseTemplateRequest,
  UpdateExpenseTemplateRequest,
  Supplier,
  SupplierLegalEntity,
} from '@/types/expenses';
import { DatePicker, DatePickerButton } from '@/components/DatePicker';
import { SupplierSearchInput } from '@/components/Suppliers/SupplierSearchInput';
import { useAuthStore } from '@/store/auth';
import { usePermissionError } from '@/hooks/usePermissionError';

interface CreateExpenseTemplateScreenProps {
  navigation?: any;
  route?: {
    params?: {
      templateId?: string;
    };
  };
}

export const CreateExpenseTemplateScreen: React.FC<CreateExpenseTemplateScreenProps> = ({
  navigation,
  route,
}) => {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const { currentCompany, user } = useAuthStore();
  const { handlePermissionError, showPermissionAlert } = usePermissionError();

  // Form fields
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [siteId, setSiteId] = useState('');
  const [templateExpenseType, setTemplateExpenseType] = useState<TemplateExpenseType>(
    TemplateExpenseType.RECURRENT
  );
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(RecurrenceType.REGULAR);
  const [frequency, setFrequency] = useState<TemplateFrequency>(TemplateFrequency.MONTHLY);
  const [dayOfWeek, setDayOfWeek] = useState<number | undefined>(undefined);
  const [dayOfMonth, setDayOfMonth] = useState<number | undefined>(undefined);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [occurrences, setOccurrences] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('PEN');

  // ============================================
  // NUEVOS CAMPOS - Integración con Proveedores
  // ============================================
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierLegalEntityId, setSupplierLegalEntityId] = useState('');
  const [legalEntities, setLegalEntities] = useState<SupplierLegalEntity[]>([]);

  // Date picker state
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  useEffect(() => {
    loadData();
    if (route?.params?.templateId) {
      loadTemplateData(route.params.templateId);
    }
  }, [route?.params?.templateId]);

  // ============================================
  // EFECTO: Cargar razones sociales cuando se selecciona proveedor
  // ============================================
  useEffect(() => {
    if (selectedSupplier?.id) {
      loadLegalEntities(selectedSupplier.id);
    } else {
      setLegalEntities([]);
      setSupplierLegalEntityId('');
    }
  }, [selectedSupplier?.id]);

  const loadLegalEntities = async (supplierId: string) => {
    try {
      const supplier = await suppliersService.getSupplier(supplierId);
      if (supplier.legalEntities && supplier.legalEntities.length > 0) {
        setLegalEntities(supplier.legalEntities);

        // Auto-select primary legal entity if exists
        const primaryEntity = supplier.legalEntities.find((le) => le.isPrimary);
        if (primaryEntity && !supplierLegalEntityId) {
          setSupplierLegalEntityId(primaryEntity.id);
        }
      } else {
        setLegalEntities([]);
        Alert.alert(
          'Advertencia',
          'Este proveedor no tiene razones sociales registradas. Por favor, agregue al menos una razón social antes de continuar.'
        );
      }
    } catch (error) {
      console.error('Error loading legal entities:', error);
      Alert.alert('Error', 'No se pudieron cargar las razones sociales del proveedor');
    }
  };

  const loadData = async () => {
    try {
      console.log('📦 Loading data for template creation...');

      const [categoriesRes, sitesRes] = await Promise.all([
        expensesService.getCategories(),
        sitesService.getSites({ page: 1, limit: 100 }),
      ]);
      console.log('📦 Categories:', categoriesRes);
      console.log('📦 Sites:', sitesRes);

      setCategories(categoriesRes.data || []);
      setSites(sitesRes.data || []);
      console.log('📦 Categories count:', (categoriesRes.data || []).length);
      console.log('📦 Sites count:', (sitesRes.data || []).length);
    } catch (error: any) {
      console.error('❌ Error loading data:', error);

      if (handlePermissionError(error)) {
        showPermissionAlert(error);
        return;
      }

      Alert.alert('Error', 'No se pudieron cargar los datos necesarios');
    }
  };

  const loadTemplateData = async (templateId: string) => {
    try {
      setLoading(true);
      console.log('📦 Loading template data for editing:', templateId);

      const template = await expensesService.getTemplate(templateId);
      console.log('📦 Template loaded:', template);

      // Populate form fields with template data
      setCode(template.code || '');
      setName(template.name || '');
      setDescription(template.description || '');
      setSiteId(template.site?.id || '');
      setTemplateExpenseType(template.templateExpenseType || TemplateExpenseType.RECURRENT);
      setRecurrenceType(template.recurrenceType || RecurrenceType.REGULAR);
      setFrequency(template.frequency || TemplateFrequency.MONTHLY);
      setDayOfWeek(template.dayOfWeek ?? undefined);
      setDayOfMonth(template.dayOfMonth ?? undefined);
      setStartDate(template.startDate || '');
      setEndDate(template.endDate || '');
      setOccurrences(template.occurrences ? String(template.occurrences) : '');
      setIsActive(template.isActive ?? true);
      setCategoryId(template.category?.id || '');
      setAmount(template.amountCents ? String(template.amountCents / 100) : '');
      setCurrency(template.currency || 'PEN');

      // Load supplier data if exists
      if (template.supplier) {
        setSelectedSupplier(template.supplier as unknown as Supplier);
      }
      if (template.supplierLegalEntityId) {
        setSupplierLegalEntityId(template.supplierLegalEntityId);
      }

      console.log('✅ Template data loaded successfully');
    } catch (error: any) {
      console.error('❌ Error loading template:', error);

      if (handlePermissionError(error)) {
        showPermissionAlert(error);
        return;
      }

      Alert.alert('Error', 'No se pudo cargar la plantilla para editar');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!code.trim()) {
      Alert.alert('Error', 'El código de la plantilla es requerido');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Error', 'El nombre de la plantilla es requerido');
      return;
    }

    if (!siteId) {
      Alert.alert('Error', 'Debe seleccionar una sede');
      return;
    }

    if (!categoryId) {
      Alert.alert('Error', 'Debe seleccionar una categoría');
      return;
    }

    if (!startDate) {
      Alert.alert('Error', 'La fecha de inicio es requerida');
      return;
    }

    // Validate recurrence type specific fields
    if (recurrenceType === RecurrenceType.REGULAR) {
      if (!frequency) {
        Alert.alert('Error', 'Debe seleccionar una frecuencia para gastos regulares');
        return;
      }

      if (frequency === TemplateFrequency.WEEKLY && !dayOfWeek) {
        Alert.alert('Error', 'Debe seleccionar el día de la semana para frecuencia semanal');
        return;
      }

      if (frequency === TemplateFrequency.MONTHLY && !dayOfMonth) {
        Alert.alert('Error', 'Debe seleccionar el día del mes para frecuencia mensual');
        return;
      }
    }

    if (!currentCompany?.id) {
      Alert.alert('Error', 'No hay una empresa seleccionada');
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'No hay un usuario autenticado');
      return;
    }

    // ============================================
    // VALIDACIÓN: Proveedor y RUC son OBLIGATORIOS
    // ============================================
    if (!selectedSupplier) {
      Alert.alert('Error', 'Debe seleccionar un proveedor');
      return;
    }

    if (!supplierLegalEntityId) {
      Alert.alert('Error', 'Debe seleccionar el RUC del proveedor');
      return;
    }

    setLoading(true);
    try {
      const templateId = route?.params?.templateId;

      if (templateId) {
        // Update existing template
        const updateData: UpdateExpenseTemplateRequest = {
          code: code.trim(),
          name: name.trim(),
          description: description.trim() || undefined,
          templateExpenseType,
          baseAmount: amount ? parseFloat(amount) : undefined,
          currency,
          recurrenceType,
          frequency: recurrenceType === RecurrenceType.REGULAR ? frequency : undefined,
          dayOfWeek,
          dayOfMonth,
          startDate: startDate,
          endDate: endDate || undefined,
          occurrences: occurrences ? parseInt(occurrences) : undefined,
          isActive,
          categoryId,
          supplierId: selectedSupplier.id,
          supplierLegalEntityId: supplierLegalEntityId,
        };

        await expensesService.updateTemplate(templateId, updateData);
        Alert.alert('Éxito', 'Plantilla de gasto recurrente actualizada correctamente', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      } else {
        // Create new template
        const createData: CreateExpenseTemplateRequest = {
          code: code.trim(),
          companyId: currentCompany.id,
          siteId: siteId,
          name: name.trim(),
          description: description.trim() || undefined,
          templateExpenseType,
          amountCents: amount ? Math.round(parseFloat(amount) * 100) : undefined,
          currency,
          recurrenceType,
          frequency: recurrenceType === RecurrenceType.REGULAR ? frequency : undefined,
          dayOfWeek,
          dayOfMonth,
          startDate: startDate,
          endDate: endDate || undefined,
          occurrences: occurrences ? parseInt(occurrences) : undefined,
          isActive,
          categoryId,
          createdBy: user.id,
          supplierId: selectedSupplier.id,
          supplierLegalEntityId: supplierLegalEntityId,
        };

        await expensesService.createTemplate(createData);
        Alert.alert('Éxito', 'Plantilla de gasto recurrente creada correctamente', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      }
    } catch (error: any) {
      console.error('Error saving template:', error);

      if (handlePermissionError(error)) {
        showPermissionAlert(error);
        return;
      }

      Alert.alert(
        'Error',
        error.response?.data?.message ||
          `No se pudo ${route?.params?.templateId ? 'actualizar' : 'crear'} la plantilla`
      );
    } finally {
      setLoading(false);
    }
  };

  const renderPicker = (
    label: string,
    value: string,
    onValueChange: (value: string) => void,
    options: { label: string; value: string }[]
  ) => (
    <View style={styles.pickerContainer}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[styles.pickerOption, value === option.value && styles.pickerOptionActive]}
            onPress={() => onValueChange(option.value)}
          >
            <Text
              style={[
                styles.pickerOptionText,
                value === option.value && styles.pickerOptionTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderInput = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    keyboardType: any = 'default',
    icon?: string,
    multiline: boolean = false
  ) => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputWrapper}>
        {icon && <Ionicons name={icon as any} size={20} color="#64748B" style={styles.inputIcon} />}
        <TextInput
          style={[styles.input, multiline && styles.inputMultiline]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={multiline ? 4 : 1}
        />
      </View>
    </View>
  );

  const renderDayOfWeekPicker = () => {
    const days = [
      { label: 'Lun', value: 1 },
      { label: 'Mar', value: 2 },
      { label: 'Mié', value: 3 },
      { label: 'Jue', value: 4 },
      { label: 'Vie', value: 5 },
      { label: 'Sáb', value: 6 },
      { label: 'Dom', value: 7 },
    ];

    return (
      <View style={styles.pickerContainer}>
        <Text style={styles.pickerLabel}>Día de la Semana</Text>
        <View style={styles.dayGrid}>
          {days.map((day) => (
            <TouchableOpacity
              key={day.value}
              style={[styles.dayButton, dayOfWeek === day.value && styles.dayButtonActive]}
              onPress={() => setDayOfWeek(day.value)}
            >
              <Text
                style={[
                  styles.dayButtonText,
                  dayOfWeek === day.value && styles.dayButtonTextActive,
                ]}
              >
                {day.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderDayOfMonthPicker = () => {
    const days = Array.from({ length: 31 }, (_, i) => i + 1);

    return (
      <View style={styles.pickerContainer}>
        <Text style={styles.pickerLabel}>Día del Mes</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
          {days.map((day) => (
            <TouchableOpacity
              key={day}
              style={[styles.dayButton, dayOfMonth === day && styles.dayButtonActive]}
              onPress={() => setDayOfMonth(day)}
            >
              <Text
                style={[styles.dayButtonText, dayOfMonth === day && styles.dayButtonTextActive]}
              >
                {day}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {route?.params?.templateId ? 'Editar Plantilla' : 'Gastos Recurrentes'}
        </Text>
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Guardar</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Basic Information */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Información Básica</Text>

          {renderInput('Código', code, setCode, 'Ej: TMP-2024-00001', 'default', 'barcode')}
          {renderInput('Nombre', name, setName, 'Ej: Alquiler Oficina', 'default', 'pricetag')}
          {renderInput(
            'Descripción (opcional)',
            description,
            setDescription,
            'Descripción detallada del gasto recurrente',
            'default',
            'document-text',
            true
          )}

          {/* Sede Selection - Required */}
          {renderPicker('Sede *', siteId, setSiteId, [
            { label: 'Seleccionar sede', value: '' },
            ...sites.map((site) => ({
              label: site.name,
              value: site.id,
            })),
          ])}

          {renderInput('Monto (opcional)', amount, setAmount, 'Ej: 1500.00', 'decimal-pad', 'cash')}
          {renderPicker('Moneda', currency, setCurrency, [
            { label: 'Soles (PEN)', value: 'PEN' },
            { label: 'Dólares (USD)', value: 'USD' },
            { label: 'Euros (EUR)', value: 'EUR' },
          ])}
        </View>

        {/* Template Type */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tipo de Plantilla</Text>

          {renderPicker(
            'Tipo de Gasto',
            templateExpenseType,
            (value) => setTemplateExpenseType(value as TemplateExpenseType),
            Object.entries(TemplateExpenseTypeLabels).map(([key, label]) => ({
              label,
              value: key,
            }))
          )}

          {templateExpenseType === TemplateExpenseType.RECURRENT && (
            <Text style={styles.infoText}>
              💡 Esta plantilla generará gastos múltiples veces según la frecuencia configurada.
            </Text>
          )}

          {templateExpenseType === TemplateExpenseType.SEMI_RECURRENT && (
            <Text style={[styles.infoText, { color: '#F59E0B' }]}>
              ⚠️ Esta plantilla generará un solo gasto y luego se desactivará automáticamente.
            </Text>
          )}
        </View>

        {/* Recurrence Configuration */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Configuración de Recurrencia</Text>

          {renderPicker(
            'Tipo de Recurrencia',
            recurrenceType,
            (value) => {
              setRecurrenceType(value as RecurrenceType);
              // Reset frequency-specific fields when changing type
              if (value !== RecurrenceType.REGULAR) {
                setFrequency(TemplateFrequency.MONTHLY);
                setDayOfWeek(undefined);
                setDayOfMonth(undefined);
              }
            },
            Object.entries(RecurrenceTypeLabels).map(([key, label]) => ({
              label,
              value: key,
            }))
          )}

          {recurrenceType === RecurrenceType.REGULAR && (
            <>
              {renderPicker(
                'Frecuencia',
                frequency,
                (value) => {
                  setFrequency(value as TemplateFrequency);
                  // Reset day-specific fields when changing frequency
                  setDayOfWeek(undefined);
                  setDayOfMonth(undefined);
                },
                Object.entries(TemplateFrequencyLabels).map(([key, label]) => ({
                  label,
                  value: key,
                }))
              )}

              {frequency === TemplateFrequency.WEEKLY && renderDayOfWeekPicker()}

              {frequency === TemplateFrequency.MONTHLY && renderDayOfMonthPicker()}
            </>
          )}
        </View>

        {/* Dates */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fechas</Text>

          <DatePickerButton
            label="Fecha de Inicio"
            value={startDate}
            onPress={() => setShowStartDatePicker(true)}
            placeholder="Seleccionar fecha de inicio"
          />

          <DatePickerButton
            label="Fecha de Fin (opcional)"
            value={endDate}
            onPress={() => setShowEndDatePicker(true)}
            placeholder="Seleccionar fecha de fin"
          />

          {renderInput(
            'Número de Ocurrencias (opcional)',
            occurrences,
            setOccurrences,
            'Ej: 12',
            'number-pad',
            'repeat'
          )}
        </View>

        {/* Category */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Categorización</Text>

          {renderPicker(
            'Categoría',
            categoryId,
            setCategoryId,
            categories.map((cat) => ({
              label: cat.name,
              value: cat.id,
            }))
          )}
        </View>

        {/* ============================================ */}
        {/* NUEVA SECCIÓN: Proveedor y Razón Social */}
        {/* ============================================ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Proveedor</Text>

          {/* Buscador de Proveedor */}
          <SupplierSearchInput
            selectedSupplier={selectedSupplier || undefined}
            onSelect={(supplier) => setSelectedSupplier(supplier)}
            label="Proveedor *"
            placeholder="Buscar proveedor..."
          />

          {/* Selector de Razón Social (RUC) */}
          {selectedSupplier && legalEntities.length > 0 && (
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>
                RUC del Proveedor <Text style={styles.required}>*</Text>
              </Text>
              {renderPicker('', supplierLegalEntityId, setSupplierLegalEntityId, [
                { label: 'Seleccionar RUC', value: '' },
                ...legalEntities.map((le) => ({
                  label: `${le.legalName} - RUC: ${le.ruc}${le.isPrimary ? ' (Principal)' : ''}`,
                  value: le.id,
                })),
              ])}
              <Text style={styles.infoText}>
                💡 Seleccione el RUC específico para la facturación
              </Text>
            </View>
          )}

          {/* Información sobre Cuenta por Pagar */}
          {selectedSupplier && supplierLegalEntityId && (
            <View style={styles.infoBanner}>
              <Ionicons name="information-circle" size={20} color="#6366F1" />
              <Text style={styles.infoBannerText}>
                Los gastos generados desde esta plantilla se vincularán automáticamente al
                proveedor seleccionado.
              </Text>
            </View>
          )}
        </View>

        {/* Status */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Estado</Text>

          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleButton, isActive && styles.toggleButtonActive]}
              onPress={() => setIsActive(true)}
            >
              <Text style={[styles.toggleButtonText, isActive && styles.toggleButtonTextActive]}>
                Activo
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, !isActive && styles.toggleButtonActive]}
              onPress={() => setIsActive(false)}
            >
              <Text style={[styles.toggleButtonText, !isActive && styles.toggleButtonTextActive]}>
                Inactivo
              </Text>
            </TouchableOpacity>
          </View>

          {isActive && templateExpenseType === TemplateExpenseType.RECURRENT && (
            <Text style={styles.infoText}>
              La plantilla generará gastos automáticamente según la configuración de recurrencia.
            </Text>
          )}

          {isActive && templateExpenseType === TemplateExpenseType.SEMI_RECURRENT && (
            <Text style={[styles.infoText, { color: '#F59E0B' }]}>
              La plantilla generará un solo gasto y luego se desactivará automáticamente.
            </Text>
          )}
        </View>

        {/* Date Pickers */}
        <DatePicker
          visible={showStartDatePicker}
          date={startDate || new Date().toISOString().split('T')[0]}
          onConfirm={(date) => {
            // Send ISO 8601 date string (YYYY-MM-DD format)
            // Backend expects valid ISO 8601 date string
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            setStartDate(`${year}-${month}-${day}`);
            setShowStartDatePicker(false);
          }}
          onCancel={() => setShowStartDatePicker(false)}
          title="Fecha de Inicio"
        />

        <DatePicker
          visible={showEndDatePicker}
          date={endDate || new Date().toISOString().split('T')[0]}
          onConfirm={(date) => {
            // Send ISO 8601 date string (YYYY-MM-DD format)
            // Backend expects valid ISO 8601 date string
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            setEndDate(`${year}-${month}-${day}`);
            setShowEndDatePicker(false);
          }}
          onCancel={() => setShowEndDatePicker(false)}
          title="Fecha de Fin"
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1E293B',
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    marginBottom: 16,
  },
  pickerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  pickerScroll: {
    flexDirection: 'row',
  },
  pickerOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  pickerOptionActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  pickerOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  pickerOptionTextActive: {
    color: '#FFFFFF',
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayButtonActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  dayButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  dayButtonTextActive: {
    color: '#FFFFFF',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  toggleButtonTextActive: {
    color: '#FFFFFF',
  },
  infoText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 12,
    lineHeight: 18,
  },
  required: {
    color: '#EF4444',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    gap: 12,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#6366F1',
    lineHeight: 18,
  },
});

export default CreateExpenseTemplateScreen;
