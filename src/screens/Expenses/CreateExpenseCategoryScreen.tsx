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
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { expensesService } from '@/services/api';
import { ExpenseCategory, CreateExpenseCategoryRequest } from '@/types/expenses';
import { usePermissionError } from '@/hooks/usePermissionError';

interface CreateExpenseCategoryScreenProps {
  navigation: any;
  route?: {
    params?: {
      categoryId?: string;
    };
  };
}

export const CreateExpenseCategoryScreen: React.FC<CreateExpenseCategoryScreenProps> = ({
  navigation,
  route,
}) => {
  const [loading, setLoading] = useState(false);
  const [loadingCategory, setLoadingCategory] = useState(false);
  const [mainCategories, setMainCategories] = useState<ExpenseCategory[]>([]);
  const { handlePermissionError } = usePermissionError();

  const categoryId = route?.params?.categoryId;
  const isEditing = !!categoryId;

  // Form fields
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [isSubcategory, setIsSubcategory] = useState(false);
  const [parentId, setParentId] = useState('');
  const [color, setColor] = useState('#6366F1');
  const [icon, setIcon] = useState('');
  const [displayOrder, setDisplayOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadMainCategories();
    if (isEditing && categoryId) {
      loadCategory();
    }
  }, [categoryId]);

  const loadMainCategories = async () => {
    try {
      const response = await expensesService.getCategories();
      const mains = response.data.filter((cat) => !cat.isSubcategory && cat.isActive);
      setMainCategories(mains);
    } catch (error) {
      console.error('Error loading main categories:', error);
    }
  };

  const loadCategory = async () => {
    if (!categoryId) return;

    try {
      setLoadingCategory(true);
      const category = await expensesService.getCategory(categoryId);

      setName(category.name);
      setCode(category.code);
      setDescription(category.description || '');
      setIsSubcategory(category.isSubcategory);
      setParentId(category.parentId || '');
      setColor(category.color || '#6366F1');
      setIcon(category.icon || '');
      setDisplayOrder(category.displayOrder.toString());
      setIsActive(category.isActive);
    } catch (error: any) {
      console.error('Error loading category:', error);
      Alert.alert('Error', 'No se pudo cargar la categoría');
      navigation.goBack();
    } finally {
      setLoadingCategory(false);
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'El nombre es obligatorio';
    } else if (name.length > 100) {
      newErrors.name = 'El nombre no puede exceder 100 caracteres';
    }

    if (!code.trim()) {
      newErrors.code = 'El código es obligatorio';
    } else if (code.length > 20) {
      newErrors.code = 'El código no puede exceder 20 caracteres';
    } else if (!/^[A-Z0-9-]+$/.test(code)) {
      newErrors.code = 'El código solo puede contener mayúsculas, números y guiones';
    }

    if (isSubcategory && !parentId) {
      newErrors.parentId = 'Debe seleccionar una categoría principal';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      Alert.alert('Error de validación', 'Por favor, corrija los errores en el formulario');
      return;
    }

    try {
      setLoading(true);

      const data: CreateExpenseCategoryRequest = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim() || undefined,
        isSubcategory,
        parentId: isSubcategory ? parentId : undefined,
        color: color || undefined,
        icon: icon.trim() || undefined,
        displayOrder: parseInt(displayOrder) || 0,
        isActive,
      };

      if (isEditing && categoryId) {
        await expensesService.updateCategory(categoryId, data);
        Alert.alert('Éxito', 'Categoría actualizada correctamente');
      } else {
        await expensesService.createCategory(data);
        Alert.alert('Éxito', 'Categoría creada correctamente');
      }

      navigation.goBack();
    } catch (error: any) {
      console.error('Error saving category:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Error al guardar la categoría';

      if (handlePermissionError(error)) {
        return;
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loadingCategory) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Cargando categoría...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditing ? 'Editar Categoría' : 'Nueva Categoría'}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Tipo de Categoría */}
        <View style={styles.section}>
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Text style={styles.label}>Es una subcategoría</Text>
              <Text style={styles.helpText}>
                Las subcategorías pertenecen a una categoría principal
              </Text>
            </View>
            <Switch
              value={isSubcategory}
              onValueChange={setIsSubcategory}
              trackColor={{ false: '#CBD5E1', true: '#A5B4FC' }}
              thumbColor={isSubcategory ? '#6366F1' : '#F1F5F9'}
            />
          </View>
        </View>

        {/* Categoría Principal (solo si es subcategoría) */}
        {isSubcategory && (
          <View style={styles.section}>
            <Text style={styles.label}>
              Categoría Principal <Text style={styles.required}>*</Text>
            </Text>
            <View style={[styles.pickerContainer, errors.parentId && styles.inputError]}>
              <Picker
                selectedValue={parentId}
                onValueChange={setParentId}
                style={styles.picker}
              >
                <Picker.Item label="Seleccione una categoría..." value="" />
                {mainCategories.map((cat) => (
                  <Picker.Item key={cat.id} label={`${cat.name} (${cat.code})`} value={cat.id} />
                ))}
              </Picker>
            </View>
            {errors.parentId && <Text style={styles.errorText}>{errors.parentId}</Text>}
          </View>
        )}

        {/* Nombre */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Nombre <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, errors.name && styles.inputError]}
            value={name}
            onChangeText={setName}
            placeholder="Ej: Servicios, Internet, etc."
            maxLength={100}
          />
          {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          <Text style={styles.helpText}>Máximo 100 caracteres</Text>
        </View>

        {/* Código */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Código <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, errors.code && styles.inputError]}
            value={code}
            onChangeText={(text) => setCode(text.toUpperCase())}
            placeholder="Ej: SRV, SRV-INT"
            maxLength={20}
            autoCapitalize="characters"
          />
          {errors.code && <Text style={styles.errorText}>{errors.code}</Text>}
          <Text style={styles.helpText}>
            Solo mayúsculas, números y guiones. Máximo 20 caracteres
          </Text>
        </View>

        {/* Descripción */}
        <View style={styles.section}>
          <Text style={styles.label}>Descripción</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Descripción opcional de la categoría"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Color */}
        <View style={styles.section}>
          <Text style={styles.label}>Color</Text>
          <View style={styles.colorRow}>
            <View style={[styles.colorPreview, { backgroundColor: color }]} />
            <TextInput
              style={[styles.input, styles.colorInput]}
              value={color}
              onChangeText={setColor}
              placeholder="#6366F1"
              maxLength={7}
            />
          </View>
          <Text style={styles.helpText}>Formato hexadecimal (ej: #6366F1)</Text>
        </View>

        {/* Icono */}
        <View style={styles.section}>
          <Text style={styles.label}>Icono (Ionicons)</Text>
          <View style={styles.iconRow}>
            {icon && (
              <View style={styles.iconPreview}>
                <Ionicons name={icon as any} size={24} color={color} />
              </View>
            )}
            <TextInput
              style={[styles.input, styles.iconInput]}
              value={icon}
              onChangeText={setIcon}
              placeholder="Ej: settings, wifi, home"
            />
          </View>
          <Text style={styles.helpText}>
            Nombre del icono de Ionicons (ej: settings, wifi, home)
          </Text>
        </View>

        {/* Orden de Visualización */}
        <View style={styles.section}>
          <Text style={styles.label}>Orden de Visualización</Text>
          <TextInput
            style={styles.input}
            value={displayOrder}
            onChangeText={setDisplayOrder}
            placeholder="0"
            keyboardType="numeric"
          />
          <Text style={styles.helpText}>Número para ordenar las categorías (menor = primero)</Text>
        </View>

        {/* Activo */}
        <View style={styles.section}>
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Text style={styles.label}>Categoría Activa</Text>
              <Text style={styles.helpText}>
                Solo las categorías activas aparecen en los formularios
              </Text>
            </View>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              trackColor={{ false: '#CBD5E1', true: '#A5B4FC' }}
              thumbColor={isActive ? '#6366F1' : '#F1F5F9'}
            />
          </View>
        </View>

        {/* Botones */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>
                {isEditing ? 'Actualizar' : 'Crear'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
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
  headerRight: {
    width: 32,
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  required: {
    color: '#DC2626',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#1E293B',
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: '#DC2626',
  },
  textArea: {
    minHeight: 80,
    paddingTop: 12,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 4,
  },
  helpText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  switchLabel: {
    flex: 1,
    marginRight: 12,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  colorPreview: {
    width: 50,
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  colorInput: {
    flex: 1,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconPreview: {
    width: 50,
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  iconInput: {
    flex: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  submitButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#6366F1',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bottomSpacer: {
    height: 40,
  },
});

export default CreateExpenseCategoryScreen;
