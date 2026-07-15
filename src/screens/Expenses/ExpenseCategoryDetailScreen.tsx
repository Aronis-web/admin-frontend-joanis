import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { expensesService } from '@/services/api';
import { ExpenseCategory } from '@/types/expenses';
import { getSafeIconName, getCategoryFallbackIcon } from '@/utils/iconUtils';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import Alert from '@/utils/alert';

interface ExpenseCategoryDetailScreenProps {
  navigation: any;
  route: {
    params: {
      categoryId: string;
    };
  };
}

export const ExpenseCategoryDetailScreen: React.FC<ExpenseCategoryDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { categoryId } = route.params;
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCategory = useCallback(async () => {
    try {
      setLoading(true);
      const data = await expensesService.getCategory(categoryId);
      setCategory(data);
    } catch (error: any) {
      console.error('Error loading category:', error);
      Alert.alert('Error', 'No se pudo cargar la categoría');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  useFocusEffect(
    useCallback(() => {
      loadCategory();
    }, [loadCategory])
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const handleEdit = () => {
    navigation.navigate('EditExpenseCategory', { categoryId });
  };

  const handleDelete = async () => {
    Alert.alert(
      'Eliminar Categoría',
      '¿Estás seguro de que deseas eliminar esta categoría? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await expensesService.deleteCategory(categoryId);
              Alert.alert('Éxito', 'Categoría eliminada correctamente');
              navigation.goBack();
            } catch (error: any) {
              Alert.alert('Error', 'No se pudo eliminar la categoría');
            }
          },
        },
      ]
    );
  };

  const renderInfoRow = (label: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined) {
      return null;
    }

    return (
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.color.brand.accent} />
          <Text style={styles.loadingText}>Cargando categoría...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!category) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={theme.color.icon.subtle} />
          <Text style={styles.errorText}>No se encontró la categoría</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.color.icon.default} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalle de Categoría</Text>
        <TouchableOpacity onPress={handleEdit} style={styles.editButton}>
          <Ionicons name="create-outline" size={24} color={theme.color.brand.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container}>
        {/* Category Header */}
        <View style={styles.categoryHeader}>
          <View style={[styles.iconContainer, { backgroundColor: category.color || theme.color.brand.accent }]}>
            <Ionicons name={getSafeIconName(category.icon, getCategoryFallbackIcon(category.name)) as any} size={32} color={theme.color.text.inverse} />
          </View>
          <View style={styles.categoryInfo}>
            <Text style={styles.categoryName}>{category.name}</Text>
            <Text style={styles.categoryCode}>{category.code}</Text>
          </View>
        </View>

        {/* Status Badge */}
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: category.isActive ? theme.color.state.success.background : theme.color.state.danger.background },
            ]}
          >
            <Ionicons
              name={category.isActive ? 'checkmark-circle' : 'close-circle'}
              size={16}
              color={category.isActive ? theme.color.state.success.border : theme.color.state.danger.border}
            />
            <Text style={[styles.statusText, { color: category.isActive ? theme.color.state.success.text : theme.color.state.danger.text }]}>
              {category.isActive ? 'Activo' : 'Inactivo'}
            </Text>
          </View>
        </View>

        {/* Description */}
        {category.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Descripción</Text>
            <Text style={styles.description}>{category.description}</Text>
          </View>
        )}

        {/* Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detalles</Text>
          {renderInfoRow('Código', category.code)}
          {renderInfoRow('ID', category.id)}
          {renderInfoRow('Creado el', formatDate(category.createdAt))}
          {renderInfoRow('Actualizado el', formatDate(category.updatedAt))}
        </View>

        {/* Parent Category */}
        {category.parentCategory && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Categoría Padre</Text>
            <View style={styles.parentCategory}>
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: category.parentCategory.color || theme.color.brand.accent },
                ]}
              >
                <Ionicons
                  name={getSafeIconName(category.parentCategory.icon, getCategoryFallbackIcon(category.parentCategory.name)) as any}
                  size={20}
                  color={theme.color.text.inverse}
                />
              </View>
              <View style={styles.parentInfo}>
                <Text style={styles.parentName}>{category.parentCategory.name}</Text>
                <Text style={styles.parentCode}>{category.parentCategory.code}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Children Categories */}
        {category.subcategories && category.subcategories.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Subcategorías ({category.subcategories.length})</Text>
            {category.subcategories.map((child: ExpenseCategory) => (
              <View key={child.id} style={styles.childCategory}>
                <View style={[styles.iconContainer, { backgroundColor: child.color || theme.color.brand.accent }]}>
                  <Ionicons name={getSafeIconName(child.icon, getCategoryFallbackIcon(child.name)) as any} size={20} color={theme.color.text.inverse} />
                </View>
                <View style={styles.childInfo}>
                  <Text style={styles.childName}>{child.name}</Text>
                  <Text style={styles.childCode}>{child.code}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsSection}>
          {/* Solo mostrar botón de crear subcategoría si es categoría principal */}
          {!category.isSubcategory && (
            <TouchableOpacity
              style={[styles.actionButton, styles.createSubcategoryButton]}
              onPress={() => navigation.navigate('CreateExpenseCategory', { parentCategoryId: categoryId })}
            >
              <Ionicons name="add-circle-outline" size={20} color={theme.color.state.success.border} />
              <Text style={[styles.actionButtonText, styles.createSubcategoryButtonText]}>
                Crear Subcategoría
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.actionButton} onPress={handleEdit}>
            <Ionicons name="create-outline" size={20} color={theme.color.brand.accent} />
            <Text style={styles.actionButtonText}>Editar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={handleDelete}
          >
            <Ionicons name="trash-outline" size={20} color={theme.color.state.danger.border} />
            <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Eliminar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.color.surface.base,
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
    color: theme.color.text.muted,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.color.text.muted,
    textAlign: 'center',
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
  editButton: {
    padding: 4,
  },
  container: {
    flex: 1,
    backgroundColor: theme.color.background.subtle,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.text.heading,
    marginBottom: 4,
  },
  categoryCode: {
    fontSize: 14,
    color: theme.color.text.muted,
  },
  statusContainer: {
    padding: 16,
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  section: {
    marginTop: 16,
    padding: 16,
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.text.heading,
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: theme.color.text.body,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  infoLabel: {
    fontSize: 14,
    color: theme.color.text.muted,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: theme.color.text.heading,
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  parentCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: theme.color.background.subtle,
    borderRadius: 8,
  },
  parentInfo: {
    flex: 1,
  },
  parentName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.color.text.heading,
  },
  parentCode: {
    fontSize: 13,
    color: theme.color.text.muted,
  },
  childCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: theme.color.background.subtle,
    borderRadius: 8,
    marginBottom: 8,
  },
  childInfo: {
    flex: 1,
  },
  childName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.color.text.heading,
  },
  childCode: {
    fontSize: 13,
    color: theme.color.text.muted,
  },
  actionsSection: {
    marginTop: 16,
    padding: 16,
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    backgroundColor: theme.color.background.subtle,
    borderRadius: 8,
    marginBottom: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.brand.accent,
    marginLeft: 8,
  },
  deleteButton: {
    backgroundColor: theme.color.state.danger.background,
  },
  deleteButtonText: {
    color: theme.color.state.danger.text,
  },
  createSubcategoryButton: {
    backgroundColor: theme.color.state.success.background,
  },
  createSubcategoryButtonText: {
    color: theme.color.state.success.text,
  },
  bottomSpacer: {
    height: 20,
  },
});
