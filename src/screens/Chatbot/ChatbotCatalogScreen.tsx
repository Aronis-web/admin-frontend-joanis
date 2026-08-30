import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
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
  useCreateSellableProduct,
  useDeleteSellableProduct,
  useSellableProductsList,
  useUpdateSellableProduct,
} from '@/hooks/api/useChatbotCatalog';
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
  presentationId: form.presentationId.trim(),
  maxSellableQty: Number(form.maxSellableQty || '0'),
  priceProfileId: form.priceProfileId.trim() || null,
  priceOverrideCents: form.priceOverrideCents ? Number(form.priceOverrideCents) : null,
  label: form.label.trim() || null,
  sortOrder: Number(form.sortOrder || '0'),
  isActive: form.isActive,
});

export const ChatbotCatalogScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const { data, isLoading, isFetching, isError, refetch } = useSellableProductsList();
  const items = useMemo(() => data ?? [], [data]);

  const createMutation = useCreateSellableProduct();
  const updateMutation = useUpdateSellableProduct();
  const deleteMutation = useDeleteSellableProduct();

  const [editing, setEditing] = useState<SellableProduct | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const openCreate = () => {
    setForm(emptyForm);
    setEditing(null);
    setCreating(true);
  };

  const openEdit = (item: SellableProduct) => {
    setForm(toForm(item));
    setEditing(item);
    setCreating(false);
  };

  const closeForm = () => {
    setCreating(false);
    setEditing(null);
    setForm(emptyForm);
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
              {items.map((item) => (
                <Card key={item.id} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <View style={{ flex: 1 }}>
                      <Title>{item.label ?? '(sin etiqueta)'}</Title>
                      <Caption color={theme.color.text.muted}>
                        Producto: {item.productId.slice(0, 8)}…
                      </Caption>
                    </View>
                    <Badge
                      variant={item.isActive ? 'success' : 'default'}
                      label={item.isActive ? 'Activo' : 'Inactivo'}
                    />
                  </View>
                  <View style={styles.itemMeta}>
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
              ))}
            </View>
          )}
        </ScrollView>

        <FAB icon="add" onPress={openCreate} />

        {/* Modal formulario */}
        <Modal visible={isFormOpen} transparent animationType="fade" onRequestClose={closeForm}>
          <Pressable style={styles.backdrop} onPress={closeForm}>
            <Pressable style={styles.formCard} onPress={(e) => e.stopPropagation()}>
              <ScrollView contentContainerStyle={styles.formContent}>
                <Title>{editing ? 'Editar entrada' : 'Nueva entrada'}</Title>
                <Caption color={theme.color.text.muted}>
                  Ingresa los UUIDs de producto, almacén y presentación.
                </Caption>

                <Input
                  label="Producto (UUID)"
                  value={form.productId}
                  onChangeText={(v) => setForm((f) => ({ ...f, productId: v }))}
                  placeholder="uuid del producto"
                />
                <Input
                  label="Variante (UUID, opcional)"
                  value={form.variantId}
                  onChangeText={(v) => setForm((f) => ({ ...f, variantId: v }))}
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
                <Input
                  label="Máximo vendible"
                  value={form.maxSellableQty}
                  onChangeText={(v) => setForm((f) => ({ ...f, maxSellableQty: v }))}
                  keyboardType="numeric"
                />
                <Input
                  label="Perfil de precio (UUID, opcional)"
                  value={form.priceProfileId}
                  onChangeText={(v) => setForm((f) => ({ ...f, priceProfileId: v }))}
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
      alignItems: 'flex-start',
      gap: spacing[2],
    },
    itemMeta: {
      gap: 2,
    },
    itemActions: {
      flexDirection: 'row',
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
      maxWidth: 520,
      maxHeight: '90%',
      backgroundColor: theme.color.surface.base,
      borderRadius: borderRadius.xl,
    },
    formContent: {
      padding: spacing[5],
      gap: spacing[3],
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
