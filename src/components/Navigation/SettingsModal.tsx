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
  Alert,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// Importar versión directamente desde package.json
// @ts-ignore
import packageJson from '../../../package.json';

// API de actualizaciones
import { appUpdatesApi, CheckUpdateResponse } from '@/services/api/app-updates';
import { config } from '@/utils/config';

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
  Caption,
  Divider,
  IconButton,
} from '@/design-system/components';

// Store
import { useThemeStore } from '@/store/theme';

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
      console.error('Error checking GitHub releases:', error);
      return {
        updateAvailable: false,
        currentVersion: appVersion,
        error: error.message || 'Error al verificar actualizaciones en GitHub',
      };
    }
  }, [appVersion]);

  // Verificar actualizaciones via Backend (para Android)
  const checkForUpdatesViaBackend = useCallback(async (): Promise<UpdateInfo> => {
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
        // Datos adicionales para Android
        downloadUrl: response.downloadUrl,
        fileName: response.fileName,
        fileSize: response.fileSize,
        changelog: response.changelog,
        isMandatory: response.isMandatory,
      } as UpdateInfo;
    } catch (error: any) {
      console.error('Error checking updates via backend:', error);
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
          console.log('Electron en modo desarrollo, usando GitHub API...');
          const githubResult = await checkForUpdatesViaGitHub();
          setUpdateInfo(githubResult);
        } else {
          setUpdateInfo(result);
        }
      } else if (isAndroid()) {
        // En Android, usar el backend propio
        console.log('📱 Android: Verificando actualizaciones via backend...');
        const backendResult = await checkForUpdatesViaBackend();
        setUpdateInfo(backendResult);
      } else {
        // En otras plataformas (Web, iOS), verificar via GitHub API
        const result = await checkForUpdatesViaGitHub();
        setUpdateInfo(result);
      }
    } catch (error: any) {
      // Si hay error, intentar con GitHub como fallback
      console.log('Error verificando actualizaciones, intentando con GitHub API...', error);
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
      console.error('Error downloading update:', error);
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
      console.error('Error installing update:', error);
    }
  }, []);

  // Descargar e instalar APK (Android)
  const downloadAndInstallApk = useCallback(async () => {
    if (!updateInfo?.downloadUrl || !updateInfo?.latestVersion) {
      Alert.alert('Error', 'No hay información de descarga disponible');
      return;
    }

    setIsDownloading(true);
    setDownloadProgress({ percent: 0, bytesPerSecond: 0, transferred: 0, total: updateInfo.fileSize || 0 });

    try {
      const fileName = updateInfo.fileName || `erp-aio-v${updateInfo.latestVersion}.apk`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

      console.log('📥 Iniciando descarga del APK:', updateInfo.downloadUrl);
      console.log('📁 Guardando en:', fileUri);

      // Descargar el archivo con progreso
      const downloadResumable = FileSystem.createDownloadResumable(
        updateInfo.downloadUrl,
        fileUri,
        {},
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
        throw new Error('La descarga no se completó correctamente');
      }

      console.log('✅ APK descargado:', result.uri);
      setDownloadProgress((prev) => prev ? { ...prev, percent: 100 } : null);

      // Intentar abrir el APK para instalación
      try {
        // Obtener URI de contenido para compartir/abrir
        const contentUri = await FileSystem.getContentUriAsync(result.uri);
        console.log('📁 Content URI:', contentUri);

        // Método 1: Intentar abrir con Linking (funciona en algunos dispositivos)
        const canOpen = await Linking.canOpenURL(contentUri);
        if (canOpen) {
          await Linking.openURL(contentUri);
          console.log('📲 APK abierto con Linking');
        } else {
          throw new Error('No se puede abrir con Linking');
        }
      } catch (linkingError) {
        console.log('⚠️ No se pudo abrir con Linking, intentando con Sharing...', linkingError);

        // Método 2: Usar Sharing como fallback (siempre funciona)
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(result.uri, {
            mimeType: 'application/vnd.android.package-archive',
            dialogTitle: 'Instalar actualización ERP-aio',
          });
          console.log('📲 APK compartido para instalación');
        } else {
          // Mostrar instrucciones manuales
          Alert.alert(
            '📥 Descarga completada',
            `El APK v${updateInfo.latestVersion} se ha descargado.\n\nPara instalar:\n1. Abre el administrador de archivos\n2. Ve a la carpeta de descargas\n3. Toca el archivo ${fileName}`,
            [{ text: 'Entendido' }]
          );
        }
      }

      // Marcar como descargado
      setUpdateInfo((prev) => prev ? { ...prev, updateDownloaded: true } : null);
    } catch (error: any) {
      console.error('❌ Error descargando APK:', error);
      Alert.alert(
        'Error de descarga',
        error.message || 'No se pudo descargar la actualización. Verifica tu conexión a internet.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsDownloading(false);
    }
  }, [updateInfo]);

  // Abrir página de releases en GitHub
  const openGitHubRelease = useCallback(() => {
    const url = latestReleaseUrl || `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
    Linking.openURL(url).catch((err) => {
      console.error('Error opening URL:', err);
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
                  onValueChange={handleToggleDarkMode}
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
                                <ActivityIndicator size="small" color={colors.neutral[0]} />
                              ) : (
                                <Ionicons name="download-outline" size={iconSizes.sm} color={colors.neutral[0]} />
                              )}
                              <Text variant="buttonSmall" color={colors.neutral[0]} style={styles.downloadButtonText}>
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
                            <Ionicons name="checkmark-circle" size={iconSizes.md} color={colors.success[500]} />
                            <Text variant="bodySmall" color="success" style={styles.downloadedText}>
                              APK descargado. El instalador debería abrirse automáticamente.
                            </Text>
                            <TouchableOpacity
                              style={styles.retryButton}
                              onPress={downloadAndInstallApk}
                              activeOpacity={activeOpacity.medium}
                            >
                              <Ionicons name="refresh-outline" size={iconSizes.sm} color={colors.primary[600]} />
                              <Text variant="buttonSmall" color={colors.primary[600]} style={styles.retryButtonText}>
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
                          <Ionicons name="logo-github" size={iconSizes.sm} color={colors.neutral[0]} />
                          <Text variant="buttonSmall" color={colors.neutral[0]} style={styles.downloadButtonText}>
                            Ver en GitHub
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
              <View style={styles.webNotice}>
                <Ionicons name="information-circle-outline" size={iconSizes.sm} color={colors.info[500]} />
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

  // Changelog
  changelogContainer: {
    marginBottom: spacing[3],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.success[200],
  },

  changelogTitle: {
    marginBottom: spacing[1],
  },

  changelogText: {
    lineHeight: 18,
  },

  // File size text
  fileSizeText: {
    textAlign: 'center',
    marginTop: spacing[2],
  },

  // Downloaded container
  downloadedContainer: {
    alignItems: 'center',
    gap: spacing[2],
  },

  downloadedText: {
    textAlign: 'center',
  },

  // Retry button
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary[300],
    marginTop: spacing[2],
    gap: spacing[1],
  },

  retryButtonText: {
    marginLeft: spacing[1],
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
