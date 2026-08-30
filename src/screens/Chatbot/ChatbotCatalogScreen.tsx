import React, { useEffect, useMemo, useState } from 'react';
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
  useCreateSellableProduct,
  useDeleteSellableProduct,
  useProductsByIdsBatch,
  useSellableProductsList,
  useSiteStock,
  useSiteWarehouses,
  useUpdateSellableProduct,
} from '@/hooks/api/useChatbotCatalog';
import type { Product, ProductAutocompleteItem } from '@/services/api/products';
import { productsApi } from '@/services/api/products';
import type { StockItemResponse } from '@/services/api/inventory';
import { useTenantStore } from '@/store/tenant';
import type {
  CreateSellableProductBody,
  SellableProduct,
  UpdateSellableProductBody,
} from '@/types/chatbot';
import Alert from '@/utils/alert';

type Props = NativeStackScreenProps<any, 'ChatbotCatalog'>;

interface FormState {
  productId: string;
  variantId: string;
  warehouseId: string;
  areaId: string;
  presentationId: string;
  maxSellableQty: string;
  priceProfileId: string;
  priceOverrideCents: string;
  label: string;
  sortOrder: string;
  isActive: boolean;
}

const emptyForm: FormState = {
  productId: '',
  variantId: '',
  warehouseId: '',
  areaId: '',
  presentationId: '',
  maxSellableQty: '',
  priceProfileId: '',
  priceOverrideCents: '',
  label: '',
  sortOrder: '0',
  isActive: true,
};

const toForm = (item: SellableProduct): FormState => ({
  productId: item.productId,
  variantId: item.variantId ?? '',
  warehouseId: item.warehouseId,
  areaId: item.areaId ?? '',
  presentationId: item.presentationId,
  maxSellableQty: item.maxSellableQty ?? '',
  priceProfileId: item.priceProfileId ?? '',
  priceOverrideCents: item.priceOverrideCents ?? '',
  label: item.label ?? '',
  sortOrder: String(item.sortOrder ?? 0),
  isActive: item.isActive,
});

const buildBody = (form: FormState): CreateSellableProductBody => ({
  productId: form.productId.trim(),
  variantId: form.variantId.trim() || null,
  warehouseId: form.warehouseId.trim(),
  areaId: form.areaId.trim() || null,
  presentationId: form.presentationId.trim(),
  maxSellableQty: Number(form.maxSellableQty || '0'),
  priceProfileId: form.priceProfileId.trim() || null,
  priceOverrideCents: form.priceOverrideCents ? Number(form.priceOverrideCents) : null,
  label: form.label.trim() || null,
  sortOrder: Number(form.sortOrder || '0'),
  isActive: form.isActive,
});

/**
 * Fila de stock por (warehouse, area) dentro de la sede activa.
 * areaId puede ser null (stock a nivel de warehouse sin área específica).
 */
interface StockRow {
  warehouseId: string;
  warehouseName: string;
  areaId: string | null;
  areaName: string;
  available: number;
}

/**
 * Deriva las filas de stock disponible para un producto dentro de la sede
 * activa, agrupadas por (warehouse, area). La fuente de verdad es la lista
 * global de stock items de la sede (`inventoryApi.getAllStock`), el mismo
 * patrón que usa Campañas → `AddProductScreen`.
 */
const computeStockRowsForProduct = (
  productId: string | null | undefined,
  siteStock: StockItemResponse[] | undefined
): StockRow[] => {
  if (!productId) return [];
  const list = Array.isArray(siteStock) ? siteStock : [];
  if (list.length === 0) return [];
  const rows = new Map<string, StockRow>();
  list.forEach((si) => {
    if (si.productId !== productId) return;
    const key = `${si.warehouseId}::${si.areaId ?? 'none'}`;
    const available = Number(si.availableQuantityBase ?? si.quantityBase ?? 0);
    const warehouseName = si.warehouse?.name ?? si.warehouseId.slice(0, 6);
    const areaName = si.area?.name ?? (si.areaId ? si.areaId.slice(0, 6) : 'Sin área');
    const prev = rows.get(key);
    if (prev) {
      prev.available += available;
    } else {
      rows.set(key, {
        warehouseId: si.warehouseId,
        warehouseName,
        areaId: si.areaId,
        areaName,
        available,
      });
    }
  });
  return Array.from(rows.values()).sort((a, b) => b.available - a.available);
};

export const ChatbotCatalogScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  // Tenant activo (sede del login) para filtrar stock y bodegas.
  const selectedCompany = useTenantStore((s) => s.selectedCompany);
  const selectedSite = useTenantStore((s) => s.selectedSite);
  const { data: siteWarehouses } = useSiteWarehouses(
    selectedCompany?.id ?? null,
    selectedSite?.id ?? null
  );
  // Stock global de la sede activa (source of truth para computar chips y
  // el preview de stock en el buscador). Un único fetch cacheado 2 min.
  const { data: siteStock } = useSiteStock(selectedSite?.id ?? null);

  // Índice productId → total disponible en la sede (para el dropdown).
  const stockTotalsByProduct = useMemo(() => {
    const map = new Map<string, number>();
    const list = Array.isArray(siteStock) ? siteStock : [];
    list.forEach((si) => {
      const available = Number(si.availableQuantityBase ?? si.quantityBase ?? 0);
      map.set(si.productId, (map.get(si.productId) ?? 0) + available);
    });
    return map;
  }, [siteStock]);

  const { data, isLoading, isFetching, isError, refetch } = useSellableProductsList();
  const items = useMemo(() => data ?? [], [data]);

  // Batch de productos para hidratar la lista con nombre / foto / SKU.
  const listProductIds = useMemo(() => items.map((it) => it.productId), [items]);
  const { data: productsById } = useProductsByIdsBatch(listProductIds);

  const createMutation = useCreateSellableProduct();
  const updateMutation = useUpdateSellableProduct();
  const deleteMutation = useDeleteSellableProduct();

  const [editing, setEditing] = useState<SellableProduct | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  // Estado del buscador dentro del formulario.
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

  const openEdit = (item: SellableProduct) => {
    setForm(toForm(item));
    setEditing(item);
    setCreating(false);
    setSearchQuery('');
    // Hidrata el producto asociado para poder mostrar selects de presentación/almacén.
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

  /**
   * Cuando se elige un item del autocomplete: llama al batch para traer
   * el producto completo (presentaciones, stockItems por sede, salePrices)
   * y pre-completa el formulario con valores sensatos.
   */
  const handleSelectProduct = async (item: ProductAutocompleteItem) => {
    setSearchFocused(false);
    setSearchQuery(`#${item.correlativeNumber} ${item.sku} — ${item.title}`);
    setLoadingProduct(true);
    try {
      // getProductById devuelve la entidad admin con presentaciones + stockItems
      // completos (más rico que el endpoint de batch v2).
      const full = await productsApi.getProductById(item.id);
      setSelectedProduct(full ?? null);

      // Presentación por defecto: la base o la primera.
      const defaultPresentation =
        full?.presentations?.find((p) => p.isBase) ?? full?.presentations?.[0] ?? null;
      // Stock disponible filtrado por la sede activa; se toma la fila con
      // mayor stock disponible como default (warehouse + area).
      const rows = computeStockRowsForProduct(item.id, siteStock);
      const defaultRow = rows[0];
      // Precio sugerido (perfil por defecto de la lista de precios).
      const defaultProfile = item.priceProfiles?.[0];
      const defaultPrice = defaultProfile?.prices?.[0]?.priceCents;

      setForm((f) => ({
        ...f,
        productId: item.id,
        variantId: '',
        presentationId: defaultPresentation?.presentationId ?? '',
        warehouseId: defaultRow?.warehouseId ?? '',
        areaId: defaultRow?.areaId ?? '',
        label: item.title,
        priceProfileId: defaultProfile?.profileId ?? '',
        priceOverrideCents: typeof defaultPrice === 'number' ? String(defaultPrice) : '',
        maxSellableQty: defaultRow ? String(Math.max(0, defaultRow.available)) : '',
      }));
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'No se pudo cargar el producto');
    } finally {
      setLoadingProduct(false);
    }
  };

  const handleSave = () => {
    if (!form.productId || !form.warehouseId || !form.presentationId) {
      Alert.alert('Faltan datos', 'Producto, almacén y presentación son obligatorios.');
      return;
    }
    if (editing) {
      const body: UpdateSellableProductBody = buildBody(form);
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

  const handleDelete = (item: SellableProduct) => {
    Alert.alert('Eliminar entrada', '¿Seguro que quieres eliminar esta entrada del catálogo?', [
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

  const clearSelection = () => {
    setSelectedProduct(null);
    setSearchQuery('');
    setForm((f) => ({
      ...f,
      productId: '',
      variantId: '',
      presentationId: '',
      warehouseId: '',
      areaId: '',
      label: '',
      priceOverrideCents: '',
      priceProfileId: '',
      maxSellableQty: '',
    }));
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isFormOpen = creating || !!editing;

  // Reset del focus del buscador cuando el modal se cierra.
  useEffect(() => {
    if (!isFormOpen) setSearchFocused(false);
  }, [isFormOpen]);

  const stockRows = useMemo(
    () => computeStockRowsForProduct(selectedProduct?.id ?? null, siteStock),
    [selectedProduct, siteStock]
  );
  const siteTotalAvailable = useMemo(
    () => stockRows.reduce((acc, r) => acc + r.available, 0),
    [stockRows]
  );
  const presentations = selectedProduct?.presentations ?? [];
  const selectedStockRow = stockRows.find(
    (r) => r.warehouseId === form.warehouseId && (r.areaId ?? '') === form.areaId
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
          <View style={styles.headerTitleContainer}>
            <View style={styles.headerIconRow}>
              <View style={styles.headerIconContainer}>
                <Ionicons name="pricetags-outline" size={22} color={theme.color.brand.onHeader} />
              </View>
              <Text style={styles.headerTitle}>Catálogo vendible</Text>
            </View>
            <Text style={styles.headerSubtitle}>Whitelist de productos vendibles por WhatsApp</Text>
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
              title="Error al cargar catálogo"
              description="Reintenta en un momento."
              onRetry={() => refetch()}
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon="pricetags-outline"
              title="Sin productos vendibles"
              description="Agrega la primera entrada al whitelist con el botón +."
            />
          ) : (
            <View style={styles.list}>
              {items.map((item) => {
                const product = productsById?.get(item.productId);
                const thumb = product?.photos?.[0] ?? product?.imageUrl;
                const whList = Array.isArray(siteWarehouses) ? siteWarehouses : [];
                const wh = whList.find((w) => w.id === item.warehouseId);
                const area = item.areaId ? wh?.areas?.find((a) => a.id === item.areaId) : null;
                const sourceLabel = wh
                  ? `${wh.name}${area?.name ? ` · ${area.name}` : ''}`
                  : `Bodega ${item.warehouseId.slice(0, 6)}…`;
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
                          {product
                            ? `#${product.correlativeNumber} · SKU ${product.sku}`
                            : `Producto: ${item.productId.slice(0, 8)}…`}
                        </Caption>
                      </View>
                      <Badge
                        variant={item.isActive ? 'success' : 'default'}
                        label={item.isActive ? 'Activo' : 'Inactivo'}
                      />
                    </View>
                    <View style={styles.itemMeta}>
                      <Caption color={theme.color.text.muted}>
                        Vendible desde: {sourceLabel}
                      </Caption>
                      <Caption color={theme.color.text.muted}>
                        Máx: {item.maxSellableQty} · Orden: {item.sortOrder}
                      </Caption>
                      {item.priceOverrideCents ? (
                        <Caption color={theme.color.text.muted}>
                          Precio override: S/ {(Number(item.priceOverrideCents) / 100).toFixed(2)}
                        </Caption>
                      ) : null}
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

        {/* Modal formulario */}
        <Modal visible={isFormOpen} transparent animationType="fade" onRequestClose={closeForm}>
          <Pressable style={styles.backdrop} onPress={closeForm}>
            <Pressable style={styles.formCard} onPress={(e) => e.stopPropagation()}>
              <ScrollView
                contentContainerStyle={styles.formContent}
                keyboardShouldPersistTaps="handled"
              >
                <Title>{editing ? 'Editar entrada' : 'Nueva entrada'}</Title>
                <Caption color={theme.color.text.muted}>
                  Busca un producto y ajusta presentación, almacén y precio.
                </Caption>

                {/* Buscador inteligente */}
                {!editing && (
                  <View>
                    <Input
                      label="Buscar producto"
                      value={searchQuery}
                      onChangeText={(v) => {
                        setSearchQuery(v);
                        setSearchFocused(true);
                        if (selectedProduct) {
                          // Editar el texto invalida la selección previa.
                          clearSelection();
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
                      renderRight={(it) => {
                        const total = stockTotalsByProduct.get(it.id) ?? 0;
                        const color = total > 0 ? theme.color.brand.accent : theme.color.text.muted;
                        return (
                          <Text variant="labelMedium" color={color}>
                            Stock: {total}
                          </Text>
                        );
                      }}
                    />
                  </View>
                )}

                {loadingProduct && (
                  <View style={styles.centerBox}>
                    <ActivityIndicator color={theme.color.brand.accent} />
                  </View>
                )}

                {/* Ficha del producto seleccionado */}
                {selectedProduct && (
                  <Card style={styles.productCard}>
                    <View style={styles.productHeader}>
                      {selectedProduct.photos?.[0] || selectedProduct.imageUrl ? (
                        <Image
                          source={{
                            uri: selectedProduct.photos?.[0] ?? selectedProduct.imageUrl,
                          }}
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
                        {selectedProduct.stock && (
                          <Caption color={theme.color.text.muted}>
                            Stock total: {selectedProduct.stock.available}
                          </Caption>
                        )}
                      </View>
                      {!editing && (
                        <TouchableOpacity onPress={clearSelection}>
                          <Ionicons name="close" size={20} color={theme.color.icon.subtle} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </Card>
                )}

                {/* Selectores derivados del producto */}
                {selectedProduct && presentations.length > 0 && (
                  <View>
                    <Caption color={theme.color.text.muted} style={styles.groupLabel}>
                      Presentación
                    </Caption>
                    <View style={styles.chipRow}>
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

                {selectedProduct && (
                  <View>
                    <View style={styles.stockHeader}>
                      <Caption color={theme.color.text.muted} style={styles.groupLabel}>
                        Stock disponible en {selectedSite?.name ?? 'sede activa'}
                      </Caption>
                      <Caption color={theme.color.text.muted}>Total: {siteTotalAvailable}</Caption>
                    </View>
                    {stockRows.length === 0 ? (
                      <Caption color={theme.color.text.muted}>
                        Sin stock en las bodegas de esta sede.
                      </Caption>
                    ) : (
                      <View style={styles.chipRow}>
                        {stockRows.map((r) => {
                          const active =
                            form.warehouseId === r.warehouseId && (r.areaId ?? '') === form.areaId;
                          return (
                            <TouchableOpacity
                              key={`${r.warehouseId}-${r.areaId ?? 'none'}`}
                              style={[styles.chip, active && styles.chipActive]}
                              onPress={() =>
                                setForm((f) => ({
                                  ...f,
                                  warehouseId: r.warehouseId,
                                  areaId: r.areaId ?? '',
                                  maxSellableQty:
                                    f.maxSellableQty && Number(f.maxSellableQty) > 0
                                      ? f.maxSellableQty
                                      : String(Math.max(0, r.available)),
                                }))
                              }
                            >
                              <Text
                                style={[styles.chipText, active && styles.chipTextActive]}
                                numberOfLines={1}
                              >
                                {r.warehouseName} · {r.areaName} · {r.available}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                    {selectedStockRow && (
                      <Caption color={theme.color.text.muted} style={styles.stockPickedHint}>
                        Vendible desde: {selectedStockRow.warehouseName} ·{' '}
                        {selectedStockRow.areaName} (disp. {selectedStockRow.available})
                      </Caption>
                    )}
                  </View>
                )}

                {/* Fallback si no hay producto (modo edición sin batch resuelto) */}
                {!selectedProduct && editing && (
                  <>
                    <Input
                      label="Producto (UUID)"
                      value={form.productId}
                      onChangeText={(v) => setForm((f) => ({ ...f, productId: v }))}
                    />
                    <Input
                      label="Almacén (UUID)"
                      value={form.warehouseId}
                      onChangeText={(v) => setForm((f) => ({ ...f, warehouseId: v }))}
                    />
                    <Input
                      label="Presentación (UUID)"
                      value={form.presentationId}
                      onChangeText={(v) => setForm((f) => ({ ...f, presentationId: v }))}
                    />
                  </>
                )}

                <Input
                  label="Máximo vendible"
                  value={form.maxSellableQty}
                  onChangeText={(v) => setForm((f) => ({ ...f, maxSellableQty: v }))}
                  keyboardType="numeric"
                />
                <Input
                  label="Precio override (centavos, opcional)"
                  value={form.priceOverrideCents}
                  onChangeText={(v) => setForm((f) => ({ ...f, priceOverrideCents: v }))}
                  keyboardType="numeric"
                />
                <Input
                  label="Etiqueta visible"
                  value={form.label}
                  onChangeText={(v) => setForm((f) => ({ ...f, label: v }))}
                  placeholder="Ej. Gaseosa 500ml (cajón x25)"
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
    stockHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    stockPickedHint: {
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
  });
