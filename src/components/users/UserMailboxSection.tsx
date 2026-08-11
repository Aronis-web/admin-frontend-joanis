import React, { useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { FormTextInput } from '@/components/ui/FormTextInput';
import Alert from '@/utils/alert';
import logger from '@/utils/logger';
import {
  useAdminMailboxStatus,
  useDeactivateMailbox,
  useProvisionMailbox,
} from '@/hooks/api/useWebmail';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/constants/permissions';

interface Props {
  userId: string;
  disabled?: boolean;
}

/**
 * Sección "Correo corporativo" dentro de EditUserModal.
 *
 * Permite al admin (con permiso `webmail.manage`) aprovisionar el buzón
 * de un usuario (contraseña) y desactivarlo. La dirección se deriva del
 * username en backend.
 */
export const UserMailboxSection: React.FC<Props> = ({ userId, disabled }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { hasPermission } = usePermissions();

  const canManage = hasPermission(PERMISSIONS.WEBMAIL.MANAGE);

  const status = useAdminMailboxStatus(userId, canManage);
  const provision = useProvisionMailbox();
  const deactivate = useDeactivateMailbox();

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();

  if (!canManage) {
    return null;
  }

  const isBusy = disabled || provision.isPending || deactivate.isPending;

  const handleProvision = async () => {
    if (!password || password.trim().length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setError(undefined);
    try {
      await provision.mutateAsync({ userId, password: password.trim() });
      setPassword('');
      Alert.alert('Éxito', 'Buzón aprovisionado correctamente.');
    } catch (e: any) {
      logger.error('Provisioning mailbox failed:', e);
      const msg = e?.response?.data?.message || e?.message || 'No se pudo aprovisionar el buzón.';
      Alert.alert('Error', String(msg));
    }
  };

  const handleDeactivate = () => {
    Alert.alert(
      'Desactivar buzón',
      '¿Confirmas que quieres desactivar el buzón de este usuario? No podrá enviar ni recibir correo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desactivar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deactivate.mutateAsync(userId);
              Alert.alert('Buzón desactivado', 'El buzón fue desactivado correctamente.');
            } catch (e: any) {
              logger.error('Deactivate mailbox failed:', e);
              const msg =
                e?.response?.data?.message || e?.message || 'No se pudo desactivar el buzón.';
              Alert.alert('Error', String(msg));
            }
          },
        },
      ]
    );
  };

  const renderBadge = () => {
    if (!status.data) return null;
    if (!status.data.configured) {
      return (
        <View style={[styles.badge, { backgroundColor: theme.color.surface.muted }]}>
          <Text style={styles.badgeText}>No configurado</Text>
        </View>
      );
    }
    if (!status.data.active) {
      return (
        <View style={[styles.badge, { backgroundColor: theme.color.state.warning.background }]}>
          <Text style={[styles.badgeText, { color: theme.color.state.warning.text }]}>
            Inactivo
          </Text>
        </View>
      );
    }
    return (
      <View style={[styles.badge, { backgroundColor: theme.color.state.success.background }]}>
        <Text style={[styles.badgeText, { color: theme.color.state.success.text }]}>Activo</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Correo corporativo</Text>
        {renderBadge()}
      </View>

      {status.isLoading ? (
        <ActivityIndicator size="small" color={theme.color.icon.accent} />
      ) : (
        <>
          {status.data?.emailAddress ? (
            <View style={styles.row}>
              <Text style={styles.label}>Dirección</Text>
              <Text style={styles.value}>{status.data.emailAddress}</Text>
            </View>
          ) : (
            <Text style={styles.hint}>
              La dirección se generará a partir del username al aprovisionar el buzón.
            </Text>
          )}

          <FormTextInput
            label={status.data?.configured ? 'Actualizar contraseña' : 'Contraseña del buzón'}
            placeholder="Mínimo 8 caracteres"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              if (error) setError(undefined);
            }}
            error={error}
            secureTextEntry
            autoCapitalize="none"
            editable={!isBusy}
          />

          <View style={styles.actions}>
            <ActionButton
              label={status.data?.configured ? 'Actualizar contraseña' : 'Aprovisionar buzón'}
              onPress={handleProvision}
              loading={provision.isPending}
              disabled={isBusy}
              theme={theme}
              variant="primary"
            />
            {status.data?.configured && status.data?.active ? (
              <ActionButton
                label="Desactivar buzón"
                onPress={handleDeactivate}
                loading={deactivate.isPending}
                disabled={isBusy}
                theme={theme}
                variant="danger"
              />
            ) : null}
          </View>
        </>
      )}
    </View>
  );
};

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  theme: Theme;
  variant: 'primary' | 'danger';
}

const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  onPress,
  loading,
  disabled,
  theme,
  variant,
}) => {
  const bg =
    variant === 'primary' ? theme.color.brand.primary : theme.color.state.danger.background;
  const fg = variant === 'primary' ? theme.color.text.onAction : theme.color.state.danger.text;

  return (
    <View
      style={{
        opacity: disabled ? 0.6 : 1,
        flex: 1,
      }}
    >
      <Text
        onPress={disabled ? undefined : onPress}
        style={{
          backgroundColor: bg,
          color: fg,
          padding: 12,
          borderRadius: theme.radii.lg,
          textAlign: 'center',
          fontWeight: '600',
          overflow: 'hidden',
        }}
      >
        {loading ? '…' : label}
      </Text>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      marginBottom: theme.space[4],
      padding: theme.space[4],
      borderRadius: theme.radii.xl,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.subtle,
      gap: theme.space[3],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: theme.radii.full,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.body,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    label: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    value: {
      flex: 1,
      color: theme.color.text.body,
    },
    hint: {
      fontSize: 12,
      color: theme.color.text.muted,
      lineHeight: 18,
    },
    actions: {
      flexDirection: 'row',
      gap: theme.space[2],
    },
  });

export default UserMailboxSection;
