import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { DatePicker, DatePickerButton } from '@/components/DatePicker';
import { sitesService, expensesService } from '@/services/api';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import { config } from '@/utils/config';
import { colors, spacing, borderRadius } from '@/design-system/tokens';

interface ExpenseReportModalProps {
  visible: boolean;
  onClose: () => void;
  isRecurrent?: boolean; // true for recurring expenses, false for all expenses
}

export const ExpenseReportModal: React.FC<ExpenseReportModalProps> = ({
  visible,
  onClose,
  isRecurrent = false,
}) => {
  const authStore = useAuthStore();
  const tenantStore = useTenantStore();

  // Filter states
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [includeInactive, setIncludeInactive] = useState<boolean>(false);

  // Data states
  const [sites, setSites] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Date picker states
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // Load sites and categories when modal opens
  useEffect(() => {
    if (visible) {
      loadSites();
      loadCategories();
      // Reset filters
      setStartDate('');
      setEndDate('');
      setSelectedSiteId('');
      setSelectedCategoryId('');
      setIncludeInactive(false);
    }
  }, [visible]);

  const loadSites = async () => {
    try {
      setLoadingSites(true);
      const response = await sitesService.getSites({ page: 1, limit: 100 });
      setSites(response.data || []);
    } catch (error) {
      console.error('Error loading sites:', error);
    } finally {
      setLoadingSites(false);
    }
  };

  const loadCategories = async () => {
    try {
      setLoadingCategories(true);
      const response = await expensesService.getCategories();
      setCategories(response.data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);

      // REMOVED: Proactive token refresh to prevent race conditions
      // Token refresh will happen automatically on 401 errors via apiClient interceptor

      const token = authStore.token;
      const userId = authStore.user?.id;
      const companyId = tenantStore.selectedCompany?.id || authStore.currentCompany?.id;
      const siteId = tenantStore.selectedSite?.id || authStore.currentSite?.id;

      if (!token) {
        throw new Error('No authentication token available');
      }

      // Build query parameters based on report type
      const params: any = {};

      if (isRecurrent) {
        // For recurring expenses (templates)
        if (selectedSiteId) {
          params.siteId = selectedSiteId;
        }
        if (selectedCategoryId) {
          params.categoryId = selectedCategoryId;
        }
        if (includeInactive) {
          params.isActive = 'false';
        }
        params.templateExpenseType = 'RECURRENT';
      } else {
        // For regular expenses
        if (startDate) {
          params.startDate = startDate;
        }
        if (endDate) {
          params.endDate = endDate;
        }
        if (selectedSiteId) {
          params.siteId = selectedSiteId;
        }
        if (selectedCategoryId) {
          params.categoryId = selectedCategoryId;
        }
      }

      // Build URL with query parameters
      const baseUrl = isRecurrent
        ? '/admin/expense-templates/reports/excel'
        : '/admin/expenses/reports/excel';
      const queryString = Object.keys(params)
        .map((key) => `${key}=${encodeURIComponent(params[key])}`)
        .join('&');
      const timestamp = new Date().getTime();
      const url = queryString
        ? `${baseUrl}?${queryString}&t=${timestamp}`
        : `${baseUrl}?t=${timestamp}`;

      console.log('📥 Downloading expense report:', url);

      // Prepare headers
      const headers: Record<string, string> = {
        'X-App-Id': config.APP_ID,
        Authorization: `Bearer ${token}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      };

      if (userId) {
        headers['X-User-Id'] = userId;
      }
      if (companyId) {
        headers['X-Company-Id'] = companyId;
      }
      if (siteId) {
        headers['X-Site-Id'] = siteId;
      }

      // Download the Excel file
      const startTime = Date.now();
      headers['X-App-Version'] = config.APP_VERSION;
      const response = await fetch(`${config.API_URL}${url}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const excelBlob = await response.blob();
      const endTime = Date.now();

      console.log('✅ Excel descargado del servidor');
      console.log('📦 Tamaño del Excel:', excelBlob.size, 'bytes');
      console.log('⏱️ Tiempo de descarga:', endTime - startTime, 'ms');

      // Handle download based on platform
      const fileName = isRecurrent
        ? `reporte-gastos-recurrentes-${timestamp}.xlsx`
        : `reporte-gastos-${timestamp}.xlsx`;

      // Check if we're on web by checking for document object
      const isWeb = typeof document !== 'undefined';
      console.log('🌐 Platform detection:', {
        platformOS: Platform.OS,
        isWeb,
        hasDocument: typeof document !== 'undefined',
      });

      if (isWeb) {
        // For web, create a download link using blob URL
        console.log('📥 Using web download method');
        const blobUrl = URL.createObjectURL(excelBlob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the blob URL after a short delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

        Alert.alert('Éxito', 'El reporte se está descargando');
        onClose();
      } else {
        // For mobile (iOS/Android), use legacy expo-file-system API
        console.log('📱 Using mobile download method (legacy API)');

        // Convert blob to base64
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            // Remove the data URL prefix to get just the base64 data
            const base64 = dataUrl.split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(excelBlob);
        });

        // Save to file system using legacy API
        const fileUri = FileSystem.cacheDirectory + fileName;
        console.log('💾 Saving file to:', fileUri);

        await FileSystem.writeAsStringAsync(fileUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });

        console.log('✅ File saved successfully');

        // Share the file - user can choose to save to Downloads from share menu
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          console.log('📤 Sharing file...');
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: isRecurrent ? 'Reporte Gastos Recurrentes' : 'Reporte de Gastos',
            UTI: 'org.openxmlformats.spreadsheetml.sheet',
          });
        } else {
          Alert.alert('Éxito', `Reporte guardado en: ${fileUri}`);
        }

        onClose();
      }
    } catch (error: any) {
      console.error('Error downloading report:', error);
      Alert.alert('Error', error.message || 'No se pudo descargar el reporte');
    } finally {
      setDownloading(false);
    }
  };

  const handleStartDateConfirm = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    setStartDate(dateString);
    setShowStartDatePicker(false);
  };

  const handleEndDateConfirm = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    setEndDate(dateString);
    setShowEndDatePicker(false);
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedSiteId('');
    setSelectedCategoryId('');
    setIncludeInactive(false);
  };

  const hasFilters =
    startDate || endDate || selectedSiteId || selectedCategoryId || includeInactive;

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={styles.container}>
            <View style={styles.content}>
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.headerButton}>
                  <Ionicons name="close" size={24} color={colors.neutral[500]} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                  {isRecurrent ? 'Reporte Gastos Recurrentes' : 'Reporte de Gastos'}
                </Text>
                <View style={styles.headerButton} />
              </View>

              {/* Content */}
              <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                <Text style={styles.sectionTitle}>Configurar Parámetros</Text>
                <Text style={styles.sectionSubtitle}>
                  Selecciona los filtros para generar el reporte en Excel
                </Text>

                {/* Date Range - Only for regular expenses */}
                {!isRecurrent && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Rango de Fechas</Text>

                    <DatePickerButton
                      label="Fecha Inicio"
                      value={startDate}
                      onPress={() => setShowStartDatePicker(true)}
                      placeholder="Seleccionar fecha inicio"
                    />

                    <DatePickerButton
                      label="Fecha Fin"
                      value={endDate}
                      onPress={() => setShowEndDatePicker(true)}
                      placeholder="Seleccionar fecha fin"
                    />
                  </View>
                )}

                {/* Include Inactive - Only for recurring expenses */}
                {isRecurrent && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Estado de Plantillas</Text>
                    <View style={styles.switchContainer}>
                      <TouchableOpacity
                        style={[styles.switchOption, !includeInactive && styles.switchOptionActive]}
                        onPress={() => setIncludeInactive(false)}
                      >
                        <Text
                          style={[
                            styles.switchOptionText,
                            !includeInactive && styles.switchOptionTextActive,
                          ]}
                        >
                          Solo Activas
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.switchOption, includeInactive && styles.switchOptionActive]}
                        onPress={() => setIncludeInactive(true)}
                      >
                        <Text
                          style={[
                            styles.switchOptionText,
                            includeInactive && styles.switchOptionTextActive,
                          ]}
                        >
                          Todas (incluyendo inactivas)
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Site Filter */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Sede (Opcional)</Text>
                  {loadingSites ? (
                    <ActivityIndicator size="small" color={colors.accent[500]} />
                  ) : (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.filterChipsContainer}
                    >
                      <TouchableOpacity
                        style={[styles.filterChip, !selectedSiteId && styles.filterChipActive]}
                        onPress={() => setSelectedSiteId('')}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            !selectedSiteId && styles.filterChipTextActive,
                          ]}
                        >
                          Todas las sedes
                        </Text>
                      </TouchableOpacity>
                      {sites.map((site) => (
                        <TouchableOpacity
                          key={site.id}
                          style={[
                            styles.filterChip,
                            selectedSiteId === site.id && styles.filterChipActive,
                          ]}
                          onPress={() => setSelectedSiteId(site.id)}
                        >
                          <Text
                            style={[
                              styles.filterChipText,
                              selectedSiteId === site.id && styles.filterChipTextActive,
                            ]}
                          >
                            {site.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>

                {/* Category Filter */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Categoría (Opcional)</Text>
                  {loadingCategories ? (
                    <ActivityIndicator size="small" color={colors.accent[500]} />
                  ) : (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.filterChipsContainer}
                    >
                      <TouchableOpacity
                        style={[styles.filterChip, !selectedCategoryId && styles.filterChipActive]}
                        onPress={() => setSelectedCategoryId('')}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            !selectedCategoryId && styles.filterChipTextActive,
                          ]}
                        >
                          Todas las categorías
                        </Text>
                      </TouchableOpacity>
                      {categories.map((category) => (
                        <TouchableOpacity
                          key={category.id}
                          style={[
                            styles.filterChip,
                            selectedCategoryId === category.id && styles.filterChipActive,
                          ]}
                          onPress={() => setSelectedCategoryId(category.id)}
                        >
                          <Text
                            style={[
                              styles.filterChipText,
                              selectedCategoryId === category.id && styles.filterChipTextActive,
                            ]}
                          >
                            {category.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>

                {/* Examples */}
                <View style={styles.examplesContainer}>
                  <Text style={styles.examplesTitle}>Ejemplos de reportes:</Text>
                  {isRecurrent ? (
                    <>
                      <View style={styles.exampleItem}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.success[500]} />
                        <Text style={styles.exampleText}>
                          Todas las plantillas activas: Deja todos los filtros vacíos
                        </Text>
                      </View>
                      <View style={styles.exampleItem}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.success[500]} />
                        <Text style={styles.exampleText}>
                          Plantillas de una sede: Selecciona la sede específica
                        </Text>
                      </View>
                      <View style={styles.exampleItem}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.success[500]} />
                        <Text style={styles.exampleText}>
                          Todas las plantillas (incluyendo inactivas): Activa "Todas"
                        </Text>
                      </View>
                      <View style={styles.exampleItem}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.success[500]} />
                        <Text style={styles.exampleText}>
                          Plantillas por categoría: Selecciona la categoría deseada
                        </Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={styles.exampleItem}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.success[500]} />
                        <Text style={styles.exampleText}>
                          Todos los gastos del 2024: Selecciona 01/01/2024 - 31/12/2024
                        </Text>
                      </View>
                      <View style={styles.exampleItem}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.success[500]} />
                        <Text style={styles.exampleText}>
                          Gastos de una sede: Selecciona la sede específica
                        </Text>
                      </View>
                      <View style={styles.exampleItem}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.success[500]} />
                        <Text style={styles.exampleText}>
                          Gastos por categoría: Selecciona la categoría deseada
                        </Text>
                      </View>
                      <View style={styles.exampleItem}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.success[500]} />
                        <Text style={styles.exampleText}>
                          Todos los gastos: Deja todos los filtros vacíos
                        </Text>
                      </View>
                    </>
                  )}
                </View>
              </ScrollView>

              {/* Footer Actions */}
              <View style={styles.footer}>
                {hasFilters && (
                  <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
                    <Ionicons name="refresh" size={18} color={colors.accent[500]} />
                    <Text style={styles.clearButtonText}>Limpiar Filtros</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.downloadButton, downloading && styles.downloadButtonDisabled]}
                  onPress={handleDownload}
                  disabled={downloading}
                >
                  {downloading ? (
                    <ActivityIndicator size="small" color={colors.neutral[0]} />
                  ) : (
                    <>
                      <Ionicons name="download" size={20} color={colors.neutral[0]} />
                      <Text style={styles.downloadButtonText}>Descargar Excel</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Pickers */}
      <DatePicker
        visible={showStartDatePicker}
        date={startDate ? new Date(startDate) : new Date()}
        onConfirm={handleStartDateConfirm}
        onCancel={() => setShowStartDatePicker(false)}
        title="Seleccionar Fecha Inicio"
      />

      <DatePicker
        visible={showEndDatePicker}
        date={endDate ? new Date(endDate) : new Date()}
        onConfirm={handleEndDateConfirm}
        onCancel={() => setShowEndDatePicker(false)}
        title="Seleccionar Fecha Fin"
      />
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.surface.primary,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    height: '90%',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[4],
    paddingBottom: spacing[8],
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: spacing[1],
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.neutral[500],
    marginBottom: spacing[6],
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[600],
    marginBottom: spacing[3],
  },
  filterChipsContainer: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingRight: spacing[4],
  },
  filterChip: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  filterChipActive: {
    backgroundColor: colors.accent[500],
    borderColor: colors.accent[500],
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[600],
  },
  filterChipTextActive: {
    color: colors.neutral[0],
  },
  examplesContainer: {
    backgroundColor: colors.success[50],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginTop: spacing[2],
  },
  examplesTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.success[800],
    marginBottom: spacing[3],
  },
  exampleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing[2],
    gap: spacing[2],
  },
  exampleText: {
    flex: 1,
    fontSize: 12,
    color: colors.success[800],
    lineHeight: 18,
  },
  footer: {
    padding: spacing[4],
    paddingBottom: spacing[5],
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    gap: spacing[3],
    backgroundColor: colors.surface.primary,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[100],
    gap: spacing[2],
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent[500],
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[3.5],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.success[500],
    gap: spacing[2],
  },
  downloadButtonDisabled: {
    backgroundColor: colors.neutral[400],
  },
  downloadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  switchContainer: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  switchOption: {
    flex: 1,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
  },
  switchOptionActive: {
    backgroundColor: colors.accent[500],
    borderColor: colors.accent[500],
  },
  switchOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[600],
  },
  switchOptionTextActive: {
    color: colors.neutral[0],
  },
});

export default ExpenseReportModal;
