import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { Caption, Card, EmptyState, Title } from '@/design-system';
import type { NavigationProp } from '@/types/navigation';

interface Props {
  navigation: NavigationProp;
  title: string;
  description?: string;
  icon?: React.ComponentProps<typeof EmptyState>['icon'];
}

/**
 * Placeholder de pantallas Payroll (Fase 1).
 * Sera reemplazado por la UI real en las fases 2-5 del plan.
 */
export const PayrollPlaceholderScreen: React.FC<Props> = ({
  navigation,
  title,
  description,
  icon = 'construct-outline',
}) => (
  <SafeAreaView style={styles.safe}>
    <ScreenLayout navigation={navigation}>
      <View style={styles.container}>
        <Title style={styles.title}>{title}</Title>
        <Card style={styles.card}>
          <EmptyState
            icon={icon}
            title="Modulo en construccion"
            description={
              description ??
              'La UI de este modulo se implementara en las proximas fases del plan de Planilla.'
            }
          />
          <Caption style={styles.hint}>
            Los servicios API, hooks React Query, permisos y rutas ya estan registrados. Solo falta
            la interfaz.
          </Caption>
        </Card>
      </View>
    </ScreenLayout>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, padding: 16 },
  title: { marginBottom: 12 },
  card: { padding: 16 },
  hint: { marginTop: 12, textAlign: 'center' },
});
