/**
 * "Últimas consultas" (plegable): historial reciente del número de consultas.
 */

import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Badge, Body, Caption, Card, Title } from '@/design-system';
import type { BadgeVariant } from '@/design-system';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { borderRadius, spacing } from '@/design-system/tokens';
import { useConsultasWaQueries } from '@/hooks/api/useConsultasWa';
import type { ConsultaWaQueryStatus } from '@/types/consultas-wa';

import { formatDateTime, formatPhone } from './waFormat';

const STATUS_LABEL: Record<ConsultaWaQueryStatus, string> = {
  RECEIVED: 'Recibida',
  ANSWERED: 'Respondida',
  FAILED: 'Falló',
  IGNORED: 'Ignorada',
  RATE_LIMITED: 'Límite',
};

const STATUS_TONE: Record<ConsultaWaQueryStatus, BadgeVariant> = {
  RECEIVED: 'info',
  ANSWERED: 'success',
  FAILED: 'danger',
  IGNORED: 'default',
  RATE_LIMITED: 'warning',
};

export const ConsultasQueriesList: React.FC = () => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false);
  const queriesQuery = useConsultasWaQueries(30, { enabled: open });
  const items = queriesQuery.data ?? [];

  return (
    <Card variant="outlined" padding="large" style={styles.card}>
      <Pressable style={styles.header} onPress={() => setOpen((v) => !v)}>
        <Ionicons name="chatbubbles-outline" size={20} color={theme.color.icon.accent} />
        <Title size="small" style={styles.flex}>
          Últimas consultas
        </Title>
        {queriesQuery.isFetching ? (
          <ActivityIndicator size="small" color={theme.color.text.muted} />
        ) : null}
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={theme.color.icon.muted}
        />
      </Pressable>

      {open ? (
        queriesQuery.isError ? (
          <Caption color={theme.color.text.danger}>No se pudieron cargar las consultas.</Caption>
        ) : items.length === 0 && !queriesQuery.isLoading ? (
          <Caption color={theme.color.text.muted}>Todavía no hay consultas.</Caption>
        ) : (
          items.map((q) => (
            <View key={q.id} style={styles.item}>
              <View style={styles.itemHeader}>
                <Caption color={theme.color.text.muted}>{formatDateTime(q.createdAt)}</Caption>
                <Body numberOfLines={1} style={[styles.flex, styles.name]}>
                  {q.contactName ?? formatPhone(q.phone)}
                </Body>
                <Badge
                  size="small"
                  variant={STATUS_TONE[q.status]}
                  label={STATUS_LABEL[q.status]}
                />
              </View>
              <Body numberOfLines={3}>{q.question}</Body>
              {q.answer ? (
                <Caption color={theme.color.text.muted} numberOfLines={2}>
                  ↳ {q.answer}
                </Caption>
              ) : null}
            </View>
          ))
        )
      ) : null}
    </Card>
  );
};

const createStyles = (theme: Theme) =>
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
    name: {
      fontWeight: '600',
    },
    item: {
      gap: spacing[1],
      padding: spacing[3],
      borderRadius: borderRadius.md,
      backgroundColor: theme.color.surface.subtle,
    },
    itemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
  });

export default ConsultasQueriesList;
