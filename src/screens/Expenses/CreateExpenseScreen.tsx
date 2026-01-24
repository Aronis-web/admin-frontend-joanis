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
import { expensesService } from '@/services/api';
import { ExpenseStatus, CreateExpenseRequest } from '@/types/expenses';
import { DatePicker, DatePickerButton } from '@/components/DatePicker';
import { usePermissionError } from '@/hooks/usePermissionError';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';

interface CreateExpenseScreenProps {
  navigation: any;
  route?: {
    params?: {
      templateId?: string;
      purchaseId?: string;
      expenseId?: string;
      projectId?: string;
    };
  };
}

export const CreateExpenseScreen: React.FC<CreateExpenseScreenProps> = ({ navigation, route }) => {
  const [loading, setLoading] = useState(false);
  const [loadingExpense, setLoadingExpense] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [projectData, setProjectData] = useState<any>(null);
  const [templateData, setTemplateData] = useState<any>(null);
  const { handlePermissionError, showPermissionAlert } = usePermissionError();
  const { currentCompany } = useAuthStore();
  const { selectedSite } = useTenantStore();

  // Check if we're editing an existing expense
  const expenseId = route?.params?.expenseId;
  const projectId = route?.params?.projectId;
  const templateIdParam = route?.params?.templateId;
  const isEditing = !!expenseId;
  const isFromProject = !!projectId;
  const isFromTemplate = !!templateIdParam;

  // Form fields - New Model
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('PEN');
  const [dueDate, setDueDate] = useState('');
  const [expenseType, setExpenseType] = useState<'UNIQUE'>('UNIQUE');
  const [costType, setCostType] = useState<'FIXED' | 'VARIABLE'>('FIXED');
  const [categoryId, setCategoryId] = useState('');
  const [templateId, setTemplateId] = useState(route?.params?.templateId || '');
  const [purchaseId, setPurchaseId] = useState(route?.params?.purchaseId || '');
  const [notes, setNotes] = useState('');
  const [description, setDescription] = useState('');
  const [manualSiteId, setManualSiteId] = useState('');

  // Date picker state
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);

  useEffect(() => {
    loadData();
    if (isEditing && expenseId) {
      loadExpense();
    }
    if (isFromProject && projectId) {
      loadProject();
    }
    if (isFromTemplate && templateIdParam) {
      loadTemplate();
    }
  }, [expenseId, projectId, templateIdParam]);

  const loadExpense = async () => {
    if (!expenseId) {
      return;
    }

    try {
      setLoadingExpense(true);
      console.log('📦 Loading expense for editing:', expenseId);
      const expense = await expensesService.getExpense(expenseId);
      console.log('📦 Expense loaded:', expense);

      // Populate form fields with expense data
      setName(expense.name || '');
      setAmount(expense.amountCents ? (Number(expense.amountCents) / 100).toString() : '');
      setCurrency(expense.currency || 'PEN');
      setDueDate(expense.dueDate || '');
      // Only allow editing UNIQUE expenses
      const mappedExpenseType =
        expense.expenseType === 'ONE_TIME' ? 'UNIQUE' : expense.expenseType || 'UNIQUE';
      if (mappedExpenseType !== 'UNIQUE') {
        Alert.alert(
          'Error',
          'Solo se pueden editar gastos únicos. Los gastos recurrentes deben editarse desde sus plantillas.'
        );
        navigation.goBack();
        return;
      }
      setExpenseType('UNIQUE');
      setCostType(expense.costType || 'FIXED');
      setCategoryId(expense.category?.id || '');
      setTemplateId(expense.template?.id || '');
      setPurchaseId(expense.purchase?.id || '');
      setNotes(expense.notes || '');
      setDescription(expense.description || '');
    } catch (error: any) {
      console.error('❌ Error loading expense:', error);
      Alert.alert('Error', 'No se pudo cargar el gasto para editar');
      navigation.goBack();
    } finally {
      setLoadingExpense(false);
    }
  };

  const loadProject = async () => {
    if (!projectId) {
      return;
    }
    try {
      console.log('📦 Loading project data:', projectId);
      const project = await expensesService.getProject(projectId);
      console.log('📦 Project loaded:', project);
      setProjectData(project);
    } catch (error: any) {
      console.error('❌ Error loading project:', error);
      Alert.alert('Error', 'No se pudo cargar la información del proyecto');
    }
  };

  const loadTemplate = async () => {
    if (!templateIdParam) {
      return;
    }
    try {
      console.log('📦 Loading template data:', templateIdParam);
      const template = await expensesService.getTemplate(templateIdParam);
      console.log('📦 Template loaded:', template);
      setTemplateData(template);
      // Pre-fill form with template data
      if (template.name) {
        setName(template.name);
      }
      if (template.amountCents) {
        setAmount((template.amountCents / 100).toString());
      }
      if (template.currency) {
        setCurrency(template.currency);
      }
      if (template.categoryId) {
        setCategoryId(template.categoryId);
      }
      if (template.description) {
        setDescription(template.description);
      }
    } catch (error: any) {
      console.error('❌ Error loading template:', error);
      Alert.alert('Error', 'No se pudo cargar la información de la plantilla');
    }
  };

  const loadData = async () => {
    try {
      console.log('📦 Loading data for expense creation...');

      // Import sitesService
      const { sitesService } = await import('@/services/api');

      const [categoriesRes, templatesRes, sitesRes] = await Promise.all([
        expensesService.getCategories(),
        expensesService.getTemplates(),
        sitesService.getSites({ page: 1, limit: 100 }),
      ]);
      console.log('📦 Categories:', categoriesRes);
      console.log('📦 Templates:', templatesRes);
      console.log('📦 Sites:', sitesRes);

      // Templates now returns an array directly
      setCategories(categoriesRes.data || []);
      setTemplates(Array.isArray(templatesRes) ? templatesRes : []);
      setSites(sitesRes.data || []);

      console.log('📦 Categories count:', (categoriesRes.data || []).length);
      console.log('📦 Templates count:', (Array.isArray(templatesRes) ? templatesRes : []).length);
      console.log('📦 Sites count:', (sitesRes.data || []).length);
    } catch (error: any) {
      console.error('❌ Error loading data:', error);

      // Check if it's a permission error
      if (handlePermissionError(error)) {
        showPermissionAlert(error);
        return;
      }

      Alert.alert('Error', 'No se pudieron cargar los datos necesarios');
    }
  };

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      Alert.alert('Error', 'El nombre del gasto es requerido');
      return;
    }

    if (!amount.trim()) {
      Alert.alert('Error', 'El monto es requerido');
      return;
    }

    if (!dueDate) {
      Alert.alert('Error', 'La fecha de vencimiento es requerida');
      return;
    }

    if (!currentCompany?.id) {
      Alert.alert('Error', 'No se ha seleccionado una empresa');
      return;
    }

    const amountValue = parseFloat(amount);

    if (isNaN(amountValue) || amountValue <= 0) {
      Alert.alert('Error', 'El monto debe ser mayor a 0');
      return;
    }

    setLoading(true);
    try {
      if (isEditing && expenseId) {
        // Update existing expense
        const updateData: any = {
          name: name.trim(),
          amountCents: Math.round(amountValue * 100),
          currency,
          dueDate,
          expenseType,
          costType,
          categoryId: categoryId || undefined,
          templateId: templateId || undefined,
          purchaseId: purchaseId || undefined,
          notes: notes.trim() || undefined,
          description: description.trim() || undefined,
        };

        await expensesService.updateExpense(expenseId, updateData);
        Alert.alert('Éxito', 'Gasto actualizado correctamente', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      } else {
        // Determine which siteId to use
        let siteIdToUse: string | undefined;

        if (isFromProject && projectData?.siteId) {
          // Use site from project
          siteIdToUse = projectData.siteId;
          console.log('📍 Using site from project:', siteIdToUse);
        } else if (isFromTemplate && templateData?.siteId) {
          // Use site from template (if template has siteId)
          siteIdToUse = templateData.siteId;
          console.log('📍 Using site from template:', siteIdToUse);
        } else if (manualSiteId) {
          // Use manually selected site
          siteIdToUse = manualSiteId;
          console.log('📍 Using manually selected site:', siteIdToUse);
        } else if (selectedSite?.id) {
          // Fallback to current selected site
          siteIdToUse = selectedSite.id;
          console.log('📍 Using current selected site:', siteIdToUse);
        }

        // Validate required fields
        if (!siteIdToUse) {
          Alert.alert('Error', 'No hay una sede seleccionada. Por favor, selecciona una sede.');
          return;
        }

        // Create new expense
        const createData: CreateExpenseRequest = {
          name: name.trim(),
          companyId: currentCompany.id,
          siteId: siteIdToUse, // Required field
          amountCents: Math.round(amountValue * 100),
          currency,
          dueDate,
          expenseType,
          costType,
          // Note: status is set automatically by backend (ACTIVE by default)
          categoryId: categoryId || undefined,
          templateId: templateId || undefined,
          purchaseId: purchaseId || undefined,
          projectId: projectId || undefined, // Include projectId if creating from project
          notes: notes.trim() || undefined,
          description: description.trim() || undefined,
        };

        console.log('📝 Creating expense:', {
          ...createData,
          isFromProject,
          projectId,
          siteName: selectedSite.name,
        });

        const newExpense = await expensesService.createExpense(createData);

        const successMessage = isFromProject
          ? 'Gasto creado y asociado al proyecto correctamente'
          : 'Gasto creado correctamente';

        Alert.alert('Éxito', successMessage, [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      }
    } catch (error: any) {
      console.error('Error saving expense:', error);

      // Check if it's a permission error
      if (handlePermissionError(error)) {
        showPermissionAlert(error);
        return;
      }

      Alert.alert('Error', error.response?.data?.message || 'No se pudo guardar el gasto');
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
      {label && <Text style={styles.pickerLabel}>{label}</Text>}
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditing ? 'Editar Gasto' : isFromProject ? 'Crear Gasto para Proyecto' : 'Crear Gasto'}
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

      {loadingExpense ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Cargando gasto...</Text>
        </View>
      ) : (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          {/* Project Info Banner */}
          {isFromProject && projectData && (
            <View style={styles.projectBanner}>
              <Ionicons name="folder-open" size={20} color="#6366F1" />
              <View style={styles.bannerContent}>
                <Text style={styles.projectBannerText}>
                  Este gasto se asociará automáticamente al proyecto
                </Text>
                <Text style={styles.projectBannerSubtext}>Proyecto: {projectData.name}</Text>
                {projectData.site && (
                  <Text style={styles.projectBannerSubtext}>Sede: {projectData.site.name}</Text>
                )}
              </View>
            </View>
          )}

          {/* Template Info Banner */}
          {isFromTemplate && templateData && (
            <View style={styles.templateBanner}>
              <Ionicons name="repeat" size={20} color="#10B981" />
              <View style={styles.bannerContent}>
                <Text style={styles.templateBannerText}>
                  Creando gasto desde plantilla recurrente
                </Text>
                <Text style={styles.templateBannerSubtext}>Plantilla: {templateData.name}</Text>
              </View>
            </View>
          )}

          {/* Basic Information */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Información Básica</Text>

            {/* Site Selection - Only show manual selector if NOT from project or template */}
            {!isFromProject && !isFromTemplate && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Sede *</Text>
                {renderPicker('', manualSiteId, setManualSiteId, [
                  { label: 'Seleccionar sede', value: '' },
                  ...sites.map((site) => ({
                    label: site.name,
                    value: site.id,
                  })),
                ])}
              </View>
            )}

            {/* Show site info if from project */}
            {isFromProject && projectData?.site && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Sede</Text>
                <View style={styles.disabledInput}>
                  <Ionicons name="business" size={16} color="#6366F1" style={{ marginRight: 8 }} />
                  <Text style={styles.disabledInputText}>{projectData.site.name}</Text>
                </View>
                <Text style={styles.infoText}>💡 La sede se toma automáticamente del proyecto</Text>
              </View>
            )}

            {/* Show site info if from template */}
            {isFromTemplate && templateData?.site && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Sede</Text>
                <View style={styles.disabledInput}>
                  <Ionicons name="business" size={16} color="#10B981" style={{ marginRight: 8 }} />
                  <Text style={styles.disabledInputText}>{templateData.site.name}</Text>
                </View>
                <Text style={styles.infoText}>
                  💡 La sede se toma automáticamente del gasto recurrente
                </Text>
              </View>
            )}

            {renderInput(
              'Nombre del Gasto',
              name,
              setName,
              'Ej: Alquiler local',
              'default',
              'pricetag'
            )}
            {renderInput('Monto Estimado', amount, setAmount, '0.00', 'decimal-pad', 'cash')}
            {renderInput(
              'Descripción (opcional)',
              description,
              setDescription,
              'Descripción del gasto',
              'default',
              'document-text',
              true
            )}
          </View>

          {/* Date and Type */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Fecha y Tipo</Text>

            <DatePickerButton
              label="Fecha de Vencimiento"
              value={dueDate}
              onPress={() => setShowDueDatePicker(true)}
              placeholder="Seleccionar fecha de vencimiento"
            />

            {/* Expense Type - Only UNIQUE is available */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Tipo de Gasto</Text>
              <View style={styles.disabledInput}>
                <Text style={styles.disabledInputText}>Único</Text>
              </View>
              <Text style={styles.infoText}>
                💡 Este es un gasto único. Para gastos recurrentes, use la sección "Gastos
                Recurrentes".
              </Text>
            </View>

            {renderPicker(
              'Tipo de Costo',
              costType,
              (value) => setCostType(value as 'FIXED' | 'VARIABLE'),
              [
                { label: 'Fijo', value: 'FIXED' },
                { label: 'Variable', value: 'VARIABLE' },
              ]
            )}
          </View>

          {/* Category and Template */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Categorización</Text>

            {renderPicker('Categoría (opcional)', categoryId, setCategoryId, [
              { label: 'Sin categoría', value: '' },
              ...categories.map((cat) => ({
                label: cat.name,
                value: cat.id,
              })),
            ])}

            {templates.length > 0 &&
              renderPicker('Plantilla (opcional)', templateId, setTemplateId, [
                { label: 'Sin plantilla', value: '' },
                ...templates.map((tmpl) => ({
                  label: tmpl.name,
                  value: tmpl.id,
                })),
              ])}
          </View>

          {/* Notes */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Notas Adicionales</Text>

            {renderInput(
              'Notas (opcional)',
              notes,
              setNotes,
              'Notas o comentarios adicionales',
              'default',
              'chatbox-outline',
              true
            )}
          </View>

          {/* Date Picker */}
          <DatePicker
            visible={showDueDatePicker}
            date={dueDate ? new Date(dueDate) : new Date()}
            onConfirm={(date) => {
              setDueDate(date.toISOString().split('T')[0]);
              setShowDueDatePicker(false);
            }}
            onCancel={() => setShowDueDatePicker(false)}
            title="Fecha de Vencimiento"
          />
        </ScrollView>
      )}
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginLeft: 12,
  },
  recurrenceSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  recurrenceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6366F1',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 12,
    lineHeight: 18,
  },
  disabledInput: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  disabledInputText: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
  },
  projectBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 12,
  },
  projectBannerText: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '600',
  },
  projectBannerSubtext: {
    fontSize: 12,
    color: '#6366F1',
    marginTop: 4,
    opacity: 0.8,
  },
  templateBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 12,
  },
  templateBannerText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
  templateBannerSubtext: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 4,
    opacity: 0.8,
  },
  bannerContent: {
    flex: 1,
  },
  disabledInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  disabledInputText: {
    fontSize: 15,
    color: '#475569',
    fontWeight: '500',
  },
  infoText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
    fontStyle: 'italic',
  },
});

export default CreateExpenseScreen;
