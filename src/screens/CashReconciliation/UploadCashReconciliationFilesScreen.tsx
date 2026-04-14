/**
 * UploadCashReconciliationFilesScreen.tsx
 *
 * Pantalla para subir archivos de cuadre de caja.
 * Rediseñada con el sistema de diseño global.
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
import { config } from '@/utils/config';
import { useAuthStore } from '@/store/auth';
import { sitesApi } from '@/services/api/sites';
import { Site } from '@/types/sites';
import { MAIN_ROUTES } from '@/constants/routes';

// Design System Imports
import { colors } from '@/design-system/tokens/colors';
import { spacing, borderRadius } from '@/design-system/tokens/spacing';
import { shadows } from '@/design-system/tokens/shadows';
import { fontSizes, fontWeights } from '@/design-system/tokens/typography';
import { durations } from '@/design-system/tokens/animations';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';

type Props = NativeStackScreenProps<any, 'UploadCashReconciliationFiles'>;

type ReportType = 'ventas' | 'izipay' | 'prosegur';

interface ReportTypeOption {
  id: ReportType;
  label: string;
  description: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
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
// Report Type Card Component
// ============================================================================

interface ReportTypeCardProps {
  type: ReportTypeOption;
  isSelected: boolean;
  onPress: () => void;
}

const ReportTypeCard: React.FC<ReportTypeCardProps> = ({ type, isSelected, onPress }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          styles.reportTypeCard,
          isSelected && styles.reportTypeCardSelected,
          { transform: [{ scale }] },
        ]}
      >
        <View style={[styles.reportTypeIcon, { backgroundColor: type.color }]}>
          <Ionicons name={type.icon} size={28} color={colors.neutral[0]} />
        </View>
        <View style={styles.reportTypeContent}>
          <Text style={styles.reportTypeLabel}>{type.label}</Text>
          <Text style={styles.reportTypeDescription}>{type.description}</Text>
        </View>
        {isSelected && (
          <View style={styles.checkmark}>
            <Ionicons name="checkmark" size={18} color={colors.neutral[0]} />
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const UploadCashReconciliationFilesScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { token, currentCompany } = useAuthStore();
  const [selectedFile, setSelectedFile] = useState<DocumentPickerAsset | null>(null);
  const [selectedReportType, setSelectedReportType] = useState<ReportType | null>(null);
  const [selectedSede, setSelectedSede] = useState<string>('');
  const [sedes, setSedes] = useState<Site[]>([]);
  const [isLoadingSedes, setIsLoadingSedes] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const reportTypes: ReportTypeOption[] = [
    {
      id: 'ventas',
      label: 'Ventas',
      description: 'Reporte de ventas del sistema',
      color: colors.success[600],
      icon: 'cash-outline',
    },
    {
      id: 'izipay',
      label: 'Izipay',
      description: 'Reporte de transacciones Izipay',
      color: colors.accent[600],
      icon: 'card-outline',
    },
    {
      id: 'prosegur',
      label: 'Prosegur',
      description: 'Reporte de recaudación Prosegur',
      color: colors.warning[600],
      icon: 'business-outline',
    },
  ];

  // Cargar sedes cuando se selecciona "ventas"
  useEffect(() => {
    if (selectedReportType === 'ventas') {
      loadSedes();
    } else {
      setSedes([]);
      setSelectedSede('');
    }
  }, [selectedReportType]);

  const loadSedes = async () => {
    setIsLoadingSedes(true);
    try {
      // Cargar todas las sedes de todas las empresas (sin filtrar por companyId)
      const response = await sitesApi.getSites({
        isActive: true,
        limit: 500,
      });
      // Ordenar por nombre de empresa y luego por nombre de sede
      const sortedSedes = response.data.sort((a, b) => {
        const companyA = a.company?.name || '';
        const companyB = b.company?.name || '';
        if (companyA !== companyB) {
          return companyA.localeCompare(companyB);
        }
        return a.name.localeCompare(b.name);
      });
      setSedes(sortedSedes);
    } catch (error) {
      console.error('❌ Error al cargar sedes:', error);
      Alert.alert('Error', 'No se pudieron cargar las sedes');
    } finally {
      setIsLoadingSedes(false);
    }
  };

  const handleSelectFile = async () => {
    try {
      let allowedTypes: string | string[];

      if (selectedReportType === 'prosegur') {
        allowedTypes = [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/zip',
          'application/x-zip-compressed',
        ];
      } else {
        allowedTypes = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      }

      const result = await getDocumentAsync({
        type: allowedTypes,
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      if (result.assets && result.assets.length > 0) {
        setSelectedFile(result.assets[0]);
      }
    } catch (error) {
      console.error('❌ Error al seleccionar archivo:', error);
      Alert.alert('Error', 'No se pudo seleccionar el archivo');
    }
  };

  const handleUpload = async () => {
    console.log('🚀 [Upload] handleUpload called');
    console.log('📄 selectedFile:', selectedFile);
    console.log('📋 selectedReportType:', selectedReportType);
    console.log('🏢 selectedSede:', selectedSede);

    if (!selectedFile || !selectedReportType) {
      Alert.alert('Error', 'Por favor selecciona un tipo de reporte y un archivo');
      return;
    }

    if (selectedReportType === 'ventas' && !selectedSede) {
      Alert.alert('Error', 'Por favor selecciona una sede');
      return;
    }

    setIsUploading(true);
    console.log('⏳ [Upload] Starting upload process...');

    try {
      const formData = new FormData();

      if (Platform.OS === 'web') {
        // Web/Electron: Need to read file content into memory before sending
        // In Electron, File objects can lose their content after selection
        console.log('📤 [Web/Electron] Preparing file upload...');
        console.log('📄 selectedFile:', selectedFile);
        console.log('📄 selectedFile.file:', selectedFile.file);
        console.log('📄 selectedFile.uri:', selectedFile.uri);

        try {
          let fileToUpload: File;

          if (selectedFile.file) {
            // Read the File object into an ArrayBuffer to ensure content is loaded
            // This fixes issues in Electron where File objects may lose content
            console.log('📖 Reading File object into memory...');
            const arrayBuffer = await selectedFile.file.arrayBuffer();
            console.log('📦 ArrayBuffer size:', arrayBuffer.byteLength, 'bytes');

            if (arrayBuffer.byteLength === 0) {
              throw new Error('El archivo esta vacio o no se pudo leer');
            }

            const blob = new Blob([arrayBuffer], { type: selectedFile.file.type || selectedFile.mimeType });
            fileToUpload = new File([blob], selectedFile.file.name || selectedFile.name, {
              type: selectedFile.file.type || selectedFile.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            console.log('✅ File recreated:', fileToUpload.name, fileToUpload.type, fileToUpload.size);
          } else if (selectedFile.uri) {
            // Fallback: fetch the blob from URI
            console.log('⚠️ No File object, fetching from URI:', selectedFile.uri);
            const blobResponse = await fetch(selectedFile.uri);
            if (!blobResponse.ok) {
              throw new Error(`Failed to fetch blob: ${blobResponse.status}`);
            }
            const blob = await blobResponse.blob();
            console.log('📦 Blob created:', blob.size, 'bytes, type:', blob.type);

            if (blob.size === 0) {
              throw new Error('El archivo esta vacio o no se pudo leer desde URI');
            }

            fileToUpload = new File([blob], selectedFile.name, {
              type: selectedFile.mimeType || blob.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            console.log('📁 File created from URI:', fileToUpload.name, fileToUpload.type, fileToUpload.size);
          } else {
            throw new Error('No se encontro el archivo para subir');
          }

          formData.append('file', fileToUpload);
          console.log('✅ File appended to FormData');
        } catch (fileError: any) {
          console.error('❌ Error preparing file:', fileError);
          throw new Error(`Error preparando archivo: ${fileError.message}`);
        }
      } else {
        // Mobile: Use file metadata object
        formData.append('file', {
          uri: selectedFile.uri,
          type: selectedFile.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          name: selectedFile.name,
        } as any);
      }

      formData.append('tipo_reporte', selectedReportType);

      if (selectedReportType === 'ventas') {
        formData.append('sede_id', selectedSede);
      }

      const uploadUrl = `${config.API_URL}/cash-reconciliation/upload`;
      console.log('🌐 [Upload] Sending to:', uploadUrl);
      console.log('🔑 [Upload] Token present:', !!token);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-App-Id': config.APP_ID,
          'X-App-Version': config.APP_VERSION,
        },
        body: formData,
      });

      console.log('📥 [Upload] Response status:', response.status);

      const responseText = await response.text();
      console.log('📄 [Upload] Response text:', responseText.substring(0, 500));

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ [Upload] Failed to parse JSON:', parseError);
        throw new Error(`Error del servidor: ${responseText.substring(0, 200)}`);
      }

      if (response.ok) {
        // Mensaje de procesamiento en segundo plano
        const reportTypeLabels = {
          ventas: 'Ventas',
          izipay: 'Izipay',
          prosegur: 'Prosegur',
        };

        const reportLabel = reportTypeLabels[selectedReportType];

        Alert.alert(
          '✅ Archivo Recibido',
          `El archivo de ${reportLabel} se ha recibido correctamente y se está procesando en segundo plano.\n\n` +
          `📂 Archivo: ${selectedFile.name}\n\n` +
          `⏳ El procesamiento puede tardar varios minutos dependiendo del tamaño del archivo.\n\n` +
          `📊 Podrás revisar los resultados más tarde en la sección de "Archivos Subidos" o "Cuadre de Caja".`,
          [
            {
              text: 'Ver Archivos Subidos',
              onPress: () => {
                setSelectedFile(null);
                setSelectedReportType(null);
                setSelectedSede('');
                navigation.navigate(MAIN_ROUTES.UPLOADED_FILES_LIST as any);
              },
            },
            {
              text: 'OK',
              style: 'cancel',
              onPress: () => {
                setSelectedFile(null);
                setSelectedReportType(null);
                setSelectedSede('');
              },
            },
          ]
        );
      } else {
        throw new Error(result.message || 'Error al procesar el archivo');
      }
    } catch (error: any) {
      console.error('❌ Error al subir archivo:', error);
      Alert.alert('Error', error.message || 'No se pudo subir el archivo');
    } finally {
      setIsUploading(false);
    }
  };

  const getStepNumber = (baseStep: number): number => {
    if (selectedReportType === 'ventas') {
      return baseStep;
    }
    return baseStep > 1 ? baseStep - 1 : baseStep;
  };

  const canUpload = selectedFile && selectedReportType && (selectedReportType !== 'ventas' || selectedSede);

  return (
    <ScreenLayout navigation={navigation as any}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header con gradiente */}
        <LinearGradient
          colors={[colors.primary[900], colors.primary[800]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButtonGradient}>
              <Ionicons name="arrow-back" size={24} color={colors.neutral[0]} />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <View style={styles.headerIconRow}>
                <View style={styles.headerIconContainer}>
                  <Ionicons name="cloud-upload-outline" size={22} color={colors.neutral[0]} />
                </View>
                <Text style={styles.titleGradient}>Subir Archivos</Text>
              </View>
              <Text style={styles.subtitleGradient}>Carga archivos de cuadre de caja</Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate(MAIN_ROUTES.UPLOADED_FILES_LIST as any)}
              style={styles.historyButtonGradient}
            >
              <Ionicons name="time-outline" size={24} color={colors.neutral[0]} />
            </TouchableOpacity>
          </View>
        </LinearGradient>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Step 1: Select Report Type */}
        <AnimatedCard delay={0}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepNumber}>1</Text>
              </View>
              <Text style={styles.sectionTitle}>Tipo de Reporte</Text>
            </View>
            <View style={styles.reportTypesContainer}>
              {reportTypes.map((type) => (
                <ReportTypeCard
                  key={type.id}
                  type={type}
                  isSelected={selectedReportType === type.id}
                  onPress={() => setSelectedReportType(type.id)}
                />
              ))}
            </View>
          </View>
        </AnimatedCard>

        {/* Step 2: Select Sede (only for Ventas) */}
        {selectedReportType === 'ventas' && (
          <AnimatedCard delay={100}>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepNumber}>2</Text>
                </View>
                <Text style={styles.sectionTitle}>Seleccionar Sede</Text>
              </View>
              {isLoadingSedes ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color={colors.primary[600]} size="small" />
                  <Text style={styles.loadingText}>Cargando sedes...</Text>
                </View>
              ) : sedes.length > 0 ? (
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={selectedSede}
                    onValueChange={(value) => setSelectedSede(value)}
                    style={styles.picker}
                  >
                    <Picker.Item label="Selecciona una sede" value="" />
                    {sedes.map((sede) => (
                      <Picker.Item
                        key={sede.id}
                        label={`${sede.name} (${sede.code})${sede.company?.name ? ` - ${sede.company.name}` : ''}`}
                        value={sede.id}
                      />
                    ))}
                  </Picker>
                </View>
              ) : (
                <View style={styles.warningContainer}>
                  <Ionicons name="warning-outline" size={24} color={colors.warning[600]} />
                  <Text style={styles.warningText}>No hay sedes disponibles</Text>
                </View>
              )}
            </View>
          </AnimatedCard>
        )}

        {/* Step 3: Select File */}
        <AnimatedCard delay={selectedReportType === 'ventas' ? 200 : 100}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepNumber}>{getStepNumber(selectedReportType === 'ventas' ? 3 : 2)}</Text>
              </View>
              <Text style={styles.sectionTitle}>
                Seleccionar Archivo {selectedReportType === 'prosegur' ? '(Excel o ZIP)' : 'Excel'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.selectFileButton, selectedFile && styles.selectFileButtonSelected]}
              onPress={handleSelectFile}
              activeOpacity={0.7}
            >
              <View style={styles.selectFileIconContainer}>
                <Ionicons
                  name={selectedFile ? 'document-attach' : 'cloud-upload-outline'}
                  size={32}
                  color={selectedFile ? colors.success[600] : colors.neutral[400]}
                />
              </View>
              <Text style={[styles.selectFileText, selectedFile && styles.selectFileTextSelected]}>
                {selectedFile ? selectedFile.name : 'Toca para seleccionar archivo'}
              </Text>
              {selectedFile && (
                <Text style={styles.selectFileSize}>
                  {(selectedFile.size! / 1024).toFixed(2)} KB
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </AnimatedCard>

        {/* Step 4: Upload */}
        <AnimatedCard delay={selectedReportType === 'ventas' ? 300 : 200}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepNumber}>{getStepNumber(selectedReportType === 'ventas' ? 4 : 3)}</Text>
              </View>
              <Text style={styles.sectionTitle}>Subir y Procesar</Text>
            </View>
            <TouchableOpacity
              style={[styles.uploadButton, (!canUpload || isUploading) && styles.uploadButtonDisabled]}
              onPress={handleUpload}
              disabled={!canUpload || isUploading}
              activeOpacity={0.8}
            >
              {isUploading ? (
                <>
                  <ActivityIndicator color={colors.neutral[0]} size="small" />
                  <Text style={styles.uploadButtonText}>Procesando...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={24} color={colors.neutral[0]} />
                  <Text style={styles.uploadButtonText}>Subir y Procesar</Text>
                </>
              )}
            </TouchableOpacity>

            {isUploading && (
              <View style={styles.processingWarning}>
                <Ionicons name="time-outline" size={24} color={colors.warning[700]} />
                <Text style={styles.processingWarningText}>
                  El procesamiento puede tardar varios minutos.{'\n'}
                  No cierres esta pantalla.
                </Text>
              </View>
            )}
          </View>
        </AnimatedCard>

        {/* Info Section */}
        <AnimatedCard delay={selectedReportType === 'ventas' ? 400 : 300}>
          <View style={styles.infoSection}>
            <View style={styles.infoHeader}>
              <Ionicons name="information-circle" size={24} color={colors.info[600]} />
              <Text style={styles.infoTitle}>Información</Text>
            </View>
            {selectedReportType === 'ventas' && (
              <Text style={styles.infoText}>
                • Debes seleccionar una sede específica{'\n'}
                • Puedes seleccionar sedes de todas las empresas{'\n'}
                • El archivo debe contener el reporte de ventas del sistema{'\n'}
                • Se excluyen: Notas de Crédito y ventas anuladas{'\n'}
                • Se detectarán duplicados automáticamente
              </Text>
            )}
            {selectedReportType === 'izipay' && (
              <Text style={styles.infoText}>
                • NO requiere seleccionar sede (se detecta automáticamente){'\n'}
                • Las sedes se asignan según el código de comercio{'\n'}
                • Solo se procesan transacciones tipo "COMPRA"{'\n'}
                • Se excluyen: Comisiones, devoluciones y ajustes
              </Text>
            )}
            {selectedReportType === 'prosegur' && (
              <Text style={styles.infoText}>
                • Acepta archivos Excel (.xlsx) o ZIP (.zip){'\n'}
                • Si es ZIP, se procesará el primer Excel encontrado{'\n'}
                • El sistema extrae y procesa automáticamente{'\n'}
                • Se detecta automáticamente el tipo de archivo
              </Text>
            )}
            {!selectedReportType && (
              <Text style={styles.infoText}>
                • Selecciona un tipo de reporte para ver información específica{'\n'}
                • El archivo debe estar en formato Excel (.xlsx){'\n'}
                • Se validarán los datos antes de insertarlos{'\n'}
                • Recibirás un resumen al finalizar
              </Text>
            )}
          </View>
        </AnimatedCard>

        {/* View Files Button */}
        <AnimatedCard delay={selectedReportType === 'ventas' ? 500 : 400}>
          <TouchableOpacity
            style={styles.viewFilesButton}
            onPress={() => navigation.navigate(MAIN_ROUTES.UPLOADED_FILES_LIST as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="folder-open-outline" size={24} color={colors.neutral[0]} />
            <Text style={styles.viewFilesButtonText}>Ver Archivos Subidos</Text>
          </TouchableOpacity>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[100],
  },
  // Header con gradiente
  headerGradient: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  backButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
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
  historyButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
    ...shadows.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.neutral[900],
  },
  historyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: colors.neutral[0],
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    ...shadows.sm,
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
    backgroundColor: colors.primary[900],
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumber: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    color: colors.neutral[0],
  },
  sectionTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[900],
  },
  reportTypesContainer: {
    gap: spacing[3],
  },
  reportTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    borderWidth: 2,
    borderColor: colors.neutral[200],
  },
  reportTypeCardSelected: {
    backgroundColor: colors.success[50],
    borderColor: colors.success[500],
  },
  reportTypeIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[4],
  },
  reportTypeContent: {
    flex: 1,
  },
  reportTypeLabel: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[900],
    marginBottom: spacing[1],
  },
  reportTypeDescription: {
    fontSize: fontSizes.sm,
    color: colors.neutral[500],
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.success[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.neutral[200],
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    color: colors.neutral[900],
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.md,
    padding: spacing[4],
    gap: spacing[3],
  },
  loadingText: {
    fontSize: fontSizes.sm,
    color: colors.neutral[500],
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warning[50],
    borderRadius: borderRadius.md,
    padding: spacing[4],
    gap: spacing[3],
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  warningText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.warning[700],
  },
  selectFileButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.lg,
    padding: spacing[6],
    borderWidth: 2,
    borderColor: colors.neutral[300],
    borderStyle: 'dashed',
  },
  selectFileButtonSelected: {
    backgroundColor: colors.success[50],
    borderColor: colors.success[400],
    borderStyle: 'solid',
  },
  selectFileIconContainer: {
    marginBottom: spacing[3],
  },
  selectFileText: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.medium,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  selectFileTextSelected: {
    color: colors.success[700],
  },
  selectFileSize: {
    fontSize: fontSizes.sm,
    color: colors.neutral[400],
    marginTop: spacing[2],
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success[600],
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    gap: spacing[3],
    ...shadows.md,
  },
  uploadButtonDisabled: {
    backgroundColor: colors.neutral[300],
    ...shadows.none,
  },
  uploadButtonText: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[0],
  },
  processingWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.warning[50],
    borderRadius: borderRadius.md,
    padding: spacing[4],
    marginTop: spacing[4],
    gap: spacing[3],
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  processingWarningText: {
    flex: 1,
    fontSize: fontSizes.sm,
    color: colors.warning[700],
    fontWeight: fontWeights.medium,
    lineHeight: 20,
  },
  infoSection: {
    backgroundColor: colors.info[50],
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.info[200],
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
    color: colors.info[800],
  },
  infoText: {
    fontSize: fontSizes.sm,
    color: colors.info[700],
    lineHeight: 22,
  },
  viewFilesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent[600],
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    gap: spacing[3],
    ...shadows.md,
  },
  viewFilesButtonText: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[0],
  },
  bottomSpacer: {
    height: spacing[8],
  },
});
