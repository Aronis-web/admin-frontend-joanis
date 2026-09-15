import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
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

import { ApprovalStatusChip } from '@/components/Payroll/ApprovalStatusChip';
import {
  useApprovePayroll,
  usePayrollApprovals,
  useRejectPayroll,
} from '@/hooks/api/usePayrollApprovals';
import { useAuthStore } from '@/store/auth';
import type {
  Approval,
  ApprovalDecisionDto,
  ApprovalEntityType,
  ApprovalStatus,
} from '@/types/payroll';
import type { RootStackParamList } from '@/types/navigation';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';

type Props = NativeStackScreenProps<RootStackParamList, 'PayrollApprovals'>;

type EntityFilter = 'ALL' | ApprovalEntityType;
type StatusFilter = 'ALL' | ApprovalStatus;

const ENTITY_TABS: { label: string; value: EntityFilter }[] = [
  { label: 'Todos', value: 'ALL' },
  { label: 'Vacaciones', value: 'VACACION' },
  { label: 'Faltas', value: 'FALTA' },
  { label: 'HH.EE.', value: 'HH_EE' },
  { label: 'Beneficios', value: 'BENEFICIO' },
];

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: 'Pendientes', value: 'PENDIENTE' },
  { label: 'Aprobados', value: 'APROBADO' },
  { label: 'Rechazados', value: 'RECHAZADO' },
  { label: 'Todos', value: 'ALL' },
];

const ENTITY_LABEL: Record<ApprovalEntityType, string> = {
  VACACION: 'Vacaciones',
  FALTA: 'Falta',
  HH_EE: 'HH.EE.',
  BENEFICIO: 'Cambio de beneficio',
};

export const PayrollApprovalsInboxScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const defaultRole = roles[0]?.code ?? '';

  const [entity, setEntity] = useState<EntityFilter>('ALL');
  const [status, setStatus] = useState<StatusFilter>('PENDIENTE');
  const [selected, setSelected] = useState<Approval | null>(null);

  const params = useMemo(
    () => ({
      status: status === 'ALL' ? undefined : status,
      entityType: entity === 'ALL' ? undefined : entity,
    }),
    [status, entity]
  );

  const { data, isLoading, isRefetching, isError, error, refetch } = usePayrollApprovals(params);
  const items = (data ?? []) as Approval[];

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenLayout navigation={navigation as any}>
        <View style={styles.container}>
          <Title>Bandeja de aprobaciones</Title>

          <ChipGroup
            options={ENTITY_TABS}
            selected={[entity]}
            onChange={(sel) => setEntity((sel[0] as EntityFilter) ?? 'ALL')}
            variant="filled"
            size="small"
          />
          <ChipGroup
            options={STATUS_FILTERS}
            selected={[status]}
            onChange={(sel) => setStatus((sel[0] as StatusFilter) ?? 'PENDIENTE')}
            variant="filled"
            size="small"
          />

          {isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={theme.color.brand.accent} />
            </View>
          ) : isError ? (
            <ErrorState
              title="No se pudo cargar la bandeja"
              description={(error as any)?.message}
              onRetry={() => refetch()}
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon="checkmark-done-outline"
              title="Sin pendientes"
              description="No hay solicitudes que revisar con estos filtros."
            />
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              refreshControl={
                <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />
              }
              renderItem={({ item }) => (
                <ApprovalRow
                  item={item}
                  isSelf={!!currentUserId && item.requested_by === currentUserId}
                  onPress={() => setSelected(item)}
                />
              )}
            />
          )}
        </View>

        <Modal
          visible={!!selected}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setSelected(null)}
        >
          <SafeAreaView style={styles.safe}>
            {selected ? (
              <ApprovalDecisionSheet
                approval={selected}
                defaultRole={defaultRole}
                roles={roles.map((r) => r.code)}
                isSelf={!!currentUserId && selected.requested_by === currentUserId}
                onClose={() => setSelected(null)}
              />
            ) : null}
          </SafeAreaView>
        </Modal>
      </ScreenLayout>
    </SafeAreaView>
  );
};

// ---------- Row -----------------------------------------------------------

const ApprovalRow: React.FC<{
  item: Approval;
  isSelf: boolean;
  onPress: () => void;
}> = ({ item, isSelf, onPress }) => {
  const styles = useThemedStyles(createStyles);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.card}>
        <View style={styles.rowBetween}>
          <Body style={styles.title}>{ENTITY_LABEL[item.entity_type]}</Body>
          <ApprovalStatusChip status={item.status} />
        </View>
        <View style={styles.metaRow}>
          <Badge variant="info" size="small" label={item.target_role} />
          {isSelf ? <Badge variant="warning" size="small" label="Propia" /> : null}
        </View>
        <Caption>Solicitado por: {item.requested_by}</Caption>
        <Caption>Creado: {new Date(item.created_at).toLocaleString('es-PE')}</Caption>
        {item.comments ? <Caption>Comentario: {item.comments}</Caption> : null}
        {item.approver_role ? (
          <Caption>
            Decidido por rol {item.approver_role}
            {item.approved_at ? ` · ${new Date(item.approved_at).toLocaleString('es-PE')}` : ''}
          </Caption>
        ) : null}
      </Card>
    </TouchableOpacity>
  );
};

// ---------- Decision sheet -----------------------------------------------

interface DecisionProps {
  approval: Approval;
  defaultRole: string;
  roles: string[];
  isSelf: boolean;
  onClose: () => void;
}

const ApprovalDecisionSheet: React.FC<DecisionProps> = ({
  approval,
  defaultRole,
  roles,
  isSelf,
  onClose,
}) => {
  const styles = useThemedStyles(createStyles);
  const [comments, setComments] = useState('');
  const [approverRole, setApproverRole] = useState(defaultRole);

  const approve = useApprovePayroll();
  const reject = useRejectPayroll();
  const pending = approve.isPending || reject.isPending;
  const isDecided = approval.status !== 'PENDIENTE';
  const canDecide = !isSelf && !isDecided && !!approverRole.trim();

  const dto = (): ApprovalDecisionDto => ({
    approverRole: approverRole.trim(),
    comments: comments.trim() || undefined,
  });

  const handleApprove = async () => {
    if (!canDecide) return;
    try {
      await approve.mutateAsync({ id: approval.id, data: dto() });
      Alert.alert('Aprobado', 'La solicitud fue aprobada.');
      onClose();
    } catch (err: any) {
      logger.error('approvePayroll', err);
      Alert.alert('Error', mapError(err));
    }
  };

  const handleReject = async () => {
    if (!canDecide) return;
    try {
      await reject.mutateAsync({ id: approval.id, data: dto() });
      Alert.alert('Rechazado', 'La solicitud fue rechazada.');
      onClose();
    } catch (err: any) {
      logger.error('rejectPayroll', err);
      Alert.alert('Error', mapError(err));
    }
  };

  const roleOptions =
    roles.length > 0
      ? roles.map((r) => ({ label: r, value: r }))
      : [{ label: defaultRole || '(sin rol)', value: defaultRole }];

  return (
    <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.rowBetween}>
        <Title>{ENTITY_LABEL[approval.entity_type]}</Title>
        <ApprovalStatusChip status={approval.status} />
      </View>

      <Card style={styles.card}>
        <Caption>ID solicitud</Caption>
        <Body>{approval.entity_id}</Body>
        <Caption>Solicitado por</Caption>
        <Body>{approval.requested_by}</Body>
        <Caption>Rol destino</Caption>
        <Body>{approval.target_role}</Body>
        <Caption>Creado</Caption>
        <Body>{new Date(approval.created_at).toLocaleString('es-PE')}</Body>
        {approval.comments ? (
          <>
            <Caption>Notas del solicitante</Caption>
            <Body>{approval.comments}</Body>
          </>
        ) : null}
      </Card>

      {isSelf ? (
        <Card style={styles.warnCard}>
          <Body style={styles.warnText}>
            No puedes aprobar tu propia solicitud (maker-checker).
          </Body>
        </Card>
      ) : null}
      {isDecided ? (
        <Card style={styles.warnCard}>
          <Body style={styles.warnText}>
            Esta solicitud ya esta {approval.status.toLowerCase()}.
          </Body>
        </Card>
      ) : null}

      <Caption style={styles.label}>Rol aprobador *</Caption>
      {roleOptions.length > 1 ? (
        <ChipGroup
          options={roleOptions}
          selected={approverRole ? [approverRole] : []}
          onChange={(sel) => setApproverRole(sel[0] ?? '')}
          variant="filled"
          size="small"
        />
      ) : (
        <Input
          value={approverRole}
          onChangeText={setApproverRole}
          placeholder="RRHH, GERENCIA, ..."
          autoCapitalize="characters"
        />
      )}

      <Input
        label="Comentario"
        value={comments}
        onChangeText={setComments}
        placeholder="Motivo o nota (opcional para aprobar, recomendado al rechazar)"
        multiline
      />

      <View style={styles.actions}>
        <Button title="Cerrar" variant="ghost" onPress={onClose} disabled={pending} />
        <Button
          title="Rechazar"
          variant="outline"
          onPress={handleReject}
          disabled={!canDecide || pending}
          loading={reject.isPending}
        />
        <Button
          title="Aprobar"
          onPress={handleApprove}
          disabled={!canDecide || pending}
          loading={approve.isPending}
        />
      </View>
    </ScrollView>
  );
};

function mapError(err: any): string {
  const status = err?.response?.status ?? err?.status;
  const msg = err?.response?.data?.message ?? err?.message ?? 'Error desconocido';
  if (status === 403) return 'Sin permiso o no puedes aprobar tu propia solicitud.';
  if (status === 404) return 'La solicitud ya no existe.';
  if (status === 409) return 'La solicitud ya fue decidida.';
  return msg;
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.color.background.canvas },
    container: { flex: 1, padding: spacing[4], gap: spacing[2] },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list: { paddingVertical: spacing[2], gap: spacing[2] },
    card: { padding: spacing[3], marginBottom: spacing[2], gap: spacing[1] },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing[2],
    },
    metaRow: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' },
    title: { fontWeight: '600' },
    formContainer: { padding: spacing[4], gap: spacing[2] },
    label: { fontWeight: '600', marginTop: spacing[2] },
    warnCard: {
      padding: spacing[3],
      backgroundColor: theme.color.surface.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    warnText: { color: theme.color.text.heading, fontWeight: '600' },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing[2],
      marginTop: spacing[4],
      flexWrap: 'wrap',
    },
  });

export default PayrollApprovalsInboxScreen;
