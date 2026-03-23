import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { expensesService } from '@/services/api';
import { ExpenseCategory } from '@/types/expenses';

interface CategorySubcategorySelectorProps {
  categoryId: string;
  subcategoryId: string;
  onCategoryChange: (categoryId: string) => void;
  onSubcategoryChange: (subcategoryId: string) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  subcategoryError?: string;
}

export const CategorySubcategorySelector: React.FC<CategorySubcategorySelectorProps> = ({
  categoryId,
  subcategoryId,
  onCategoryChange,
  onSubcategoryChange,
  required = false,
  disabled = false,
  error,
  subcategoryError,
}) => {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [subcategories, setSubcategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (categoryId) {
      const selectedCategory = categories.find((c) => c.id === categoryId);
      setSubcategories(selectedCategory?.subcategories || []);
    } else {
      setSubcategories([]);
    }
  }, [categoryId, categories]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const response = await expensesService.getCategories();
      const mainCategories = response.data.filter((cat) => !cat.isSubcategory && cat.isActive);
      setCategories(mainCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (value: string) => {
    onCategoryChange(value);
    // Reset subcategory when category changes
    onSubcategoryChange('');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#6366F1" />
        <Text style={styles.loadingText}>Cargando categorías...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Categoría Principal */}
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>
          Categoría Principal {required && <Text style={styles.required}>*</Text>}
        </Text>
        <View style={[styles.pickerContainer, error && styles.pickerError]}>
          <Picker
            selectedValue={categoryId}
            onValueChange={handleCategoryChange}
            enabled={!disabled}
            style={styles.picker}
          >
            <Picker.Item label="Seleccione una categoría..." value="" />
            {categories.map((cat) => (
              <Picker.Item
                key={cat.id}
                label={`${cat.icon || ''} ${cat.name} (${cat.code})`}
                value={cat.id}
              />
            ))}
          </Picker>
        </View>
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      {/* Subcategoría */}
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>
          Subcategoría {required && <Text style={styles.required}>*</Text>}
        </Text>
        <View
          style={[
            styles.pickerContainer,
            subcategoryError && styles.pickerError,
            (!categoryId || subcategories.length === 0) && styles.pickerDisabled,
          ]}
        >
          <Picker
            selectedValue={subcategoryId}
            onValueChange={onSubcategoryChange}
            enabled={!disabled && !!categoryId && subcategories.length > 0}
            style={styles.picker}
          >
            <Picker.Item label="Seleccione una subcategoría..." value="" />
            {subcategories.map((subcat) => (
              <Picker.Item
                key={subcat.id}
                label={`${subcat.icon || ''} ${subcat.name} (${subcat.code})`}
                value={subcat.id}
              />
            ))}
          </Picker>
        </View>
        {subcategoryError && <Text style={styles.errorText}>{subcategoryError}</Text>}
        {categoryId && subcategories.length === 0 && (
          <Text style={styles.helpText}>
            Esta categoría no tiene subcategorías activas. Por favor, cree una primero.
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
  },
  fieldContainer: {
    marginBottom: 4,
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
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  pickerError: {
    borderColor: '#DC2626',
  },
  pickerDisabled: {
    backgroundColor: '#F1F5F9',
    opacity: 0.6,
  },
  picker: {
    height: 50,
    color: '#1F2937',
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
    fontStyle: 'italic',
  },
});

export default CategorySubcategorySelector;
