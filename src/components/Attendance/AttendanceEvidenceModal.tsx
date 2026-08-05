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
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes/defaultLight';
import { attendanceRecordsApi } from '@/services/api/attendance';
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
 * Descarga el stream con el token JWT (blob) y lo reproduce vía objectURL en un <video>.
 * En plataformas nativas (Android/iOS) muestra un mensaje: hoy la reproducción
 * solo está disponible en web/desktop (Electron).
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
    if (!visible || !recordId) return;
    if (Platform.OS !== 'web') return;

    let objectUrl: string | null = null;
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        setVideoUrl(null);

        const blob = await attendanceRecordsApi.getRecordEvidence(recordId);
        if (cancelled) return;

        const type = blob.type && blob.type.startsWith('video/') ? blob.type : 'video/webm';
        setMimeType(type);
        objectUrl = URL.createObjectURL(blob);
        setVideoUrl(objectUrl);
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
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [visible, recordId]);

  // Limpia el objectURL cuando se cierra el modal
  useEffect(() => {
    if (!visible && videoUrl) {
      try {
        URL.revokeObjectURL(videoUrl);
      } catch {
        // noop
      }
      setVideoUrl(null);
      setError(null);
    }
  }, [visible, videoUrl]);

  const renderVideo = () => {
    if (Platform.OS !== 'web') {
      return (
        <View style={styles.messageBox}>
          <Ionicons name="phone-portrait-outline" size={40} color={theme.color.text.muted} />
          <Text style={styles.messageTitle}>Solo disponible en web/desktop</Text>
          <Text style={styles.messageText}>
            La reproducción del video de evidencia se soporta desde la versión web o Electron.
          </Text>
        </View>
      );
    }

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
  });

export default AttendanceEvidenceModal;
