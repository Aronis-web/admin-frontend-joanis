import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import Alert from '@/utils/alert';
import { getDocumentAsync, type DocumentPickerAsset } from '@/utils/filePicker';
import { appUpdatesApi, type AppRelease } from '@/services/api/app-updates';
import { CAJAGRIT_APP_ID, CAJAGRIT_PLATFORM } from '@/services/api/device-fleet';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Se llama tras subir una version, para refrescar la lista de cajas. */
  onUploaded: () => void;
}

const VERSION = /^\d+\.\d+\.\d+$/;

const formatSize = (bytes?: number | null) =>
  bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : '';

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }) : '';

/**
 * Versiones publicadas de CajaGrit escritorio (Versiones de App, app POS,
 * Windows) y subida de un instalador nuevo. Las cajas lo descargan desde este
 * servidor, sin GitHub.
 */
export const CajaGritVersionsModal: React.FC<Props> = ({ visible, onClose, onUploaded }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [releases, setReleases] = useState<AppRelease[]>([]);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState('');
  const [changelog, setChangelog] = useState('');
  const [file, setFile] = useState<DocumentPickerAsset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReleases(await appUpdatesApi.listReleases(CAJAGRIT_APP_ID, CAJAGRIT_PLATFORM));
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudieron cargar las versiones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) void load();
  }, [visible, load]);

  const pickFile = async () => {
    const result = await getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    if (!asset.name.toLowerCase().endsWith('.exe')) {
      Alert.alert('Archivo inválido', 'Selecciona el instalador .exe de CajaGrit.');
      return;
    }
    setFile(asset);
    // Sugerir la version desde el nombre (CajaGrit-Setup-0.0.73.exe)
    const match = asset.name.match(/(\d+\.\d+\.\d+)/);
    if (match && !version) setVersion(match[1]);
  };

  const upload = async () => {
    const trimmed = version.trim();
    if (!file) {
      Alert.alert('Falta el instalador', 'Selecciona el archivo .exe.');
      return;
    }
    if (!VERSION.test(trimmed)) {
      Alert.alert('Versión inválida', 'Usa el formato X.Y.Z (ej: 0.0.73).');
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      if (changelog.trim()) {
        try {
          await appUpdatesApi.createRelease({
            appId: CAJAGRIT_APP_ID,
            platform: CAJAGRIT_PLATFORM,
            version: trimmed,
            changelog: changelog.trim(),
          });
        } catch (error: any) {
          // 400: la version ya existia; se sube el archivo igual.
          if (error?.response?.status !== 400) throw error;
        }
      }
      await appUpdatesApi.uploadRelease(
        CAJAGRIT_APP_ID,
        CAJAGRIT_PLATFORM,
        trimmed,
        file,
        setProgress
      );
      Alert.alert(
        'Versión publicada',
        `CajaGrit ${trimmed} ya está disponible. Las cajas la verán en su próxima revisión, o usa Actualizar/Forzar.`
      );
      setFile(null);
      setVersion('');
      setChangelog('');
      await load();
      onUploaded();
    } catch (error: any) {
      Alert.alert(
        'Error',
        error?.response?.data?.message || error?.message || 'No se pudo subir el instalador'
      );
    } finally {
      setUploading(false);
    }
  };

  const toggleActive = async (release: AppRelease) => {
    try {
      if (release.isActive) {
        await appUpdatesApi.deactivateRelease(release.id);
      } else {
        await appUpdatesApi.updateRelease(release.id, { isActive: true });
      }
      await load();
      onUploaded();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudo cambiar la versión');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Versiones de CajaGrit</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Cerrar">
              <Ionicons name="close" size={24} color={theme.color.text.muted} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.section}>Subir nueva versión</Text>
            <TouchableOpacity style={styles.fileButton} onPress={pickFile} disabled={uploading}>
              <Ionicons
                name="document-attach-outline"
                size={18}
                color={theme.color.brand.primary}
              />
              <Text style={styles.fileText} numberOfLines={1}>
                {file ? `${file.name} ${formatSize(file.size)}` : 'Seleccionar instalador .exe'}
              </Text>
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              value={version}
              onChangeText={setVersion}
              placeholder="Versión (ej: 0.0.73)"
              placeholderTextColor={theme.color.text.placeholder}
              autoCapitalize="none"
              editable={!uploading}
            />
            <TextInput
              style={[styles.input, styles.multiline]}
              value={changelog}
              onChangeText={setChangelog}
              placeholder="Cambios (opcional)"
              placeholderTextColor={theme.color.text.placeholder}
              multiline
              editable={!uploading}
            />
            <TouchableOpacity
              style={[styles.primary, uploading && styles.disabled]}
              onPress={upload}
              disabled={uploading}
            >
              {uploading ? (
                <Text style={styles.primaryText}>Subiendo… {Math.round(progress)}%</Text>
              ) : (
                <Text style={styles.primaryText}>Subir y publicar</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.section}>Publicadas</Text>
            {loading ? (
              <ActivityIndicator color={theme.color.brand.primary} />
            ) : releases.length === 0 ? (
              <Text style={styles.muted}>Todavía no hay versiones subidas.</Text>
            ) : (
              releases.map((release) => (
                <View key={release.id} style={styles.release}>
                  <View style={styles.releaseInfo}>
                    <Text style={styles.releaseTitle}>
                      v{release.version}
                      {release.isActive ? '' : ' (inactiva)'}
                    </Text>
                    <Text style={styles.muted}>
                      {formatDate(release.releaseDate)}
                      {release.fileSize
                        ? ` · ${formatSize(release.fileSize)}`
                        : ' · sin instalador'}
                    </Text>
                    {release.changelog ? (
                      <Text style={styles.changelog}>{release.changelog}</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity onPress={() => void toggleActive(release)}>
                    <Text style={styles.link}>{release.isActive ? 'Desactivar' : 'Activar'}</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
            <Text style={styles.hint}>
              Las cajas instalan la versión activa más alta. Desactiva una versión para retirarla.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    },
    sheet: {
      width: '100%',
      maxWidth: 560,
      maxHeight: '90%',
      backgroundColor: theme.color.surface.base,
      borderRadius: 12,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    title: { fontSize: 18, fontWeight: '700', color: theme.color.text.heading },
    body: { padding: 16 },
    section: {
      fontWeight: '700',
      color: theme.color.text.heading,
      marginTop: 8,
      marginBottom: 8,
    },
    fileButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: theme.color.border.default,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
    },
    fileText: { flex: 1, color: theme.color.text.body },
    input: {
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: 8,
      padding: 10,
      color: theme.color.text.body,
      marginBottom: 8,
    },
    multiline: { minHeight: 60, textAlignVertical: 'top' },
    primary: {
      backgroundColor: theme.color.brand.primary,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
      marginBottom: 16,
    },
    primaryText: { color: theme.color.text.inverse, fontWeight: '700' },
    disabled: { opacity: 0.6 },
    release: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    releaseInfo: { flex: 1 },
    releaseTitle: { fontWeight: '700', color: theme.color.text.body },
    changelog: { color: theme.color.text.body, marginTop: 2 },
    muted: { color: theme.color.text.muted },
    link: { color: theme.color.brand.primary, fontWeight: '700' },
    hint: { color: theme.color.text.muted, fontStyle: 'italic', marginTop: 12 },
  });

export default CajaGritVersionsModal;
