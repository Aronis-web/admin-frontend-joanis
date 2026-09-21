import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import {
  Body,
  Button,
  Caption,
  Card,
  EmptyState,
  ErrorState,
  Text,
  Title,
  useTheme,
  useThemedStyles,
} from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { borderRadius, spacing } from '@/design-system/tokens';
import { useChatbotFunnel, useChatbotUsage } from '@/hooks/api/useChatbotMetrics';
import type { ChatbotMetricsParams } from '@/types/chatbot';

type Props = NativeStackScreenProps<any, 'ChatbotMetrics'>;

/** Convierte "camelCase"/"snake_case" a un título legible. */
const humanize = (key: string): string =>
  key
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const formatValue = (v: unknown): string => {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'number') return new Intl.NumberFormat('es-PE').format(v);
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  return String(v);
};

/** Fila simple etiqueta/valor. */
const MetricRow: React.FC<{ label: string; value: unknown; styles: MetricStyles }> = ({
  label,
  value,
  styles,
}) => {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Caption color={theme.color.text.muted} style={styles.rowLabel}>
        {humanize(label)}
      </Caption>
      <Body style={styles.rowValue}>{formatValue(value)}</Body>
    </View>
  );
};

/**
 * Render genérico y defensivo de un objeto de métricas cuyo shape exacto no
 * conocemos: primitivos → filas; arrays de objetos → mini-tablas; objetos
 * anidados → subtarjetas.
 */
const MetricBlock: React.FC<{ data: unknown; styles: MetricStyles }> = ({ data, styles }) => {
  const theme = useTheme();

  if (data === null || data === undefined) {
    return <Caption color={theme.color.text.muted}>Sin datos.</Caption>;
  }

  if (!isRecord(data) && !Array.isArray(data)) {
    return <Body>{formatValue(data)}</Body>;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <Caption color={theme.color.text.muted}>Sin registros.</Caption>;
    }
    return (
      <View style={styles.group}>
        {data.map((item, idx) => (
          <View key={idx} style={styles.subCard}>
            <MetricBlock data={item} styles={styles} />
          </View>
        ))}
      </View>
    );
  }

  const entries = Object.entries(data);
  const primitives = entries.filter(([, v]) => !isRecord(v) && !Array.isArray(v));
  const nested = entries.filter(([, v]) => isRecord(v) || Array.isArray(v));

  return (
    <View style={styles.group}>
      {primitives.length > 0 ? (
        <View style={styles.rowsBox}>
          {primitives.map(([k, v]) => (
            <MetricRow key={k} label={k} value={v} styles={styles} />
          ))}
        </View>
      ) : null}
      {nested.map(([k, v]) => (
        <View key={k} style={styles.subCard}>
          <Caption color={theme.color.text.heading} style={styles.subCardTitle}>
            {humanize(k)}
          </Caption>
          <MetricBlock data={v} styles={styles} />
        </View>
      ))}
    </View>
  );
};

export const ChatbotMetricsScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState<ChatbotMetricsParams>({});

  const funnelQuery = useChatbotFunnel(applied);
  const usageQuery = useChatbotUsage(applied);

  const isLoading = funnelQuery.isLoading || usageQuery.isLoading;
  const isError = funnelQuery.isError || usageQuery.isError;
  const isFetching = funnelQuery.isFetching || usageQuery.isFetching;

  const hasFunnel = useMemo(
    () => funnelQuery.data && Object.keys(funnelQuery.data).length > 0,
    [funnelQuery.data]
  );
  const hasUsage = useMemo(
    () => usageQuery.data && Object.keys(usageQuery.data).length > 0,
    [usageQuery.data]
  );

  const applyRange = () => {
    setApplied({
      ...(from.trim() ? { from: from.trim() } : {}),
      ...(to.trim() ? { to: to.trim() } : {}),
    });
  };

  const clearRange = () => {
    setFrom('');
    setTo('');
    setApplied({});
  };

  const refetchAll = () => {
    funnelQuery.refetch();
    usageQuery.refetch();
  };

  return (
    <ScreenLayout navigation={navigation as any}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <LinearGradient
          colors={[theme.color.brand.headerFrom, theme.color.brand.headerTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerTitleContainer}>
            <View style={styles.headerIconRow}>
              <View style={styles.headerIconContainer}>
                <Ionicons name="bar-chart-outline" size={22} color={theme.color.brand.onHeader} />
              </View>
              <Text style={styles.headerTitle}>Métricas WhatsApp</Text>
            </View>
            <Text style={styles.headerSubtitle}>Embudo de compra y consumo del bot</Text>
          </View>
        </LinearGradient>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetchAll} />
          }
        >
          {/* Filtro de rango */}
          <Card style={styles.filterCard}>
            <Caption color={theme.color.text.heading} style={styles.filterTitle}>
              Rango de fechas
            </Caption>
            <View style={styles.filterRow}>
              <View style={styles.filterField}>
                <Caption color={theme.color.text.muted}>Desde</Caption>
                <TextInput
                  style={styles.input}
                  value={from}
                  onChangeText={setFrom}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor={theme.color.text.muted}
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.filterField}>
                <Caption color={theme.color.text.muted}>Hasta</Caption>
                <TextInput
                  style={styles.input}
                  value={to}
                  onChangeText={setTo}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor={theme.color.text.muted}
                  autoCapitalize="none"
                />
              </View>
            </View>
            <View style={styles.filterActions}>
              <Button title="Limpiar" variant="ghost" onPress={clearRange} />
              <Button title="Aplicar" onPress={applyRange} leftIcon="search-outline" />
            </View>
          </Card>

          {isLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={theme.color.brand.accent} />
            </View>
          ) : isError ? (
            <ErrorState
              title="Error al cargar métricas"
              description="Reintenta en un momento."
              onRetry={refetchAll}
            />
          ) : (
            <>
              {/* Embudo */}
              <Card style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="funnel-outline" size={18} color={theme.color.brand.accent} />
                  <Title>Embudo de compra</Title>
                </View>
                {hasFunnel ? (
                  <MetricBlock data={funnelQuery.data} styles={styles} />
                ) : (
                  <EmptyState
                    icon="funnel-outline"
                    title="Sin datos de embudo"
                    description="No hay métricas para el rango seleccionado."
                  />
                )}
              </Card>

              {/* Uso / tokens */}
              <Card style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Ionicons
                    name="hardware-chip-outline"
                    size={18}
                    color={theme.color.brand.accent}
                  />
                  <Title>Uso del bot</Title>
                </View>
                {hasUsage ? (
                  <MetricBlock data={usageQuery.data} styles={styles} />
                ) : (
                  <EmptyState
                    icon="hardware-chip-outline"
                    title="Sin datos de uso"
                    description="No hay métricas para el rango seleccionado."
                  />
                )}
              </Card>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ScreenLayout>
  );
};

type MetricStyles = ReturnType<typeof createStyles>;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.color.brand.headerFrom,
    },
    headerGradient: {
      paddingHorizontal: spacing[5],
      paddingTop: spacing[4],
      paddingBottom: spacing[5],
    },
    headerTitleContainer: {
      flex: 1,
    },
    headerIconRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing[1],
    },
    headerIconContainer: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.lg,
      backgroundColor: theme.color.brand.headerBadge,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing[3],
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.color.brand.onHeader,
      letterSpacing: 0.3,
    },
    headerSubtitle: {
      fontSize: 13,
      color: theme.color.brand.onHeaderMuted,
      fontWeight: '500',
      marginLeft: 48,
    },
    scrollView: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
    },
    scrollContent: {
      padding: spacing[4],
      paddingBottom: spacing[8],
      gap: spacing[3],
    },
    centerBox: {
      padding: spacing[5],
      alignItems: 'center',
    },
    filterCard: {
      padding: spacing[3],
      gap: spacing[2],
    },
    filterTitle: {
      fontWeight: '600',
    },
    filterRow: {
      flexDirection: 'row',
      gap: spacing[2],
    },
    filterField: {
      flex: 1,
      gap: spacing[1],
    },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border.default,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      backgroundColor: theme.color.surface.base,
      color: theme.color.text.body,
      minHeight: 40,
    },
    filterActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing[2],
    },
    sectionCard: {
      padding: spacing[3],
      gap: spacing[3],
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    group: {
      gap: spacing[2],
    },
    rowsBox: {
      gap: spacing[1],
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing[2],
      paddingVertical: spacing[1],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.color.border.subtle,
    },
    rowLabel: {
      flex: 1,
    },
    rowValue: {
      fontWeight: '600',
      textAlign: 'right',
    },
    subCard: {
      gap: spacing[2],
      padding: spacing[3],
      backgroundColor: theme.color.background.subtle,
      borderRadius: borderRadius.md,
    },
    subCardTitle: {
      fontWeight: '600',
    },
  });
