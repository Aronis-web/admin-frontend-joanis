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
import { ProductSearchAutocomplete } from '@/components/Products/ProductSearchAutocomplete';
import { FormDatePicker } from '@/components/ui/FormDatePicker';
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
  useCreatePromotionPack,
  useDeletePromotionPack,
  usePromotionPackPreview,
  usePromotionPacksList,
  useSetPromotionPackActive,
  useUpdatePromotionPack,
} from '@/hooks/api/usePromotionPacks';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/constants/permissions';
import type { ProductAutocompleteItem } from '@/services/api/products';
import type { AdminPackView, CreatePackBody } from '@/types/promotions';
import Alert from '@/utils/alert';

type Props = NativeStackScreenProps<any, 'PromotionPacks'>;

interface PackRow {
  productId: string;
  sku: string | null;
  name: string;
  quantity: string;
}

interface PackFormState {
  name: string;
  description: string;
  price: string;
  availablePos: boolean;
  availableChatbot: boolean;
  hideUnitsChatbot: boolean;
  isActive: boolean;
  /** YYYY-MM-DD (fecha local) o '' */
  validFrom: string;
  validTo: string;
  rows: PackRow[];
}

const emptyForm: PackFormState = {
  name: '',
  description: '',
  price: '',
  availablePos: true,
  availableChatbot: false,
  hideUnitsChatbot: false,
  isActive: true,
  validFrom: '',
  validTo: '',
  rows: [],
};

const money = (cents: number) => `S/ ${(cents / 100).toFixed(2)}`;

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO del servidor -> YYYY-MM-DD en hora local. */
const isoToLocalDate = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** YYYY-MM-DD local -> ISO al inicio (o fin) del día local. */
const localDateToIso = (date: string, endOfDay: boolean): string | null => {
  if (!date) return null;
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return null;
  const dt = endOfDay ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d, 0, 0, 0, 0);
  return dt.toISOString();
};

const formatLocalDate = (date: string) => {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
};

const vigenciaLabel = (pack: AdminPackView): string | null => {
  const from = isoToLocalDate(pack.validFrom);
  const to = isoToLocalDate(pack.validTo);
  if (!from && !to) return null;
  if (from && to) return `Del ${formatLocalDate(from)} al ${formatLocalDate(to)}`;
  if (from) return `Desde el ${formatLocalDate(from)}`;
  return `Hasta el ${formatLocalDate(to)}`;
};

const errorMessage = (err: any, fallback: string): string => {
  const msg = err?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join('\n');
  if (typeof msg === 'string' && msg) return msg;
  return err?.message ?? fallback;
};

const toForm = (pack: AdminPackView): PackFormState => ({
  name: pack.name,
  description: pack.description ?? '',
  price: (pack.priceCents / 100).toFixed(2),
  availablePos: pack.availablePos,
  availableChatbot: pack.availableChatbot,
  hideUnitsChatbot: pack.hideUnitsChatbot ?? false,
  isActive: pack.isActive,
  validFrom: isoToLocalDate(pack.validFrom),
  validTo: isoToLocalDate(pack.validTo),
  rows: pack.components.map((c) => ({
    productId: c.productId,
    sku: c.sku,
    name: c.name,
    quantity: String(c.quantity),
  })),
});

// Rango amplio para el selector de fechas (por defecto solo permite hasta hoy).
const MIN_DATE = new Date(2020, 0, 1);
const MAX_DATE = new Date(new Date().getFullYear() + 5, 11, 31);

export const PromotionPacksScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.PROMOTIONS.PACKS_MANAGE);

  const { data, isLoading, isFetching, isError, refetch } = usePromotionPacksList();
  const packs = useMemo(() => data ?? [], [data]);

  const createMutation = useCreatePromotionPack();
  const updateMutation = useUpdatePromotionPack();
  const activeMutation = useSetPromotionPackActive();
  const deleteMutation = useDeletePromotionPack();

  const [editing, setEditing] = useState<AdminPackView | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<PackFormState>(emptyForm);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const [previewId, setPreviewId] = useState<string | null>(null);
  const preview = usePromotionPackPreview(previewId);

  const isFormOpen = creating || !!editing;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const openCreate = () => {
    setForm(emptyForm);
    setEditing(null);
    setSearchQuery('');
    setCreating(true);
  };

  const openEdit = (pack: AdminPackView) => {
    setForm(toForm(pack));
    setEditing(pack);
    setSearchQuery('');
    setCreating(false);
  };

  const closeForm = () => {
    if (isSaving) return;
    setCreating(false);
    setEditing(null);
    setForm(emptyForm);
    setSearchQuery('');
  };

  const handleSelectProduct = (item: ProductAutocompleteItem) => {
    setSearchFocused(false);
    setSearchQuery('');
    setForm((f) => {
      const existing = f.rows.find((r) => r.productId === item.id);
      if (existing) {
        return {
          ...f,
          rows: f.rows.map((r) =>
            r.productId === item.id
              ? { ...r, quantity: String((parseInt(r.quantity, 10) || 0) + 1) }
              : r
          ),
        };
      }
      return {
        ...f,
        rows: [...f.rows, { productId: item.id, sku: item.sku, name: item.title, quantity: '1' }],
      };
    });
  };

  const setRowQuantity = (productId: string, quantity: string) => {
    setForm((f) => ({
      ...f,
      rows: f.rows.map((r) =>
        r.productId === productId ? { ...r, quantity: quantity.replace(/[^0-9]/g, '') } : r
      ),
    }));
  };

  const removeRow = (productId: string) => {
    setForm((f) => ({ ...f, rows: f.rows.filter((r) => r.productId !== productId) }));
  };

  const handleSave = () => {
    if (createMutation.isPending || updateMutation.isPending) return;

    const name = form.name.trim();
    if (!name) {
      Alert.alert('Falta el nombre', 'Escribe un nombre para el pack.');
      return;
    }
    const priceNumber = Number(form.price.replace(',', '.'));
    const priceCents = Math.round(priceNumber * 100);
    if (!Number.isFinite(priceNumber) || priceCents <= 0) {
      Alert.alert('Precio inválido', 'El precio del pack debe ser mayor a 0.');
      return;
    }
    if (!form.availablePos && !form.availableChatbot) {
      Alert.alert('¿Dónde se vende?', 'Marca al menos uno: Caja (POS) o Chatbot.');
      return;
    }
    if (form.rows.length === 0) {
      Alert.alert('Sin productos', 'Agrega al menos un producto al pack.');
      return;
    }
    const items = form.rows.map((r) => ({
      productId: r.productId,
      quantity: parseInt(r.quantity, 10),
    }));
    if (items.some((it) => !Number.isInteger(it.quantity) || it.quantity < 1)) {
      Alert.alert('Cantidad inválida', 'Cada producto debe tener cantidad 1 o más.');
      return;
    }
    const validFrom = localDateToIso(form.validFrom, false);
    const validTo = localDateToIso(form.validTo, true);
    if (validFrom && validTo && validFrom > validTo) {
      Alert.alert('Vigencia inválida', 'La fecha "desde" debe ser antes que "hasta".');
      return;
    }

    const body: CreatePackBody = {
      name,
      description: form.description.trim() || null,
      priceCents,
      availablePos: form.availablePos,
      availableChatbot: form.availableChatbot,
      hideUnitsChatbot: form.availableChatbot && form.hideUnitsChatbot,
      isActive: form.isActive,
      validFrom,
      validTo,
      items,
    };

    const onSuccess = () => {
      setCreating(false);
      setEditing(null);
      setForm(emptyForm);
      setSearchQuery('');
    };

    if (editing) {
      updateMutation.mutate(
        { id: editing.id, body },
        {
          onSuccess,
          onError: (err: any) => Alert.alert('Error', errorMessage(err, 'No se pudo guardar')),
        }
      );
    } else {
      createMutation.mutate(body, {
        onSuccess,
        onError: (err: any) => Alert.alert('Error', errorMessage(err, 'No se pudo crear')),
      });
    }
  };

  const handleToggleActive = (pack: AdminPackView) => {
    if (activeMutation.isPending) return;
    activeMutation.mutate(
      { id: pack.id, isActive: !pack.isActive },
      {
        onError: (err: any) =>
          Alert.alert('Error', errorMessage(err, 'No se pudo cambiar el estado')),
      }
    );
  };

  const handleDelete = (pack: AdminPackView) => {
    if (deleteMutation.isPending) return;
    Alert.alert('Eliminar pack', `¿Seguro que quieres eliminar "${pack.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          if (deleteMutation.isPending) return;
          deleteMutation.mutate(pack.id, {
            onError: (err: any) => Alert.alert('Error', errorMessage(err, 'No se pudo eliminar')),
          });
        },
      },
    ]);
  };

  // Precio normal / ahorro en el formulario (solo al editar, con datos de la lista).
  const formPriceCents = Math.round(Number(form.price.replace(',', '.')) * 100);
  const editingReference = editing?.referenceTotalCents ?? null;

  const previewTotal = useMemo(
    () => (preview.data?.lines ?? []).reduce((acc, l) => acc + l.lineTotalCents, 0),
    [preview.data]
  );

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
              <Ionicons name="gift-outline" size={22} color={theme.color.brand.onHeader} />
            </View>
            <Text style={styles.headerTitle}>Packs</Text>
          </View>
          <Text style={styles.headerSubtitle}>
            Varios productos juntos a un precio especial, en caja y/o chatbot
          </Text>
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
              title="Error al cargar los packs"
              description="Reintenta en un momento."
              onRetry={() => refetch()}
            />
          ) : packs.length === 0 ? (
            <EmptyState
              icon="gift-outline"
              title="Sin packs"
              description={canManage ? 'Crea el primero con el botón +.' : 'Aún no hay packs.'}
            />
          ) : (
            <View style={styles.list}>
              {packs.map((pack) => {
                const saving = pack.referenceTotalCents - pack.priceCents;
                const vigencia = vigenciaLabel(pack);
                const summary = pack.components.map((c) => `${c.quantity} × ${c.name}`).join(', ');
                return (
                  <Card key={pack.id} style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Title numberOfLines={2}>{pack.name}</Title>
                        {pack.description ? (
                          <Caption color={theme.color.text.muted} numberOfLines={2}>
                            {pack.description}
                          </Caption>
                        ) : null}
                      </View>
                      <Badge
                        variant={pack.isActive ? 'success' : 'default'}
                        label={pack.isActive ? 'Activo' : 'Pausado'}
                      />
                    </View>

                    <View style={styles.priceRow}>
                      <Text style={styles.price}>{money(pack.priceCents)}</Text>
                      {pack.referenceTotalCents > pack.priceCents ? (
                        <>
                          <Text style={styles.priceStruck}>{money(pack.referenceTotalCents)}</Text>
                          <Caption color={theme.color.brand.accent}>Ahorro {money(saving)}</Caption>
                        </>
                      ) : null}
                    </View>

                    <View style={styles.badgeRow}>
                      {pack.availablePos ? <Badge variant="info" label="Caja" /> : null}
                      {pack.availableChatbot ? <Badge variant="primary" label="Chatbot" /> : null}
                    </View>

                    {vigencia ? <Caption color={theme.color.text.muted}>{vigencia}</Caption> : null}
                    <Caption color={theme.color.text.body} numberOfLines={3}>
                      {summary}
                    </Caption>

                    <View style={styles.itemActions}>
                      <Button
                        title="Ver boleta"
                        variant="ghost"
                        leftIcon="receipt-outline"
                        onPress={() => setPreviewId(pack.id)}
                      />
                      {canManage ? (
                        <>
                          <Button
                            title="Eliminar"
                            variant="ghost"
                            leftIcon="trash-outline"
                            onPress={() => handleDelete(pack)}
                            guardDoubleTap
                            disabled={deleteMutation.isPending}
                          />
                          <Button
                            title={pack.isActive ? 'Pausar' : 'Activar'}
                            variant="outline"
                            leftIcon={pack.isActive ? 'pause-outline' : 'play-outline'}
                            onPress={() => handleToggleActive(pack)}
                            guardDoubleTap
                            loading={
                              activeMutation.isPending && activeMutation.variables?.id === pack.id
                            }
                            disabled={activeMutation.isPending}
                          />
                          <Button
                            title="Editar"
                            variant="outline"
                            leftIcon="create-outline"
                            onPress={() => openEdit(pack)}
                          />
                        </>
                      ) : null}
                    </View>
                  </Card>
                );
              })}
            </View>
          )}
        </ScrollView>

        {canManage ? <FAB icon="add" onPress={openCreate} /> : null}

        {/* Formulario crear / editar */}
        <Modal visible={isFormOpen} transparent animationType="fade" onRequestClose={closeForm}>
          <Pressable style={styles.backdrop} onPress={closeForm}>
            <Pressable style={styles.formCard} onPress={(e) => e.stopPropagation()}>
              <ScrollView
                contentContainerStyle={styles.formContent}
                keyboardShouldPersistTaps="handled"
              >
                <Title>{editing ? 'Editar pack' : 'Nuevo pack'}</Title>

                <Input
                  label="Nombre"
                  value={form.name}
                  onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                  placeholder="Ej. Pack cumpleaños"
                />
                <Input
                  label="Descripción"
                  value={form.description}
                  onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
                  placeholder="Opcional"
                  multiline
                />
                <Input
                  label="Precio del pack (S/)"
                  value={form.price}
                  onChangeText={(v) => setForm((f) => ({ ...f, price: v }))}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                />
                {editingReference != null ? (
                  <Caption color={theme.color.text.muted}>
                    Precio normal {money(editingReference)}
                    {formPriceCents > 0 && editingReference > formPriceCents
                      ? ` · Ahorro ${money(editingReference - formPriceCents)}`
                      : ''}
                  </Caption>
                ) : (
                  <Caption color={theme.color.text.muted}>
                    El precio normal y el ahorro se ven al guardar.
                  </Caption>
                )}

                <Caption color={theme.color.text.muted} style={styles.groupLabel}>
                  Dónde se vende
                </Caption>
                <View style={styles.switchRow}>
                  <Body>Caja (POS)</Body>
                  <Switch
                    value={form.availablePos}
                    onValueChange={(v) => setForm((f) => ({ ...f, availablePos: v }))}
                  />
                </View>
                <View style={styles.switchRow}>
                  <Body>Chatbot</Body>
                  <Switch
                    value={form.availableChatbot}
                    onValueChange={(v) => setForm((f) => ({ ...f, availableChatbot: v }))}
                  />
                </View>
                {form.availableChatbot ? (
                  <View style={styles.switchRow}>
                    <Body>En el chatbot vender solo en pack (no por unidad)</Body>
                    <Switch
                      value={form.hideUnitsChatbot}
                      onValueChange={(v) => setForm((f) => ({ ...f, hideUnitsChatbot: v }))}
                    />
                  </View>
                ) : null}

                <Caption color={theme.color.text.muted} style={styles.groupLabel}>
                  Vigencia (opcional)
                </Caption>
                <View style={styles.dateRow}>
                  <View style={{ flex: 1 }}>
                    <FormDatePicker
                      label="Desde"
                      placeholder="Sin fecha"
                      value={form.validFrom ? `${form.validFrom}T00:00:00` : undefined}
                      onValueChange={(v) => setForm((f) => ({ ...f, validFrom: v }))}
                      minimumDate={MIN_DATE}
                      maximumDate={MAX_DATE}
                    />
                  </View>
                  {form.validFrom ? (
                    <TouchableOpacity
                      onPress={() => setForm((f) => ({ ...f, validFrom: '' }))}
                      style={styles.clearDate}
                    >
                      <Ionicons name="close-circle" size={22} color={theme.color.icon.subtle} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <View style={styles.dateRow}>
                  <View style={{ flex: 1 }}>
                    <FormDatePicker
                      label="Hasta"
                      placeholder="Sin fecha"
                      value={form.validTo ? `${form.validTo}T00:00:00` : undefined}
                      onValueChange={(v) => setForm((f) => ({ ...f, validTo: v }))}
                      minimumDate={MIN_DATE}
                      maximumDate={MAX_DATE}
                    />
                  </View>
                  {form.validTo ? (
                    <TouchableOpacity
                      onPress={() => setForm((f) => ({ ...f, validTo: '' }))}
                      style={styles.clearDate}
                    >
                      <Ionicons name="close-circle" size={22} color={theme.color.icon.subtle} />
                    </TouchableOpacity>
                  ) : null}
                </View>

                <View style={styles.switchRow}>
                  <Body>Activo</Body>
                  <Switch
                    value={form.isActive}
                    onValueChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                  />
                </View>

                <Caption color={theme.color.text.muted} style={styles.groupLabel}>
                  Productos del pack
                </Caption>
                <View>
                  <Input
                    label="Agregar producto"
                    value={searchQuery}
                    onChangeText={(v) => {
                      setSearchQuery(v);
                      setSearchFocused(true);
                    }}
                    onFocus={() => setSearchFocused(true)}
                    placeholder="Nombre, SKU o código de barras…"
                  />
                  <ProductSearchAutocomplete
                    query={searchQuery}
                    visible={searchFocused}
                    onSelect={handleSelectProduct}
                    style={styles.autocomplete}
                  />
                </View>

                {form.rows.length === 0 ? (
                  <Caption color={theme.color.text.muted}>Aún no agregas productos.</Caption>
                ) : (
                  <View style={styles.rowsList}>
                    {form.rows.map((r) => (
                      <View key={r.productId} style={styles.productRow}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Body numberOfLines={2}>{r.name}</Body>
                          {r.sku ? (
                            <Caption color={theme.color.text.muted}>SKU {r.sku}</Caption>
                          ) : null}
                        </View>
                        <View style={styles.qtyBox}>
                          <Input
                            value={r.quantity}
                            onChangeText={(v) => setRowQuantity(r.productId, v)}
                            keyboardType="number-pad"
                            placeholder="1"
                          />
                        </View>
                        <TouchableOpacity
                          onPress={() => removeRow(r.productId)}
                          style={styles.removeBtn}
                          accessibilityLabel="Quitar producto"
                        >
                          <Ionicons
                            name="trash-outline"
                            size={20}
                            color={theme.color.state.danger.text}
                          />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

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
                    guardDoubleTap
                    loading={isSaving}
                    disabled={isSaving}
                  />
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Vista previa de la boleta */}
        <Modal
          visible={!!previewId}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewId(null)}
        >
          <Pressable style={styles.backdrop} onPress={() => setPreviewId(null)}>
            <Pressable style={styles.formCard} onPress={(e) => e.stopPropagation()}>
              <ScrollView contentContainerStyle={styles.formContent}>
                <Title>Así sale en la boleta</Title>
                {preview.isLoading ? (
                  <View style={styles.centerBox}>
                    <ActivityIndicator color={theme.color.brand.accent} />
                  </View>
                ) : preview.isError ? (
                  <Caption color={theme.color.state.danger.text}>
                    {errorMessage(preview.error, 'No se pudo cargar la vista previa')}
                  </Caption>
                ) : preview.data ? (
                  <>
                    <Caption color={theme.color.text.muted}>
                      {preview.data.pack.name} · el precio del pack se reparte entre sus productos.
                    </Caption>
                    <View style={styles.previewHeader}>
                      <Caption style={styles.colQty}>Cant.</Caption>
                      <Caption style={styles.colName}>Producto</Caption>
                      <Caption style={styles.colMoney}>P. unit.</Caption>
                      <Caption style={styles.colMoney}>Total</Caption>
                    </View>
                    {preview.data.lines.map((l, idx) => (
                      <View key={`${l.productId}-${idx}`} style={styles.previewLine}>
                        <Body style={styles.colQty}>{l.quantity}</Body>
                        <Body style={styles.colName} numberOfLines={2}>
                          {l.name}
                        </Body>
                        <Body style={styles.colMoney}>{money(l.unitPriceCents)}</Body>
                        <Body style={styles.colMoney}>{money(l.lineTotalCents)}</Body>
                      </View>
                    ))}
                    <View style={styles.previewTotal}>
                      <Body style={{ fontWeight: '700' }}>Total</Body>
                      <Body style={{ fontWeight: '700' }}>{money(previewTotal)}</Body>
                    </View>
                  </>
                ) : null}
                <View style={styles.formActions}>
                  <Button title="Cerrar" variant="outline" onPress={() => setPreviewId(null)} />
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
      alignItems: 'flex-start',
      gap: spacing[3],
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      flexWrap: 'wrap',
      gap: spacing[2],
    },
    price: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.color.text.body,
    },
    priceStruck: {
      fontSize: 14,
      color: theme.color.text.muted,
      textDecorationLine: 'line-through',
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[2],
    },
    itemActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: spacing[2],
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
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    clearDate: {
      padding: spacing[1],
    },
    autocomplete: {
      marginTop: spacing[2],
    },
    rowsList: {
      gap: spacing[2],
    },
    productRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      paddingVertical: spacing[1],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    qtyBox: {
      width: 72,
    },
    removeBtn: {
      padding: spacing[2],
    },
    formActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing[2],
      marginTop: spacing[2],
    },
    previewHeader: {
      flexDirection: 'row',
      gap: spacing[2],
      paddingBottom: spacing[1],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    previewLine: {
      flexDirection: 'row',
      gap: spacing[2],
      paddingVertical: spacing[1],
    },
    previewTotal: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: spacing[2],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
    },
    colQty: {
      width: 44,
    },
    colName: {
      flex: 1,
    },
    colMoney: {
      width: 80,
      textAlign: 'right',
    },
  });
