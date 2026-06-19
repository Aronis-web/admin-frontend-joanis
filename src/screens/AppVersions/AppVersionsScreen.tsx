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
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { palette } from '@/design-system/tokens/palette';
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
    color: palette.green[500],
    acceptedTypes: ['application/vnd.android.package-archive', 'application/octet-stream'],
  },
  {
    id: 'windows',
    label: 'Windows',
    icon: 'logo-windows',
    color: palette.blue[500],
    acceptedTypes: ['application/x-msdownload', 'application/octet-stream'],
  },
  {
    id: 'ios',
    label: 'iOS',
    icon: 'logo-apple',
    color: palette.neutral[700],
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
  const theme = useTheme();
  const translateY = useRef(new Animated.Value(30)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: theme.motion.durations.normal,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: theme.motion.durations.normal,
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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

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
      case 'android': return palette.green[500];
      case 'windows': return palette.blue[500];
      case 'ios': return palette.neutral[700];
      default: return theme.color.brand.accent;
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
          { backgroundColor: release.isActive ? theme.color.icon.success : theme.color.icon.disabled }
        ]} />
      </View>

      <View style={styles.versionDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="code-outline" size={14} color={theme.color.text.muted} />
          <Text style={styles.detailText}>Código: {release.versionCode}</Text>
        </View>
        {release.fileSize && (
          <View style={styles.detailRow}>
            <Ionicons name="document-outline" size={14} color={theme.color.text.muted} />
            <Text style={styles.detailText}>Tamaño: {formatFileSize(release.fileSize)}</Text>
          </View>
        )}
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={14} color={theme.color.text.muted} />
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
          <Ionicons name="download-outline" size={18} color={theme.color.text.onAction} />
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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

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
            <Ionicons name="apps-outline" size={20} color={theme.color.icon.accent} />
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
            <Ionicons name="phone-portrait-outline" size={20} color={theme.color.icon.accent} />
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
                  color={selectedPlatform === platform.id ? platform.color : theme.color.icon.disabled}
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
            <Ionicons name="git-branch-outline" size={20} color={theme.color.icon.accent} />
            <Text style={styles.cardTitle}>Versión</Text>
          </View>
          <TextInput
            style={styles.textInput}
            placeholder="Ej: 1.0.31"
            placeholderTextColor={theme.color.text.placeholder}
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
            <Ionicons name="document-outline" size={20} color={theme.color.icon.accent} />
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
                color={selectedFile ? theme.color.icon.success : theme.color.brand.accent}
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
              <ActivityIndicator size="small" color={theme.color.brand.accent} />
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
                ? [theme.color.action.primary.backgroundDisabled, theme.color.icon.disabled]
                : [theme.color.brand.accent, palette.blue[600]]
            }
            style={styles.uploadButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color={theme.color.text.onAction} />
            ) : (
              <>
                <Ionicons name="cloud-upload" size={22} color={theme.color.text.onAction} />
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
          <ActivityIndicator size="large" color={theme.color.brand.accent} />
          <Text style={styles.loadingText}>Cargando versiones...</Text>
        </View>
      ) : releases.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cloud-offline-outline" size={64} color={theme.color.icon.disabled} />
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
              tintColor={theme.color.brand.accent}
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
    <ScreenLayout navigation={navigation as any}>
      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'list' && styles.tabActive]}
          onPress={() => setActiveTab('list')}
        >
          <Ionicons
            name="list-outline"
            size={20}
            color={activeTab === 'list' ? theme.color.icon.accent : theme.color.text.muted}
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
            color={activeTab === 'upload' ? theme.color.icon.accent : theme.color.text.muted}
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

const createStyles = (theme: Theme) => StyleSheet.create({
  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: theme.color.surface.base,
    marginHorizontal: theme.space[4],
    marginTop: theme.space[2],
    marginBottom: theme.space[4],
    borderRadius: theme.radii.xl,
    padding: theme.space[1],
    ...theme.shadow.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.space[3],
    borderRadius: theme.radii.lg,
    gap: theme.space[2],
  },
  tabActive: {
    backgroundColor: theme.color.brand.accentSoft,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.color.text.muted,
  },
  tabTextActive: {
    color: theme.color.icon.accent,
  },

  // Tab Content
  tabContent: {
    flex: 1,
    paddingHorizontal: theme.space[4],
  },

  // Cards
  card: {
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii.xl,
    padding: theme.space[4],
    marginBottom: theme.space[4],
    ...theme.shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.space[3],
    gap: theme.space[2],
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.text.heading,
  },

  // Picker
  pickerContainer: {
    backgroundColor: theme.color.background.subtle,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },

  // Platform Grid
  platformGrid: {
    flexDirection: 'row',
    gap: theme.space[3],
  },
  platformOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.space[4],
    backgroundColor: theme.color.background.subtle,
    borderRadius: theme.radii.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: theme.space[2],
  },
  platformOptionSelected: {
    backgroundColor: theme.color.surface.base,
    borderColor: theme.color.brand.accent,
  },
  platformOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.color.text.muted,
  },

  // Text Input
  textInput: {
    backgroundColor: theme.color.background.subtle,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
    fontSize: 16,
    color: theme.color.text.heading,
  },
  inputHint: {
    fontSize: 12,
    color: theme.color.text.muted,
    marginTop: theme.space[2],
  },

  // File Picker
  filePickerButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.space[6],
    backgroundColor: theme.color.background.subtle,
    borderRadius: theme.radii.lg,
    borderWidth: 2,
    borderColor: theme.color.border.subtle,
    borderStyle: 'dashed',
    gap: theme.space[2],
  },
  filePickerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.color.surface.base,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.sm,
  },
  filePickerText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.color.text.body,
  },
  filePickerSize: {
    fontSize: 12,
    color: theme.color.text.muted,
  },

  // Progress
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
    marginBottom: theme.space[3],
  },
  progressText: {
    fontSize: 14,
    color: theme.color.icon.accent,
  },
  progressBar: {
    height: 6,
    backgroundColor: theme.color.border.subtle,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.color.brand.accent,
    borderRadius: 3,
  },

  // Upload Button
  uploadButton: {
    borderRadius: theme.radii.xl,
    overflow: 'hidden',
    ...theme.shadow.md,
  },
  uploadButtonDisabled: {
    opacity: 0.7,
  },
  uploadButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.space[4],
    gap: theme.space[2],
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.text.onAction,
  },

  // Filters
  filtersContainer: {
    flexDirection: 'row',
    gap: theme.space[3],
    marginBottom: theme.space[4],
  },
  filterGroup: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.color.text.muted,
    marginBottom: theme.space[1],
  },
  filterPicker: {
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
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
    paddingVertical: theme.space[10],
  },
  loadingText: {
    marginTop: theme.space[3],
    fontSize: 14,
    color: theme.color.text.muted,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.space[10],
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.color.text.heading,
    marginTop: theme.space[4],
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.color.text.muted,
    textAlign: 'center',
    marginTop: theme.space[2],
  },

  // Versions List
  versionsList: {
    flex: 1,
  },
  versionCard: {
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii.xl,
    padding: theme.space[4],
    marginBottom: theme.space[3],
    ...theme.shadow.sm,
  },
  versionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.space[3],
  },
  versionInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.space[2],
  },
  versionBadge: {
    backgroundColor: theme.color.brand.accentSoft,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[1],
    borderRadius: theme.radii.full,
  },
  versionText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.color.icon.accent,
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.space[2],
    paddingVertical: theme.space[1],
    borderRadius: theme.radii.md,
    gap: theme.space[1],
  },
  platformText: {
    fontSize: 12,
    fontWeight: '500',
  },
  mandatoryBadge: {
    backgroundColor: theme.color.state.warning.background,
    paddingHorizontal: theme.space[2],
    paddingVertical: theme.space[1],
    borderRadius: theme.radii.md,
  },
  mandatoryText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.color.state.warning.text,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  versionDetails: {
    gap: theme.space[2],
    marginBottom: theme.space[3],
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
  },
  detailText: {
    fontSize: 14,
    color: theme.color.text.muted,
  },
  changelogContainer: {
    backgroundColor: theme.color.background.subtle,
    borderRadius: theme.radii.lg,
    padding: theme.space[3],
    marginBottom: theme.space[3],
  },
  changelogLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.color.text.muted,
    marginBottom: theme.space[1],
  },
  changelogText: {
    fontSize: 14,
    color: theme.color.text.body,
    lineHeight: 20,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.brand.accent,
    paddingVertical: theme.space[2.5],
    borderRadius: theme.radii.lg,
    gap: theme.space[2],
  },
  downloadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.onAction,
  },
});

export default AppVersionsScreen;
