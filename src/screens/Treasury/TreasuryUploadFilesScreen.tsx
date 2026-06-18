/**
 * TreasuryUploadFilesScreen.tsx
 *
 * Pantalla para subir archivos de bancos (Tesorería).
 * Soporta archivos ZIP con múltiples cuentas o Excel individuales.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import Alert from '@/utils/alert';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getDocumentAsync, DocumentPickerAsset } from '@/utils/filePicker';
import { Picker } from '@react-native-picker/picker';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import { companiesApi } from '@/services/api/companies';
import { Company } from '@/types/companies';
import { apiClient } from '@/services/api/client';

// Design System Imports
import { spacing, borderRadius } from '@/design-system/tokens/spacing';
import { fontSizes, fontWeights } from '@/design-system/tokens/typography';
import { durations } from '@/design-system/tokens/animations';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';

type Props = NativeStackScreenProps<any, 'TreasuryUploadFiles'>;

// ============================================================================
// Types
// ============================================================================

interface BulkUploadResponse {
  detectedBank: string;
  totalFiles: number;
  totalNewTransactions: number;
  totalDuplicates: number;
  accounts: AccountResult[];
  processingDurationMs: number;
  warnings: string[];
}

interface AccountResult {
  accountSuffix: string;
  accountNumber: string;
  bankAccountId: string;
  fileName: string;
  totalRows: number;
  newTransactionsCount: number;
  duplicatesCount: number;
  errorsCount: number;
  accountAutoCreated: boolean;
}

// ============================================================================
// Animated Card Component
// ============================================================================

interface AnimatedCardProps {
  children: React.ReactNode;
  delay?: number;
  style?: any;
}

const AnimatedCard: React.FC<AnimatedCardProps> = ({ children, delay = 0, style }) => {
  const translateY = useRef(new Animated.Value(30)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: durations.normal,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: durations.normal,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[{ transform: [{ translateY }], opacity }, style]}>
      {children}
    </Animated.View>
  );
};

// ============================================================================
// Result Card Component
// ============================================================================

interface ResultCardProps {
  result: BulkUploadResponse;
}

const ResultCard: React.FC<ResultCardProps> = ({ result }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [expandedAccounts, setExpandedAccounts] = useState(false);

  return (
    <View style={styles.resultCard}>
      {/* Header con banco detectado */}
      <View style={styles.resultHeader}>
        <View style={styles.resultBankBadge}>
          <Ionicons name="business" size={20} color={theme.color.text.inverse} />
          <Text style={styles.resultBankText}>{result.detectedBank}</Text>
        </View>
        <Text style={styles.resultDuration}>
          {(result.processingDurationMs / 1000).toFixed(1)}s
        </Text>
      </View>

      {/* Estadísticas principales */}
      <View style={styles.resultStats}>
        <View style={styles.resultStatItem}>
          <Text style={styles.resultStatValue}>{result.totalFiles}</Text>
          <Text style={styles.resultStatLabel}>Archivos</Text>
        </View>
        <View style={styles.resultStatDivider} />
        <View style={styles.resultStatItem}>
          <Text style={[styles.resultStatValue, { color: theme.color.text.success }]}>
            {result.totalNewTransactions}
          </Text>
          <Text style={styles.resultStatLabel}>Nuevos</Text>
        </View>
        <View style={styles.resultStatDivider} />
        <View style={styles.resultStatItem}>
          <Text style={[styles.resultStatValue, { color: theme.color.text.warning }]}>
            {result.totalDuplicates}
          </Text>
          <Text style={styles.resultStatLabel}>Duplicados</Text>
        </View>
      </View>

      {/* Warnings si hay */}
      {result.warnings && result.warnings.length > 0 && (
        <View style={styles.warningsContainer}>
          <Ionicons name="warning" size={16} color={theme.color.text.warning} />
          <Text style={styles.warningsText}>
            {result.warnings.length} advertencia(s)
          </Text>
        </View>
      )}

      {/* Lista de cuentas */}
      <TouchableOpacity
        style={styles.accountsToggle}
        onPress={() => setExpandedAccounts(!expandedAccounts)}
      >
        <Text style={styles.accountsToggleText}>
          {result.accounts.length} cuenta(s) procesada(s)
        </Text>
        <Ionicons
          name={expandedAccounts ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.color.icon.subtle}
        />
      </TouchableOpacity>

      {expandedAccounts && (
        <View style={styles.accountsList}>
          {result.accounts.map((account, index) => (
            <View key={index} style={styles.accountItem}>
              <View style={styles.accountHeader}>
                <View style={styles.accountInfo}>
                  <Text style={styles.accountNumber}>{account.accountNumber}</Text>
                  <Text style={styles.accountFile}>{account.fileName}</Text>
                </View>
                {account.accountAutoCreated && (
                  <View style={styles.autoCreatedBadge}>
                    <Text style={styles.autoCreatedText}>Nueva</Text>
                  </View>
                )}
              </View>
              <View style={styles.accountStats}>
                <View style={styles.accountStatItem}>
                  <Ionicons name="document-text" size={14} color={theme.color.icon.disabled} />
                  <Text style={styles.accountStatText}>{account.totalRows} filas</Text>
                </View>
                <View style={styles.accountStatItem}>
                  <Ionicons name="checkmark-circle" size={14} color={theme.color.icon.success} />
                  <Text style={styles.accountStatText}>{account.newTransactionsCount} nuevos</Text>
                </View>
                <View style={styles.accountStatItem}>
                  <Ionicons name="copy" size={14} color={theme.color.icon.warning} />
                  <Text style={styles.accountStatText}>{account.duplicatesCount} dup.</Text>
                </View>
                {account.errorsCount > 0 && (
                  <View style={styles.accountStatItem}>
                    <Ionicons name="close-circle" size={14} color={theme.color.icon.danger} />
                    <Text style={[styles.accountStatText, { color: theme.color.text.danger }]}>
                      {account.errorsCount} errores
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const TreasuryUploadFilesScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { currentCompany } = useAuthStore();
  const { selectedCompany } = useTenantStore();

  const [selectedFile, setSelectedFile] = useState<DocumentPickerAsset | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<BulkUploadResponse | null>(null);

  // Cargar empresas al montar
  useEffect(() => {
    loadCompanies();
  }, []);

  // Establecer empresa por defecto
  useEffect(() => {
    const defaultCompany = selectedCompany || currentCompany;
    if (defaultCompany && !selectedCompanyId) {
      setSelectedCompanyId(defaultCompany.id);
    }
  }, [selectedCompany, currentCompany]);

  const loadCompanies = async () => {
    setIsLoadingCompanies(true);
    try {
      const response = await companiesApi.getCompanies({ limit: 100 });
      setCompanies(response.data);
    } catch (error) {
      console.error('❌ Error al cargar empresas:', error);
      Alert.alert('Error', 'No se pudieron cargar las empresas');
    } finally {
      setIsLoadingCompanies(false);
    }
  };

  const handleSelectFile = async () => {
    try {
      const result = await getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
          'application/vnd.ms-excel', // xls
          'application/zip',
          'application/x-zip-compressed',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      if (result.assets && result.assets.length > 0) {
        setSelectedFile(result.assets[0]);
        setUploadResult(null); // Limpiar resultado anterior
      }
    } catch (error) {
      console.error('❌ Error al seleccionar archivo:', error);
      Alert.alert('Error', 'No se pudo seleccionar el archivo');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      Alert.alert('Error', 'Por favor selecciona un archivo');
      return;
    }

    if (!selectedCompanyId) {
      Alert.alert('Error', 'Por favor selecciona una empresa');
      return;
    }

    setIsUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();

      if (Platform.OS === 'web') {
        if (selectedFile.file) {
          formData.append('file', selectedFile.file);
        } else {
          const blobResponse = await fetch(selectedFile.uri);
          const blob = await blobResponse.blob();
          const file = new File([blob], selectedFile.name, {
            type: selectedFile.mimeType || 'application/octet-stream'
          });
          formData.append('file', file);
        }
      } else {
        formData.append('file', {
          uri: selectedFile.uri,
          type: selectedFile.mimeType || 'application/octet-stream',
          name: selectedFile.name,
        } as any);
      }

      // Añadir el companyId al FormData (requerido por el backend)
      formData.append('companyId', selectedCompanyId);

      const result = await apiClient.post<BulkUploadResponse>(
        '/treasury/transactions/upload-bulk',
        formData,
        {
          headers: {
            'X-Company-Id': selectedCompanyId, // Usar el ID seleccionado por el usuario
          },
        }
      );

      setUploadResult(result);

      Alert.alert(
        '✅ Archivo Procesado',
        `Se procesaron ${result.totalFiles} archivo(s).\n\n` +
        `• ${result.totalNewTransactions} transacciones nuevas\n` +
        `• ${result.totalDuplicates} duplicados detectados\n` +
        `• Banco: ${result.detectedBank}`,
        [
          {
            text: 'Subir Otro',
            onPress: () => {
              setSelectedFile(null);
            },
          },
          {
            text: 'OK',
            style: 'default',
          },
        ]
      );
    } catch (error: any) {
      console.error('❌ Error al subir archivo:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || error.message || 'No se pudo procesar el archivo'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const getFileIcon = (): keyof typeof Ionicons.glyphMap => {
    if (!selectedFile) return 'cloud-upload-outline';
    const name = selectedFile.name.toLowerCase();
    if (name.endsWith('.zip')) return 'archive-outline';
    return 'document-attach';
  };

  const getFileTypeLabel = (): string => {
    if (!selectedFile) return '';
    const name = selectedFile.name.toLowerCase();
    if (name.endsWith('.zip')) return 'ZIP';
    if (name.endsWith('.xlsx')) return 'XLSX';
    if (name.endsWith('.xls')) return 'XLS';
    return 'Archivo';
  };

  const canUpload = selectedFile && selectedCompanyId && !isUploading;

  return (
    <ScreenLayout navigation={navigation as any}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header con gradiente */}
        <LinearGradient
          colors={[theme.color.brand.headerFrom, theme.color.brand.headerTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={theme.color.text.inverse} />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <View style={styles.headerIconRow}>
                <View style={styles.headerIconContainer}>
                  <Ionicons name="wallet-outline" size={22} color={theme.color.text.inverse} />
                </View>
                <Text style={styles.titleGradient}>Subir Archivos</Text>
              </View>
              <Text style={styles.subtitleGradient}>Tesorería - Archivos de Bancos</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Step 1: Seleccionar Empresa */}
          <AnimatedCard delay={0}>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepNumber}>1</Text>
                </View>
                <Text style={styles.sectionTitle}>Seleccionar Empresa</Text>
              </View>
              {isLoadingCompanies ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color={theme.color.brand.primary} size="small" />
                  <Text style={styles.loadingText}>Cargando empresas...</Text>
                </View>
              ) : companies.length > 0 ? (
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={selectedCompanyId}
                    onValueChange={(value) => setSelectedCompanyId(value)}
                    style={styles.picker}
                  >
                    <Picker.Item label="Selecciona una empresa" value="" />
                    {companies.map((company) => (
                      <Picker.Item
                        key={company.id}
                        label={company.name}
                        value={company.id}
                      />
                    ))}
                  </Picker>
                </View>
              ) : (
                <View style={styles.warningContainer}>
                  <Ionicons name="warning-outline" size={24} color={theme.color.text.warning} />
                  <Text style={styles.warningText}>No hay empresas disponibles</Text>
                </View>
              )}
            </View>
          </AnimatedCard>

          {/* Step 2: Seleccionar Archivo */}
          <AnimatedCard delay={100}>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepNumber}>2</Text>
                </View>
                <Text style={styles.sectionTitle}>Seleccionar Archivo</Text>
              </View>
              <TouchableOpacity
                style={[styles.selectFileButton, selectedFile && styles.selectFileButtonSelected]}
                onPress={handleSelectFile}
                activeOpacity={0.7}
              >
                <View style={styles.selectFileIconContainer}>
                  <Ionicons
                    name={getFileIcon()}
                    size={32}
                    color={selectedFile ? theme.color.text.success : theme.color.icon.disabled}
                  />
                </View>
                <Text style={[styles.selectFileText, selectedFile && styles.selectFileTextSelected]}>
                  {selectedFile ? selectedFile.name : 'Toca para seleccionar archivo ZIP o Excel'}
                </Text>
                {selectedFile && (
                  <View style={styles.fileInfoRow}>
                    <View style={styles.fileTypeBadge}>
                      <Text style={styles.fileTypeText}>{getFileTypeLabel()}</Text>
                    </View>
                    <Text style={styles.selectFileSize}>
                      {(selectedFile.size! / 1024).toFixed(2)} KB
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </AnimatedCard>

          {/* Step 3: Subir */}
          <AnimatedCard delay={200}>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepNumber}>3</Text>
                </View>
                <Text style={styles.sectionTitle}>Subir y Procesar</Text>
              </View>
              <TouchableOpacity
                style={[styles.uploadButton, !canUpload && styles.uploadButtonDisabled]}
                onPress={handleUpload}
                disabled={!canUpload}
                activeOpacity={0.8}
              >
                {isUploading ? (
                  <>
                    <ActivityIndicator color={theme.color.text.inverse} size="small" />
                    <Text style={styles.uploadButtonText}>Procesando...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="cloud-upload" size={24} color={theme.color.text.inverse} />
                    <Text style={styles.uploadButtonText}>Subir y Procesar</Text>
                  </>
                )}
              </TouchableOpacity>

              {isUploading && (
                <View style={styles.processingWarning}>
                  <Ionicons name="time-outline" size={24} color={theme.color.state.warning.text} />
                  <Text style={styles.processingWarningText}>
                    El procesamiento puede tardar según el tamaño del archivo.{'\n'}
                    No cierres esta pantalla.
                  </Text>
                </View>
              )}
            </View>
          </AnimatedCard>

          {/* Resultado */}
          {uploadResult && (
            <AnimatedCard delay={0}>
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.stepBadge, { backgroundColor: theme.color.icon.success }]}>
                    <Ionicons name="checkmark" size={16} color={theme.color.text.inverse} />
                  </View>
                  <Text style={styles.sectionTitle}>Resultado</Text>
                </View>
                <ResultCard result={uploadResult} />
              </View>
            </AnimatedCard>
          )}

          {/* Info Section */}
          <AnimatedCard delay={300}>
            <View style={styles.infoSection}>
              <View style={styles.infoHeader}>
                <Ionicons name="information-circle" size={24} color={theme.color.icon.accent} />
                <Text style={styles.infoTitle}>Formatos Soportados</Text>
              </View>
              <Text style={styles.infoText}>
                • <Text style={styles.infoBold}>ZIP:</Text> Archivo ZIP de Interbank con múltiples Excel{'\n'}
                • <Text style={styles.infoBold}>XLSX:</Text> Archivo Excel individual{'\n'}
                • <Text style={styles.infoBold}>XLS:</Text> Archivo Excel antiguo{'\n\n'}
                <Text style={styles.infoBold}>Detección Automática:</Text>{'\n'}
                • Banco por formato del contenido{'\n'}
                • Cuenta bancaria por nombre del archivo{'\n'}
                • Moneda (Soles o Dólares){'\n'}
                • Tipo de cuenta (Corriente, Ahorros, etc.)
              </Text>
            </View>
          </AnimatedCard>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </View>
    </ScreenLayout>
  );
};

// ============================================================================
// Styles
// ============================================================================

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.surface.muted,
  },

  // Header
  headerGradient: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: theme.color.brand.headerBadge,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
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
    backgroundColor: theme.color.brand.headerBadge,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  titleGradient: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.color.text.inverse,
    letterSpacing: 0.3,
  },
  subtitleGradient: {
    fontSize: 14,
    color: theme.color.brand.onHeaderMuted,
    fontWeight: '500',
    marginLeft: spacing[12],
  },

  // Content
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: theme.color.surface.base,
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    ...theme.shadow.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[4],
    gap: spacing[3],
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.color.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumber: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    color: theme.color.text.inverse,
  },
  sectionTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: theme.color.text.heading,
  },

  // Picker
  pickerContainer: {
    backgroundColor: theme.color.surface.subtle,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: theme.color.border.subtle,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    color: theme.color.text.heading,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.surface.subtle,
    borderRadius: borderRadius.md,
    padding: spacing[4],
    gap: spacing[3],
  },
  loadingText: {
    fontSize: fontSizes.sm,
    color: theme.color.text.subtle,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.state.warning.background,
    borderRadius: borderRadius.md,
    padding: spacing[4],
    gap: spacing[3],
    borderWidth: 1,
    borderColor: theme.color.state.warning.border,
  },
  warningText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: theme.color.state.warning.text,
  },

  // File selection
  selectFileButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.surface.subtle,
    borderRadius: borderRadius.lg,
    padding: spacing[6],
    borderWidth: 2,
    borderColor: theme.color.border.default,
    borderStyle: 'dashed',
  },
  selectFileButtonSelected: {
    backgroundColor: theme.color.state.success.background,
    borderColor: theme.color.state.success.border,
    borderStyle: 'solid',
  },
  selectFileIconContainer: {
    marginBottom: spacing[3],
  },
  selectFileText: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.medium,
    color: theme.color.text.subtle,
    textAlign: 'center',
  },
  selectFileTextSelected: {
    color: theme.color.state.success.text,
  },
  fileInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[2],
    gap: spacing[2],
  },
  fileTypeBadge: {
    backgroundColor: theme.color.brand.primarySoft,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: borderRadius.sm,
  },
  fileTypeText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: theme.color.brand.primary,
  },
  selectFileSize: {
    fontSize: fontSizes.sm,
    color: theme.color.text.disabled,
  },

  // Upload button
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.action.success.background,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    gap: spacing[3],
    ...theme.shadow.md,
  },
  uploadButtonDisabled: {
    backgroundColor: theme.color.action.success.backgroundDisabled,
    ...theme.shadow.none,
  },
  uploadButtonText: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: theme.color.text.inverse,
  },
  processingWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.color.state.warning.background,
    borderRadius: borderRadius.md,
    padding: spacing[4],
    marginTop: spacing[4],
    gap: spacing[3],
    borderWidth: 1,
    borderColor: theme.color.state.warning.border,
  },
  processingWarningText: {
    flex: 1,
    fontSize: fontSizes.sm,
    color: theme.color.state.warning.text,
    fontWeight: fontWeights.medium,
    lineHeight: 20,
  },

  // Result card
  resultCard: {
    backgroundColor: theme.color.surface.subtle,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  resultBankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.brand.primary,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.full,
    gap: spacing[2],
  },
  resultBankText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: theme.color.text.inverse,
  },
  resultDuration: {
    fontSize: fontSizes.sm,
    color: theme.color.text.subtle,
  },
  resultStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: theme.color.surface.base,
    borderRadius: borderRadius.md,
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  resultStatItem: {
    alignItems: 'center',
  },
  resultStatValue: {
    fontSize: fontSizes['2xl'],
    fontWeight: fontWeights.bold,
    color: theme.color.text.heading,
  },
  resultStatLabel: {
    fontSize: fontSizes.xs,
    color: theme.color.text.subtle,
    marginTop: spacing[0.5],
  },
  resultStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: theme.color.border.subtle,
  },
  warningsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.state.warning.background,
    borderRadius: borderRadius.md,
    padding: spacing[2],
    marginBottom: spacing[3],
    gap: spacing[2],
  },
  warningsText: {
    fontSize: fontSizes.sm,
    color: theme.color.state.warning.text,
  },
  accountsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
    borderTopWidth: 1,
    borderTopColor: theme.color.border.subtle,
  },
  accountsToggleText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: theme.color.text.muted,
  },
  accountsList: {
    marginTop: spacing[3],
    gap: spacing[2],
  },
  accountItem: {
    backgroundColor: theme.color.surface.base,
    borderRadius: borderRadius.md,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  accountInfo: {
    flex: 1,
  },
  accountNumber: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: theme.color.text.heading,
  },
  accountFile: {
    fontSize: fontSizes.xs,
    color: theme.color.text.subtle,
    marginTop: spacing[0.5],
  },
  autoCreatedBadge: {
    backgroundColor: theme.color.state.success.background,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: borderRadius.sm,
  },
  autoCreatedText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: theme.color.state.success.text,
  },
  accountStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  accountStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  accountStatText: {
    fontSize: fontSizes.xs,
    color: theme.color.text.muted,
  },

  // Info section
  infoSection: {
    backgroundColor: theme.color.state.info.background,
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: theme.color.state.info.border,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[3],
    gap: spacing[2],
  },
  infoTitle: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    color: theme.color.state.info.text,
  },
  infoText: {
    fontSize: fontSizes.sm,
    color: theme.color.state.info.text,
    lineHeight: 22,
  },
  infoBold: {
    fontWeight: fontWeights.semibold,
  },

  bottomSpacer: {
    height: spacing[8],
  },
});

export default TreasuryUploadFilesScreen;
