/**
 * UploadCashReconciliationFilesScreen.tsx
 *
 * Pantalla para subir archivos de cuadre de caja.
 * RediseÃ±ada con el sistema de diseÃ±o global.
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
import { durations } from '@/design-system/tokens/animations';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
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
// Main Component
// ============================================================================

export const UploadCashReconciliationFilesScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { token, currentCompany } = useAuthStore();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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
      color: theme.color.action.success.background,
      icon: 'cash-outline',
    },
    {
      id: 'izipay',
      label: 'Izipay',
      description: 'Reporte de transacciones Izipay',
      color: theme.color.brand.accent,
      icon: 'card-outline',
    },
    {
      id: 'prosegur',
      label: 'Prosegur',
      description: 'Reporte de recaudaciÃ³n Prosegur',
      color: theme.color.icon.warning,
      icon: 'business-outline',
    },
  ];

  // Report Type Card (inline to access themed styles)
  const ReportTypeCard: React.FC<{
    type: ReportTypeOption;
    isSelected: boolean;
    onPress: () => void;
  }> = ({ type, isSelected, onPress }) => {
    const scale = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
      Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
    };
    const handlePressOut = () => {
      Animated.spring(scale, { toValue: 1, friction: 3, useNativeDriver: true }).start();
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
            <Ionicons name={type.icon} size={28} color={theme.color.brand.onHeader} />
          </View>
          <View style={styles.reportTypeContent}>
            <Text style={styles.reportTypeLabel}>{type.label}</Text>
            <Text style={styles.reportTypeDescription}>{type.description}</Text>
          </View>
          {isSelected && (
            <View style={styles.checkmark}>
              <Ionicons name="checkmark" size={18} color={theme.color.brand.onHeader} />
            </View>
          )}
        </Animated.View>
      </TouchableOpacity>
    );
  };

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
        limit: 100,
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
      console.error('âŒ Error al cargar sedes:', error);
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
      console.error('âŒ Error al seleccionar archivo:', error);
      Alert.alert('Error', 'No se pudo seleccionar el archivo');
    }
  };

  const handleUpload = async () => {
    console.log('ðŸš€ [Upload] handleUpload called');
    console.log('ðŸ“„ selectedFile:', selectedFile);
    console.log('ðŸ“‹ selectedReportType:', selectedReportType);
    console.log('ðŸ¢ selectedSede:', selectedSede);

    if (!selectedFile || !selectedReportType) {
      Alert.alert('Error', 'Por favor selecciona un tipo de reporte y un archivo');
      return;
    }

    if (selectedReportType === 'ventas' && !selectedSede) {
      Alert.alert('Error', 'Por favor selecciona una sede');
      return;
    }

    setIsUploading(true);
    console.log('â³ [Upload] Starting upload process...');

    try {
      const formData = new FormData();

      if (Platform.OS === 'web') {
        // Web/Electron: Need to read file content into memory before sending
        // In Electron, File objects can lose their content after selection
        console.log('ðŸ“¤ [Web/Electron] Preparing file upload...');
        console.log('ðŸ“„ selectedFile:', selectedFile);
        console.log('ðŸ“„ selectedFile.file:', selectedFile.file);
        console.log('ðŸ“„ selectedFile.uri:', selectedFile.uri);

        try {
          let fileToUpload: File;

          if (selectedFile.file) {
            // Read the File object into an ArrayBuffer to ensure content is loaded
            // This fixes issues in Electron where File objects may lose content
            console.log('ðŸ“– Reading File object into memory...');
            const arrayBuffer = await selectedFile.file.arrayBuffer();
            console.log('ðŸ“¦ ArrayBuffer size:', arrayBuffer.byteLength, 'bytes');

            if (arrayBuffer.byteLength === 0) {
              throw new Error('El archivo esta vacio o no se pudo leer');
            }

            const blob = new Blob([arrayBuffer], { type: selectedFile.file.type || selectedFile.mimeType });
            fileToUpload = new File([blob], selectedFile.file.name || selectedFile.name, {
              type: selectedFile.file.type || selectedFile.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            console.log('âœ… File recreated:', fileToUpload.name, fileToUpload.type, fileToUpload.size);
          } else if (selectedFile.uri) {
            // Fallback: fetch the blob from URI
            console.log('âš ï¸ No File object, fetching from URI:', selectedFile.uri);
            const blobResponse = await fetch(selectedFile.uri);
            if (!blobResponse.ok) {
              throw new Error(`Failed to fetch blob: ${blobResponse.status}`);
            }
            const blob = await blobResponse.blob();
            console.log('ðŸ“¦ Blob created:', blob.size, 'bytes, type:', blob.type);

            if (blob.size === 0) {
              throw new Error('El archivo esta vacio o no se pudo leer desde URI');
            }

            fileToUpload = new File([blob], selectedFile.name, {
              type: selectedFile.mimeType || blob.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            console.log('ðŸ“ File created from URI:', fileToUpload.name, fileToUpload.type, fileToUpload.size);
          } else {
            throw new Error('No se encontro el archivo para subir');
          }

          formData.append('file', fileToUpload);
          console.log('âœ… File appended to FormData');
        } catch (fileError: any) {
          console.error('âŒ Error preparing file:', fileError);
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
      console.log('ðŸŒ [Upload] Sending to:', uploadUrl);
      console.log('ðŸ”‘ [Upload] Token present:', !!token);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-App-Id': config.APP_ID,
          'X-App-Version': config.APP_VERSION,
        },
        body: formData,
      });

      console.log('ðŸ“¥ [Upload] Response status:', response.status);

      const responseText = await response.text();
      console.log('ðŸ“„ [Upload] Response text:', responseText.substring(0, 500));

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('âŒ [Upload] Failed to parse JSON:', parseError);
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
          'âœ… Archivo Recibido',
          `El archivo de ${reportLabel} se ha recibido correctamente y se estÃ¡ procesando en segundo plano.\n\n` +
          `ðŸ“‚ Archivo: ${selectedFile.name}\n\n` +
          `â³ El procesamiento puede tardar varios minutos dependiendo del tamaÃ±o del archivo.\n\n` +
          `ðŸ“Š PodrÃ¡s revisar los resultados mÃ¡s tarde en la secciÃ³n de "Archivos Subidos" o "Cuadre de Caja".`,
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
      console.error('âŒ Error al subir archivo:', error);
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
          colors={[theme.color.brand.headerFrom, theme.color.brand.headerTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButtonGradient}>
              <Ionicons name="arrow-back" size={24} color={theme.color.brand.onHeader} />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <View style={styles.headerIconRow}>
                <View style={styles.headerIconContainer}>
                  <Ionicons name="cloud-upload-outline" size={22} color={theme.color.brand.onHeader} />
                </View>
                <Text style={styles.titleGradient}>Subir Archivos</Text>
              </View>
              <Text style={styles.subtitleGradient}>Carga archivos de cuadre de caja</Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate(MAIN_ROUTES.UPLOADED_FILES_LIST as any)}
              style={styles.historyButtonGradient}
            >
              <Ionicons name="time-outline" size={24} color={theme.color.brand.onHeader} />
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
                  <ActivityIndicator color={theme.color.icon.muted} size="small" />
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
                  <Ionicons name="warning-outline" size={24} color={theme.color.icon.warning} />
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
                  color={selectedFile ? theme.color.text.success : theme.color.text.placeholder}
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
                  <ActivityIndicator color={theme.color.action.success.text} size="small" />
                  <Text style={styles.uploadButtonText}>Procesando...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={24} color={theme.color.action.success.text} />
                  <Text style={styles.uploadButtonText}>Subir y Procesar</Text>
                </>
              )}
            </TouchableOpacity>

            {isUploading && (
              <View style={styles.processingWarning}>
                <Ionicons name="time-outline" size={24} color={theme.color.state.warning.text} />
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
              <Ionicons name="information-circle" size={24} color={theme.color.state.info.border} />
              <Text style={styles.infoTitle}>InformaciÃ³n</Text>
            </View>
            {selectedReportType === 'ventas' && (
              <Text style={styles.infoText}>
                â€¢ Debes seleccionar una sede especÃ­fica{'\n'}
                â€¢ Puedes seleccionar sedes de todas las empresas{'\n'}
                â€¢ El archivo debe contener el reporte de ventas del sistema{'\n'}
                â€¢ Se excluyen: Notas de CrÃ©dito y ventas anuladas{'\n'}
                â€¢ Se detectarÃ¡n duplicados automÃ¡ticamente
              </Text>
            )}
            {selectedReportType === 'izipay' && (
              <Text style={styles.infoText}>
                â€¢ NO requiere seleccionar sede (se detecta automÃ¡ticamente){'\n'}
                â€¢ Las sedes se asignan segÃºn el cÃ³digo de comercio{'\n'}
                â€¢ Solo se procesan transacciones tipo "COMPRA"{'\n'}
                â€¢ Se excluyen: Comisiones, devoluciones y ajustes
              </Text>
            )}
            {selectedReportType === 'prosegur' && (
              <Text style={styles.infoText}>
                â€¢ Acepta archivos Excel (.xlsx) o ZIP (.zip){'\n'}
                â€¢ Si es ZIP, se procesarÃ¡ el primer Excel encontrado{'\n'}
                â€¢ El sistema extrae y procesa automÃ¡ticamente{'\n'}
                â€¢ Se detecta automÃ¡ticamente el tipo de archivo
              </Text>
            )}
            {!selectedReportType && (
              <Text style={styles.infoText}>
                â€¢ Selecciona un tipo de reporte para ver informaciÃ³n especÃ­fica{'\n'}
                â€¢ El archivo debe estar en formato Excel (.xlsx){'\n'}
                â€¢ Se validarÃ¡n los datos antes de insertarlos{'\n'}
                â€¢ RecibirÃ¡s un resumen al finalizar
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
            <Ionicons name="folder-open-outline" size={24} color={theme.color.brand.onHeader} />
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

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background.muted,
  },
  // Header con gradiente
  headerGradient: {
    paddingHorizontal: theme.space[5],
    paddingTop: theme.space[4],
    paddingBottom: theme.space[4],
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  backButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.full,
    backgroundColor: theme.color.brand.headerBadge,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.space[3],
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.space[1],
  },
  headerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.brand.headerBadge,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.space[3],
  },
  titleGradient: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.color.brand.onHeader,
    letterSpacing: 0.3,
  },
  subtitleGradient: {
    fontSize: 14,
    color: theme.color.brand.onHeaderMuted,
    fontWeight: '500',
    marginLeft: theme.space[12],
  },
  historyButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.full,
    backgroundColor: theme.color.brand.headerBadge,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[4],
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
    ...theme.shadow.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.color.background.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  historyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.color.brand.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: theme.color.surface.base,
    marginHorizontal: theme.space[4],
    marginTop: theme.space[4],
    borderRadius: theme.radii.lg,
    padding: theme.space[4],
    ...theme.shadow.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.space[4],
    gap: theme.space[3],
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
    fontSize: 14,
    fontWeight: '700',
    color: theme.color.brand.onHeader,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.color.text.heading,
  },
  reportTypesContainer: {
    gap: theme.space[3],
  },
  reportTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.background.subtle,
    borderRadius: theme.radii.lg,
    padding: theme.space[4],
    borderWidth: 2,
    borderColor: theme.color.border.subtle,
  },
  reportTypeCardSelected: {
    backgroundColor: theme.color.state.success.background,
    borderColor: theme.color.state.success.border,
  },
  reportTypeIcon: {
    width: 56,
    height: 56,
    borderRadius: theme.radii.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.space[4],
  },
  reportTypeContent: {
    flex: 1,
  },
  reportTypeLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.color.text.heading,
    marginBottom: theme.space[1],
  },
  reportTypeDescription: {
    fontSize: 14,
    color: theme.color.text.subtle,
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.color.state.success.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    backgroundColor: theme.color.background.subtle,
    borderRadius: theme.radii.md,
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
    backgroundColor: theme.color.background.subtle,
    borderRadius: theme.radii.md,
    padding: theme.space[4],
    gap: theme.space[3],
  },
  loadingText: {
    fontSize: 14,
    color: theme.color.text.subtle,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.state.warning.background,
    borderRadius: theme.radii.md,
    padding: theme.space[4],
    gap: theme.space[3],
    borderWidth: 1,
    borderColor: theme.color.state.warning.border,
  },
  warningText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.color.state.warning.text,
  },
  selectFileButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.background.subtle,
    borderRadius: theme.radii.lg,
    padding: theme.space[6],
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
    marginBottom: theme.space[3],
  },
  selectFileText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.color.text.subtle,
    textAlign: 'center',
  },
  selectFileTextSelected: {
    color: theme.color.state.success.text,
  },
  selectFileSize: {
    fontSize: 14,
    color: theme.color.text.placeholder,
    marginTop: theme.space[2],
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.action.success.background,
    borderRadius: theme.radii.lg,
    padding: theme.space[4],
    gap: theme.space[3],
    ...theme.shadow.md,
  },
  uploadButtonDisabled: {
    backgroundColor: theme.color.action.success.backgroundDisabled,
  },
  uploadButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.color.action.success.text,
  },
  processingWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.color.state.warning.background,
    borderRadius: theme.radii.md,
    padding: theme.space[4],
    marginTop: theme.space[4],
    gap: theme.space[3],
    borderWidth: 1,
    borderColor: theme.color.state.warning.border,
  },
  processingWarningText: {
    flex: 1,
    fontSize: 14,
    color: theme.color.state.warning.text,
    fontWeight: '500',
    lineHeight: 20,
  },
  infoSection: {
    backgroundColor: theme.color.state.info.background,
    marginHorizontal: theme.space[4],
    marginTop: theme.space[4],
    borderRadius: theme.radii.lg,
    padding: theme.space[4],
    borderWidth: 1,
    borderColor: theme.color.state.info.border,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.space[3],
    gap: theme.space[2],
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.state.info.text,
  },
  infoText: {
    fontSize: 14,
    color: theme.color.state.info.text,
    lineHeight: 22,
  },
  viewFilesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.brand.accent,
    marginHorizontal: theme.space[4],
    marginTop: theme.space[4],
    borderRadius: theme.radii.lg,
    padding: theme.space[4],
    gap: theme.space[3],
    ...theme.shadow.md,
  },
  viewFilesButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.brand.onHeader,
  },
  bottomSpacer: {
    height: theme.space[8],
  },
});
