/**
 * "Números autorizados" del WhatsApp de consultas: lista + alta.
 *
 * Permiso: `consultas_wa.contactos.gestionar`.
 */

import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button, Caption, Card, Title } from '@/design-system';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { spacing } from '@/design-system/tokens';
import { useConsultasWaContacts, useConsultasWaOptions } from '@/hooks/api/useConsultasWa';

import { ConsultaAddContactForm } from './ConsultaAddContactForm';
import { ConsultaContactRow } from './ConsultaContactRow';
import { getErrorMessage } from './waFormat';

export const ConsultasContactsCard: React.FC = () => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const contactsQuery = useConsultasWaContacts();
  const optionsQuery = useConsultasWaOptions();

  const contacts = useMemo(() => contactsQuery.data ?? [], [contactsQuery.data]);
  const users = optionsQuery.data?.users ?? [];
  const sites = optionsQuery.data?.sites ?? [];
  const registeredUserIds = useMemo(() => new Set(contacts.map((c) => c.userId)), [contacts]);

  return (
    <Card variant="elevated" padding="large" style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="people-outline" size={20} color={theme.color.icon.accent} />
        <Title size="small" style={styles.flex}>
          Números autorizados
        </Title>
        {contactsQuery.isFetching ? (
          <ActivityIndicator size="small" color={theme.color.text.muted} />
        ) : null}
      </View>

      {contactsQuery.isError ? (
        <View style={styles.errorBox}>
          <Caption color={theme.color.text.danger}>
            {getErrorMessage(contactsQuery.error, 'No se pudieron cargar los números.')}
          </Caption>
          <Button
            title="Reintentar"
            variant="ghost"
            size="small"
            onPress={() => void contactsQuery.refetch()}
          />
        </View>
      ) : contacts.length === 0 && !contactsQuery.isLoading ? (
        <Caption color={theme.color.text.muted}>
          Todavía no hay números autorizados para consultar.
        </Caption>
      ) : (
        <View style={styles.list}>
          {contacts.map((c) => (
            <ConsultaContactRow key={c.id} contact={c} sites={sites} />
          ))}
        </View>
      )}

      {optionsQuery.isError ? (
        <Caption color={theme.color.text.danger}>
          {getErrorMessage(optionsQuery.error, 'No se pudieron cargar usuarios y sedes.')}
        </Caption>
      ) : (
        <ConsultaAddContactForm users={users} sites={sites} registeredUserIds={registeredUserIds} />
      )}
    </Card>
  );
};

const createStyles = (_theme: Theme) =>
  StyleSheet.create({
    card: {
      gap: spacing[3],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    flex: {
      flex: 1,
    },
    list: {
      gap: spacing[2],
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
  });

export default ConsultasContactsCard;
