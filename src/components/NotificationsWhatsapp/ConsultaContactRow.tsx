/**
 * Fila de un número autorizado del WhatsApp de consultas, con sus acciones:
 * Reenviar código, Editar sedes, Desactivar y Reactivar.
 *
 * Cada fila tiene sus propias mutaciones y candados para que un doble clic no
 * dispare la acción dos veces.
 */

import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Badge, Body, Button, Caption, Chip } from '@/design-system';
import type { BadgeVariant } from '@/design-system';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { borderRadius, spacing } from '@/design-system/tokens';
import { PERMISSIONS } from '@/constants/permissions';
import {
  useDisableConsultaWaContact,
  useEnableConsultaWaContact,
  useResendConsultaWaCode,
  useUpdateConsultaWaContact,
} from '@/hooks/api/useConsultasWa';
import { useSingleFlight } from '@/hooks/useSingleFlight';
import type {
  ConsultaWaContact,
  ConsultaWaContactStatus,
  ConsultaWaSiteOption,
} from '@/types/consultas-wa';
import Alert from '@/utils/alert';
import { hasPermissionWithHierarchy } from '@/utils/permissionHierarchy';

import { SiteMultiSelect } from './SiteMultiSelect';
import { formatDateTime, formatPhone, getErrorMessage } from './waFormat';

const STATUS_LABEL: Record<ConsultaWaContactStatus, string> = {
  PENDING: 'Esperando código',
  ACTIVE: 'Activo',
  DISABLED: 'Desactivado',
};

const STATUS_TONE: Record<ConsultaWaContactStatus, BadgeVariant> = {
  PENDING: 'warning',
  ACTIVE: 'success',
  DISABLED: 'default',
};

/** Permisos de gestión que no se muestran como chips. */
const ADMIN_PERMS = new Set<string>([
  PERMISSIONS.CONSULTAS_WA.USAR,
  PERMISSIONS.CONSULTAS_WA.SESION_GESTIONAR,
  PERMISSIONS.CONSULTAS_WA.CONTACTOS_GESTIONAR,
]);

export interface ConsultaContactRowProps {
  contact: ConsultaWaContact;
  sites: ConsultaWaSiteOption[];
}

export const ConsultaContactRow: React.FC<ConsultaContactRowProps> = ({ contact, sites }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const resendMutation = useResendConsultaWaCode();
  const updateMutation = useUpdateConsultaWaContact();
  const disableMutation = useDisableConsultaWaContact();
  const enableMutation = useEnableConsultaWaContact();
  const runResend = useSingleFlight();
  const runUpdate = useSingleFlight();
  const runDisable = useSingleFlight();
  const runEnable = useSingleFlight();

  const [editing, setEditing] = useState(false);
  const [draftSites, setDraftSites] = useState<string[]>(contact.siteIds);

  const busy =
    resendMutation.isPending ||
    updateMutation.isPending ||
    disableMutation.isPending ||
    enableMutation.isPending;

  const canUse = hasPermissionWithHierarchy(contact.permissions, PERMISSIONS.CONSULTAS_WA.USAR);
  const permChips = contact.permissions
    .filter((p) => p.startsWith('consultas_wa.') && !ADMIN_PERMS.has(p))
    .map((p) => p.slice('consultas_wa.'.length));

  const sitesLabel =
    contact.siteIds.length === 0
      ? 'Todas las sedes'
      : contact.sites.map((s) => s.name).join(', ') || `${contact.siteIds.length} sede(s)`;

  const handleResend = () => {
    if (resendMutation.isPending) return;
    void runResend(async () => {
      try {
        await resendMutation.mutateAsync(contact.id);
        Alert.alert(
          'Código reenviado',
          `Se envió un nuevo código a ${formatPhone(contact.phone)}.`
        );
      } catch (err) {
        Alert.alert('Error', getErrorMessage(err, 'No se pudo reenviar el código'));
      }
    });
  };

  const handleSaveSites = () => {
    if (updateMutation.isPending) return;
    void runUpdate(async () => {
      try {
        await updateMutation.mutateAsync({ id: contact.id, dto: { siteIds: draftSites } });
        setEditing(false);
      } catch (err) {
        Alert.alert('Error', getErrorMessage(err, 'No se pudieron guardar las sedes'));
      }
    });
  };

  const handleDisable = () => {
    if (disableMutation.isPending) return;
    Alert.alert(
      'Desactivar número',
      `${contact.userName} (${formatPhone(contact.phone)}) dejará de recibir respuestas del número de consultas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desactivar',
          style: 'destructive',
          onPress: () => {
            void runDisable(async () => {
              try {
                await disableMutation.mutateAsync(contact.id);
              } catch (err) {
                Alert.alert('Error', getErrorMessage(err, 'No se pudo desactivar el número'));
              }
            });
          },
        },
      ]
    );
  };

  const handleEnable = () => {
    if (enableMutation.isPending) return;
    void runEnable(async () => {
      try {
        await enableMutation.mutateAsync(contact.id);
      } catch (err) {
        Alert.alert('Error', getErrorMessage(err, 'No se pudo reactivar el número'));
      }
    });
  };

  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Body style={styles.name}>{contact.userName}</Body>
          <Caption color={theme.color.text.muted}>{formatPhone(contact.phone)}</Caption>
        </View>
        <Badge variant={STATUS_TONE[contact.status]} label={STATUS_LABEL[contact.status]} />
      </View>

      <View style={styles.meta}>
        <Ionicons name="business-outline" size={14} color={theme.color.icon.muted} />
        <Caption color={theme.color.text.muted} style={styles.flex}>
          {sitesLabel}
        </Caption>
      </View>
      <View style={styles.meta}>
        <Ionicons name="time-outline" size={14} color={theme.color.icon.muted} />
        <Caption color={theme.color.text.muted}>
          Última consulta: {formatDateTime(contact.lastQueryAt)}
        </Caption>
      </View>

      {permChips.length > 0 ? (
        <View style={styles.chips}>
          {permChips.map((p) => (
            <Chip key={p} label={p} size="small" variant="outlined" />
          ))}
        </View>
      ) : null}

      {!canUse ? (
        <View style={styles.warning}>
          <Ionicons name="warning-outline" size={14} color={theme.color.icon.warning} />
          <Caption color={theme.color.state.warning.text} style={styles.flex}>
            Sin permiso consultas_wa.usar: no recibirá respuestas
          </Caption>
        </View>
      ) : null}

      {editing ? (
        <View style={styles.editBox}>
          <SiteMultiSelect
            sites={sites}
            value={draftSites}
            onChange={setDraftSites}
            disabled={updateMutation.isPending}
          />
          <View style={styles.actions}>
            <Button
              title="Cancelar"
              variant="ghost"
              size="small"
              onPress={() => setEditing(false)}
              disabled={updateMutation.isPending}
            />
            <Button
              title="Guardar sedes"
              size="small"
              onPress={handleSaveSites}
              loading={updateMutation.isPending}
              disabled={updateMutation.isPending}
            />
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          {contact.status === 'PENDING' ? (
            <Button
              title="Reenviar código"
              variant="outline"
              size="small"
              leftIcon="refresh-outline"
              onPress={handleResend}
              loading={resendMutation.isPending}
              disabled={busy}
            />
          ) : null}
          <Button
            title="Editar sedes"
            variant="ghost"
            size="small"
            leftIcon="business-outline"
            onPress={() => {
              setDraftSites(contact.siteIds);
              setEditing(true);
            }}
            disabled={busy}
          />
          {contact.status === 'DISABLED' ? (
            <Button
              title="Reactivar"
              variant="outline"
              size="small"
              leftIcon="checkmark-circle-outline"
              onPress={handleEnable}
              loading={enableMutation.isPending}
              disabled={busy}
            />
          ) : (
            <Button
              title="Desactivar"
              variant="danger"
              size="small"
              leftIcon="close-circle-outline"
              onPress={handleDisable}
              loading={disableMutation.isPending}
              disabled={busy}
            />
          )}
        </View>
      )}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      gap: spacing[2],
      padding: spacing[3],
      borderRadius: borderRadius.lg,
      backgroundColor: theme.color.surface.subtle,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    flex: {
      flex: 1,
    },
    name: {
      fontWeight: '600',
    },
    meta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[1],
    },
    warning: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
      padding: spacing[2],
      borderRadius: borderRadius.md,
      backgroundColor: theme.color.state.warning.background,
    },
    editBox: {
      gap: spacing[2],
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: spacing[2],
    },
  });

export default ConsultaContactRow;
