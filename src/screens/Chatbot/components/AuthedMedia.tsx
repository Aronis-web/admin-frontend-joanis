import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio, ResizeMode, Video } from 'expo-av';
import { Body, Caption, useTheme } from '@/design-system';
import { spacing, borderRadius } from '@/design-system/tokens';
import { chatbotConversationsApi, MessageMediaError } from '@/services/api';
import { saveAndShareFile } from '@/utils/fileDownload';
import Alert from '@/utils/alert';
import logger from '@/utils/logger';
import type { ChatMessage } from '@/types/chatbot';

interface Props {
  conversationId: string;
  message: ChatMessage;
  /** Ancho preferido para render de imagen/video. Default 240. */
  width?: number;
  /** Alto preferido para render de imagen/video. Default 240. */
  height?: number;
  onPress?: () => void;
}

/**
 * Fuente de un adjunto cargado con `fetchMessageMedia`.
 * Almacenamos también el mime real para elegir cómo compartir el archivo
 * cuando el usuario descarga documentos.
 */
interface LoadedMedia {
  uri: string;
  contentType: string;
  fileName: string | null;
  blob: Blob;
}

/**
 * Estado del escaneo antivirus del backend.
 *
 * Si el backend legacy no envía `scanStatus`, lo tratamos como `'skipped'`
 * para no bloquear el renderizado de mensajes viejos.
 */
type ScanStatus = NonNullable<ChatMessage['scanStatus']>;

const resolveScanStatus = (msg: ChatMessage): ScanStatus => msg.scanStatus ?? 'skipped';

/**
 * Renderiza un adjunto de WhatsApp (imagen, video, audio, documento, sticker)
 * consultando el endpoint autenticado
 * `/chatbot/conversations/:id/messages/:mid/media`.
 *
 * Responsabilidades:
 * - Refleja el `scanStatus` del mensaje (`pending` → spinner; `infected` →
 *   bloqueado) sin llegar a pegarle al endpoint cuando ya se sabe que no
 *   va a servir el binario.
 * - Para `clean`/`skipped` descarga el binario con fetch autenticado, crea
 *   un object URL (web) o guarda a `cacheDirectory` (nativo, vía
 *   `saveAndShareFile`) y lo entrega al widget correspondiente.
 * - Documentos se ofrecen como botón "Descargar" que dispara el share sheet
 *   nativo o un `<a download>` en web con el `fileName` original.
 */
export const AuthedMedia: React.FC<Props> = ({
  conversationId,
  message,
  width = 240,
  height = 240,
  onPress,
}) => {
  const theme = useTheme();
  const scan = resolveScanStatus(message);
  const mediaType = message.mediaType ?? null;

  const isPlayable =
    mediaType === 'image' ||
    mediaType === 'sticker' ||
    mediaType === 'video' ||
    mediaType === 'audio';
  const shouldAutoLoad = isPlayable && (scan === 'clean' || scan === 'skipped');

  const [media, setMedia] = useState<LoadedMedia | null>(null);
  const [error, setError] = useState<MessageMediaError | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!shouldAutoLoad) return;
    let cancelled = false;
    let objectUrl: string | null = null;

    setLoading(true);
    setError(null);
    setMedia(null);

    chatbotConversationsApi
      .fetchMessageMedia(conversationId, message.id)
      .then(({ blob, contentType, fileName }) => {
        if (cancelled) return;
        // Web y RN Web: object URL. En nativo, `URL.createObjectURL` no está
        // disponible pero `expo-av` / `Image` sí aceptan `data:` URIs para
        // blobs pequeños. Para audio/video preferimos siempre object URL.
        const uri = URL.createObjectURL(blob);
        objectUrl = uri;
        setMedia({ uri, contentType, fileName, blob });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof MessageMediaError) {
          setError(err);
        } else {
          logger.error('AuthedMedia: fetch failed', err);
          setError(new MessageMediaError('error', 0, 'Fetch failed'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl && Platform.OS === 'web') {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {
          /* noop */
        }
      }
    };
  }, [conversationId, message.id, shouldAutoLoad]);

  // ── Estados por scanStatus ────────────────────────────────────────────
  if (scan === 'pending') {
    return (
      <StatusBox icon="hourglass-outline" label="Analizando archivo…" tone="muted" width={width} />
    );
  }
  if (scan === 'infected') {
    return (
      <StatusBox
        icon="shield-outline"
        label="Archivo bloqueado por seguridad"
        tone="danger"
        width={width}
      />
    );
  }

  // ── Documento (no se auto-descarga) ───────────────────────────────────
  if (mediaType === 'document') {
    return (
      <DocumentDownload
        conversationId={conversationId}
        messageId={message.id}
        fileName={message.fileName}
        width={width}
      />
    );
  }

  // ── Errores del fetch ─────────────────────────────────────────────────
  if (error) {
    // pending/infected pueden llegar como error si el header del listado
    // decía 'clean' pero el backend cambió de opinión en el intervalo.
    if (error.code === 'pending') {
      return (
        <StatusBox
          icon="hourglass-outline"
          label="Analizando archivo…"
          tone="muted"
          width={width}
        />
      );
    }
    if (error.code === 'infected') {
      return (
        <StatusBox
          icon="shield-outline"
          label="Archivo bloqueado por seguridad"
          tone="danger"
          width={width}
        />
      );
    }
    if (error.code === 'notfound') {
      return (
        <StatusBox
          icon="close-circle-outline"
          label="Archivo no disponible"
          tone="muted"
          width={width}
        />
      );
    }
    return (
      <StatusBox
        icon="alert-circle-outline"
        label="No se pudo cargar"
        tone="danger"
        width={width}
      />
    );
  }

  if (loading || !media) {
    return (
      <View
        style={[styles.frame, { width, height, backgroundColor: theme.color.background.subtle }]}
      >
        <ActivityIndicator size="small" color={theme.color.text.muted} />
      </View>
    );
  }

  // ── Renders reproducibles ─────────────────────────────────────────────
  if (mediaType === 'image' || mediaType === 'sticker') {
    const content = (
      <View
        style={[styles.frame, { width, height, backgroundColor: theme.color.background.subtle }]}
      >
        <Image source={{ uri: media.uri }} style={styles.image} resizeMode="cover" />
      </View>
    );
    if (onPress) {
      return (
        <Pressable onPress={onPress} accessibilityRole="imagebutton">
          {content}
        </Pressable>
      );
    }
    return content;
  }

  if (mediaType === 'video') {
    if (Platform.OS === 'web') {
      // React Native Web no tiene <Video>; usamos <video> HTML.
      return React.createElement('video' as any, {
        src: media.uri,
        controls: true,
        preload: 'metadata',
        style: {
          width,
          maxHeight: height * 1.5,
          backgroundColor: '#000',
          borderRadius: borderRadius.md,
        },
      });
    }
    return (
      <Video
        source={{ uri: media.uri }}
        useNativeControls
        resizeMode={ResizeMode.CONTAIN}
        style={[styles.video, { width, aspectRatio: 16 / 9 }]}
      />
    );
  }

  if (mediaType === 'audio') {
    if (Platform.OS === 'web') {
      return React.createElement('audio' as any, {
        src: media.uri,
        controls: true,
        preload: 'metadata',
        style: { width, maxWidth: 320 },
      });
    }
    return (
      <NativeAudioPlayer
        uri={media.uri}
        contentType={media.contentType}
        width={Math.min(width, 280)}
      />
    );
  }

  // Cualquier otro tipo (fallback): botón de descarga.
  return (
    <DocumentDownload
      conversationId={conversationId}
      messageId={message.id}
      fileName={message.fileName}
      width={width}
    />
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes
// ────────────────────────��────────────────────────────────────────────────────

interface StatusBoxProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tone: 'muted' | 'danger';
  width: number;
}

const StatusBox: React.FC<StatusBoxProps> = ({ icon, label, tone, width }) => {
  const theme = useTheme();
  const color = tone === 'danger' ? theme.color.icon.danger : theme.color.text.muted;
  return (
    <View style={[styles.statusBox, { width, backgroundColor: theme.color.background.subtle }]}>
      <Ionicons name={icon} size={22} color={color} />
      <Caption color={color}>{label}</Caption>
    </View>
  );
};

interface DocumentDownloadProps {
  conversationId: string;
  messageId: string;
  fileName?: string | null;
  width: number;
}

/**
 * Botón que descarga un documento vía `fetchMessageMedia` y lo guarda /
 * comparte usando `saveAndShareFile`.
 */
const DocumentDownload: React.FC<DocumentDownloadProps> = ({
  conversationId,
  messageId,
  fileName,
  width,
}) => {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);

  const download = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const {
        blob,
        contentType,
        fileName: serverFileName,
      } = await chatbotConversationsApi.fetchMessageMedia(conversationId, messageId);
      const finalName = serverFileName || fileName || `documento-${messageId}`;
      await saveAndShareFile({
        blob,
        fileName: finalName,
        mimeType: contentType || 'application/octet-stream',
        dialogTitle: 'Guardar documento',
        webDownloadName: finalName,
      });
    } catch (err) {
      if (err instanceof MessageMediaError) {
        if (err.code === 'pending') {
          Alert.alert(
            'Analizando',
            'El archivo aún está en análisis de seguridad. Reintenta en un momento.'
          );
          return;
        }
        if (err.code === 'infected') {
          Alert.alert('Bloqueado', 'El archivo fue bloqueado por seguridad.');
          return;
        }
        if (err.code === 'notfound') {
          Alert.alert('No disponible', 'El archivo ya no está disponible.');
          return;
        }
      }
      logger.error('DocumentDownload: falló descarga', err);
      Alert.alert('Error', 'No se pudo descargar el documento.');
    } finally {
      setBusy(false);
    }
  }, [busy, conversationId, messageId, fileName]);

  const displayName = fileName || 'Documento';

  return (
    <Pressable
      onPress={download}
      disabled={busy}
      style={({ pressed }) => [
        styles.docBox,
        {
          width,
          backgroundColor: theme.color.background.subtle,
          opacity: pressed || busy ? 0.7 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Descargar ${displayName}`}
    >
      <Ionicons name="document-outline" size={24} color={theme.color.text.body} />
      <View style={styles.docTextCol}>
        <Body numberOfLines={2}>{displayName}</Body>
        <Caption color={theme.color.text.muted}>
          {busy ? 'Descargando…' : 'Tocar para descargar'}
        </Caption>
      </View>
      {busy ? (
        <ActivityIndicator size="small" color={theme.color.text.muted} />
      ) : (
        <Ionicons name="download-outline" size={20} color={theme.color.text.muted} />
      )}
    </Pressable>
  );
};

interface NativeAudioPlayerProps {
  uri: string;
  contentType: string;
  width: number;
}

/**
 * Reproductor de audio minimal para nativo (Android/iOS) usando `expo-av`.
 *
 * En web preferimos el `<audio controls>` nativo del navegador — este
 * componente sólo se usa cuando `Platform.OS !== 'web'`.
 */
const NativeAudioPlayer: React.FC<NativeAudioPlayerProps> = ({ uri, width }) => {
  const theme = useTheme();
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => {
      // Descarga el sound al desmontar para liberar memoria/handles.
      if (sound) sound.unloadAsync().catch(() => undefined);
    };
  }, [sound]);

  const toggle = useCallback(async () => {
    try {
      if (!sound) {
        setLoading(true);
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true },
          (status) => {
            if (!status.isLoaded) return;
            setPlaying(status.isPlaying);
            if (status.didJustFinish) setPlaying(false);
          }
        );
        setSound(newSound);
        setPlaying(true);
        setLoading(false);
        return;
      }
      const status = await sound.getStatusAsync();
      if (!status.isLoaded) return;
      if (status.isPlaying) {
        await sound.pauseAsync();
        setPlaying(false);
      } else {
        await sound.playAsync();
        setPlaying(true);
      }
    } catch (err) {
      logger.error('NativeAudioPlayer: toggle falló', err);
      setLoading(false);
    }
  }, [sound, uri]);

  return (
    <Pressable
      onPress={toggle}
      style={[styles.audioBox, { width, backgroundColor: theme.color.background.subtle }]}
      accessibilityRole="button"
      accessibilityLabel={playing ? 'Pausar audio' : 'Reproducir audio'}
    >
      {loading ? (
        <ActivityIndicator size="small" color={theme.color.text.body} />
      ) : (
        <Ionicons
          name={playing ? 'pause-circle' : 'play-circle'}
          size={32}
          color={theme.color.brand.accent}
        />
      )}
      <Caption color={theme.color.text.muted}>{playing ? 'Reproduciendo…' : 'Audio'}</Caption>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  frame: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  video: {
    borderRadius: borderRadius.md,
    backgroundColor: '#000',
  },
  statusBox: {
    minHeight: 64,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
    padding: spacing[3],
  },
  docBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: borderRadius.md,
  },
  docTextCol: {
    flex: 1,
    gap: 2,
  },
  audioBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[2],
    borderRadius: borderRadius.full,
  },
});
