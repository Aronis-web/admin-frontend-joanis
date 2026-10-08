import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
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
  Badge,
  Body,
  Button,
  Caption,
  Card,
  ChipGroup,
  EmptyState,
  ErrorState,
  Text,
  Title,
  useTheme,
  useThemedStyles,
} from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { spacing, borderRadius } from '@/design-system/tokens';
import {
  useAssignCase,
  useCloseCase,
  useSupportCases,
  useSupportSearch,
} from '@/hooks/api/useChatbotSupport';
import { usePermissions } from '@/hooks/usePermissions';
import type { SupportCase, SupportCaseType, SupportLight } from '@/services/api/chatbot-support';
import Alert from '@/utils/alert';
import { formatDateTime } from './utils';
import { CASE_TYPE_LABEL, formatWait } from './supportUtils';

type Props = NativeStackScreenProps<any, 'ChatbotSupport'>;

const STATUS_OPTIONS = [
  { label: 'Abiertos', value: 'open' },
  { label: 'Cerrados (7 días)', value: 'closed' },
];
const TYPE_OPTIONS = [
  { label: 'Todos', value: 'ALL' },
  ...(Object.keys(CASE_TYPE_LABEL) as SupportCaseType[]).map((t) => ({
    label: CASE_TYPE_LABEL[t],
    value: t,
  })),
];
const ASSIGNEE_OPTIONS = [
  { label: 'Todos', value: 'all' },
  { label: 'Míos', value: 'me' },
  { label: 'Sin asignar', value: 'none' },
];
const LIGHT_VARIANT: Record<SupportLight, 'success' | 'warning' | 'danger'> = {
  VERDE: 'success',
  AMARILLO: 'warning',
  ROJO: 'danger',
};

/**
 * Atencion al cliente: cola de casos (escalados, devoluciones, pedidos vencidos)
 * con semaforo de espera, asignacion y cierre con nota. Desde aqui se abre la
 * ficha del cliente (datos protegidos, compra directa, dinero).
 */
export const ChatbotSupportScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('chatbot.support.manage');
  const [status, setStatus] = useState<'open' | 'closed'>('open');
  const [type, setType] = useState('ALL');
  const [assignee, setAssignee] = useState('all');
  const [q, setQ] = useState('');
  const [closing, setClosing] = useState<SupportCase | null>(null);
  const [note, setNote] = useState('');

  const query = useSupportCases(status, type === 'ALL' ? undefined : type, assignee);
  const search = useSupportSearch(q);
  const assign = useAssignCase();
  const close = useCloseCase();
  const cases = query.data ?? [];

  const counts = useMemo(() => {
    const c = { ROJO: 0, AMARILLO: 0, VERDE: 0 };
    cases.forEach((x) => x.light && (c[x.light] += 1));
    return c;
  }, [cases]);

  const openCard = (conversationId: string, caseId?: string) =>
    navigation.navigate('ChatbotSupportCustomer', { conversationId, caseId });

  const onAssign = (c: SupportCase, release = false) =>
    assign.mutate(
      { caseId: c.id, userId: release ? null : undefined },
      { onError: (e: any) => Alert.alert('Error', e?.message ?? 'No se pudo asignar') }
    );

  const confirmClose = () => {
    if (!closing) return;
    const text = note.trim();
    if (text.length < 3) {
      Alert.alert('Cerrar caso', 'Escribe cómo se resolvió.');
      return;
    }
    close.mutate(
      { caseId: closing.id, note: text },
      {
        onSuccess: () => {
          setClosing(null);
          setNote('');
        },
        onError: (e: any) => Alert.alert('Error', e?.message ?? 'No se pudo cerrar'),
      }
    );
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
          <View style={styles.headerIconRow}>
            <View style={styles.headerIconContainer}>
              <Ionicons name="headset-outline" size={22} color={theme.color.brand.onHeader} />
            </View>
            <Text style={styles.headerTitle}>Atención al cliente</Text>
          </View>
          <Text style={styles.headerSubtitle}>
            Casos por atender · verde menos de 2 h, amarillo menos de 4 h, rojo más
          </Text>
        </LinearGradient>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={query.isFetching && !query.isLoading}
              onRefresh={() => query.refetch()}
            />
          }
        >
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Buscar cliente: nombre, celular, DNI o N.° de pedido"
            placeholderTextColor={theme.color.text.muted}
            style={styles.input}
          />
          {q.trim().length >= 3 ? (
            <Card style={styles.card}>
              <Caption color={theme.color.text.muted}>Resultados</Caption>
              {search.isLoading ? (
                <ActivityIndicator color={theme.color.brand.accent} />
              ) : (search.data ?? []).length === 0 ? (
                <Body>Sin resultados.</Body>
              ) : (
                (search.data ?? []).map((r) => (
                  <Pressable
                    key={r.conversationId}
                    style={styles.resultRow}
                    onPress={() => openCard(r.conversationId)}
                  >
                    <Body style={{ flex: 1 }}>
                      {r.name ?? 'Sin nombre'} · {r.channel}
                      {r.phone ? ` · ${r.phone}` : ''}
                      {r.document ? ` · Doc ${r.document}` : ''}
                    </Body>
                    <Ionicons name="chevron-forward" size={18} color={theme.color.text.muted} />
                  </Pressable>
                ))
              )}
            </Card>
          ) : null}

          <ChipGroup
            options={STATUS_OPTIONS}
            selected={[status]}
            onChange={(sel) => sel[0] && setStatus(sel[0] as 'open' | 'closed')}
            multiple={false}
          />
          <ChipGroup
            options={TYPE_OPTIONS}
            selected={[type]}
            onChange={(sel) => sel[0] && setType(sel[0])}
            multiple={false}
          />
          <ChipGroup
            options={ASSIGNEE_OPTIONS}
            selected={[assignee]}
            onChange={(sel) => sel[0] && setAssignee(sel[0])}
            multiple={false}
          />

          {status === 'open' && cases.length > 0 ? (
            <View style={styles.countsRow}>
              <Badge variant="danger" label={`${counts.ROJO} en rojo`} />
              <Badge variant="warning" label={`${counts.AMARILLO} en amarillo`} />
              <Badge variant="success" label={`${counts.VERDE} en verde`} />
            </View>
          ) : null}

          {query.isLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={theme.color.brand.accent} />
            </View>
          ) : query.isError ? (
            <ErrorState
              title="Error al cargar los casos"
              description="Reintenta en un momento."
              onRetry={() => query.refetch()}
            />
          ) : cases.length === 0 ? (
            <EmptyState
              icon="checkmark-done-outline"
              title="Sin casos"
              description="No hay casos con estos filtros."
            />
          ) : (
            cases.map((c) => (
              <Card key={c.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Body style={{ fontWeight: '700' }}>{c.customerName ?? 'Sin nombre'}</Body>
                    <Caption color={theme.color.text.muted}>
                      {c.channel}
                      {c.phone ? ` · ${c.phone}` : ''} · desde {formatDateTime(c.createdAt)}
                      {c.casesInChat > 1 ? ` · ${c.casesInChat} casos en el chat` : ''}
                    </Caption>
                  </View>
                  <Badge variant="info" label={CASE_TYPE_LABEL[c.type] ?? c.type} />
                  {c.light ? (
                    <Badge variant={LIGHT_VARIANT[c.light]} label={formatWait(c.waitMinutes)} />
                  ) : (
                    <Badge variant="completed" label="Cerrado" />
                  )}
                </View>
                {c.summary ? <Body>{c.summary}</Body> : null}
                {c.customerText ? (
                  <View style={styles.block}>
                    <Caption color={theme.color.text.muted}>La clienta escribió</Caption>
                    <Body numberOfLines={3}>{c.customerText}</Body>
                  </View>
                ) : null}
                {c.resolutionNote ? (
                  <View style={styles.block}>
                    <Caption color={theme.color.text.muted}>
                      Resolución · {formatDateTime(c.resolvedAt)}
                    </Caption>
                    <Body>{c.resolutionNote}</Body>
                  </View>
                ) : null}
                <View style={styles.tagsRow}>
                  {c.tags.map((t) => (
                    <Badge key={t} variant="default" label={t} />
                  ))}
                  {!c.botEnabled ? <Badge variant="warning" label="Bot apagado" /> : null}
                  <Caption color={theme.color.text.muted}>
                    {c.assignedName ? `Asignado a ${c.assignedName}` : 'Sin asignar'}
                  </Caption>
                </View>
                <View style={styles.actionsRow}>
                  <Button
                    title="Ver chat"
                    size="small"
                    variant="ghost"
                    leftIcon="chatbubbles-outline"
                    onPress={() =>
                      navigation.navigate('ChatbotChatDetail', { conversationId: c.conversationId })
                    }
                  />
                  <Button
                    title="Ficha"
                    size="small"
                    variant="outline"
                    leftIcon="person-outline"
                    onPress={() => openCard(c.conversationId, c.id)}
                  />
                  {canManage && status === 'open' ? (
                    <>
                      <Button
                        title={c.assignedTo ? 'Soltar' : 'Tomar'}
                        size="small"
                        variant="outline"
                        leftIcon={c.assignedTo ? 'hand-left-outline' : 'hand-right-outline'}
                        onPress={() => onAssign(c, !!c.assignedTo)}
                        disabled={assign.isPending}
                      />
                      <Button
                        title="Cerrar"
                        size="small"
                        leftIcon="checkmark-circle-outline"
                        onPress={() => {
                          setNote('');
                          setClosing(c);
                        }}
                      />
                    </>
                  ) : null}
                </View>
              </Card>
            ))
          )}
        </ScrollView>

        <Modal
          visible={!!closing}
          transparent
          animationType="fade"
          onRequestClose={() => setClosing(null)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setClosing(null)}>
            <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
              <Title>Cerrar caso de {closing?.customerName ?? 'la clienta'}</Title>
              <Caption color={theme.color.text.muted}>
                Se cierran todos los casos abiertos de este chat con esta nota.
              </Caption>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Cómo se resolvió (cambio, devolución, se le respondió...)"
                placeholderTextColor={theme.color.text.muted}
                multiline
                style={[styles.input, styles.inputMultiline]}
              />
              <View style={styles.actionsRow}>
                <Button title="Cancelar" variant="ghost" onPress={() => setClosing(null)} />
                <Button title="Cerrar caso" onPress={confirmClose} disabled={close.isPending} />
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </ScreenLayout>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.color.brand.headerFrom },
    headerGradient: {
      paddingHorizontal: spacing[5],
      paddingTop: spacing[4],
      paddingBottom: spacing[5],
    },
    headerIconRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing[1] },
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
    scrollView: { flex: 1, backgroundColor: theme.color.background.subtle },
    scrollContent: { padding: spacing[4], paddingBottom: spacing[8], gap: spacing[3] },
    centerBox: { padding: spacing[5], alignItems: 'center' },
    card: { padding: spacing[3], gap: spacing[2] },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
    countsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing[2] },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing[2],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.color.border.default,
    },
    block: {
      gap: spacing[1],
      padding: spacing[2],
      backgroundColor: theme.color.background.subtle,
      borderRadius: borderRadius.md,
    },
    actionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: spacing[2],
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing[4],
    },
    modalCard: {
      width: '100%',
      maxWidth: 560,
      backgroundColor: theme.color.surface.base,
      borderRadius: borderRadius.xl,
      padding: spacing[5],
      gap: spacing[3],
    },
    input: {
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: borderRadius.md,
      padding: spacing[3],
      color: theme.color.text.body,
      backgroundColor: theme.color.surface.base,
    },
    inputMultiline: { minHeight: 110, textAlignVertical: 'top' },
  });
