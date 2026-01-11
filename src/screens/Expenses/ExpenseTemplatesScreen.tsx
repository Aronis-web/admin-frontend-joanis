import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MAIN_ROUTES } from '@/constants/routes';
import { ExpenseTemplate, TemplateFrequencyLabels } from '@/types/expenses';
import { expensesService } from '@/services/api/expenses';
import { TemplateCard } from '@/components/Expenses/TemplateCard';
import { AddButton } from '@/components/Navigation/AddButton';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import { usePermissions } from '@/hooks/usePermissions';

export const ExpenseTemplatesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { selectedSite } = useTenantStore();
  const { hasPermission } = usePermissions();

  const [templates, setTemplates] = useState<ExpenseTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showInactive, setShowInactive] = useState(false); // Filter state: false = active only, true = show all

  // Check permissions
  const canUpdate = hasPermission('expenses.templates.update');
  const canDelete = hasPermission('expenses.templates.delete');
  const canGenerate = hasPermission('expenses.templates.generate');

  const loadTemplates = async () => {
    try {
      if (!selectedSite?.id) {
        Alert.alert('Error', 'No hay una sede seleccionada');
        return;
      }

      // Backend returns an array directly
      const templates = await expensesService.getTemplates({
        page: 1,
        limit: 100,
        includeInactive: showInactive, // true = show all, false/undefined = active only
      });

      console.log('Templates loaded:', {
        count: templates.length,
        showInactive,
        includeInactive: showInactive,
        templates: templates
      });

      setTemplates(templates);
    } catch (error) {
      console.error('Error loading templates:', error);
      Alert.alert('Error', 'No se pudieron cargar las plantillas de gastos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, [selectedSite?.id, showInactive]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadTemplates();
  };

  const handleCreateTemplate = () => {
    navigation.navigate(MAIN_ROUTES.CREATE_EXPENSE_TEMPLATE as never);
  };

  const handleTemplatePress = (template: ExpenseTemplate) => {
    // Navigate to view expenses generated from this template
    navigation.navigate(MAIN_ROUTES.TEMPLATE_EXPENSES as never, {
      templateId: template.id,
      templateName: template.name,
    } as never);
  };

  const handleGenerateExpense = (template: ExpenseTemplate) => {
    // Navigate to create expense with template data
    navigation.navigate(MAIN_ROUTES.CREATE_EXPENSE as never, {
      templateId: template.id,
    } as never);
  };

  const handleEditTemplate = (template: ExpenseTemplate) => {
    // Navigate to edit template screen
    // For now, just log the template
    console.log('Edit template:', template);
    Alert.alert('Editar', `Editar plantilla: ${template.name}`);
  };

  const handleDeleteTemplate = (template: ExpenseTemplate) => {
    Alert.alert(
      'Eliminar Plantilla',
      `¿Estás seguro de que deseas eliminar la plantilla "${template.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await expensesService.deleteTemplate(template.id);
              Alert.alert('Éxito', 'Plantilla eliminada correctamente');
              loadTemplates();
            } catch (error) {
              console.error('Error deleting template:', error);
              Alert.alert('Error', 'No se pudo eliminar la plantilla');
            }
          },
        },
      ]
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>🔄</Text>
      <Text style={styles.emptyTitle}>No hay plantillas</Text>
      <Text style={styles.emptyText}>
        {showInactive
          ? 'No tienes plantillas de gastos recurrentes configuradas.'
          : 'No hay plantillas activas. Cambia a "Todos" para ver plantillas inactivas.'}
      </Text>
      <TouchableOpacity style={styles.createButton} onPress={handleCreateTemplate}>
        <Text style={styles.createButtonText}>Crear Plantilla</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTemplate = ({ item }: { item: ExpenseTemplate }) => (
    <TemplateCard
      template={item}
      onPress={handleTemplatePress}
      onGenerate={canGenerate ? handleGenerateExpense : undefined}
      onEdit={canUpdate ? handleEditTemplate : undefined}
      onDelete={canDelete ? handleDeleteTemplate : undefined}
    />
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Gastos Recurrentes</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DC2626" />
          <Text style={styles.loadingText}>Cargando plantillas...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gastos Recurrentes</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, !showInactive && styles.filterTabActive]}
          onPress={() => setShowInactive(false)}
        >
          <Text style={[styles.filterTabText, !showInactive && styles.filterTabTextActive]}>
            Activos
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, showInactive && styles.filterTabActive]}
          onPress={() => setShowInactive(true)}
        >
          <Text style={[styles.filterTabText, showInactive && styles.filterTabTextActive]}>
            Todos
          </Text>
        </TouchableOpacity>
      </View>

      {/* Templates List */}
      <FlatList
        data={templates}
        renderItem={renderTemplate}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
      />

      {/* Floating Action Button */}
      <AddButton onPress={handleCreateTemplate} icon="🔄" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTabActive: {
    backgroundColor: '#DC2626',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 40,
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ExpenseTemplatesScreen;
