import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { MAIN_ROUTES } from '@/constants/routes';
import { ExpenseTemplate, TemplateFrequencyLabels } from '@/types/expenses';
import { expensesService } from '@/services/api/expenses';
import { sitesService } from '@/services/api';
import { TemplateCard } from '@/components/Expenses/TemplateCard';
import { AddButton } from '@/components/Navigation/AddButton';
import { ExpenseReportModal } from '@/components/Expenses/ExpenseReportModal';
import { ExpenseTemplateBulkUploadModal } from '@/components/Expenses/ExpenseTemplateBulkUploadModal';
import { ExpenseTemplatesFAB } from '@/components/Expenses/ExpenseTemplatesFAB';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import { usePermissions } from '@/hooks/usePermissions';
import { colors, spacing, borderRadius } from '@/design-system/tokens';

export const ExpenseTemplatesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { selectedSite } = useTenantStore();
  const { hasPermission } = usePermissions();

  const [templates, setTemplates] = useState<ExpenseTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showInactive, setShowInactive] = useState(false); // Filter state: false = active only, true = show all
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [bulkUploadModalVisible, setBulkUploadModalVisible] = useState(false);
  const [generatingExpenses, setGeneratingExpenses] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Check permissions
  const canUpdate = hasPermission('expenses.templates.update');
  const canDelete = hasPermission('expenses.templates.delete');
  const canGenerate = hasPermission('expenses.templates.generate');

  const loadTemplates = async (page: number = 1) => {
    try {
      setLoading(true);

      if (!selectedSite?.id) {
        Alert.alert('Error', 'No hay una sede seleccionada');
        return;
      }

      // Load sites to map siteId to site name
      const sitesResponse = await sitesService.getSites({ page: 1, limit: 100 });
      const sitesMap = new Map(sitesResponse.data.map((site: any) => [site.id, site]));

      // Backend returns array directly (no pagination support yet)
      const response = await expensesService.getTemplates({
        includeInactive: showInactive, // true = show all, false/undefined = active only
      });

      // Handle array response and implement client-side pagination
      if (Array.isArray(response)) {
        // Map siteId to site object
        const allTemplates = response.map((template) => ({
          ...template,
          site: template.siteId ? sitesMap.get(template.siteId) : template.site,
        }));

        const total = allTemplates.length;
        const totalPages = Math.ceil(total / pagination.limit);
        const startIndex = (page - 1) * pagination.limit;
        const endIndex = startIndex + pagination.limit;
        const paginatedTemplates = allTemplates.slice(startIndex, endIndex);

        setTemplates(paginatedTemplates);
        setPagination({
          page,
          limit: pagination.limit,
          total,
          totalPages,
        });
      } else {
        setTemplates([]);
        setPagination({
          page: 1,
          limit: pagination.limit,
          total: 0,
          totalPages: 0,
        });
      }
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
    loadTemplates(1);
  };

  const handlePreviousPage = () => {
    if (pagination.page > 1) {
      loadTemplates(pagination.page - 1);
    }
  };

  const handleNextPage = () => {
    if (pagination.page < pagination.totalPages) {
      loadTemplates(pagination.page + 1);
    }
  };

  const handleCreateTemplate = () => {
    navigation.navigate(MAIN_ROUTES.CREATE_EXPENSE_TEMPLATE as never);
  };

  const handleOpenReportModal = () => {
    setReportModalVisible(true);
  };

  const handleOpenBulkUploadModal = () => {
    setBulkUploadModalVisible(true);
  };

  const handleBulkUploadSuccess = () => {
    loadTemplates();
  };

  const handleTestGeneration = async () => {
    Alert.alert(
      'Generar Gastos',
      '¿Deseas ejecutar la generación manual de gastos desde las plantillas activas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Generar',
          onPress: async () => {
            try {
              setGeneratingExpenses(true);
              console.log('🚀 Iniciando generación manual de gastos...');

              const result = await expensesService.testGeneration();

              console.log('✅ Resultado de generación:', result);

              Alert.alert(
                'Éxito',
                result.message || `Se generaron ${result.generated} gastos correctamente.`,
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      // Refresh the templates list
                      loadTemplates();
                    },
                  },
                ]
              );
            } catch (error: any) {
              console.error('❌ Error en generación manual:', error);
              Alert.alert(
                'Error',
                error.response?.data?.message || error.message ||
                  'No se pudieron generar los gastos. Por favor, intenta nuevamente.'
              );
            } finally {
              setGeneratingExpenses(false);
            }
          },
        },
      ]
    );
  };

  const handleTemplatePress = (template: ExpenseTemplate) => {
    // Navigate to view expenses generated from this template
    (navigation as any).navigate(MAIN_ROUTES.TEMPLATE_EXPENSES, {
      templateId: template.id,
      templateName: template.name,
    });
  };

  const handleGenerateExpense = (template: ExpenseTemplate) => {
    // Navigate to create expense with template data
    (navigation as any).navigate(MAIN_ROUTES.CREATE_EXPENSE, {
      templateId: template.id,
    });
  };

  const handleEditTemplate = (template: ExpenseTemplate) => {
    // Navigate to edit template screen
    (navigation as any).navigate(MAIN_ROUTES.EDIT_EXPENSE_TEMPLATE, {
      templateId: template.id,
    });
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

  if (loading) {
    return (
      <ScreenLayout navigation={navigation as any}>
        <SafeAreaView style={styles.container} edges={['top']}>
          <LinearGradient
            colors={[colors.primary[900], colors.primary[800]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <View style={styles.headerTop}>
              <View style={styles.headerTitleContainer}>
                <View style={styles.headerIconRow}>
                  <View style={styles.headerIconContainer}>
                    <Ionicons name="repeat-outline" size={22} color={colors.neutral[0]} />
                  </View>
                  <Text style={styles.titleGradient}>Gastos Recurrentes</Text>
                </View>
                <Text style={styles.subtitleGradient}>Plantillas de gastos automáticos</Text>
              </View>
            </View>
          </LinearGradient>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary[900]} />
            <Text style={styles.loadingText}>Cargando plantillas...</Text>
          </View>
        </SafeAreaView>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout navigation={navigation as any}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header con gradiente */}
        <LinearGradient
          colors={[colors.primary[900], colors.primary[800]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerTop}>
            <View style={styles.headerTitleContainer}>
              <View style={styles.headerIconRow}>
                <View style={styles.headerIconContainer}>
                  <Ionicons name="repeat-outline" size={22} color={colors.neutral[0]} />
                </View>
                <Text style={styles.titleGradient}>Gastos Recurrentes</Text>
              </View>
              <Text style={styles.subtitleGradient}>Plantillas de gastos automáticos</Text>
            </View>
            <View style={styles.statsHeaderContainer}>
              <View style={styles.statHeaderItem}>
                <Text style={styles.statHeaderValue}>{pagination.total}</Text>
                <Text style={styles.statHeaderLabel}>Total</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {templates.length === 0
          ? renderEmptyState()
          : templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onPress={handleTemplatePress}
                onEdit={canUpdate ? handleEditTemplate : undefined}
                onDelete={canDelete ? handleDeleteTemplate : undefined}
              />
            ))}
      </ScrollView>

      {/* Pagination Controls */}
      {pagination.total > 0 && (
        <View style={styles.paginationContainer}>
          <TouchableOpacity
            style={[
              styles.paginationButton,
              pagination.page === 1 && styles.paginationButtonDisabled,
            ]}
            onPress={handlePreviousPage}
            disabled={pagination.page === 1}
          >
            <Text
              style={[
                styles.paginationButtonText,
                pagination.page === 1 && styles.paginationButtonTextDisabled,
              ]}
            >
              ← Anterior
            </Text>
          </TouchableOpacity>

          <View style={styles.paginationInfo}>
            <Text style={styles.paginationText}>
              Pág. {pagination.page}/{pagination.totalPages}
            </Text>
            <Text style={styles.paginationSubtext}>
              {templates.length} de {pagination.total}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.paginationButton,
              pagination.page >= pagination.totalPages && styles.paginationButtonDisabled,
            ]}
            onPress={handleNextPage}
            disabled={pagination.page >= pagination.totalPages}
          >
            <Text
              style={[
                styles.paginationButtonText,
                pagination.page >= pagination.totalPages && styles.paginationButtonTextDisabled,
              ]}
            >
              Siguiente →
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Floating Action Button with animations */}
      <ExpenseTemplatesFAB
        onCreateTemplate={handleCreateTemplate}
        onDownloadReport={handleOpenReportModal}
        onBulkUpload={handleOpenBulkUploadModal}
        onTestGeneration={handleTestGeneration}
        generatingExpenses={generatingExpenses}
      />

      {/* Report Modal */}
      <ExpenseReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        isRecurrent={true}
      />

      {/* Bulk Upload Modal */}
      <ExpenseTemplateBulkUploadModal
        visible={bulkUploadModalVisible}
        onClose={() => setBulkUploadModalVisible(false)}
        onSuccess={handleBulkUploadSuccess}
      />
      </SafeAreaView>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  // Header con gradiente
  headerGradient: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  headerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  titleGradient: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.neutral[0],
    letterSpacing: 0.3,
  },
  subtitleGradient: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
    marginLeft: spacing[12],
  },
  statsHeaderContainer: {
    alignItems: 'flex-end',
  },
  statHeaderItem: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.lg,
  },
  statHeaderValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.neutral[0],
  },
  statHeaderLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
    textTransform: 'uppercase',
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
  scrollView: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
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
  paginationContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 60,
  },
  paginationInfo: {
    alignItems: 'center',
    minWidth: 100,
  },
  paginationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  paginationSubtext: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  paginationButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#6366F1',
    minWidth: 110,
    alignItems: 'center',
  },
  paginationButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  paginationButtonTextDisabled: {
    color: '#94A3B8',
  },
});

export default ExpenseTemplatesScreen;
