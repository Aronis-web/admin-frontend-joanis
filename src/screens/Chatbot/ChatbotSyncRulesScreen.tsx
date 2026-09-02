import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
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
  EmptyState,
  ErrorState,
  FAB,
  Input,
  Text,
  Title,
  useTheme,
  useThemedStyles,
} from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { spacing, borderRadius } from '@/design-system/tokens';
import {
  useCreateSyncRule,
  useDeleteSyncRule,
  useRunSyncRule,
  useSyncRulePreview,
  useSyncRules,
  useUpdateSyncRule,
} from '@/hooks/api/useChatbotSync';
import { useSiteWarehouses } from '@/hooks/api/useChatbotCatalog';
import { useTenantStore } from '@/store/tenant';
import type { SyncRule, SyncSummary, UpsertSyncRuleBody } from '@/types/chatbot';
import Alert from '@/utils/alert';

type Props = NativeStackScreenProps<any, 'ChatbotSyncRules'>;

/**
 * Formulario UI. Todos los campos numéricos viven como string para que
 * `Input` los pueda editar cómodamente; se castean al construir el body.
 */
interface RuleFormState {
  warehouseId: string;
  areaId: string;
  name: string;
  isActive: boolean;
  minDaysSinceEntry: string;
  minDaysWithoutMovement: string;
  minStockBase: string;
  maxSellPct: string;
  excludeWithoutPhoto: boolean;
  lowRotationDays: string;
  lowRotationDiscountPct: string;
  promoValidDays: string;
  minMarginFactor: string;
  syncEveryMinutes: string;
}

const emptyForm: RuleFormState = {
  warehouseId: '',
  areaId: '',
  name: '',
  isActive: true,
  minDaysSinceEntry: '',
  minDaysWithoutMovement: '',
  minStockBase: '0',
  maxSellPct: '100',
  excludeWithoutPhoto: false,
  lowRotationDays: '',
  lowRotationDiscountPct: '0',
  promoValidDays: '',
  minMarginFactor: '1',
  syncEveryMinutes: '60',
};

const toForm = (r: SyncRule): RuleFormState => ({
  warehouseId: r.warehouseId,
  areaId: r.areaId ?? '',
  name: r.name,
  isActive: r.isActive,
  minDaysSinceEntry: r.minDaysSinceEntry != null ? String(r.minDaysSinceEntry) : '',
  minDaysWithoutMovement: r.minDaysWithoutMovement != null ? String(r.minDaysWithoutMovement) : '',
  minStockBase: r.minStockBase ?? '0',
  maxSellPct: r.maxSellPct ?? '100',
  excludeWithoutPhoto: r.excludeWithoutPhoto,
  lowRotationDays: r.lowRotationDays != null ? String(r.lowRotationDays) : '',
  lowRotationDiscountPct: r.lowRotationDiscountPct ?? '0',
  promoValidDays: r.promoValidDays != null ? String(r.promoValidDays) : '',
  minMarginFactor: r.minMarginFactor ?? '1',
  syncEveryMinutes: String(r.syncEveryMinutes ?? 60),
});

/** Convierte una string opcional a `number | null` (null si vacía). */
const toNumOrNull = (v: string): number | null => {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

const buildBody = (f: RuleFormState): UpsertSyncRuleBody => ({
  warehouseId: f.warehouseId.trim(),
  areaId: f.areaId.trim() || null,
  name: f.name.trim(),
  isActive: f.isActive,
  minDaysSinceEntry: toNumOrNull(f.minDaysSinceEntry),
  minDaysWithoutMovement: toNumOrNull(f.minDaysWithoutMovement),
  minStockBase: Number(f.minStockBase || '0'),
  maxSellPct: Number(f.maxSellPct || '100'),
  excludeWithoutPhoto: f.excludeWithoutPhoto,
  lowRotationDays: toNumOrNull(f.lowRotationDays),
  lowRotationDiscountPct: Number(f.lowRotationDiscountPct || '0'),
  promoValidDays: toNumOrNull(f.promoValidDays),
  minMarginFactor: Number(f.minMarginFactor || '1'),
  syncEveryMinutes: Math.max(5, Number(f.syncEveryMinutes || '60')),
});

/**
 * Panel de gestión de reglas de sincronización del catálogo del chatbot.
 * Permite crear, editar, previsualizar y ejecutar (dry-run / firme) reglas.
 */
export const ChatbotSyncRulesScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  // Warehouses de la sede activa (mismo patrón que el catálogo).
  const selectedCompany = useTenantStore((s) => s.selectedCompany);
  const selectedSite = useTenantStore((s) => s.selectedSite);
  const { data: siteWarehouses } = useSiteWarehouses(
    selectedCompany?.id ?? null,
    selectedSite?.id ?? null
  );

  const { data, isLoading, isFetching, isError, refetch } = useSyncRules();
  const rules = useMemo(() => data ?? [], [data]);

  const createMutation = useCreateSyncRule();
  const updateMutation = useUpdateSyncRule();
  const deleteMutation = useDeleteSyncRule();
  const runMutation = useRunSyncRule();

  const [editing, setEditing] = useState<SyncRule | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<RuleFormState>(emptyForm);

  // Preview del impacto (bajo demanda, sólo cuando el usuario abre la modal).
  const [previewRuleId, setPreviewRuleId] = useState<string | null>(null);
  const previewQuery = useSyncRulePreview(previewRuleId, !!previewRuleId);

  // Resumen de la última corrida iniciada desde el UI (dryRun o firme).
  const [lastRunSummary, setLastRunSummary] = useState<{
    ruleId: string;
    dryRun: boolean;
    summary: SyncSummary;
  } | null>(null);

  const openCreate = () => {
    setForm(emptyForm);
    setEditing(null);
    setCreating(true);
  };

  const openEdit = (rule: SyncRule) => {
    setForm(toForm(rule));
    setEditing(rule);
    setCreating(false);
  };

  const closeForm = () => {
    setCreating(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.warehouseId.trim()) {
      Alert.alert('Faltan datos', 'Nombre y almacén son obligatorios.');
      return;
    }
    const body = buildBody(form);
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, body },
        {
          onSuccess: () => closeForm(),
          onError: (err: any) => Alert.alert('Error', err?.message ?? 'No se pudo guardar'),
        }
      );
    } else {
      createMutation.mutate(body, {
        onSuccess: () => closeForm(),
        onError: (err: any) => Alert.alert('Error', err?.message ?? 'No se pudo crear'),
      });
    }
  };

  const handleDelete = (rule: SyncRule) => {
    Alert.alert(
      'Eliminar regla',
      `¿Eliminar la regla "${rule.name}"? Las filas RULE dejarán de re-sincronizarse.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () =>
            deleteMutation.mutate(rule.id, {
              onError: (err: any) => Alert.alert('Error', err?.message ?? 'No se pudo eliminar'),
            }),
        },
      ]
    );
  };

  const handleRun = (rule: SyncRule, dryRun: boolean) => {
    runMutation.mutate(
      { id: rule.id, dryRun },
      {
        onSuccess: (summary) => {
          setLastRunSummary({ ruleId: rule.id, dryRun, summary });
        },
        onError: (err: any) => Alert.alert('Error', err?.message ?? 'No se pudo ejecutar la regla'),
      }
    );
  };

  const warehouses = Array.isArray(siteWarehouses) ? siteWarehouses : [];
  const selectedWarehouse = warehouses.find((w) => w.id === form.warehouseId);
  const availableAreas = selectedWarehouse?.areas ?? [];

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isFormOpen = creating || !!editing;

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
                <Ionicons name="sync-outline" size={22} color={theme.color.brand.onHeader} />
              </View>
              <Text style={styles.headerTitle}>Reglas de sincronización</Text>
            </View>
            <Text style={styles.headerSubtitle}>
              Automatiza el catálogo vendible por almacén/área
            </Text>
          </View>
        </LinearGradient>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => refetch()} />
          }
        >
          {isLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={theme.color.brand.accent} />
            </View>
          ) : isError ? (
            <ErrorState
              title="Error al cargar reglas"
              description="Reintenta en un momento."
              onRetry={() => refetch()}
            />
          ) : rules.length === 0 ? (
            <EmptyState
              icon="sync-outline"
              title="Sin reglas"
              description="Crea tu primera regla con el botón + para que el bot arme el catálogo automáticamente."
            />
          ) : (
            <View style={styles.list}>
              {rules.map((rule) => {
                const wh = warehouses.find((w) => w.id === rule.warehouseId);
                const area = rule.areaId ? wh?.areas?.find((a) => a.id === rule.areaId) : null;
                const scopeLabel = wh
                  ? `${wh.name}${area?.name ? ` · ${area.name}` : ''}`
                  : `Almacén ${rule.warehouseId.slice(0, 6)}…`;
                const summary = rule.lastSyncSummary;
                const isRunning = runMutation.isPending && runMutation.variables?.id === rule.id;
                return (
                  <Card key={rule.id} style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Title numberOfLines={1}>{rule.name}</Title>
                        <Caption color={theme.color.text.muted} numberOfLines={1}>
                          {scopeLabel}
                        </Caption>
                      </View>
                      <View style={styles.badgeStack}>
                        <Badge
                          variant={rule.isActive ? 'success' : 'default'}
                          label={rule.isActive ? 'Activa' : 'Pausada'}
                        />
                        <Badge variant="info" label={`Cada ${rule.syncEveryMinutes}m`} />
                      </View>
                    </View>

                    <View style={styles.criteriaGrid}>
                      {rule.minDaysSinceEntry != null && (
                        <Caption color={theme.color.text.muted}>
                          ≥ {rule.minDaysSinceEntry}d desde ingreso
                        </Caption>
                      )}
                      {rule.minDaysWithoutMovement != null && (
                        <Caption color={theme.color.text.muted}>
                          ≥ {rule.minDaysWithoutMovement}d sin movimiento
                        </Caption>
                      )}
                      <Caption color={theme.color.text.muted}>
                        Stock mín: {Number(rule.minStockBase)}
                      </Caption>
                      <Caption color={theme.color.text.muted}>
                        Tope venta: {Number(rule.maxSellPct)}%
                      </Caption>
                      {rule.excludeWithoutPhoto && (
                        <Caption color={theme.color.text.muted}>Requiere foto</Caption>
                      )}
                      {rule.lowRotationDays != null && (
                        <Caption color={theme.color.text.muted}>
                          Baja rot.: {rule.lowRotationDays}d · -
                          {Number(rule.lowRotationDiscountPct)}%
                        </Caption>
                      )}
                      <Caption color={theme.color.text.muted}>
                        Margen mín: x{Number(rule.minMarginFactor).toFixed(2)}
                      </Caption>
                    </View>

                    {summary && (
                      <View style={styles.summaryBox}>
                        <Caption color={theme.color.text.muted}>
                          Última corrida:{' '}
                          {rule.lastSyncedAt ? new Date(rule.lastSyncedAt).toLocaleString() : '—'}
                        </Caption>
                        <Caption color={theme.color.text.body}>
                          + {summary.added} · ~ {summary.updated} · − {summary.deactivated} · promos{' '}
                          {summary.promosUpserted}/{summary.promosDeactivated}
                        </Caption>
                        {summary.errors?.length > 0 && (
                          <Caption color={theme.color.text.danger ?? theme.color.text.body}>
                            {summary.errors.length} error(es)
                          </Caption>
                        )}
                      </View>
                    )}

                    <View style={styles.itemActions}>
                      <Button
                        title="Previsualizar"
                        variant="ghost"
                        leftIcon="eye-outline"
                        onPress={() => setPreviewRuleId(rule.id)}
                      />
                      <Button
                        title="Simular"
                        variant="outline"
                        leftIcon="flash-outline"
                        onPress={() => handleRun(rule, true)}
                        loading={isRunning && runMutation.variables?.dryRun === true}
                      />
                      <Button
                        title="Ejecutar"
                        variant="primary"
                        leftIcon="play-outline"
                        onPress={() => handleRun(rule, false)}
                        loading={isRunning && runMutation.variables?.dryRun !== true}
                      />
                    </View>
                    <View style={styles.itemActions}>
                      <Button
                        title="Eliminar"
                        variant="ghost"
                        leftIcon="trash-outline"
                        onPress={() => handleDelete(rule)}
                      />
                      <Button
                        title="Editar"
                        variant="outline"
                        leftIcon="create-outline"
                        onPress={() => openEdit(rule)}
                      />
                    </View>

                    {lastRunSummary?.ruleId === rule.id && (
                      <Card style={styles.lastRunCard}>
                        <Caption color={theme.color.text.muted}>
                          {lastRunSummary.dryRun ? 'Simulación' : 'Corrida'} — candidatos{' '}
                          {lastRunSummary.summary.candidates}
                        </Caption>
                        <Body>
                          + {lastRunSummary.summary.added} nuevas · ~{' '}
                          {lastRunSummary.summary.updated} actualizadas · −{' '}
                          {lastRunSummary.summary.deactivated} desactivadas
                        </Body>
                        <Caption color={theme.color.text.muted}>
                          Promos: {lastRunSummary.summary.promosUpserted} up /{' '}
                          {lastRunSummary.summary.promosDeactivated} off · Saltadas manuales:{' '}
                          {lastRunSummary.summary.skippedManual}
                        </Caption>
                      </Card>
                    )}
                  </Card>
                );
              })}
            </View>
          )}
        </ScrollView>

        <FAB icon="add" onPress={openCreate} />

        {/* Modal · Formulario de regla */}
        <Modal visible={isFormOpen} transparent animationType="fade" onRequestClose={closeForm}>
          <Pressable style={styles.backdrop} onPress={closeForm}>
            <Pressable style={styles.formCard} onPress={(e) => e.stopPropagation()}>
              <ScrollView
                contentContainerStyle={styles.formContent}
                keyboardShouldPersistTaps="handled"
              >
                <Title>{editing ? 'Editar regla' : 'Nueva regla'}</Title>
                <Caption color={theme.color.text.muted}>
                  Define almacén/área y los criterios que armarán el catálogo automáticamente.
                </Caption>

                <Input
                  label="Nombre"
                  value={form.name}
                  onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                  placeholder="Ej. Liquidación almacén central"
                />

                {/* Almacén */}
                <Caption color={theme.color.text.muted} style={styles.groupLabel}>
                  Almacén
                </Caption>
                <View style={styles.chipRow}>
                  {warehouses.map((w) => {
                    const active = form.warehouseId === w.id;
                    return (
                      <TouchableOpacity
                        key={w.id}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setForm((f) => ({ ...f, warehouseId: w.id, areaId: '' }))}
                      >
                        <Text
                          style={[styles.chipText, active && styles.chipTextActive]}
                          numberOfLines={1}
                        >
                          {w.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Área */}
                {availableAreas.length > 0 && (
                  <>
                    <Caption color={theme.color.text.muted} style={styles.groupLabel}>
                      Área (opcional)
                    </Caption>
                    <View style={styles.chipRow}>
                      <TouchableOpacity
                        style={[styles.chip, !form.areaId && styles.chipActive]}
                        onPress={() => setForm((f) => ({ ...f, areaId: '' }))}
                      >
                        <Text style={[styles.chipText, !form.areaId && styles.chipTextActive]}>
                          Todas
                        </Text>
                      </TouchableOpacity>
                      {availableAreas.map((a) => {
                        const active = form.areaId === a.id;
                        return (
                          <TouchableOpacity
                            key={a.id}
                            style={[styles.chip, active && styles.chipActive]}
                            onPress={() => setForm((f) => ({ ...f, areaId: a.id }))}
                          >
                            <Text
                              style={[styles.chipText, active && styles.chipTextActive]}
                              numberOfLines={1}
                            >
                              {a.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                )}

                <Caption color={theme.color.text.muted} style={styles.groupLabel}>
                  Filtros de selección
                </Caption>
                <Input
                  label="Días mínimos desde ingreso (opcional)"
                  value={form.minDaysSinceEntry}
                  onChangeText={(v) => setForm((f) => ({ ...f, minDaysSinceEntry: v }))}
                  keyboardType="numeric"
                  placeholder="Ej. 30"
                />
                <Input
                  label="Días mínimos sin movimiento (opcional)"
                  value={form.minDaysWithoutMovement}
                  onChangeText={(v) => setForm((f) => ({ ...f, minDaysWithoutMovement: v }))}
                  keyboardType="numeric"
                  placeholder="Ej. 15"
                />
                <Input
                  label="Stock mínimo (unidad base)"
                  value={form.minStockBase}
                  onChangeText={(v) => setForm((f) => ({ ...f, minStockBase: v }))}
                  keyboardType="numeric"
                />
                <Input
                  label="Tope vendible como % del stock (0-100)"
                  value={form.maxSellPct}
                  onChangeText={(v) => setForm((f) => ({ ...f, maxSellPct: v }))}
                  keyboardType="numeric"
                />
                <View style={styles.switchRow}>
                  <Body>Excluir productos sin foto</Body>
                  <Switch
                    value={form.excludeWithoutPhoto}
                    onValueChange={(v) => setForm((f) => ({ ...f, excludeWithoutPhoto: v }))}
                  />
                </View>

                <Caption color={theme.color.text.muted} style={styles.groupLabel}>
                  Baja rotación y promos
                </Caption>
                <Input
                  label="Días para marcar baja rotación (opcional)"
                  value={form.lowRotationDays}
                  onChangeText={(v) => setForm((f) => ({ ...f, lowRotationDays: v }))}
                  keyboardType="numeric"
                  placeholder="Ej. 45"
                />
                <Input
                  label="Descuento % para baja rotación"
                  value={form.lowRotationDiscountPct}
                  onChangeText={(v) => setForm((f) => ({ ...f, lowRotationDiscountPct: v }))}
                  keyboardType="numeric"
                />
                <Input
                  label="Vigencia de promo (días, opcional)"
                  value={form.promoValidDays}
                  onChangeText={(v) => setForm((f) => ({ ...f, promoValidDays: v }))}
                  keyboardType="numeric"
                  placeholder="Ej. 7"
                />
                <Input
                  label="Factor de margen mínimo (precio ≥ costo × factor)"
                  value={form.minMarginFactor}
                  onChangeText={(v) => setForm((f) => ({ ...f, minMarginFactor: v }))}
                  keyboardType="numeric"
                />

                <Caption color={theme.color.text.muted} style={styles.groupLabel}>
                  Programación
                </Caption>
                <Input
                  label="Frecuencia (minutos, mín. 5)"
                  value={form.syncEveryMinutes}
                  onChangeText={(v) => setForm((f) => ({ ...f, syncEveryMinutes: v }))}
                  keyboardType="numeric"
                />
                <View style={styles.switchRow}>
                  <Body>Regla activa</Body>
                  <Switch
                    value={form.isActive}
                    onValueChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                  />
                </View>

                <View style={styles.formActions}>
                  <Button
                    title="Cancelar"
                    variant="outline"
                    onPress={closeForm}
                    disabled={isSaving}
                  />
                  <Button
                    title={editing ? 'Guardar' : 'Crear'}
                    onPress={handleSave}
                    loading={isSaving}
                  />
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Modal · Preview del impacto */}
        <Modal
          visible={!!previewRuleId}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewRuleId(null)}
        >
          <Pressable style={styles.backdrop} onPress={() => setPreviewRuleId(null)}>
            <Pressable style={styles.formCard} onPress={(e) => e.stopPropagation()}>
              <ScrollView contentContainerStyle={styles.formContent}>
                <Title>Previsualización</Title>
                <Caption color={theme.color.text.muted}>
                  Sólo simula la selección; no escribe nada en la base.
                </Caption>
                {previewQuery.isLoading ? (
                  <View style={styles.centerBox}>
                    <ActivityIndicator color={theme.color.brand.accent} />
                  </View>
                ) : previewQuery.isError ? (
                  <ErrorState
                    title="No se pudo previsualizar"
                    description="Reintenta en un momento."
                    onRetry={() => previewQuery.refetch()}
                  />
                ) : previewQuery.data ? (
                  <>
                    <Body>
                      {previewQuery.data.count} productos calificarían para{' '}
                      <Text style={{ fontWeight: '700' }}>{previewQuery.data.name}</Text>
                    </Body>
                    <View style={{ gap: spacing[2], marginTop: spacing[2] }}>
                      {previewQuery.data.items.slice(0, 50).map((it) => (
                        <View key={it.productId} style={styles.previewRow}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Body numberOfLines={1}>
                              {it.productId.slice(0, 8)}… · stock {it.availableBase}
                            </Body>
                            <Caption color={theme.color.text.muted} numberOfLines={1}>
                              vendible {it.maxSellableQty} ·{' '}
                              {it.daysSinceEntry != null ? `${it.daysSinceEntry}d ingreso · ` : ''}
                              {it.daysWithoutMovement != null
                                ? `${it.daysWithoutMovement}d sin mov.`
                                : 'sin movimiento'}
                            </Caption>
                          </View>
                          <View style={{ alignItems: 'flex-end', gap: spacing[1] }}>
                            <Caption color={theme.color.text.body}>
                              S/ {(it.basePriceCents / 100).toFixed(2)}
                            </Caption>
                            {it.promoPriceCents != null && (
                              <Badge
                                variant="warning"
                                label={`Promo S/ ${(it.promoPriceCents / 100).toFixed(2)}`}
                              />
                            )}
                            {it.isLowRotation && <Badge variant="danger" label="Baja rot." />}
                          </View>
                        </View>
                      ))}
                      {previewQuery.data.items.length > 50 && (
                        <Caption color={theme.color.text.muted}>
                          Mostrando 50 de {previewQuery.data.items.length}
                        </Caption>
                      )}
                    </View>
                  </>
                ) : null}
                <View style={styles.formActions}>
                  <Button title="Cerrar" variant="outline" onPress={() => setPreviewRuleId(null)} />
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
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
    list: {
      gap: spacing[3],
    },
    itemCard: {
      padding: spacing[3],
      gap: spacing[2],
    },
    itemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
    },
    badgeStack: {
      alignItems: 'flex-end',
      gap: spacing[1],
    },
    criteriaGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: spacing[3],
      rowGap: spacing[1],
    },
    summaryBox: {
      backgroundColor: theme.color.surface.subtle,
      borderRadius: borderRadius.md,
      padding: spacing[2],
      gap: 2,
    },
    itemActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing[2],
      flexWrap: 'wrap',
    },
    lastRunCard: {
      padding: spacing[3],
      gap: spacing[1],
      backgroundColor: theme.color.brand.accentSoft,
    },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing[4],
    },
    formCard: {
      width: '100%',
      maxWidth: 560,
      maxHeight: '90%',
      backgroundColor: theme.color.surface.base,
      borderRadius: borderRadius.xl,
    },
    formContent: {
      padding: spacing[5],
      gap: spacing[3],
    },
    groupLabel: {
      marginTop: spacing[2],
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[2],
    },
    chip: {
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.base,
    },
    chipActive: {
      borderColor: theme.color.brand.accent,
      backgroundColor: theme.color.brand.accentSoft,
    },
    chipText: {
      fontSize: 13,
      color: theme.color.text.body,
    },
    chipTextActive: {
      color: theme.color.brand.accent,
      fontWeight: '600',
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    formActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing[2],
      marginTop: spacing[2],
    },
    previewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      paddingVertical: spacing[2],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
  });
