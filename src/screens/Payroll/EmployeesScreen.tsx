import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  ChipGroup,
  EmptyState,
  ErrorState,
  Input,
  Title,
} from '@/design-system';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { spacing } from '@/design-system/tokens';

import { useDebounce } from '@/hooks/useDebounce';
import { useCreatePayrollEmployee, usePayrollEmployees } from '@/hooks/api/usePayrollEmployment';
import type { EmploymentRecord } from '@/types/payroll';
import { parseDecimal } from '@/types/payroll';
import { formatPen } from '@/utils/payrollFormat';
import { PayrollEmployeeForm } from '@/components/Payroll/PayrollEmployeeForm';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';
import { MAIN_ROUTES } from '@/constants/routes';
import type { RootStackParamList } from '@/types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'PayrollEmployees'>;

type ActiveFilter = 'all' | 'active' | 'inactive';

const FILTERS: { label: string; value: ActiveFilter }[] = [
  { label: 'Todos', value: 'all' },
  { label: 'Activos', value: 'active' },
  { label: 'Inactivos', value: 'inactive' },
];

export const PayrollEmployeesScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('active');
  const [formOpen, setFormOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 300).trim();

  const params = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      isActive: activeFilter === 'all' ? undefined : activeFilter === 'active',
      limit: 50,
      offset: 0,
    }),
    [debouncedSearch, activeFilter]
  );

  const { data, isLoading, isRefetching, isError, error, refetch } = usePayrollEmployees(params);
  const create = useCreatePayrollEmployee();

  const employees = (data ?? []) as EmploymentRecord[];

  const handleOpenDetail = (record: EmploymentRecord) => {
    navigation.navigate(MAIN_ROUTES.PAYROLL_EMPLOYEE_DETAIL, { userId: record.user_id });
  };

  const handleCreate = async (payload: Parameters<typeof create.mutateAsync>[0]) => {
    try {
      await create.mutateAsync(payload);
      setFormOpen(false);
      Alert.alert('Trabajador creado', 'El registro laboral fue creado correctamente.');
    } catch (err: any) {
      logger.error('createPayrollEmployee', err);
      Alert.alert('Error', err?.message ?? 'No se pudo crear el trabajador.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenLayout navigation={navigation as any}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Title>Trabajadores</Title>
            <Button
              title="Nuevo"
              leftIcon="add-outline"
              size="small"
              onPress={() => setFormOpen(true)}
            />
          </View>

          <Input
            placeholder="Buscar por nombre o codigo"
            value={search}
            onChangeText={setSearch}
            leftIcon="search-outline"
            size="small"
          />

          <ChipGroup
            options={FILTERS}
            selected={[activeFilter]}
            onChange={(sel) => setActiveFilter((sel[0] as ActiveFilter) ?? 'active')}
            variant="filled"
            size="small"
          />

          {isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={theme.color.brand.accent} />
            </View>
          ) : isError ? (
            <ErrorState
              title="No se pudo cargar la lista"
              description={(error as any)?.message ?? 'Verifica tu conexion.'}
              onRetry={() => refetch()}
            />
          ) : employees.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title="Sin trabajadores"
              description="Agrega el primer registro laboral para empezar."
            />
          ) : (
            <FlatList
              data={employees}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              refreshControl={
                <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />
              }
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => handleOpenDetail(item)} activeOpacity={0.7}>
                  <Card style={styles.card}>
                    <View style={styles.rowBetween}>
                      <View style={{ flex: 1 }}>
                        <Body style={styles.name}>{item.full_name ?? item.user_id}</Body>
                        <Caption>
                          {(item.employee_code ?? '—') +
                            (item.position_name ? ` · ${item.position_name}` : '')}
                        </Caption>
                      </View>
                      <Badge
                        variant={item.is_active ? 'success' : 'default'}
                        size="small"
                        label={item.is_active ? 'Activo' : 'Inactivo'}
                      />
                    </View>
                    <View style={styles.metaRow}>
                      <Caption>Sueldo: {formatPen(item.basic_salary)}</Caption>
                      <Caption>
                        {item.pension_system}
                        {item.pension_system === 'AFP' && item.afp_code
                          ? ` · ${item.afp_code}`
                          : ''}
                      </Caption>
                      {parseDecimal(item.movilidad_amount) > 0 && (
                        <Caption>Movilidad: {formatPen(item.movilidad_amount)}</Caption>
                      )}
                    </View>
                  </Card>
                </TouchableOpacity>
              )}
            />
          )}
        </View>

        <Modal
          visible={formOpen}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setFormOpen(false)}
        >
          <SafeAreaView style={styles.safe}>
            <PayrollEmployeeForm
              submitting={create.isPending}
              onSubmit={handleCreate}
              onCancel={() => setFormOpen(false)}
            />
          </SafeAreaView>
        </Modal>
      </ScreenLayout>
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.color.background.canvas },
    container: { flex: 1, padding: spacing[4], gap: spacing[2] },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    list: { paddingVertical: spacing[2], gap: spacing[2] },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    card: { padding: spacing[4], marginBottom: spacing[2], gap: spacing[1] },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing[2],
    },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[4], marginTop: spacing[1] },
    name: { fontWeight: '600' },
  });

export default PayrollEmployeesScreen;
