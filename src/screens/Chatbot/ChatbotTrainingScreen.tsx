import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
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
import type { BadgeVariant } from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { spacing, borderRadius } from '@/design-system/tokens';
import {
  useCreateKnowledge,
  useDeleteKnowledge,
  useDismissCase,
  useEscalateCase,
  useTeachCase,
  useTrainingCases,
  useTrainingKnowledge,
  useUpdateKnowledge,
} from '@/hooks/api/useChatbotTraining';
import type {
  TrainingCase,
  TrainingCaseStatus,
  TrainingCategory,
  TrainingKnowledge,
} from '@/types/chatbot';
import Alert from '@/utils/alert';
import { formatDateTime } from './utils';

type Props = NativeStackScreenProps<any, 'ChatbotTraining'>;

type TabKey = 'CASES' | 'KNOWLEDGE';

const CASE_STATUS_OPTIONS: Array<{ label: string; value: TrainingCaseStatus }> = [
  { label: 'Pendientes', value: 'PENDING' },
  { label: 'Enseñados', value: 'TAUGHT' },
  { label: 'Escalados', value: 'ESCALATED' },
  { label: 'Descartados', value: 'DISMISSED' },
];

const CASE_STATUS_BADGE: Record<TrainingCaseStatus, { variant: BadgeVariant; label: string }> = {
  PENDING: { variant: 'warning', label: 'Pendiente' },
  TAUGHT: { variant: 'success', label: 'Enseñado' },
  ESCALATED: { variant: 'info', label: 'Escalado' },
  DISMISSED: { variant: 'default', label: 'Descartado' },
};

const CATEGORY_LABEL: Record<TrainingCategory, string> = {
  QUEJA: 'Queja',
  RECLAMO: 'Reclamo',
  CONSULTA_PRODUCTO: 'Consulta de producto',
  FUERA_DE_TEMA: 'Fuera de tema',
  NO_SE: 'No sabe',
  OTRO: 'Otro',
};

const CATEGORY_OPTIONS: Array<{ label: string; value: TrainingCategory }> = (
  Object.keys(CATEGORY_LABEL) as TrainingCategory[]
).map((k) => ({ label: CATEGORY_LABEL[k], value: k }));

const parseKeywords = (input: string): string[] =>
  input
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

const joinKeywords = (arr: string[]): string => arr.join(', ');

// ============================================
// Modal · Enseñar caso
// ============================================
interface TeachModalProps {
  visible: boolean;
  onClose: () => void;
  target: TrainingCase | null;
}

const TeachCaseModal: React.FC<TeachModalProps> = ({ visible, onClose, target }) => {
  const styles = useThemedStyles(createStyles);
  const theme = useTheme();
  const teach = useTeachCase();

  const [topic, setTopic] = useState('');
  const [keywords, setKeywords] = useState('');
  const [answer, setAnswer] = useState('');
  const [replyNow, setReplyNow] = useState(true);

  useEffect(() => {
    if (visible && target) {
      const seed = (target.summary ?? target.customerText ?? '').slice(0, 60);
      setTopic(seed);
      setKeywords('');
      setAnswer('');
      setReplyNow(true);
    }
  }, [visible, target]);

  if (!target) return null;

  const disabled =
    topic.trim().length < 2 || answer.trim().length < 2 || parseKeywords(keywords).length === 0;

  const submit = () => {
    if (disabled) return;
    teach.mutate(
      {
        id: target.id,
        body: {
          topic: topic.trim(),
          triggerKeywords: parseKeywords(keywords),
          answer: answer.trim(),
          category: target.category,
          replyNow,
        },
      },
      {
        onSuccess: () => {
          Alert.alert('Listo', 'Se enseñó al bot con este conocimiento.');
          onClose();
        },
        onError: (err: any) =>
          Alert.alert('Error', err?.message ?? 'No se pudo guardar el conocimiento'),
      }
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <Title>Enseñar al bot</Title>
          <Caption color={theme.color.text.muted}>
            Se agregará a la base de conocimiento y responderá al cliente ({target.phone}).
          </Caption>

          <View style={styles.field}>
            <Caption color={theme.color.text.muted}>Tema</Caption>
            <TextInput
              value={topic}
              onChangeText={setTopic}
              placeholder="Ej: Horarios de atención"
              placeholderTextColor={theme.color.text.muted}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Caption color={theme.color.text.muted}>Palabras clave (separadas por coma)</Caption>
            <TextInput
              value={keywords}
              onChangeText={setKeywords}
              placeholder="horario, atención, abren, cierran"
              placeholderTextColor={theme.color.text.muted}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Caption color={theme.color.text.muted}>Respuesta</Caption>
            <TextInput
              value={answer}
              onChangeText={setAnswer}
              multiline
              placeholder="Respuesta que dará el bot ante esta consulta…"
              placeholderTextColor={theme.color.text.muted}
              style={[styles.input, styles.inputMultiline]}
            />
          </View>

          <View style={styles.switchRow}>
            <Body>Responder al cliente ahora</Body>
            <Switch value={replyNow} onValueChange={setReplyNow} />
          </View>

          <View style={styles.modalActions}>
            <Button
              title="Cancelar"
              variant="outline"
              onPress={onClose}
              disabled={teach.isPending}
            />
            <Button
              title={teach.isPending ? 'Guardando…' : 'Enseñar'}
              onPress={submit}
              disabled={disabled || teach.isPending}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ============================================
// Modal · Crear/Editar conocimiento
// ============================================
interface KnowledgeFormState {
  topic: string;
  keywords: string;
  answer: string;
  category: TrainingCategory | null;
  isActive: boolean;
}

const emptyKnowledgeForm: KnowledgeFormState = {
  topic: '',
  keywords: '',
  answer: '',
  category: null,
  isActive: true,
};

interface KnowledgeModalProps {
  visible: boolean;
  editing: TrainingKnowledge | null;
  onClose: () => void;
}

const KnowledgeModal: React.FC<KnowledgeModalProps> = ({ visible, editing, onClose }) => {
  const styles = useThemedStyles(createStyles);
  const theme = useTheme();
  const create = useCreateKnowledge();
  const update = useUpdateKnowledge();
  const isSaving = create.isPending || update.isPending;

  const [form, setForm] = useState<KnowledgeFormState>(emptyKnowledgeForm);

  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setForm({
        topic: editing.topic,
        keywords: joinKeywords(editing.triggerKeywords),
        answer: editing.answer,
        category: editing.category,
        isActive: editing.isActive,
      });
    } else {
      setForm(emptyKnowledgeForm);
    }
  }, [visible, editing]);

  const disabled =
    form.topic.trim().length < 2 ||
    form.answer.trim().length < 2 ||
    parseKeywords(form.keywords).length === 0;

  const submit = () => {
    if (disabled) return;
    const body = {
      topic: form.topic.trim(),
      triggerKeywords: parseKeywords(form.keywords),
      answer: form.answer.trim(),
      category: form.category,
    };
    if (editing) {
      update.mutate(
        { id: editing.id, body: { ...body, isActive: form.isActive } },
        {
          onSuccess: onClose,
          onError: (err: any) => Alert.alert('Error', err?.message ?? 'No se pudo actualizar'),
        }
      );
    } else {
      create.mutate(body, {
        onSuccess: onClose,
        onError: (err: any) => Alert.alert('Error', err?.message ?? 'No se pudo crear'),
      });
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <Title>{editing ? 'Editar conocimiento' : 'Nuevo conocimiento'}</Title>

          <View style={styles.field}>
            <Caption color={theme.color.text.muted}>Tema</Caption>
            <TextInput
              value={form.topic}
              onChangeText={(v) => setForm((s) => ({ ...s, topic: v }))}
              placeholder="Ej: Delivery"
              placeholderTextColor={theme.color.text.muted}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Caption color={theme.color.text.muted}>Palabras clave (coma)</Caption>
            <TextInput
              value={form.keywords}
              onChangeText={(v) => setForm((s) => ({ ...s, keywords: v }))}
              placeholder="delivery, envío, llegar"
              placeholderTextColor={theme.color.text.muted}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Caption color={theme.color.text.muted}>Respuesta</Caption>
            <TextInput
              value={form.answer}
              onChangeText={(v) => setForm((s) => ({ ...s, answer: v }))}
              multiline
              placeholder="Respuesta que dará el bot…"
              placeholderTextColor={theme.color.text.muted}
              style={[styles.input, styles.inputMultiline]}
            />
          </View>

          <View style={styles.field}>
            <Caption color={theme.color.text.muted}>Categoría (opcional)</Caption>
            <ChipGroup
              options={CATEGORY_OPTIONS}
              selected={form.category ? [form.category] : []}
              onChange={(sel) =>
                setForm((s) => ({ ...s, category: (sel[0] as TrainingCategory) ?? null }))
              }
              multiple={false}
            />
          </View>

          {editing && (
            <View style={styles.switchRow}>
              <Body>Activo</Body>
              <Switch
                value={form.isActive}
                onValueChange={(v) => setForm((s) => ({ ...s, isActive: v }))}
              />
            </View>
          )}

          <View style={styles.modalActions}>
            <Button title="Cancelar" variant="outline" onPress={onClose} disabled={isSaving} />
            <Button
              title={isSaving ? 'Guardando…' : editing ? 'Actualizar' : 'Crear'}
              onPress={submit}
              disabled={disabled || isSaving}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ============================================
// Screen principal
// ============================================
export const ChatbotTrainingScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [tab, setTab] = useState<TabKey>('CASES');
  const [caseStatus, setCaseStatus] = useState<TrainingCaseStatus>('PENDING');
  const [includeInactive, setIncludeInactive] = useState(false);

  const [teachTarget, setTeachTarget] = useState<TrainingCase | null>(null);
  const [kbEditing, setKbEditing] = useState<TrainingKnowledge | null>(null);
  const [kbModalOpen, setKbModalOpen] = useState(false);

  const casesQuery = useTrainingCases(
    { status: caseStatus },
    { refetchIntervalMs: caseStatus === 'PENDING' ? 15_000 : undefined }
  );
  const knowledgeQuery = useTrainingKnowledge({ includeInactive });

  const escalate = useEscalateCase();
  const dismiss = useDismissCase();
  const deleteKb = useDeleteKnowledge();

  const cases = casesQuery.data ?? [];
  const knowledge = knowledgeQuery.data ?? [];

  const pendingCount = useMemo(
    () => (caseStatus === 'PENDING' ? cases.length : undefined),
    [cases.length, caseStatus]
  );

  const handleEscalate = (item: TrainingCase) => {
    escalate.mutate(
      { id: item.id, body: {} },
      { onError: (err: any) => Alert.alert('Error', err?.message ?? 'No se pudo escalar') }
    );
  };

  const handleDismiss = (item: TrainingCase) => {
    dismiss.mutate(item.id, {
      onError: (err: any) => Alert.alert('Error', err?.message ?? 'No se pudo descartar'),
    });
  };

  const handleDeleteKnowledge = (item: TrainingKnowledge) => {
    Alert.alert('Eliminar', `¿Eliminar "${item.topic}" de la base de conocimiento?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () =>
          deleteKb.mutate(item.id, {
            onError: (err: any) => Alert.alert('Error', err?.message ?? 'No se pudo eliminar'),
          }),
      },
    ]);
  };

  const openNewKnowledge = () => {
    setKbEditing(null);
    setKbModalOpen(true);
  };

  const openEditKnowledge = (item: TrainingKnowledge) => {
    setKbEditing(item);
    setKbModalOpen(true);
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
                <Ionicons name="school-outline" size={22} color={theme.color.brand.onHeader} />
              </View>
              <Text style={styles.headerTitle}>Entrenamiento</Text>
            </View>
            <Text style={styles.headerSubtitle}>
              Casos escalados y base de conocimiento del bot
            </Text>
          </View>
        </LinearGradient>

        <View style={styles.tabsBar}>
          <Pressable
            style={[styles.tabBtn, tab === 'CASES' && styles.tabBtnActive]}
            onPress={() => setTab('CASES')}
          >
            <Text style={[styles.tabText, tab === 'CASES' && styles.tabTextActive]}>
              Casos {pendingCount != null && pendingCount > 0 ? `(${pendingCount})` : ''}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabBtn, tab === 'KNOWLEDGE' && styles.tabBtnActive]}
            onPress={() => setTab('KNOWLEDGE')}
          >
            <Text style={[styles.tabText, tab === 'KNOWLEDGE' && styles.tabTextActive]}>
              Conocimiento ({knowledge.length})
            </Text>
          </Pressable>
        </View>

        {tab === 'CASES' ? (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={casesQuery.isFetching && !casesQuery.isLoading}
                onRefresh={() => casesQuery.refetch()}
              />
            }
          >
            <ChipGroup
              options={CASE_STATUS_OPTIONS}
              selected={[caseStatus]}
              onChange={(sel) => sel[0] && setCaseStatus(sel[0] as TrainingCaseStatus)}
              multiple={false}
            />

            {casesQuery.isLoading ? (
              <View style={styles.centerBox}>
                <ActivityIndicator color={theme.color.brand.accent} />
              </View>
            ) : casesQuery.isError ? (
              <ErrorState
                title="Error al cargar casos"
                description="Reintenta en un momento."
                onRetry={() => casesQuery.refetch()}
              />
            ) : cases.length === 0 ? (
              <EmptyState
                icon="checkmark-done-outline"
                title="Sin casos"
                description="No hay casos en este estado."
              />
            ) : (
              <View style={styles.list}>
                {cases.map((c) => {
                  const badge = CASE_STATUS_BADGE[c.status];
                  return (
                    <Card key={c.id} style={styles.caseCard}>
                      <View style={styles.caseHeader}>
                        <View style={{ flex: 1 }}>
                          <Body>{CATEGORY_LABEL[c.category] ?? c.category}</Body>
                          <Caption color={theme.color.text.muted}>
                            {c.phone} · {formatDateTime(c.createdAt)}
                          </Caption>
                        </View>
                        <Badge variant={badge.variant} label={badge.label} />
                      </View>

                      {c.customerText ? (
                        <View style={styles.quoteBox}>
                          <Ionicons
                            name="chatbubble-ellipses-outline"
                            size={14}
                            color={theme.color.text.muted}
                          />
                          <Caption color={theme.color.text.body}>{c.customerText}</Caption>
                        </View>
                      ) : null}

                      {c.summary ? (
                        <Caption color={theme.color.text.muted}>{c.summary}</Caption>
                      ) : null}

                      {c.resolutionNote ? (
                        <Caption color={theme.color.text.muted}>Nota: {c.resolutionNote}</Caption>
                      ) : null}

                      {c.status === 'PENDING' && (
                        <View style={styles.actionsRow}>
                          <Button
                            title="Descartar"
                            variant="ghost"
                            onPress={() => handleDismiss(c)}
                            disabled={dismiss.isPending}
                          />
                          <Button
                            title="Escalar"
                            variant="outline"
                            onPress={() => handleEscalate(c)}
                            disabled={escalate.isPending}
                          />
                          <Button title="Enseñar" onPress={() => setTeachTarget(c)} />
                        </View>
                      )}
                    </Card>
                  );
                })}
              </View>
            )}
          </ScrollView>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={knowledgeQuery.isFetching && !knowledgeQuery.isLoading}
                onRefresh={() => knowledgeQuery.refetch()}
              />
            }
          >
            <View style={styles.kbToolbar}>
              <View style={styles.switchRowInline}>
                <Caption color={theme.color.text.muted}>Mostrar inactivos</Caption>
                <Switch value={includeInactive} onValueChange={setIncludeInactive} />
              </View>
              <Button title="Agregar" onPress={openNewKnowledge} />
            </View>

            {knowledgeQuery.isLoading ? (
              <View style={styles.centerBox}>
                <ActivityIndicator color={theme.color.brand.accent} />
              </View>
            ) : knowledgeQuery.isError ? (
              <ErrorState
                title="Error al cargar conocimiento"
                description="Reintenta en un momento."
                onRetry={() => knowledgeQuery.refetch()}
              />
            ) : knowledge.length === 0 ? (
              <EmptyState
                icon="book-outline"
                title="Sin conocimiento"
                description="Aún no hay entradas en la base de conocimiento del bot."
              />
            ) : (
              <View style={styles.list}>
                {knowledge.map((k) => (
                  <Card key={k.id} style={styles.caseCard}>
                    <View style={styles.caseHeader}>
                      <View style={{ flex: 1 }}>
                        <Body>{k.topic}</Body>
                        <Caption color={theme.color.text.muted}>
                          {k.category ? CATEGORY_LABEL[k.category] : 'Sin categoría'} · Hits:{' '}
                          {k.hits}
                        </Caption>
                      </View>
                      <Badge
                        variant={k.isActive ? 'success' : 'default'}
                        label={k.isActive ? 'Activo' : 'Inactivo'}
                      />
                    </View>

                    {k.triggerKeywords.length > 0 && (
                      <View style={styles.kwRow}>
                        {k.triggerKeywords.map((kw) => (
                          <View key={kw} style={styles.kwChip}>
                            <Caption color={theme.color.text.muted}>{kw}</Caption>
                          </View>
                        ))}
                      </View>
                    )}

                    <Caption color={theme.color.text.body}>{k.answer}</Caption>

                    <View style={styles.actionsRow}>
                      <Button
                        title="Eliminar"
                        variant="ghost"
                        onPress={() => handleDeleteKnowledge(k)}
                        disabled={deleteKb.isPending}
                      />
                      <Button
                        title="Editar"
                        variant="outline"
                        onPress={() => openEditKnowledge(k)}
                      />
                    </View>
                  </Card>
                ))}
              </View>
            )}
          </ScrollView>
        )}

        <TeachCaseModal
          visible={!!teachTarget}
          target={teachTarget}
          onClose={() => setTeachTarget(null)}
        />
        <KnowledgeModal
          visible={kbModalOpen}
          editing={kbEditing}
          onClose={() => {
            setKbModalOpen(false);
            setKbEditing(null);
          }}
        />
      </SafeAreaView>
    </ScreenLayout>
  );
};

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
    headerTitleContainer: { flex: 1 },
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
    tabsBar: {
      flexDirection: 'row',
      backgroundColor: theme.color.surface.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.default,
    },
    tabBtn: {
      flex: 1,
      paddingVertical: spacing[3],
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabBtnActive: {
      borderBottomColor: theme.color.brand.accent,
    },
    tabText: {
      color: theme.color.text.muted,
      fontWeight: '600',
      fontSize: 14,
    },
    tabTextActive: {
      color: theme.color.brand.accent,
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
    list: { gap: spacing[3] },
    caseCard: {
      padding: spacing[3],
      gap: spacing[2],
    },
    caseHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing[2],
    },
    quoteBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing[2],
      padding: spacing[2],
      backgroundColor: theme.color.background.subtle,
      borderRadius: borderRadius.md,
    },
    actionsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing[2],
      flexWrap: 'wrap',
    },
    kbToolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing[3],
    },
    switchRowInline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    kwRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[1],
    },
    kwChip: {
      paddingHorizontal: spacing[2],
      paddingVertical: 2,
      backgroundColor: theme.color.background.subtle,
      borderRadius: borderRadius.sm,
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
      maxWidth: 520,
      backgroundColor: theme.color.surface.base,
      borderRadius: borderRadius.xl,
      padding: spacing[5],
      gap: spacing[3],
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing[2],
    },
    field: { gap: spacing[1] },
    input: {
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: borderRadius.md,
      padding: spacing[3],
      color: theme.color.text.body,
    },
    inputMultiline: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
  });
