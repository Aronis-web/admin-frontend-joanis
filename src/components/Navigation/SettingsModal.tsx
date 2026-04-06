/**
 * SettingsModal - Modal de Configuración
 *
 * Modal con configuraciones de la aplicación:
 * - Modo oscuro
 * - Información de versión y actualizaciones
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

// Design System
import {
  colors,
  spacing,
  borderRadius,
  shadows,
  activeOpacity,
  iconSizes,
} from '@/design-system/tokens';
import {
  Text,
  Title,
  Body,
  Caption,
  Divider,
  IconButton,
} from '@/design-system/components';

// Store
import { useThemeStore } from '@/store/theme';

// ============================================
// TYPES
// ============================================
interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

interface UpdateInfo {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion?: string;
  releaseDate?: string;
  updateDownloaded?: boolean;
  message?: string;
  error?: string;
}

interface DownloadProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================
const isElectron = (): boolean => {
  return typeof window !== 'undefined' && !!(window as any).electronAPI;
};

const getElectronAPI = () => {
  if (isElectron()) {
    return (window as any).electronAPI;
  }
  return null;
};

// ============================================
// SETTINGS CARD COMPONENT
// ============================================
interface SettingsCardProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}

const SettingsCard: React.FC<SettingsCardProps> = ({ title, icon, children }) => {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIconContainer}>
          <Ionicons name={icon} size={iconSizes.md} color={colors.primary[900]} />
        </View>
        <Text variant="titleSmall" color="primary">
          {title}
        </Text>
      </View>
      <View style={styles.cardContent}>{children}</View>
    </View>
  );
};

// ============================================
// SETTINGS MODAL COMPONENT
// ============================================
export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  const insets = useSafeAreaInsets();
  const { isDarkMode, toggleMode } = useThemeStore();

  // Estado para actualizaciones
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [appVersion, setAppVersion] = useState<string>('');

  // Obtener versión de la app
  useEffect(() => {
    const getVersion = async () => {
      const electronAPI = getElectronAPI();
      if (electronAPI) {
        try {
          const info = await electronAPI.getAppVersion();
          setAppVersion(info.version);
        } catch (error) {
          console.error('Error getting app version:', error);
          setAppVersion(Constants.expoConfig?.version || '1.0.0');
        }
      } else {
        setAppVersion(Constants.expoConfig?.version || '1.0.0');
      }
    };

    if (visible) {
      getVersion();
    }
  }, [visible]);

  // Escuchar eventos de actualización (solo Electron)
  useEffect(() => {
    const electronAPI = getElectronAPI();
    if (!electronAPI) return;

    // Escuchar estado de actualización
    electronAPI.onUpdateStatus?.((status: { status: string; version: string }) => {
      if (status.status === 'downloaded') {
        setUpdateInfo((prev) => prev ? { ...prev, updateDownloaded: true } : null);
        setIsDownloading(false);
      }
    });

    // Escuchar progreso de descarga
    electronAPI.onDownloadProgress?.((progress: DownloadProgress) => {
      setDownloadProgress(progress);
    });
  }, []);

  // Verificar actualizaciones
  const checkForUpdates = useCallback(async () => {
    const electronAPI = getElectronAPI();
    if (!electronAPI) {
      setUpdateInfo({
        updateAvailable: false,
        currentVersion: appVersion,
        message: 'Las actualizaciones solo están disponibles en la versión de escritorio',
      });
      return;
    }

    setIsCheckingUpdate(true);
    setUpdateInfo(null);

    try {
      const result = await electronAPI.checkForUpdates();
      setUpdateInfo(result);
    } catch (error: any) {
      setUpdateInfo({
        updateAvailable: false,
        currentVersion: appVersion,
        error: error.message || 'Error al verificar actualizaciones',
      });
    } finally {
      setIsCheckingUpdate(false);
    }
  }, [appVersion]);

  // Descargar actualización
  const downloadUpdate = useCallback(async () => {
    const electronAPI = getElectronAPI();
    if (!electronAPI) return;

    setIsDownloading(true);
    setDownloadProgress(null);

    try {
      await electronAPI.downloadUpdate();
    } catch (error) {
      console.error('Error downloading update:', error);
      setIsDownloading(false);
    }
  }, []);

  // Instalar actualización
  const installUpdate = useCallback(async () => {
    const electronAPI = getElectronAPI();
    if (!electronAPI) return;

    try {
      await electronAPI.installUpdate();
    } catch (error) {
      console.error('Error installing update:', error);
    }
  }, []);

  // Formatear bytes
  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View
          style={[
            styles.modalContent,
            {
              paddingTop: insets.top + spacing[4],
              paddingBottom: insets.bottom + spacing[4],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconContainer}>
                <Ionicons name="settings" size={iconSizes.lg} color={colors.primary[900]} />
              </View>
              <Title size="large">Configuración</Title>
            </View>
            <IconButton icon="close" onPress={onClose} variant="ghost" size="medium" />
          </View>

          <Divider spacing="small" />

          {/* Content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Apariencia */}
            <SettingsCard title="Apariencia" icon="color-palette-outline">
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <View style={styles.settingIconSmall}>
                    <Ionicons
                      name={isDarkMode ? 'moon' : 'sunny'}
                      size={iconSizes.sm}
                      color={isDarkMode ? colors.accent[500] : colors.warning[500]}
                    />
                  </View>
                  <View style={styles.settingText}>
                    <Text variant="bodyMedium" color="primary">
                      Modo Oscuro
                    </Text>
                    <Caption color="tertiary">
                      {isDarkMode ? 'Activado' : 'Desactivado'}
                    </Caption>
                  </View>
                </View>
                <Switch
                  value={isDarkMode}
                  onValueChange={toggleMode}
                  trackColor={{ false: colors.neutral[200], true: colors.primary[500] }}
                  thumbColor={isDarkMode ? colors.neutral[0] : colors.neutral[400]}
                />
              </View>
              <Caption color="tertiary" style={styles.settingHint}>
                El modo oscuro reduce el brillo de la pantalla y puede ayudar a reducir la fatiga visual.
              </Caption>
            </SettingsCard>

            {/* Versión y Actualizaciones */}
            <SettingsCard title="Versión y Actualizaciones" icon="refresh-outline">
              {/* Versión actual */}
              <View style={styles.versionContainer}>
                <View style={styles.versionRow}>
                  <Text variant="bodyMedium" color="secondary">
                    Versión actual:
                  </Text>
                  <View style={styles.versionBadge}>
                    <Text variant="labelMedium" color="primary">
                      v{appVersion}
                    </Text>
                  </View>
                </View>

                <View style={styles.versionRow}>
                  <Text variant="bodyMedium" color="secondary">
                    Plataforma:
                  </Text>
                  <Text variant="bodyMedium" color="primary">
                    {isElectron() ? 'Desktop (Electron)' : Platform.OS === 'web' ? 'Web' : Platform.OS}
                  </Text>
                </View>
              </View>

              <Divider spacing="small" />

              {/* Botón de verificar actualizaciones */}
              <TouchableOpacity
                style={[
                  styles.updateButton,
                  (isCheckingUpdate || isDownloading) && styles.updateButtonDisabled,
                ]}
                onPress={checkForUpdates}
                disabled={isCheckingUpdate || isDownloading}
                activeOpacity={activeOpacity.medium}
              >
                {isCheckingUpdate ? (
                  <ActivityIndicator size="small" color={colors.neutral[0]} />
                ) : (
                  <Ionicons name="cloud-download-outline" size={iconSizes.md} color={colors.neutral[0]} />
                )}
                <Text variant="buttonMedium" color={colors.neutral[0]} style={styles.updateButtonText}>
                  {isCheckingUpdate ? 'Verificando...' : 'Buscar Actualizaciones'}
                </Text>
              </TouchableOpacity>

              {/* Resultado de verificación */}
              {updateInfo && (
                <View style={styles.updateInfoContainer}>
                  {updateInfo.error ? (
                    <View style={styles.updateError}>
                      <Ionicons name="warning-outline" size={iconSizes.md} color={colors.danger[500]} />
                      <Text variant="bodySmall" color={colors.danger[600]} style={styles.updateInfoText}>
                        {updateInfo.error}
                      </Text>
                    </View>
                  ) : updateInfo.message ? (
                    <View style={styles.updateMessage}>
                      <Ionicons name="information-circle-outline" size={iconSizes.md} color={colors.info[500]} />
                      <Text variant="bodySmall" color="secondary" style={styles.updateInfoText}>
                        {updateInfo.message}
                      </Text>
                    </View>
                  ) : updateInfo.updateAvailable ? (
                    <View style={styles.updateAvailable}>
                      <View style={styles.updateAvailableHeader}>
                        <Ionicons name="arrow-up-circle" size={iconSizes.lg} color={colors.success[500]} />
                        <View style={styles.updateAvailableText}>
                          <Text variant="titleSmall" color="primary">
                            ¡Nueva versión disponible!
                          </Text>
                          <Text variant="bodySmall" color="secondary">
                            v{updateInfo.latestVersion}
                          </Text>
                        </View>
                      </View>

                      {/* Progreso de descarga */}
                      {isDownloading && downloadProgress && (
                        <View style={styles.downloadProgress}>
                          <View style={styles.progressBarContainer}>
                            <View
                              style={[
                                styles.progressBar,
                                { width: `${downloadProgress.percent}%` },
                              ]}
                            />
                          </View>
                          <View style={styles.progressInfo}>
                            <Text variant="caption" color="secondary">
                              {downloadProgress.percent.toFixed(0)}%
                            </Text>
                            <Text variant="caption" color="tertiary">
                              {formatBytes(downloadProgress.transferred)} / {formatBytes(downloadProgress.total)}
                            </Text>
                          </View>
                        </View>
                      )}

                      {/* Botones de acción */}
                      {!updateInfo.updateDownloaded ? (
                        <TouchableOpacity
                          style={[styles.downloadButton, isDownloading && styles.downloadButtonDisabled]}
                          onPress={downloadUpdate}
                          disabled={isDownloading}
                          activeOpacity={activeOpacity.medium}
                        >
                          {isDownloading ? (
                            <ActivityIndicator size="small" color={colors.neutral[0]} />
                          ) : (
                            <Ionicons name="download-outline" size={iconSizes.sm} color={colors.neutral[0]} />
                          )}
                          <Text variant="buttonSmall" color={colors.neutral[0]} style={styles.downloadButtonText}>
                            {isDownloading ? 'Descargando...' : 'Descargar Actualización'}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.installButton}
                          onPress={installUpdate}
                          activeOpacity={activeOpacity.medium}
                        >
                          <Ionicons name="rocket-outline" size={iconSizes.sm} color={colors.neutral[0]} />
                          <Text variant="buttonSmall" color={colors.neutral[0]} style={styles.downloadButtonText}>
                            Instalar y Reiniciar
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <View style={styles.upToDate}>
                      <Ionicons name="checkmark-circle" size={iconSizes.lg} color={colors.success[500]} />
                      <Text variant="bodyMedium" color="primary" style={styles.updateInfoText}>
                        ¡Estás al día!
                      </Text>
                      <Caption color="tertiary">
                        Ya tienes la última versión instalada.
                      </Caption>
                    </View>
                  )}
                </View>
              )}

              {/* Info adicional */}
              {!isElectron() && (
                <View style={styles.webNotice}>
                  <Ionicons name="desktop-outline" size={iconSizes.sm} color={colors.info[500]} />
                  <Caption color="secondary" style={styles.webNoticeText}>
                    Las actualizaciones automáticas solo están disponibles en la versión de escritorio.
                  </Caption>
                </View>
              )}
            </SettingsCard>

            {/* Info del sistema */}
            <SettingsCard title="Información" icon="information-circle-outline">
              <View style={styles.infoRow}>
                <Caption color="tertiary">Desarrollado por</Caption>
                <Text variant="bodySmall" color="primary">Aronis Web</Text>
              </View>
              <View style={styles.infoRow}>
                <Caption color="tertiary">Nombre de la app</Caption>
                <Text variant="bodySmall" color="primary">ERP-aio</Text>
              </View>
            </SettingsCard>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalContent: {
    width: '95%',
    maxWidth: 500,
    maxHeight: '90%',
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    ...shadows.xl,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  headerIconContainer: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  },

  // Scroll
  scrollView: {
    flex: 1,
  },

  scrollContent: {
    padding: spacing[4],
    paddingTop: spacing[2],
  },

  // Card
  card: {
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.border.light,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[4],
  },

  cardIconContainer: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  },

  cardContent: {},

  // Setting Row
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  settingIconSmall: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  },

  settingText: {
    flex: 1,
  },

  settingHint: {
    marginTop: spacing[3],
    paddingLeft: spacing[11],
  },

  // Version
  versionContainer: {
    gap: spacing[2],
  },

  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  versionBadge: {
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
  },

  // Update Button
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[900],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.lg,
    marginTop: spacing[3],
    gap: spacing[2],
  },

  updateButtonDisabled: {
    backgroundColor: colors.neutral[400],
  },

  updateButtonText: {
    marginLeft: spacing[2],
  },

  // Update Info
  updateInfoContainer: {
    marginTop: spacing[4],
  },

  updateError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.danger[50],
    padding: spacing[3],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.danger[200],
  },

  updateMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.info[50],
    padding: spacing[3],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.info[200],
  },

  updateInfoText: {
    flex: 1,
    marginLeft: spacing[2],
  },

  updateAvailable: {
    backgroundColor: colors.success[50],
    padding: spacing[4],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.success[200],
  },

  updateAvailableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[3],
  },

  updateAvailableText: {
    marginLeft: spacing[3],
  },

  // Download Progress
  downloadProgress: {
    marginBottom: spacing[3],
  },

  progressBarContainer: {
    height: 8,
    backgroundColor: colors.neutral[200],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginBottom: spacing[2],
  },

  progressBar: {
    height: '100%',
    backgroundColor: colors.success[500],
    borderRadius: borderRadius.full,
  },

  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  // Download Button
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success[600],
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.md,
    gap: spacing[2],
  },

  downloadButtonDisabled: {
    backgroundColor: colors.neutral[400],
  },

  downloadButtonText: {
    marginLeft: spacing[1],
  },

  installButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent[600],
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.md,
    gap: spacing[2],
  },

  // Up to date
  upToDate: {
    alignItems: 'center',
    padding: spacing[4],
    backgroundColor: colors.success[50],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.success[200],
  },

  // Web Notice
  webNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[4],
    padding: spacing[3],
    backgroundColor: colors.info[50],
    borderRadius: borderRadius.md,
  },

  webNoticeText: {
    flex: 1,
    marginLeft: spacing[2],
  },

  // Info
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
  },
});

export default SettingsModal;
