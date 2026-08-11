/**
 * DriveFileOpenSheet
 *
 * Bottom-sheet que aparece al tocar un archivo (en vez de renderizar el
 * visor directamente). Presenta las opciones disponibles:
 *  - Abrir en ERP (usa el visor integrado)
 *  - Descargar
 *  - Abrir con otra app (nativo) / Abrir en nueva pestaña (web)
 *  - Ver versiones (a futuro)
 *
 * El caller decide qué acción tomar según el id devuelto.
 */

import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/design-system/components';
import { activeOpacity, iconSizes } from '@/design-system/tokens';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import type { DriveNode } from '@/types/drive';
import { toBytesNumber } from '@/types/drive';

export type FileOpenAction = 'preview-in-erp' | 'download' | 'open-external';

interface Props {
  visible: boolean;
  node: DriveNode | null;
  onSelect: (action: FileOpenAction, node: DriveNode) => void;
  onClose: () => void;
}

const humanBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

/** ¿Este archivo tiene visor integrado en el ERP? */
const isPreviewable = (mime: string | null, name: string): boolean => {
  const m = (mime || '').toLowerCase();
  const n = name.toLowerCase();
  if (m.startsWith('image/')) return true;
  if (m.startsWith('video/')) return Platform.OS === 'web';
  if (m === 'application/pdf' || n.endsWith('.pdf')) return Platform.OS === 'web';
  if (
    n.endsWith('.xlsx') ||
    n.endsWith('.xls') ||
    n.endsWith('.ods') ||
    m.includes('spreadsheet') ||
    m.includes('excel')
  )
    return true;
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
    return true;
  return false;
};

export const DriveFileOpenSheet: React.FC<Props> = ({ visible, node, onSelect, onClose }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  if (!node) return null;

  const previewable = isPreviewable(node.mimeType, node.name);
  const size = toBytesNumber(node.sizeBytes);

  const options: Array<{
    id: FileOpenAction;
    label: string;
    hint?: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
  }> = [];

  if (previewable) {
    options.push({
      id: 'preview-in-erp',
      label: 'Abrir en el ERP',
      hint: 'Ver o editar dentro de la app',
      icon: 'eye-outline',
      color: theme.color.brand.primary,
    });
  }
  options.push({
    id: 'download',
    label: 'Descargar',
    hint: Platform.OS === 'web' ? 'Guardar en tu computadora' : 'Guardar en el dispositivo',
    icon: 'download-outline',
    color: '#10B981',
  });
  options.push({
    id: 'open-external',
    label: Platform.OS === 'web' ? 'Abrir en pestaña nueva' : 'Abrir con otra app',
    hint: Platform.OS === 'web' ? 'El navegador decide qué visor usar' : 'Usa una app instalada',
    icon: 'open-outline',
    color: '#3B82F6',
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Ionicons
              name="document-outline"
              size={iconSizes.md}
              color={theme.color.icon.default}
            />
            <View style={styles.headerText}>
              <Text variant="bodyMedium" numberOfLines={1}>
                {node.name}
              </Text>
              <Text variant="caption" color="secondary" numberOfLines={1}>
                {humanBytes(size)}
                {node.mimeType ? ` · ${node.mimeType}` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={activeOpacity.medium}>
              <Ionicons name="close" size={iconSizes.md} color={theme.color.icon.default} />
            </TouchableOpacity>
          </View>

          <View style={styles.list}>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={styles.row}
                onPress={() => {
                  onSelect(opt.id, node);
                  onClose();
                }}
                activeOpacity={activeOpacity.medium}
                accessibilityLabel={opt.label}
              >
                <View style={[styles.iconBox, { backgroundColor: `${opt.color}18` }]}>
                  <Ionicons name={opt.icon} size={iconSizes.md} color={opt.color} />
                </View>
                <View style={styles.rowText}>
                  <Text variant="bodyMedium">{opt.label}</Text>
                  {opt.hint && (
                    <Text variant="caption" color="secondary" numberOfLines={1}>
                      {opt.hint}
                    </Text>
                  )}
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={iconSizes.sm}
                  color={theme.color.icon.muted}
                />
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: theme.color.overlay.strong,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: theme.color.surface.base,
      borderTopLeftRadius: theme.radii.xl,
      borderTopRightRadius: theme.radii.xl,
      paddingBottom: theme.space[6],
      paddingTop: theme.space[2],
      ...theme.shadow.lg,
    },
    grabber: {
      width: 44,
      height: 4,
      backgroundColor: theme.color.border.subtle,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: theme.space[2],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
      paddingHorizontal: theme.space[5],
      paddingVertical: theme.space[3],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.color.border.subtle,
    },
    headerText: { flex: 1, minWidth: 0 },
    list: {
      paddingVertical: theme.space[2],
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
      paddingHorizontal: theme.space[5],
      paddingVertical: theme.space[3],
    },
    iconBox: {
      width: 40,
      height: 40,
      borderRadius: theme.radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowText: {
      flex: 1,
      minWidth: 0,
    },
  });

export default DriveFileOpenSheet;
