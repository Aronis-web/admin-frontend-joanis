import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
  useCreateCrateProduct,
  useCrateProductsList,
  useDeleteCrateProduct,
  useUpdateCrateProduct,
} from '@/hooks/api/useChatbotCrate';
import { useProductsByIdsBatch, useSiteWarehouses } from '@/hooks/api/useChatbotCatalog';
import { useBotSettings, useUpdateBotSettings } from '@/hooks/api/useChatbotSettings';
import type { Product, ProductAutocompleteItem } from '@/services/api/products';
import { productsApi } from '@/services/api/products';
import { useTenantStore } from '@/store/tenant';
import type {
  ChatbotCrateProduct,
  UpdateCrateProductBody,
  UpsertCrateProductBody,
} from '@/types/chatbot';
import Alert from '@/utils/alert';
import { formatSolesFromCents } from './utils';

type Props = NativeStackScreenProps<any, 'ChatbotCrate'>;

interface CrateFormState {
  productId: string;
  warehouseId: string;
  presentationId: string;
  maxSellableQty: string;
  priceCents: string;
  label: string;
  sortOrder: string;
  isActive: boolean;
}

const emptyForm: CrateFormState = {
  productId: '',
  warehouseId: '',
  presentationId: '',
  maxSellableQty: '',
  priceCents: '',
  label: '',
  sortOrder: '0',
  isActive: true,
};

const toForm = (item: ChatbotCrateProduct): CrateFormState => ({
  productId: item.productId,
  warehouseId: item.warehouseId,
  presentationId: item.presentationId ?? '',
  maxSellableQty: item.maxSellableQty ?? '',
  priceCents: item.priceCents ?? '',
  label: item.label ?? '',
  sortOrder: String(item.sortOrder ?? 0),
  isActive: item.isActive,
});

const buildBody = (form: CrateFormState): UpsertCrateProductBody => ({
  productId: form.productId.trim(),
  variantId: null,
  warehouseId: form.warehouseId.trim(),
  presentationId: form.presentationId.trim() || null,
  maxSellableQty: Number(form.maxSellableQty || '0'),
  priceCents: Math.trunc(Number(form.priceCents || '0')),
  label: form.label.trim() || null,
  sortOrder: Number(form.sortOrder || '0'),
  isActive: form.isActive,
});

export const ChatbotCrateScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const selectedCompany = useTenantStore((s) => s.selectedCompany);
  const selectedSite = useTenantStore((s) => s.selectedSite);
  const { data: siteWarehouses } = useSiteWarehouses(
    selectedCompany?.id ?? null,
    selectedSite?.id ?? null
  );
  const warehouses = useMemo(
    () => (Array.isArray(siteWarehouses) ? siteWarehouses : []),
    [siteWarehouses]
  );

  // Toggle global "Venta por cajón".
  const settingsQuery = useBotSettings();
  const updateSettings = useUpdateBotSettings();
  const crateMode = settingsQuery.data?.crateMode ?? false;
  const togglingCrateMode = updateSettings.isPending;

  const { data, isLoading, isFetching, isError, refetch } = useCrateProductsList();
  const items = useMemo(() => data ?? [], [data]);

  const listProductIds = useMemo(() => items.map((it) => it.productId), [items]);
  const { data: productsById } = useProductsByIdsBatch(listProductIds);

  const createMutation = useCreateCrateProduct();
  const updateMutation = useUpdateCrateProduct();
  const deleteMutation = useDeleteCrateProduct();

  const [editing, setEditing] = useState<ChatbotCrateProduct | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CrateFormState>(emptyForm);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(false);

  const openCreate = () => {
    setForm(emptyForm);
    setEditing(null);
    setSearchQuery('');
    setSelectedProduct(null);
    setCreating(true);
  };

  const openEdit = (item: ChatbotCrateProduct) => {
    setForm(toForm(item));
    setEditing(item);
    setCreating(false);
    setSearchQuery('');
    setLoadingProduct(true);
    productsApi
      .getProductById(item.productId)
      .then((p) => setSelectedProduct(p ?? null))
      .catch(() => setSelectedProduct(null))
      .finally(() => setLoadingProduct(false));
  };

  const closeForm = () => {
    setCreating(false);
    setEditing(null);
    setForm(emptyForm);
    setSearchQuery('');
    setSelectedProduct(null);
  };

  const handleSelectProduct = async (item: ProductAutocompleteItem) => {
    setSearchFocused(false);
    setSearchQuery(`#${item.correlativeNumber} ${item.sku} — ${item.title}`);
    setLoadingProduct(true);
    try {
      const full = await productsApi.getProductById(item.id);
      setSelectedProduct(full ?? null);
      const defaultPresentation =
        full?.presentations?.find((p) => p.isBase) ?? full?.presentations?.[0] ?? null;
      setForm((f) => ({
        ...f,
        productId: item.id,
        presentationId: defaultPresentation?.presentationId ?? '',
        warehouseId: warehouses[0]?.id ?? '',
        label: item.title,
      }));
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'No se pudo cargar el producto');
    } finally {
      setLoadingProduct(false);
    }
  };

  const handleSave = () => {
    const priceCents = Math.trunc(Number(form.priceCents || '0'));
    if (!form.productId || !form.warehouseId) {
      Alert.alert('Faltan datos', 'Producto y almacén son obligatorios.');
      return;
    }
    if (!Number.isInteger(priceCents) || priceCents <= 0) {
      Alert.alert('Precio inválido', 'El precio debe ser un entero positivo en centavos (> 0).');
      return;
    }
    if (editing) {
      const body: UpdateCrateProductBody = buildBody(form);
      updateMutation.mutate(
        { id: editing.id, body },
        {
          onSuccess: () => closeForm(),
          onError: (err: any) => Alert.alert('Error', err?.message ?? 'No se pudo guardar'),
        }
      );
    } else {
      createMutation.mutate(buildBody(form), {
        onSuccess: () => closeForm(),
        onError: (err: any) => Alert.alert('Error', err?.message ?? 'No se pudo crear'),
      });
    }
  };

  const handleDelete = (item: ChatbotCrateProduct) => {
    Alert.alert('Eliminar producto', '¿Seguro que quieres eliminar este producto del cajón?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () =>
          deleteMutation.mutate(item.id, {
            onError: (err: any) => Alert.alert('Error', err?.message ?? 'No se pudo eliminar'),
          }),
      },
    ]);
  };

  const handleToggleCrateMode = (next: boolean) => {
    updateSettings.mutate(
      { crateMode: next },
      {
        onError: (err: any) =>
          Alert.alert('Error', err?.message ?? 'No se pudo actualizar el modo cajón'),
      }
    );
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isFormOpen = creating || !!editing;
  const presentations = selectedProduct?.presentations ?? [];

  const pricePreview = useMemo(() => {
    const cents = Math.trunc(Number(form.priceCents || '0'));
    return Number.isInteger(cents) && cents > 0 ? formatSolesFromCents(String(cents)) : null;
  }, [form.priceCents]);

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
                <Ionicons name="cube-outline" size={22} color={theme.color.brand.onHeader} />
              </View>
              <Text style={styles.headerTitle}>Venta por cajón</Text>
            </View>
            <Text style={styles.headerSubtitle}>
              Catálogo curado a precio fijo para compartir por WhatsApp
            </Text>
          </View>
          <View style={styles.headerToggle}>
            <Caption color={theme.color.brand.onHeader} style={styles.headerToggleLabel}>
              Modo cajón
            </Caption>
            <Switch
              value={crateMode}
              onValueChange={handleToggleCrateMode}
              disabled={togglingCrateMode}
            />
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
              title="Error al cargar el cajón"
              description="Reintenta en un momento."
              onRetry={() => refetch()}
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon="cube-outline"
              title="Cajón vacío"
              description="Agrega productos al cajón con el botón +."
            />
          ) : (
            <View style={styles.list}>
              {items.map((item) => {
                const product = productsById?.get(item.productId);
                const thumb = product?.photos?.[0] ?? product?.imageUrl;
                const wh = warehouses.find((w) => w.id === item.warehouseId);
                const sourceLabel = wh ? wh.name : `Almacén ${item.warehouseId.slice(0, 6)}…`;
                const presentation = product?.presentations?.find(
                  (p) => p.presentationId === item.presentationId
                );
                const presentationLabel = presentation
                  ? (presentation.presentation?.name ?? 'Presentación')
                  : 'Unidad';
                return (
                  <Card key={item.id} style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      {thumb ? (
                        <Image source={{ uri: thumb }} style={styles.thumb} resizeMode="cover" />
                      ) : (
                        <View style={styles.thumbPlaceholder}>
                          <Ionicons name="cube-outline" size={22} color={theme.color.icon.subtle} />
                        </View>
                      )}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Title numberOfLines={1}>
                          {item.label ?? product?.title ?? '(sin etiqueta)'}
                        </Title>
                        <Caption color={theme.color.text.muted} numberOfLines={1}>
                          {product ? `#${product.correlativeNumber} · SKU ${product.sku}` : ''}
                        </Caption>
                      </View>
                      <Badge
                        variant={item.isActive ? 'success' : 'default'}
                        label={item.isActive ? 'Activo' : 'Inactivo'}
                      />
                    </View>
                    <View style={styles.itemMeta}>
                      <Caption color={theme.color.text.muted}>
                        {formatSolesFromCents(item.priceCents)} · {presentationLabel}
                      </Caption>
                      <Caption color={theme.color.text.muted}>
                        Máx: {item.maxSellableQty} · Origen: {sourceLabel}
                      </Caption>
                    </View>
                    <View style={styles.itemActions}>
                      <Button
                        title="Eliminar"
                        variant="ghost"
                        leftIcon="trash-outline"
                        onPress={() => handleDelete(item)}
                      />
                      <Button
                        title="Editar"
                        variant="outline"
                        leftIcon="create-outline"
                        onPress={() => openEdit(item)}
                      />
                    </View>
                  </Card>
                );
              })}
            </View>
          )}
        </ScrollView>

        <FAB icon="add" onPress={openCreate} />

        <Modal visible={isFormOpen} transparent animationType="fade" onRequestClose={closeForm}>
          <Pressable style={styles.backdrop} onPress={closeForm}>
            <Pressable style={styles.formCard} onPress={(e) => e.stopPropagation()}>
              <ScrollView
                contentContainerStyle={styles.formContent}
                keyboardShouldPersistTaps="handled"
              >
                <Title>{editing ? 'Editar producto' : 'Nuevo producto'}</Title>
                <Caption color={theme.color.text.muted}>
                  Busca un producto y define su precio fijo y almacén de origen.
                </Caption>

                {!editing && (
                  <View>
                    <Input
                      label="Buscar producto"
                      value={searchQuery}
                      onChangeText={(v) => {
                        setSearchQuery(v);
                        setSearchFocused(true);
                        if (selectedProduct) {
                          setSelectedProduct(null);
                          setForm((f) => ({ ...f, productId: '', presentationId: '' }));
                        }
                      }}
                      onFocus={() => setSearchFocused(true)}
                      placeholder="Nombre, SKU, correlativo o código de barras…"
                    />
                    <ProductSearchAutocomplete
                      query={searchQuery}
                      visible={searchFocused && !selectedProduct}
                      onSelect={handleSelectProduct}
                      style={styles.autocomplete}
                    />
                  </View>
                )}

                {loadingProduct && (
                  <View style={styles.centerBox}>
                    <ActivityIndicator color={theme.color.brand.accent} />
                  </View>
                )}

                {selectedProduct && (
                  <Card style={styles.productCard}>
                    <View style={styles.productHeader}>
                      {selectedProduct.photos?.[0] || selectedProduct.imageUrl ? (
                        <Image
                          source={{ uri: selectedProduct.photos?.[0] ?? selectedProduct.imageUrl }}
                          style={styles.thumb}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.thumbPlaceholder}>
                          <Ionicons name="cube-outline" size={22} color={theme.color.icon.subtle} />
                        </View>
                      )}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Body numberOfLines={1}>{selectedProduct.title}</Body>
                        <Caption color={theme.color.text.muted} numberOfLines={1}>
                          #{selectedProduct.correlativeNumber} · SKU {selectedProduct.sku}
                        </Caption>
                      </View>
                    </View>
                  </Card>
                )}

                {selectedProduct && presentations.length > 0 && (
                  <View>
                    <Caption color={theme.color.text.muted} style={styles.groupLabel}>
                      Presentación de venta
                    </Caption>
                    <View style={styles.chipRow}>
                      <TouchableOpacity
                        style={[styles.chip, form.presentationId === '' && styles.chipActive]}
                        onPress={() => setForm((f) => ({ ...f, presentationId: '' }))}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            form.presentationId === '' && styles.chipTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          Unidad
                        </Text>
                      </TouchableOpacity>
                      {presentations.map((p) => {
                        const active = form.presentationId === p.presentationId;
                        return (
                          <TouchableOpacity
                            key={p.presentationId}
                            style={[styles.chip, active && styles.chipActive]}
                            onPress={() =>
                              setForm((f) => ({ ...f, presentationId: p.presentationId }))
                            }
                          >
                            <Text
                              style={[styles.chipText, active && styles.chipTextActive]}
                              numberOfLines={1}
                            >
                              {p.presentation?.name ?? p.presentationId.slice(0, 6)}
                              {p.isBase ? ' · base' : ''}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                <View>
                  <Caption color={theme.color.text.muted} style={styles.groupLabel}>
                    Almacén de origen
                  </Caption>
                  {warehouses.length === 0 ? (
                    <Caption color={theme.color.text.muted}>
                      Sin almacenes en la sede activa.
                    </Caption>
                  ) : (
                    <View style={styles.chipRow}>
                      {warehouses.map((w) => {
                        const active = form.warehouseId === w.id;
                        return (
                          <TouchableOpacity
                            key={w.id}
                            style={[styles.chip, active && styles.chipActive]}
                            onPress={() => setForm((f) => ({ ...f, warehouseId: w.id }))}
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
                  )}
                </View>

                <Input
                  label="Máximo vendible"
                  value={form.maxSellableQty}
                  onChangeText={(v) => setForm((f) => ({ ...f, maxSellableQty: v }))}
                  keyboardType="numeric"
                />
                <Input
                  label="Precio (centavos)"
                  value={form.priceCents}
                  onChangeText={(v) => setForm((f) => ({ ...f, priceCents: v }))}
                  keyboardType="numeric"
                  placeholder="1500"
                />
                {pricePreview ? (
                  <Caption color={theme.color.brand.accent}>Equivale a {pricePreview}</Caption>
                ) : null}
                <Input
                  label="Etiqueta visible"
                  value={form.label}
                  onChangeText={(v) => setForm((f) => ({ ...f, label: v }))}
                  placeholder="Ej. Cajón de manzanas x25"
                />
                <Input
                  label="Orden en listado"
                  value={form.sortOrder}
                  onChangeText={(v) => setForm((f) => ({ ...f, sortOrder: v }))}
                  keyboardType="numeric"
                />

                <View style={styles.switchRow}>
                  <Body>Activo</Body>
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
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
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
    headerToggle: {
      alignItems: 'center',
      gap: spacing[1],
    },
    headerToggleLabel: {
      fontWeight: '600',
      fontSize: 12,
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
    itemMeta: {
      gap: 2,
    },
    itemActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing[2],
    },
    thumb: {
      width: 44,
      height: 44,
      borderRadius: borderRadius.md,
      backgroundColor: theme.color.surface.subtle,
    },
    thumbPlaceholder: {
      width: 44,
      height: 44,
      borderRadius: borderRadius.md,
      backgroundColor: theme.color.surface.subtle,
      alignItems: 'center',
      justifyContent: 'center',
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
      maxWidth: 520,
      maxHeight: '90%',
      backgroundColor: theme.color.surface.base,
      borderRadius: borderRadius.xl,
    },
    formContent: {
      padding: spacing[5],
      gap: spacing[3],
    },
    autocomplete: {
      marginTop: spacing[2],
    },
    productCard: {
      padding: spacing[3],
    },
    productHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
    },
    groupLabel: {
      marginBottom: spacing[2],
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
  });
