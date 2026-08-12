/**
 * DriveFileViewerModal
 *
 * Visor cross-platform mínimo para la fase 1:
 *  - Imágenes: <Image src={blob-url} />
 *  - PDF / video (web/Electron): <iframe> con blob-url. Nativo cae al fallback.
 *  - Texto/JSON/CSV: render como texto plano scrolleable.
 *  - Fallback: card con "Descargar" (usa expo-sharing / anchor download en web).
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Button, Text } from '@/design-system/components';
import { activeOpacity, iconSizes } from '@/design-system/tokens';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { driveApi } from '@/services/api/drive';
import type { DriveNode } from '@/types/drive';
import { logger } from '@/utils/logger';
import DriveExcelEditor from '@/components/Drive/DriveExcelEditor';
import { useUploadDriveVersion } from '@/hooks/api/useDrive';

interface Props {
  visible: boolean;
  node: DriveNode | null;
  /** Si el nivel de acceso permite descargar (nivel `download` o superior). */
  canDownload?: boolean;
  /** Si el nivel de acceso permite editar/guardar (nivel `editor` o superior). */
  canEdit?: boolean;
  onClose: () => void;
}

type ViewerKind = 'image' | 'pdf' | 'video' | 'text' | 'excel' | 'fallback';

const classify = (mime: string | null | undefined, name: string): ViewerKind => {
  const m = (mime || '').toLowerCase();
  const n = name.toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (m.startsWith('video/')) return 'video';
  if (
    n.endsWith('.xlsx') ||
    n.endsWith('.xls') ||
    n.endsWith('.ods') ||
    m.includes('spreadsheet') ||
    m.includes('excel')
  )
    return 'excel';
  if (
    m.startsWith('text/') ||
    m === 'application/json' ||
    m === 'application/xml' ||
    n.endsWith('.txt') ||
    n.endsWith('.md') ||
    n.endsWith('.csv') ||
    n.endsWith('.json') ||
    n.endsWith('.xml')
  )
    return 'text';
  return 'fallback';
};

export const DriveFileViewerModal: React.FC<Props> = ({
  visible,
  node,
  canDownload = true,
  canEdit = true,
  onClose,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [rawBlob, setRawBlob] = useState<Blob | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [excelDirty, setExcelDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const excelSaverRef = useRef<(() => Promise<Blob>) | null>(null);
  const uploadVersion = useUploadDriveVersion();

  const kind: ViewerKind = useMemo(
    () => (node ? classify(node.mimeType, node.name) : 'fallback'),
    [node]
  );

  useEffect(() => {
    if (!visible || !node) return;
    let cancelled = false;
    let createdUrl: string | null = null;
    setLoading(true);
    setError(null);
    setTextContent(null);
    setBlobUrl(null);
    setRawBlob(null);
    setExcelDirty(false);

    (async () => {
      try {
        // Solo para tipos que rendericemos in-app; para fallback no descargamos.
        if (kind === 'fallback') {
          setLoading(false);
          return;
        }
        const blob = await driveApi.downloadNode(node.id, { disposition: 'inline' });
        if (cancelled) return;
        setRawBlob(blob);
        if (kind === 'text') {
          const txt = await blob.text();
          if (!cancelled) setTextContent(txt);
        } else if (kind !== 'excel') {
          const url = URL.createObjectURL(blob);
          createdUrl = url;
          if (!cancelled) setBlobUrl(url);
        }
      } catch (e) {
        logger.error('Error cargando preview:', e);
        if (!cancelled) setError('No se pudo cargar el archivo.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (createdUrl) {
        try {
          URL.revokeObjectURL(createdUrl);
        } catch {
          /* noop */
        }
      }
    };
  }, [visible, node, kind]);

  const handleSaveExcel = async () => {
    if (!node || !excelSaverRef.current) return;
    try {
      setSaving(true);
      const blob = await excelSaverRef.current();
      await uploadVersion.mutateAsync({
        nodeId: node.id,
        spaceId: node.spaceId,
        file: blob,
        filename: node.name,
      });
      setExcelDirty(false);
    } catch (e) {
      logger.error('Error guardando xlsx:', e);
      setError('No se pudo guardar el archivo.');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!node) return;
    try {
      if (Platform.OS === 'web') {
        const blob = await driveApi.downloadNode(node.id, { disposition: 'attachment' });
        const url = URL.createObjectURL(blob);
        // Trigger anchor download
        const a = document.createElement('a');
        a.href = url;
        a.download = node.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        const blob = await driveApi.downloadNode(node.id, { disposition: 'attachment' });
        // Convertir Blob a base64 y guardarlo en cache para poder compartirlo
        const reader = new FileReader();
        const base64: string = await new Promise((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1] || '');
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
        const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
        const path = `${dir}${encodeURIComponent(node.name)}`;
        await FileSystem.writeAsStringAsync(path, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(path);
        }
      }
    } catch (e) {
      logger.error('Error descargando:', e);
      setError('No se pudo descargar el archivo.');
    }
  };

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.headerBtn}
            activeOpacity={activeOpacity.medium}
            accessibilityLabel="Cerrar"
          >
            <Ionicons name="close" size={iconSizes.lg} color={theme.color.icon.default} />
          </TouchableOpacity>
          <View style={styles.headerTitle}>
            <Text variant="titleSmall" numberOfLines={1}>
              {node?.name ?? ''}
            </Text>
          </View>
          {kind === 'excel' && canEdit && (
            <TouchableOpacity
              onPress={handleSaveExcel}
              style={styles.headerBtn}
              activeOpacity={activeOpacity.medium}
              accessibilityLabel="Guardar cambios"
              disabled={!excelDirty || saving}
            >
              <Ionicons
                name="save-outline"
                size={iconSizes.lg}
                color={excelDirty && !saving ? theme.color.brand.primary : theme.color.icon.subtle}
              />
            </TouchableOpacity>
          )}
          {canDownload && (
            <TouchableOpacity
              onPress={handleDownload}
              style={styles.headerBtn}
              activeOpacity={activeOpacity.medium}
              accessibilityLabel="Descargar"
            >
              <Ionicons
                name="download-outline"
                size={iconSizes.lg}
                color={theme.color.icon.default}
              />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.body}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={theme.color.brand.primary} />
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text variant="bodyMedium" color="danger">
                {error}
              </Text>
              {canDownload && <Button title="Descargar" onPress={handleDownload} />}
            </View>
          ) : kind === 'image' && blobUrl ? (
            <View style={styles.center}>
              <Image source={{ uri: blobUrl }} style={styles.image} resizeMode="contain" />
            </View>
          ) : kind === 'pdf' && blobUrl && Platform.OS === 'web' ? (
            // eslint-disable-next-line react-native/no-inline-styles
            <iframe
              src={blobUrl}
              style={{ border: 'none', width: '100%', height: '100%' }}
              title={node?.name}
            />
          ) : kind === 'video' && blobUrl && Platform.OS === 'web' ? (
            // eslint-disable-next-line react-native/no-inline-styles
            <video src={blobUrl} controls style={{ width: '100%', height: '100%' }} />
          ) : kind === 'excel' && rawBlob ? (
            <DriveExcelEditor
              blob={rawBlob}
              filename={node?.name ?? ''}
              editable={canEdit}
              onDirtyChange={setExcelDirty}
              registerSaver={(fn) => {
                excelSaverRef.current = fn;
              }}
            />
          ) : kind === 'text' && textContent !== null ? (
            <ScrollView style={styles.textScroll} contentContainerStyle={styles.textContainer}>
              <Text variant="bodySmall" selectable>
                {textContent}
              </Text>
            </ScrollView>
          ) : (
            <View style={styles.center}>
              <Ionicons name="document-outline" size={64} color={theme.color.icon.subtle} />
              <Text variant="bodyMedium" color="secondary" align="center">
                {canDownload
                  ? 'Este tipo de archivo no se puede previsualizar aquí todavía.'
                  : 'Este tipo de archivo no se puede previsualizar aquí y tu acceso es solo de lectura.'}
              </Text>
              {canDownload && (
                <Button
                  title="Descargar / abrir con otra app"
                  onPress={handleDownload}
                  leftIcon="download-outline"
                />
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.surface.base,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[3],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.color.border.subtle,
      gap: theme.space[2],
    },
    headerTitle: {
      flex: 1,
      minWidth: 0,
    },
    headerBtn: {
      padding: theme.space[1],
      borderRadius: theme.radii.md,
    },
    body: {
      flex: 1,
      backgroundColor: theme.color.surface.muted,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.space[4],
      gap: theme.space[3],
    },
    image: {
      width: '100%',
      height: '100%',
    },
    textScroll: {
      flex: 1,
    },
    textContainer: {
      padding: theme.space[4],
    },
  });

export default DriveFileViewerModal;
