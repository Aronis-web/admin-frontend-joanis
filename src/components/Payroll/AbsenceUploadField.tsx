import React from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Body, Button, Caption } from '@/design-system';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { spacing } from '@/design-system/tokens';

import { getDocumentAsync, type DocumentPickerAsset } from '@/utils/filePicker';
import { logger } from '@/utils/logger';
import type { AbsenceFileInput } from '@/types/payroll';

export type AbsenceUploadValue = File | Blob | AbsenceFileInput;

interface Props {
  value?: AbsenceUploadValue | null;
  fileName?: string | null;
  onChange: (
    file: AbsenceUploadValue | null,
    meta: { name: string; mimeType?: string } | null
  ) => void;
  disabled?: boolean;
  helperText?: string;
}

/**
 * Selector cross-platform de archivo para adjuntar evidencia de descanso medico.
 * - Web/Electron: usa `<input type="file">` (retorna `File`).
 * - Nativo: usa `expo-document-picker` y arma `AbsenceFileInput`.
 */
export const AbsenceUploadField: React.FC<Props> = ({
  value,
  fileName,
  onChange,
  disabled,
  helperText,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const displayName =
    fileName ??
    (value && 'name' in (value as any) ? (value as any).name : undefined) ??
    (value && typeof File !== 'undefined' && value instanceof File ? value.name : undefined) ??
    null;

  const handlePick = async () => {
    try {
      const res = await getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset: DocumentPickerAsset = res.assets[0];

      if (Platform.OS === 'web' && asset.file) {
        onChange(asset.file, { name: asset.file.name, mimeType: asset.file.type });
        return;
      }

      const info: AbsenceFileInput = {
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? 'application/octet-stream',
      };
      onChange(info, { name: info.name, mimeType: info.mimeType });
    } catch (err) {
      logger.error('AbsenceUploadField.pick', err);
    }
  };

  return (
    <View style={styles.wrapper}>
      <Caption style={styles.label}>Evidencia (PDF o imagen)</Caption>
      {displayName ? (
        <View style={styles.chip}>
          <Ionicons name="document-attach-outline" size={18} color={theme.color.icon.default} />
          <Body style={styles.name} numberOfLines={1}>
            {displayName}
          </Body>
          {!disabled && (
            <TouchableOpacity onPress={() => onChange(null, null)} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={theme.color.icon.subtle} />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <Button
          title="Adjuntar archivo"
          leftIcon="cloud-upload-outline"
          variant="outline"
          size="small"
          disabled={disabled}
          onPress={handlePick}
        />
      )}
      {helperText ? <Caption>{helperText}</Caption> : null}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrapper: { gap: spacing[1] },
    label: { fontWeight: '600' },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      padding: spacing[2],
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.surface.subtle,
    },
    name: { flex: 1 },
  });

export default AbsenceUploadField;
