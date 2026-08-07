import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes/defaultLight';
import { attendanceRecordsApi } from '@/services/api/attendance';
import { config } from '@/utils/config';
import { authService } from '@/services/AuthService';
import { useAuthStore } from '@/store/auth';
import logger from '@/utils/logger';

interface AttendanceEvidenceModalProps {
  visible: boolean;
  recordId: string | null;
  title?: string;
  subtitle?: string;
  onClose: () => void;
}

/**
 * Modal para reproducir el video de evidencia de un evento de asistencia.
 *
 * - En **web/desktop (Electron)**: descarga el stream como Blob y lo reproduce
 *   con un `<video>` HTML vía `URL.createObjectURL`.
 * - En **nativo (Android/iOS)**: descarga el Blob, lo persiste como archivo
 *   temporal en `cacheDirectory` y lo reproduce con `expo-av` `<Video>`.
 */
export const AttendanceEvidenceModal: React.FC<AttendanceEvidenceModalProps> = ({
  visible,
  recordId,
  title,
  subtitle,
  onClose,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('video/webm');

  useEffect(() => {
    if (!visible) return;
    if (!recordId) {
      setError(
        'Este evento no tiene un ID de registro disponible. El backend debe incluir "lastEvent.id" en la respuesta de active-workers/finished-workers.'
      );
      setLoading(false);
      return;
    }

    let objectUrl: string | null = null;
    let nativeFileUri: string | null = null;
    let cancelled = false;

    const extensionFromMime = (type: string): string => {
      if (type.includes('mp4')) return 'mp4';
      if (type.includes('quicktime')) return 'mov';
      if (type.includes('webm')) return 'webm';
      if (type.includes('ogg')) return 'ogv';
      return 'mp4';
    };

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        setVideoUrl(null);

        if (Platform.OS === 'web') {
          const blob = await attendanceRecordsApi.getRecordEvidence(recordId);
          if (cancelled) return;
          const type = blob.type && blob.type.startsWith('video/') ? blob.type : 'video/mp4';
          setMimeType(type);
          objectUrl = URL.createObjectURL(blob);
          setVideoUrl(objectUrl);
        } else {
          // Nativo: descargar directamente a un archivo con FileSystem.downloadAsync
          // usando los headers de auth + tenant. Esto evita el round-trip por Blob
          // (que en React Native es poco confiable) y permite a `expo-av` reproducir
          // el video desde una URI local.
          const authStore = useAuthStore.getState();
          const token = authService.getAccessToken() || authStore.token;
          const headers: Record<string, string> = {
            Accept: 'video/*,*/*;q=0.9',
            'X-App-Id': config.APP_ID,
            'X-App-Version': config.APP_VERSION,
          };
          if (token) headers.Authorization = `Bearer ${token}`;
          if (authStore.user?.id) headers['X-User-Id'] = authStore.user.id;
          if (authStore.currentCompany?.id) headers['X-Company-Id'] = authStore.currentCompany.id;
          if (authStore.currentSite?.id) headers['X-Site-Id'] = authStore.currentSite.id;

          // Guardamos primero con extensión .mp4 (default), luego renombramos si
          // la respuesta indica otro mime.
          const tempFileUri = `${FileSystem.cacheDirectory}attendance-evidence-${recordId}.tmp`;
          const url = `${config.API_URL}/attendance/records/${recordId}/evidence`;
          const result = await FileSystem.downloadAsync(url, tempFileUri, { headers });
          if (cancelled) return;

          if (result.status < 200 || result.status >= 300) {
            const err: any = new Error(`HTTP ${result.status}`);
            err.response = { status: result.status };
            throw err;
          }

          const contentType =
            (result.headers?.['content-type'] as string | undefined) ||
            (result.headers?.['Content-Type'] as string | undefined) ||
            'video/mp4';
          const type = contentType.startsWith('video/') ? contentType : 'video/mp4';
          setMimeType(type);

          const ext = extensionFromMime(type);
          const finalUri = `${FileSystem.cacheDirectory}attendance-evidence-${recordId}.${ext}`;
          try {
            await FileSystem.deleteAsync(finalUri, { idempotent: true });
          } catch {
            // noop
          }
          await FileSystem.moveAsync({ from: result.uri, to: finalUri });
          if (cancelled) return;
          nativeFileUri = finalUri;
          setVideoUrl(finalUri);
        }
      } catch (err: any) {
        if (cancelled) return;
        logger.error('Error cargando video de evidencia:', err);
        const status = err?.response?.status;
        if (status === 404) {
          setError('No hay video de evidencia asociado a este registro.');
        } else if (status === 403) {
          setError('No tienes permiso para ver este video (attendance.read.all).');
        } else {
          setError('No se pudo cargar el video de evidencia.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {
          // noop
        }
      }
      if (nativeFileUri) {
        // Limpieza best-effort del archivo temporal en cache
        FileSystem.deleteAsync(nativeFileUri, { idempotent: true }).catch(() => {
          // noop
        });
      }
    };
  }, [visible, recordId]);

  // Limpia estado cuando se cierra el modal
  useEffect(() => {
    if (!visible) {
      if (videoUrl && Platform.OS === 'web') {
        try {
          URL.revokeObjectURL(videoUrl);
        } catch {
          // noop
        }
      }
      setVideoUrl(null);
      setError(null);
    }
  }, [visible, videoUrl]);

  const renderVideo = () => {
    if (loading) {
      return (
        <View style={styles.messageBox}>
          <ActivityIndicator size="large" color={theme.color.brand.accent} />
          <Text style={styles.messageText}>Cargando video…</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.messageBox}>
          <Ionicons name="alert-circle-outline" size={40} color={theme.color.icon.danger} />
          <Text style={styles.messageTitle}>Sin video</Text>
          <Text style={styles.messageText}>{error}</Text>
        </View>
      );
    }

    if (!videoUrl) {
      return null;
    }

    if (Platform.OS === 'web') {
      // Render HTML <video> vía React Native Web
      return React.createElement('video' as any, {
        src: videoUrl,
        controls: true,
        autoPlay: true,
        style: {
          width: '100%',
          maxHeight: 480,
          backgroundColor: '#000',
          borderRadius: 8,
        },
        children: React.createElement('source' as any, { src: videoUrl, type: mimeType }),
      });
    }

    // Nativo: expo-av
    return (
      <Video
        source={{ uri: videoUrl }}
        style={styles.nativeVideo}
        useNativeControls
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
        isLooping={false}
      />
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>
                {title || 'Video de evidencia'}
              </Text>
              {!!subtitle && (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {subtitle}
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityLabel="Cerrar"
            >
              <Ionicons name="close" size={22} color={theme.color.text.body} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>{renderVideo()}</View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    },
    card: {
      width: '100%',
      maxWidth: 720,
      backgroundColor: theme.color.surface.base,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      gap: 8,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    subtitle: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginTop: 2,
    },
    closeButton: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 16,
      backgroundColor: theme.color.surface.elevated,
    },
    body: {
      padding: 14,
      minHeight: 220,
      alignItems: 'center',
      justifyContent: 'center',
    },
    messageBox: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 24,
      paddingHorizontal: 16,
    },
    messageTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginTop: 4,
    },
    messageText: {
      fontSize: 13,
      color: theme.color.text.muted,
      textAlign: 'center',
    },
    nativeVideo: {
      width: '100%',
      aspectRatio: 16 / 9,
      maxHeight: 480,
      backgroundColor: '#000',
      borderRadius: 8,
    },
  });

export default AttendanceEvidenceModal;
