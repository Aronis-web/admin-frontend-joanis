/**
 * AppVersionsScreen.tsx
 *
 * Pantalla para gestionar versiones de la aplicación.
 * Permite subir nuevos APKs y listar versiones existentes.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Platform,
  RefreshControl,
  TextInput,
} from 'react-native';
import Alert from '@/utils/alert';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getDocumentAsync, DocumentPickerAsset } from '@/utils/filePicker';
import { Picker } from '@react-native-picker/picker';

// Design System Imports
import { colors } from '@/design-system/tokens/colors';
import { spacing, borderRadius } from '@/design-system/tokens/spacing';
import { shadows } from '@/design-system/tokens/shadows';
import { fontSizes, fontWeights } from '@/design-system/tokens/typography';
import { durations } from '@/design-system/tokens/animations';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';

// API
import { appUpdatesApi, AppRelease, Platform as AppPlatform, AppId } from '@/services/api/app-updates';

type Props = NativeStackScreenProps<any, 'AppVersions'>;

// ============================================================================
// Types
// ============================================================================

interface AppOption {
  id: AppId;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface PlatformOption {
  id: AppPlatform;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  acceptedTypes: string[];
}

const APP_OPTIONS: AppOption[] = [
  { id: 'erp-aio', label: 'ERP AIO', icon: 'business-outline' },
  { id: 'caja-frontend', label: 'Caja Frontend', icon: 'cart-outline' },
];

const PLATFORM_OPTIONS: PlatformOption[] = [
  {
    id: 'android',
    label: 'Android',
    icon: 'logo-android',
    color: colors.success[500],
    acceptedTypes: ['application/vnd.android.package-archive', 'application/octet-stream'],
  },
  {
    id: 'windows',
    label: 'Windows',
    icon: 'logo-windows',
    color: colors.accent[500],
    acceptedTypes: ['application/x-msdownload', 'application/octet-stream'],
  },
  {
    id: 'ios',
    label: 'iOS',
    icon: 'logo-apple',
    color: colors.neutral[700],
    acceptedTypes: ['application/octet-stream'],
  },
];

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
// Version Card Component
// ============================================================================

interface VersionCardProps {
  release: AppRelease;
  onDownload: () => void;
}

const VersionCard: React.FC<VersionCardProps> = ({ release, onDownload }) => {
  const getPlatformIcon = (platform: AppPlatform): keyof typeof Ionicons.glyphMap => {
    switch (platform) {
      case 'android': return 'logo-android';
      case 'windows': return 'logo-windows';
      case 'ios': return 'logo-apple';
      default: return 'globe-outline';
    }
  };

  const getPlatformColor = (platform: AppPlatform): string => {
    switch (platform) {
      case 'android': return colors.success[500];
      case 'windows': return colors.accent[500];
      case 'ios': return colors.neutral[700];
      default: return colors.primary[500];
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <View style={styles.versionCard}>
      <View style={styles.versionHeader}>
        <View style={styles.versionInfo}>
          <View style={styles.versionBadge}>
            <Text style={styles.versionText}>v{release.version}</Text>
          </View>
          <View style={[styles.platformBadge, { backgroundColor: `${getPlatformColor(release.platform)}20` }]}>
            <Ionicons name={getPlatformIcon(release.platform)} size={14} color={getPlatformColor(release.platform)} />
            <Text style={[styles.platformText, { color: getPlatformColor(release.platform) }]}>
              {release.platform}
            </Text>
          </View>
          {release.isMandatory && (
            <View style={styles.mandatoryBadge}>
              <Text style={styles.mandatoryText}>Obligatoria</Text>
            </View>
          )}
        </View>
        <View style={[
          styles.statusDot,
          { backgroundColor: release.isActive ? colors.success[500] : colors.neutral[400] }
        ]} />
      </View>

      <View style={styles.versionDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="code-outline" size={14} color={colors.neutral[500]} />
          <Text style={styles.detailText}>Código: {release.versionCode}</Text>
        </View>
        {release.fileSize && (
          <View style={styles.detailRow}>
            <Ionicons name="document-outline" size={14} color={colors.neutral[500]} />
            <Text style={styles.detailText}>Tamaño: {formatFileSize(release.fileSize)}</Text>
          </View>
        )}
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={14} color={colors.neutral[500]} />
          <Text style={styles.detailText}>Fecha: {formatDate(release.releaseDate)}</Text>
        </View>
      </View>

      {release.changelog && (
        <View style={styles.changelogContainer}>
          <Text style={styles.changelogLabel}>Changelog:</Text>
          <Text style={styles.changelogText} numberOfLines={3}>{release.changelog}</Text>
        </View>
      )}

      {release.downloadUrl && (
        <TouchableOpacity style={styles.downloadButton} onPress={onDownload}>
          <Ionicons name="download-outline" size={18} color={colors.neutral[0]} />
          <Text style={styles.downloadButtonText}>Descargar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const AppVersionsScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  // State for upload
  const [selectedApp, setSelectedApp] = useState<AppId>('erp-aio');
  const [selectedPlatform, setSelectedPlatform] = useState<AppPlatform>('android');
  const [version, setVersion] = useState('');
  const [selectedFile, setSelectedFile] = useState<DocumentPickerAsset | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // State for list
  const [releases, setReleases] = useState<AppRelease[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterPlatform, setFilterPlatform] = useState<AppPlatform | 'all'>('all');

  // Active tab
  const [activeTab, setActiveTab] = useState<'upload' | 'list'>('list');

  // ============================================================================
  // API Calls
  // ============================================================================

  const loadReleases = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setIsLoading(true);
      const platform = filterPlatform === 'all' ? undefined : filterPlatform;
      const data = await appUpdatesApi.listReleases(selectedApp, platform);
      setReleases(data || []);
    } catch (error: any) {
      console.error('Error loading releases:', error);
      Alert.alert('Error', 'No se pudieron cargar las versiones');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedApp, filterPlatform]);

  useEffect(() => {
    loadReleases();
  }, [loadReleases]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadReleases(false);
  };

  // ============================================================================
  // File Picker
  // ============================================================================

  const handleSelectFile = async () => {
    try {
      const result = await getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];

      // Validate file extension
      const fileName = file.name.toLowerCase();
      const isValidExtension =
        (selectedPlatform === 'android' && fileName.endsWith('.apk')) ||
        (selectedPlatform === 'windows' && (fileName.endsWith('.exe') || fileName.endsWith('.msi'))) ||
        (selectedPlatform === 'ios' && fileName.endsWith('.ipa'));

      if (!isValidExtension) {
        Alert.alert(
          'Archivo inválido',
          `Por favor selecciona un archivo válido para ${selectedPlatform}`
        );
        return;
      }

      setSelectedFile(file);
    } catch (error) {
      console.error('Error selecting file:', error);
      Alert.alert('Error', 'No se pudo seleccionar el archivo');
    }
  };

  // ============================================================================
  // Upload
  // ============================================================================

  const handleUpload = async () => {
    if (!selectedFile) {
      Alert.alert('Error', 'Por favor selecciona un archivo');
      return;
    }

    if (!version.trim()) {
      Alert.alert('Error', 'Por favor ingresa la versión');
      return;
    }

    // Validate version format (semver)
    const versionRegex = /^\d+\.\d+\.\d+$/;
    if (!versionRegex.test(version.trim())) {
      Alert.alert('Error', 'La versión debe tener el formato X.Y.Z (ej: 1.0.31)');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);

      await appUpdatesApi.uploadRelease(
        selectedApp,
        selectedPlatform,
        version.trim(),
        selectedFile,
        (progress) => setUploadProgress(progress)
      );

      Alert.alert('Éxito', 'La versión se subió correctamente');

      // Reset form
      setSelectedFile(null);
      setVersion('');
      setUploadProgress(0);

      // Switch to list tab and refresh
      setActiveTab('list');
      loadReleases();
    } catch (error: any) {
      console.error('Error uploading:', error);
      Alert.alert(
        'Error',
        error.message || 'No se pudo subir el archivo'
      );
    } finally {
      setIsUploading(false);
    }
  };

  // ============================================================================
  // Download
  // ============================================================================

  const handleDownload = (release: AppRelease) => {
    if (release.downloadUrl) {
      const url = appUpdatesApi.getDownloadUrl(
        release.appId as AppId,
        release.platform,
        release.version
      );
      // Open download URL
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      } else {
        Alert.alert('Descargar', `URL de descarga:\n${url}`);
      }
    }
  };

  // ============================================================================
  // Render Upload Tab
  // ============================================================================

  const renderUploadTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* App Selector */}
      <AnimatedCard delay={0}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="apps-outline" size={20} color={colors.primary[600]} />
            <Text style={styles.cardTitle}>Aplicación</Text>
          </View>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedApp}
              onValueChange={(value) => setSelectedApp(value)}
              style={styles.picker}
            >
              {APP_OPTIONS.map((app) => (
                <Picker.Item key={app.id} label={app.label} value={app.id} />
              ))}
            </Picker>
          </View>
        </View>
      </AnimatedCard>

      {/* Platform Selector */}
      <AnimatedCard delay={100}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="phone-portrait-outline" size={20} color={colors.primary[600]} />
            <Text style={styles.cardTitle}>Plataforma</Text>
          </View>
          <View style={styles.platformGrid}>
            {PLATFORM_OPTIONS.map((platform) => (
              <TouchableOpacity
                key={platform.id}
                style={[
                  styles.platformOption,
                  selectedPlatform === platform.id && styles.platformOptionSelected,
                  selectedPlatform === platform.id && { borderColor: platform.color },
                ]}
                onPress={() => {
                  setSelectedPlatform(platform.id);
                  setSelectedFile(null); // Reset file when changing platform
                }}
              >
                <Ionicons
                  name={platform.icon}
                  size={24}
                  color={selectedPlatform === platform.id ? platform.color : colors.neutral[400]}
                />
                <Text style={[
                  styles.platformOptionText,
                  selectedPlatform === platform.id && { color: platform.color },
                ]}>
                  {platform.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </AnimatedCard>

      {/* Version Input */}
      <AnimatedCard delay={200}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="git-branch-outline" size={20} color={colors.primary[600]} />
            <Text style={styles.cardTitle}>Versión</Text>
          </View>
          <TextInput
            style={styles.textInput}
            placeholder="Ej: 1.0.31"
            placeholderTextColor={colors.neutral[400]}
            value={version}
            onChangeText={setVersion}
            keyboardType="default"
            autoCapitalize="none"
          />
          <Text style={styles.inputHint}>Formato: X.Y.Z (semver)</Text>
        </View>
      </AnimatedCard>

      {/* File Selector */}
      <AnimatedCard delay={300}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="document-outline" size={20} color={colors.primary[600]} />
            <Text style={styles.cardTitle}>Archivo</Text>
          </View>

          <TouchableOpacity
            style={styles.filePickerButton}
            onPress={handleSelectFile}
            disabled={isUploading}
          >
            <View style={styles.filePickerIcon}>
              <Ionicons
                name={selectedFile ? 'document-attach' : 'cloud-upload-outline'}
                size={32}
                color={selectedFile ? colors.success[500] : colors.primary[500]}
              />
            </View>
            <Text style={styles.filePickerText}>
              {selectedFile ? selectedFile.name : 'Seleccionar archivo'}
            </Text>
            {selectedFile && (
              <Text style={styles.filePickerSize}>
                {((selectedFile.size || 0) / (1024 * 1024)).toFixed(2)} MB
              </Text>
            )}
          </TouchableOpacity>

          <Text style={styles.inputHint}>
            Archivos permitidos: {selectedPlatform === 'android' ? '.apk' : selectedPlatform === 'windows' ? '.exe, .msi' : '.ipa'}
          </Text>
        </View>
      </AnimatedCard>

      {/* Upload Progress */}
      {isUploading && (
        <AnimatedCard delay={0}>
          <View style={styles.card}>
            <View style={styles.progressContainer}>
              <ActivityIndicator size="small" color={colors.primary[500]} />
              <Text style={styles.progressText}>Subiendo... {uploadProgress}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
            </View>
          </View>
        </AnimatedCard>
      )}

      {/* Upload Button */}
      <AnimatedCard delay={400}>
        <TouchableOpacity
          style={[
            styles.uploadButton,
            (!selectedFile || !version.trim() || isUploading) && styles.uploadButtonDisabled,
          ]}
          onPress={handleUpload}
          disabled={!selectedFile || !version.trim() || isUploading}
        >
          <LinearGradient
            colors={
              (!selectedFile || !version.trim() || isUploading)
                ? [colors.neutral[300], colors.neutral[400]]
                : [colors.primary[500], colors.primary[600]]
            }
            style={styles.uploadButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color={colors.neutral[0]} />
            ) : (
              <>
                <Ionicons name="cloud-upload" size={22} color={colors.neutral[0]} />
                <Text style={styles.uploadButtonText}>Subir Versión</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </AnimatedCard>

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  // ============================================================================
  // Render List Tab
  // ============================================================================

  const renderListTab = () => (
    <View style={styles.tabContent}>
      {/* Filters */}
      <View style={styles.filtersContainer}>
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>App:</Text>
          <View style={styles.filterPicker}>
            <Picker
              selectedValue={selectedApp}
              onValueChange={(value) => setSelectedApp(value)}
              style={styles.pickerSmall}
            >
              {APP_OPTIONS.map((app) => (
                <Picker.Item key={app.id} label={app.label} value={app.id} />
              ))}
            </Picker>
          </View>
        </View>

        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Plataforma:</Text>
          <View style={styles.filterPicker}>
            <Picker
              selectedValue={filterPlatform}
              onValueChange={(value) => setFilterPlatform(value)}
              style={styles.pickerSmall}
            >
              <Picker.Item label="Todas" value="all" />
              {PLATFORM_OPTIONS.map((platform) => (
                <Picker.Item key={platform.id} label={platform.label} value={platform.id} />
              ))}
            </Picker>
          </View>
        </View>
      </View>

      {/* Versions List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text style={styles.loadingText}>Cargando versiones...</Text>
        </View>
      ) : releases.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cloud-offline-outline" size={64} color={colors.neutral[300]} />
          <Text style={styles.emptyTitle}>No hay versiones</Text>
          <Text style={styles.emptySubtitle}>
            No se encontraron versiones para los filtros seleccionados
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.versionsList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary[500]}
            />
          }
        >
          {releases.map((release, index) => (
            <AnimatedCard key={release.id} delay={index * 50}>
              <VersionCard
                release={release}
                onDownload={() => handleDownload(release)}
              />
            </AnimatedCard>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <ScreenLayout
      title="Versiones de App"
      subtitle="Gestionar versiones y actualizaciones"
      onBack={() => navigation.goBack()}
    >
      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'list' && styles.tabActive]}
          onPress={() => setActiveTab('list')}
        >
          <Ionicons
            name="list-outline"
            size={20}
            color={activeTab === 'list' ? colors.primary[600] : colors.neutral[500]}
          />
          <Text style={[styles.tabText, activeTab === 'list' && styles.tabTextActive]}>
            Versiones
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upload' && styles.tabActive]}
          onPress={() => setActiveTab('upload')}
        >
          <Ionicons
            name="cloud-upload-outline"
            size={20}
            color={activeTab === 'upload' ? colors.primary[600] : colors.neutral[500]}
          />
          <Text style={[styles.tabText, activeTab === 'upload' && styles.tabTextActive]}>
            Subir Nueva
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'upload' ? renderUploadTab() : renderListTab()}
    </ScreenLayout>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface.primary,
    marginHorizontal: spacing[4],
    marginTop: spacing[2],
    marginBottom: spacing[4],
    borderRadius: borderRadius.xl,
    padding: spacing[1],
    ...shadows.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    gap: spacing[2],
  },
  tabActive: {
    backgroundColor: colors.primary[50],
  },
  tabText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium as any,
    color: colors.neutral[500],
  },
  tabTextActive: {
    color: colors.primary[600],
  },

  // Tab Content
  tabContent: {
    flex: 1,
    paddingHorizontal: spacing[4],
  },

  // Cards
  card: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[4],
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[3],
    gap: spacing[2],
  },
  cardTitle: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold as any,
    color: colors.text.primary,
  },

  // Picker
  pickerContainer: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.primary,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },

  // Platform Grid
  platformGrid: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  platformOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[4],
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: spacing[2],
  },
  platformOptionSelected: {
    backgroundColor: colors.surface.primary,
    borderColor: colors.primary[500],
  },
  platformOptionText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium as any,
    color: colors.neutral[500],
  },

  // Text Input
  textInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.primary,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: fontSizes.base,
    color: colors.text.primary,
  },
  inputHint: {
    fontSize: fontSizes.xs,
    color: colors.neutral[500],
    marginTop: spacing[2],
  },

  // File Picker
  filePickerButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[6],
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border.primary,
    borderStyle: 'dashed',
    gap: spacing[2],
  },
  filePickerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  filePickerText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium as any,
    color: colors.text.secondary,
  },
  filePickerSize: {
    fontSize: fontSizes.xs,
    color: colors.neutral[500],
  },

  // Progress
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  progressText: {
    fontSize: fontSizes.sm,
    color: colors.primary[600],
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.neutral[200],
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary[500],
    borderRadius: 3,
  },

  // Upload Button
  uploadButton: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadows.md,
  },
  uploadButtonDisabled: {
    opacity: 0.7,
  },
  uploadButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[4],
    gap: spacing[2],
  },
  uploadButtonText: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold as any,
    color: colors.neutral[0],
  },

  // Filters
  filtersContainer: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  filterGroup: {
    flex: 1,
  },
  filterLabel: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium as any,
    color: colors.neutral[600],
    marginBottom: spacing[1],
  },
  filterPicker: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.primary,
    overflow: 'hidden',
  },
  pickerSmall: {
    height: 44,
  },

  // Loading & Empty
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[10],
  },
  loadingText: {
    marginTop: spacing[3],
    fontSize: fontSizes.sm,
    color: colors.neutral[500],
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[10],
  },
  emptyTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold as any,
    color: colors.text.primary,
    marginTop: spacing[4],
  },
  emptySubtitle: {
    fontSize: fontSizes.sm,
    color: colors.neutral[500],
    textAlign: 'center',
    marginTop: spacing[2],
  },

  // Versions List
  versionsList: {
    flex: 1,
  },
  versionCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[3],
    ...shadows.sm,
  },
  versionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[3],
  },
  versionInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing[2],
  },
  versionBadge: {
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
  },
  versionText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold as any,
    color: colors.primary[700],
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
    gap: spacing[1],
  },
  platformText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium as any,
  },
  mandatoryBadge: {
    backgroundColor: colors.warning[100],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
  },
  mandatoryText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium as any,
    color: colors.warning[700],
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  versionDetails: {
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  detailText: {
    fontSize: fontSizes.sm,
    color: colors.neutral[600],
  },
  changelogContainer: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  changelogLabel: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold as any,
    color: colors.neutral[600],
    marginBottom: spacing[1],
  },
  changelogText: {
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[500],
    paddingVertical: spacing[2.5],
    borderRadius: borderRadius.lg,
    gap: spacing[2],
  },
  downloadButtonText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold as any,
    color: colors.neutral[0],
  },
});

export default AppVersionsScreen;
