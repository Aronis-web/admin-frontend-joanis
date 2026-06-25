/**
 * SettingsModal - Modal de Configuración
 *
 * Modal con configuraciones de la aplicación:
 * - Modo oscuro
 * - Información de versión y actualizaciones
 *
 * Soporta actualizaciones en:
 * - Electron (desktop): Auto-update nativo
 * - Android: Descarga APK desde servidor propio
 * - Web: Link a GitHub releases
 */

import Alert from '@/utils/alert';

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
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';

// Importar versión directamente desde package.json
// @ts-ignore
import packageJson from '../../../package.json';

// API de actualizaciones
import { appUpdatesApi, CheckUpdateResponse } from '@/services/api/app-updates';
import { config } from '@/utils/config';
import logger from '@/utils/logger';

// Design System
import {
  activeOpacity,
  iconSizes,
} from '@/design-system/tokens';
import {
  Text,
  Title,
  Caption,
  Divider,
  IconButton,
} from '@/design-system/components';

// Store
import { useThemeStore } from '@/store/theme';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

// Configuración de GitHub para actualizaciones
const GITHUB_OWNER = 'Aronis-web';
const GITHUB_REPO = 'admin-frontend-joanis';
const GITHUB_TOKEN = process.env.EXPO_PUBLIC_GITHUB_TOKEN || '';

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
  // Campos adicionales para Android
  downloadUrl?: string;
  fileName?: string;
  fileSize?: number;
  changelog?: string;
  isMandatory?: boolean;
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

const isAndroid = (): boolean => {
  return Platform.OS === 'android';
};

const getElectronAPI = () => {
  if (isElectron()) {
    return (window as any).electronAPI;
  }
  return null;
};

// Obtener nombre de plataforma para mostrar
const getPlatformName = (): string => {
  if (isElectron()) return 'Desktop (Electron)';
  if (Platform.OS === 'android') return 'Android';
  if (Platform.OS === 'ios') return 'iOS';
  if (Platform.OS === 'web') return 'Web';
  return Platform.OS;
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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.color.surface.subtle, borderColor: theme.color.border.subtle },
      ]}
    >
      <View style={styles.cardHeader}>
        <View
          style={[styles.cardIconContainer, { backgroundColor: theme.color.surface.base }]}
        >
          <Ionicons name={icon} size={iconSizes.md} color={theme.color.icon.default} />
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
// HELPER: Comparar versiones semánticas
// ============================================
const compareVersions = (v1: string, v2: string): number => {
  const parts1 = v1.replace(/^v/, '').split('.').map(Number);
  const parts2 = v2.replace(/^v/, '').split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
};

// ============================================
// SETTINGS MODAL COMPONENT
// ============================================
export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { isDarkMode, toggleMode } = useThemeStore();

  // Obtener versión directamente de package.json (siempre disponible)
  const appVersion = packageJson.version || '1.0.0';

  // Estado para actualizaciones
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [latestReleaseUrl, setLatestReleaseUrl] = useState<string | null>(null);

  // Resetear estado al abrir el modal
  useEffect(() => {
    if (visible) {
      setUpdateInfo(null);
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

  // Manejar toggle de modo oscuro
  const handleToggleDarkMode = useCallback(() => {
    toggleMode();
    const newMode = !isDarkMode;
    Alert.alert(
      newMode ? '🌙 Modo Oscuro' : '☀️ Modo Claro',
      newMode
        ? 'Modo oscuro activado. Los cambios visuales se aplicarán gradualmente a toda la app.'
        : 'Modo claro activado.',
      [{ text: 'OK' }]
    );
  }, [isDarkMode, toggleMode]);

  // Verificar actualizaciones via GitHub API
  const checkForUpdatesViaGitHub = useCallback(async (): Promise<UpdateInfo> => {
    try {
      // Configurar headers con autenticación si hay token disponible
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
      };

      if (GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
      }

      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
        { headers }
      );

      if (!response.ok) {
        if (response.status === 404) {
          return {
            updateAvailable: false,
            currentVersion: appVersion,
            message: 'No hay releases publicados en GitHub',
          };
        }
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const release = await response.json();
      const latestVersion = release.tag_name.replace(/^v/, '');
      const currentVersion = appVersion.replace(/^v/, '');

      const updateAvailable = compareVersions(latestVersion, currentVersion) > 0;

      if (updateAvailable) {
        setLatestReleaseUrl(release.html_url);
      }

      return {
        updateAvailable,
        currentVersion: appVersion,
        latestVersion,
        releaseDate: release.published_at,
      };
    } catch (error: any) {
      logger.error('Error checking GitHub releases:', error);
      return {
        updateAvailable: false,
        currentVersion: appVersion,
        error: error.message || 'Error al verificar actualizaciones en GitHub',
      };
    }
  }, [appVersion]);

  // Verificar actualizaciones via Backend (para Android)
  const checkForUpdatesViaBackend = useCallback(async (): Promise<UpdateInfo> => {
    logger.debug('[BACKEND_CHECK] Verificando actualizaciones', { appId: 'erp-aio', platform: 'android', currentVersion: appVersion });

    try {
      const response: CheckUpdateResponse = await appUpdatesApi.checkForUpdates(
        'erp-aio',
        'android',
        appVersion
      );

      return {
        updateAvailable: response.updateAvailable,
        currentVersion: appVersion,
        latestVersion: response.latestVersion,
        releaseDate: response.releaseDate,
        message: response.message,
        downloadUrl: response.downloadUrl,
        fileName: response.fileName,
        fileSize: response.fileSize,
        changelog: response.changelog,
        isMandatory: response.isMandatory,
      };
    } catch (error: any) {
      logger.error('[BACKEND_CHECK] Error verificando actualizaciones:', error?.message || error);
      return {
        updateAvailable: false,
        currentVersion: appVersion,
        error: error.message || 'Error al verificar actualizaciones',
      };
    }
  }, [appVersion]);

  // Verificar actualizaciones
  const checkForUpdates = useCallback(async () => {
    setIsCheckingUpdate(true);
    setUpdateInfo(null);
    setLatestReleaseUrl(null);

    try {
      const electronAPI = getElectronAPI();

      if (electronAPI) {
        // En Electron, intentar usar el sistema de auto-update
        const result = await electronAPI.checkForUpdates();

        // Si Electron está en modo desarrollo, usar GitHub API como fallback
        if (result.message && result.message.includes('modo desarrollo')) {
          logger.debug('Electron en modo desarrollo, usando GitHub API...');
          const githubResult = await checkForUpdatesViaGitHub();
          setUpdateInfo(githubResult);
        } else {
          setUpdateInfo(result);
        }
      } else if (isAndroid()) {
        // En Android, usar el backend propio
        logger.debug('Android: Verificando actualizaciones via backend...');
        const backendResult = await checkForUpdatesViaBackend();
        setUpdateInfo(backendResult);
      } else {
        // En otras plataformas (Web, iOS), verificar via GitHub API
        const result = await checkForUpdatesViaGitHub();
        setUpdateInfo(result);
      }
    } catch (error: any) {
      // Si hay error, intentar con GitHub como fallback
      logger.warn('Error verificando actualizaciones, intentando con GitHub API...', error?.message || error);
      try {
        const githubResult = await checkForUpdatesViaGitHub();
        setUpdateInfo(githubResult);
      } catch (githubError: any) {
        setUpdateInfo({
          updateAvailable: false,
          currentVersion: appVersion,
          error: githubError.message || 'Error al verificar actualizaciones',
        });
      }
    } finally {
      setIsCheckingUpdate(false);
    }
  }, [appVersion, checkForUpdatesViaGitHub, checkForUpdatesViaBackend]);

  // Descargar actualización (Electron)
  const downloadUpdate = useCallback(async () => {
    const electronAPI = getElectronAPI();
    if (!electronAPI) return;

    setIsDownloading(true);
    setDownloadProgress(null);

    try {
      await electronAPI.downloadUpdate();
    } catch (error) {
      logger.error('Error downloading update:', error);
      setIsDownloading(false);
    }
  }, []);

  // Instalar actualización (Electron)
  const installUpdate = useCallback(async () => {
    const electronAPI = getElectronAPI();
    if (!electronAPI) return;

    try {
      await electronAPI.installUpdate();
    } catch (error) {
      logger.error('Error installing update:', error);
    }
  }, []);

  // Descargar e instalar APK (Android)
  const downloadAndInstallApk = useCallback(async () => {
    if (!updateInfo?.downloadUrl || !updateInfo?.latestVersion) {
      logger.error('[APK_UPDATE] Faltan datos de descarga', {
        hasDownloadUrl: !!updateInfo?.downloadUrl,
        hasLatestVersion: !!updateInfo?.latestVersion,
      });
      Alert.alert(
        'Error',
        'No hay información de descarga disponible. Vuelve a verificar actualizaciones.'
      );
      return;
    }

    setIsDownloading(true);
    setDownloadProgress({ percent: 0, bytesPerSecond: 0, transferred: 0, total: updateInfo.fileSize || 0 });

    try {
      const fileName = updateInfo.fileName || `erp-aio-v${updateInfo.latestVersion}.apk`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

      logger.debug('[APK_UPDATE] Descargando APK', {
        url: updateInfo.downloadUrl,
        fileUri,
        fileSize: updateInfo.fileSize,
      });

      // Configurar headers requeridos por el backend
      const downloadHeaders: Record<string, string> = {
        'X-App-Id': config.APP_ID || 'erp-aio',
        'x-app-id': config.APP_ID || 'erp-aio',
        'X-App-Version': config.APP_VERSION || appVersion,
      };

      // Descargar el archivo con progreso
      const downloadResumable = FileSystem.createDownloadResumable(
        updateInfo.downloadUrl,
        fileUri,
        { headers: downloadHeaders },
        (progress) => {
          const percent = (progress.totalBytesWritten / progress.totalBytesExpectedToWrite) * 100;
          setDownloadProgress({
            percent,
            bytesPerSecond: 0,
            transferred: progress.totalBytesWritten,
            total: progress.totalBytesExpectedToWrite,
          });
        }
      );

      const result = await downloadResumable.downloadAsync();

      if (!result?.uri) {
        throw new Error('La descarga no se completó correctamente - URI vacío');
      }

      logger.debug('[APK_UPDATE] APK descargado', { uri: result.uri, status: result.status });
      setDownloadProgress((prev) => prev ? { ...prev, percent: 100 } : null);

      // Intentar abrir el APK para instalación
      try {
        const contentUri = await FileSystem.getContentUriAsync(result.uri);

        // Método 1: IntentLauncher para abrir el instalador de Android
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
          type: 'application/vnd.android.package-archive',
        });
      } catch (intentError: any) {
        logger.warn('[APK_UPDATE] IntentLauncher falló, probando Linking', intentError?.message);

        // Método 2: Linking como fallback
        try {
          const contentUri = await FileSystem.getContentUriAsync(result.uri);
          const canOpen = await Linking.canOpenURL(contentUri);

          if (canOpen) {
            await Linking.openURL(contentUri);
          } else {
            throw new Error('canOpenURL retornó false');
          }
        } catch (linkingError: any) {
          logger.warn('[APK_UPDATE] Linking falló, probando Sharing', linkingError?.message);

          // Método 3: Sharing como último recurso
          const isAvailable = await Sharing.isAvailableAsync();

          if (isAvailable) {
            await Sharing.shareAsync(result.uri, {
              mimeType: 'application/vnd.android.package-archive',
              dialogTitle: 'Instalar actualización ERP-aio',
            });
          } else {
            Alert.alert(
              '📥 Descarga completada',
              `El APK v${updateInfo.latestVersion} se ha descargado.\n\nPara instalar:\n1. Abre el administrador de archivos\n2. Ve a la carpeta de descargas\n3. Toca el archivo ${fileName}`,
              [{ text: 'Entendido' }]
            );
          }
        }
      }

      setUpdateInfo((prev) => prev ? { ...prev, updateDownloaded: true } : null);
    } catch (error: any) {
      logger.error('[APK_UPDATE] Error descargando/instalando APK', error?.message || error);
      Alert.alert(
        'Error de descarga',
        `${error.message || 'Error desconocido'}\n\nRevisa los logs para más detalles.`,
        [{ text: 'OK' }]
      );
    } finally {
      setIsDownloading(false);
    }
  }, [updateInfo, appVersion]);

  // Abrir página de releases en GitHub
  const openGitHubRelease = useCallback(() => {
    const url = latestReleaseUrl || `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
    Linking.openURL(url).catch((err) => {
      logger.error('Error opening URL:', err);
      Alert.alert('Error', 'No se pudo abrir el enlace');
    });
  }, [latestReleaseUrl]);

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
      <View style={[styles.modalContainer, { backgroundColor: theme.color.overlay.medium }]}>
        <View
          style={[
            styles.modalContent,
            { backgroundColor: theme.color.surface.elevated },
            {
              paddingTop: insets.top + theme.space[4],
              paddingBottom: insets.bottom + theme.space[4],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View
                style={[styles.headerIconContainer, { backgroundColor: theme.color.brand.accentSoft }]}
              >
                <Ionicons name="settings" size={iconSizes.lg} color={theme.color.icon.default} />
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
                  <View
                    style={[styles.settingIconSmall, { backgroundColor: theme.color.surface.base }]}
                  >
                    <Ionicons
                      name={isDarkMode ? 'moon' : 'sunny'}
                      size={iconSizes.sm}
                      color={isDarkMode ? theme.color.brand.accent : theme.color.icon.warning}
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
                  onValueChange={handleToggleDarkMode}
                  trackColor={{ false: theme.color.border.subtle, true: theme.color.action.primary.background }}
                  thumbColor={isDarkMode ? theme.color.surface.base : theme.color.text.disabled}
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
                    {getPlatformName()}
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
                  <ActivityIndicator size="small" color={theme.color.action.primary.text} />
                ) : (
                  <Ionicons name="cloud-download-outline" size={iconSizes.md} color={theme.color.action.primary.text} />
                )}
                <Text variant="buttonMedium" color={theme.color.action.primary.text} style={styles.updateButtonText}>
                  {isCheckingUpdate ? 'Verificando...' : 'Buscar Actualizaciones'}
                </Text>
              </TouchableOpacity>

              {/* Resultado de verificación */}
              {updateInfo && (
                <View style={styles.updateInfoContainer}>
                  {updateInfo.error ? (
                    <View style={styles.updateError}>
                      <Ionicons name="warning-outline" size={iconSizes.md} color={theme.color.icon.danger} />
                      <Text variant="bodySmall" color={theme.color.text.danger} style={styles.updateInfoText}>
                        {updateInfo.error}
                      </Text>
                    </View>
                  ) : updateInfo.message ? (
                    <View style={styles.updateMessage}>
                      <Ionicons name="information-circle-outline" size={iconSizes.md} color={theme.color.state.info.border} />
                      <Text variant="bodySmall" color="secondary" style={styles.updateInfoText}>
                        {updateInfo.message}
                      </Text>
                    </View>
                  ) : updateInfo.updateAvailable ? (
                    <View style={styles.updateAvailable}>
                      <View style={styles.updateAvailableHeader}>
                        <Ionicons name="arrow-up-circle" size={iconSizes.lg} color={theme.color.icon.success} />
                        <View style={styles.updateAvailableText}>
                          <Text variant="titleSmall" color="primary">
                            ¡Nueva versión disponible!
                          </Text>
                          <Text variant="bodySmall" color="secondary">
                            v{updateInfo.latestVersion}
                          </Text>
                        </View>
                      </View>

                      {/* Changelog (si está disponible) */}
                      {updateInfo.changelog && (
                        <View style={styles.changelogContainer}>
                          <Text variant="labelSmall" color="secondary" style={styles.changelogTitle}>
                            Novedades:
                          </Text>
                          <Text variant="bodySmall" color="tertiary" style={styles.changelogText}>
                            {updateInfo.changelog}
                          </Text>
                        </View>
                      )}

                      {/* Progreso de descarga (Electron y Android) */}
                      {(isElectron() || isAndroid()) && isDownloading && downloadProgress && (
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
                      {isElectron() ? (
                        // En Electron: descargar e instalar automáticamente
                        !updateInfo.updateDownloaded ? (
                          <TouchableOpacity
                            style={[styles.downloadButton, isDownloading && styles.downloadButtonDisabled]}
                            onPress={downloadUpdate}
                            disabled={isDownloading}
                            activeOpacity={activeOpacity.medium}
                          >
                            {isDownloading ? (
                              <ActivityIndicator size="small" color={theme.color.action.success.text} />
                            ) : (
                              <Ionicons name="download-outline" size={iconSizes.sm} color={theme.color.action.success.text} />
                            )}
                            <Text variant="buttonSmall" color={theme.color.action.success.text} style={styles.downloadButtonText}>
                              {isDownloading ? 'Descargando...' : 'Descargar Actualización'}
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={styles.installButton}
                            onPress={installUpdate}
                            activeOpacity={activeOpacity.medium}
                          >
                            <Ionicons name="rocket-outline" size={iconSizes.sm} color={theme.color.action.primary.text} />
                            <Text variant="buttonSmall" color={theme.color.action.primary.text} style={styles.downloadButtonText}>
                              Instalar y Reiniciar
                            </Text>
                          </TouchableOpacity>
                        )
                      ) : isAndroid() ? (
                        // En Android: descargar APK e instalar manualmente
                        !updateInfo.updateDownloaded ? (
                          <View>
                            <TouchableOpacity
                              style={[styles.downloadButton, isDownloading && styles.downloadButtonDisabled]}
                              onPress={downloadAndInstallApk}
                              disabled={isDownloading}
                              activeOpacity={activeOpacity.medium}
                            >
                              {isDownloading ? (
                                <ActivityIndicator size="small" color={theme.color.action.success.text} />
                              ) : (
                                <Ionicons name="download-outline" size={iconSizes.sm} color={theme.color.action.success.text} />
                              )}
                              <Text variant="buttonSmall" color={theme.color.action.success.text} style={styles.downloadButtonText}>
                                {isDownloading ? 'Descargando APK...' : 'Descargar e Instalar'}
                              </Text>
                            </TouchableOpacity>
                            {updateInfo.fileSize && (
                              <Caption color="tertiary" style={styles.fileSizeText}>
                                Tamaño: {formatBytes(updateInfo.fileSize)}
                              </Caption>
                            )}
                          </View>
                        ) : (
                          <View style={styles.downloadedContainer}>
                            <Ionicons name="checkmark-circle" size={iconSizes.md} color={theme.color.icon.success} />
                            <Text variant="bodySmall" color="success" style={styles.downloadedText}>
                              APK descargado. El instalador debería abrirse automáticamente.
                            </Text>
                            <TouchableOpacity
                              style={styles.retryButton}
                              onPress={downloadAndInstallApk}
                              activeOpacity={activeOpacity.medium}
                            >
                              <Ionicons name="refresh-outline" size={iconSizes.sm} color={theme.color.brand.primary} />
                              <Text variant="buttonSmall" color={theme.color.brand.primary} style={styles.retryButtonText}>
                                Descargar de nuevo
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )
                      ) : (
                        // En otras plataformas (Web, iOS): abrir GitHub
                        <TouchableOpacity
                          style={styles.downloadButton}
                          onPress={openGitHubRelease}
                          activeOpacity={activeOpacity.medium}
                        >
                          <Ionicons name="logo-github" size={iconSizes.sm} color={theme.color.action.success.text} />
                          <Text variant="buttonSmall" color={theme.color.action.success.text} style={styles.downloadButtonText}>
                            Ver en GitHub
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <View style={styles.upToDate}>
                      <Ionicons name="checkmark-circle" size={iconSizes.lg} color={theme.color.icon.success} />
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
              <View style={styles.webNotice}>
                <Ionicons name="information-circle-outline" size={iconSizes.sm} color={theme.color.state.info.border} />
                <Caption color="secondary" style={styles.webNoticeText}>
                  {isElectron()
                    ? 'Las actualizaciones se descargan e instalan automáticamente.'
                    : isAndroid()
                      ? 'Las actualizaciones se descargan desde el servidor. Asegúrate de permitir instalación de apps de fuentes desconocidas.'
                      : 'Verifica si hay nuevas versiones disponibles en GitHub.'}
                </Caption>
              </View>
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
const createStyles = (theme: Theme) => StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: theme.color.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalContent: {
    width: '95%',
    maxWidth: 500,
    maxHeight: '90%',
    minHeight: Platform.OS === 'android' ? '70%' : undefined,
    backgroundColor: theme.color.surface.elevated,
    borderRadius: theme.radii.xl,
    ...theme.shadow.xl,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space[4],
    paddingBottom: theme.space[3],
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  headerIconContainer: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.brand.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.space[3],
  },

  // Scroll
  scrollView: {
    flex: 1,
  },

  scrollContent: {
    padding: theme.space[4],
    paddingTop: theme.space[2],
  },

  // Card
  card: {
    backgroundColor: theme.color.surface.subtle,
    borderRadius: theme.radii.lg,
    padding: theme.space[4],
    marginBottom: theme.space[4],
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.space[4],
  },

  cardIconContainer: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.md,
    backgroundColor: theme.color.surface.base,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.space[3],
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
    borderRadius: theme.radii.full,
    backgroundColor: theme.color.surface.base,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.space[3],
  },

  settingText: {
    flex: 1,
  },

  settingHint: {
    marginTop: theme.space[3],
    paddingLeft: theme.space[11],
  },

  // Version
  versionContainer: {
    gap: theme.space[2],
  },

  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  versionBadge: {
    backgroundColor: theme.color.brand.primarySoft,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[1],
    borderRadius: theme.radii.full,
  },

  // Update Button
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.action.primary.background,
    paddingVertical: theme.space[3],
    paddingHorizontal: theme.space[4],
    borderRadius: theme.radii.lg,
    marginTop: theme.space[3],
    gap: theme.space[2],
  },

  updateButtonDisabled: {
    backgroundColor: theme.color.action.primary.backgroundDisabled,
  },

  updateButtonText: {
    marginLeft: theme.space[2],
  },

  // Update Info
  updateInfoContainer: {
    marginTop: theme.space[4],
  },

  updateError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.state.danger.background,
    padding: theme.space[3],
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.color.state.danger.border,
  },

  updateMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.state.info.background,
    padding: theme.space[3],
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.color.state.info.border,
  },

  updateInfoText: {
    flex: 1,
    marginLeft: theme.space[2],
  },

  updateAvailable: {
    backgroundColor: theme.color.state.success.background,
    padding: theme.space[4],
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.color.state.success.border,
  },

  updateAvailableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.space[3],
  },

  updateAvailableText: {
    marginLeft: theme.space[3],
  },

  // Download Progress
  downloadProgress: {
    marginBottom: theme.space[3],
  },

  progressBarContainer: {
    height: 8,
    backgroundColor: theme.color.border.subtle,
    borderRadius: theme.radii.full,
    overflow: 'hidden',
    marginBottom: theme.space[2],
  },

  progressBar: {
    height: '100%',
    backgroundColor: theme.color.action.success.background,
    borderRadius: theme.radii.full,
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
    backgroundColor: theme.color.action.success.background,
    paddingVertical: theme.space[2.5],
    paddingHorizontal: theme.space[4],
    borderRadius: theme.radii.md,
    gap: theme.space[2],
  },

  downloadButtonDisabled: {
    backgroundColor: theme.color.action.success.backgroundDisabled,
  },

  downloadButtonText: {
    marginLeft: theme.space[1],
  },

  installButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.brand.accent,
    paddingVertical: theme.space[2.5],
    paddingHorizontal: theme.space[4],
    borderRadius: theme.radii.md,
    gap: theme.space[2],
  },

  // Up to date
  upToDate: {
    alignItems: 'center',
    padding: theme.space[4],
    backgroundColor: theme.color.state.success.background,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.color.state.success.border,
  },

  // Changelog
  changelogContainer: {
    marginBottom: theme.space[3],
    paddingTop: theme.space[2],
    borderTopWidth: 1,
    borderTopColor: theme.color.state.success.border,
  },

  changelogTitle: {
    marginBottom: theme.space[1],
  },

  changelogText: {
    lineHeight: 18,
  },

  // File size text
  fileSizeText: {
    textAlign: 'center',
    marginTop: theme.space[2],
  },

  // Downloaded container
  downloadedContainer: {
    alignItems: 'center',
    gap: theme.space[2],
  },

  downloadedText: {
    textAlign: 'center',
  },

  // Retry button
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.space[2],
    paddingHorizontal: theme.space[3],
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.color.border.default,
    marginTop: theme.space[2],
    gap: theme.space[1],
  },

  retryButtonText: {
    marginLeft: theme.space[1],
  },

  // Web Notice
  webNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.space[4],
    padding: theme.space[3],
    backgroundColor: theme.color.state.info.background,
    borderRadius: theme.radii.md,
  },

  webNoticeText: {
    flex: 1,
    marginLeft: theme.space[2],
  },

  // Info
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.space[2],
  },
});

export default SettingsModal;
