import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { expensesService } from '@/services/api';
import { ExpenseCategory } from '@/types/expenses';

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
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Cargando categoría...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!category) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#94A3B8" />
          <Text style={styles.errorText}>No se encontró la categoría</Text>
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
        <Text style={styles.headerTitle}>Detalle de Categoría</Text>
        <TouchableOpacity onPress={handleEdit} style={styles.editButton}>
          <Ionicons name="create-outline" size={24} color="#6366F1" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container}>
        {/* Category Header */}
        <View style={styles.categoryHeader}>
          <View style={[styles.iconContainer, { backgroundColor: category.color || '#6366F1' }]}>
            <Ionicons name={(category.icon as any) || 'pricetag'} size={32} color="#FFFFFF" />
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
              { backgroundColor: category.isActive ? '#DCFCE7' : '#FEE2E2' },
            ]}
          >
            <Ionicons
              name={category.isActive ? 'checkmark-circle' : 'close-circle'}
              size={16}
              color={category.isActive ? '#16A34A' : '#DC2626'}
            />
            <Text style={[styles.statusText, { color: category.isActive ? '#16A34A' : '#DC2626' }]}>
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
        {category.parent && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Categoría Padre</Text>
            <View style={styles.parentCategory}>
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: category.parent.color || '#6366F1' },
                ]}
              >
                <Ionicons
                  name={(category.parent.icon as any) || 'pricetag'}
                  size={20}
                  color="#FFFFFF"
                />
              </View>
              <View style={styles.parentInfo}>
                <Text style={styles.parentName}>{category.parent.name}</Text>
                <Text style={styles.parentCode}>{category.parent.code}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Children Categories */}
        {category.children && category.children.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Subcategorías ({category.children.length})</Text>
            {category.children.map((child) => (
              <View key={child.id} style={styles.childCategory}>
                <View style={[styles.iconContainer, { backgroundColor: child.color || '#6366F1' }]}>
                  <Ionicons name={(child.icon as any) || 'pricetag'} size={20} color="#FFFFFF" />
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
          <TouchableOpacity style={styles.actionButton} onPress={handleEdit}>
            <Ionicons name="create-outline" size={20} color="#6366F1" />
            <Text style={styles.actionButtonText}>Editar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={handleDelete}
          >
            <Ionicons name="trash-outline" size={20} color="#DC2626" />
            <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Eliminar</Text>
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
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
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
  editButton: {
    padding: 4,
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
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
    color: '#1E293B',
    marginBottom: 4,
  },
  categoryCode: {
    fontSize: 14,
    color: '#64748B',
  },
  statusContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748B',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  parentCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
  },
  parentInfo: {
    flex: 1,
  },
  parentName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  parentCode: {
    fontSize: 13,
    color: '#64748B',
  },
  childCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    marginBottom: 8,
  },
  childInfo: {
    flex: 1,
  },
  childName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  childCode: {
    fontSize: 13,
    color: '#64748B',
  },
  actionsSection: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    marginBottom: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366F1',
    marginLeft: 8,
  },
  deleteButton: {
    backgroundColor: '#FEF2F2',
  },
  deleteButtonText: {
    color: '#DC2626',
  },
  bottomSpacer: {
    height: 20,
  },
});
