import React, { useState } from 'react';
import { View, StyleSheet, Modal, ScrollView, Switch } from 'react-native';
import { useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import {
  Text,
  Title,
  Body,
  Caption,
  Label,
  Button,
  Input,
  IconButton,
  EmptyState,
  Badge,
} from '@/design-system/components';
import { Product } from '@/services/api/products';
import { ProductVariant, CreateProductVariantDto } from '@/services/api/product-variants';
import {
  useProductVariants,
  useCreateProductVariant,
  useUpdateProductVariant,
  useDeleteProductVariant,
} from '@/hooks/api/useProductVariants';
import Alert from '@/utils/alert';

interface Props {
  visible: boolean;
  onClose: () => void;
  product: Product | null;
}

interface FormState {
  name: string;
  sku: string;
  barcode: string;
  isSellable: boolean;
  tracksStock: boolean;
  note: string;
}

const emptyForm: FormState = {
  name: '',
  sku: '',
  barcode: '',
  isSellable: false,
  tracksStock: false,
  note: '',
};

export const ProductVariantsModal: React.FC<Props> = ({ visible, onClose, product }) => {
  const styles = useThemedStyles(createStyles);
  const productId = product?.id ?? '';

  const { data: variants = [], isLoading } = useProductVariants(productId, visible && !!productId);
  const createMut = useCreateProductVariant();
  const updateMut = useUpdateProductVariant();
  const deleteMut = useDeleteProductVariant();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const isEditing = editingId !== null;

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleEdit = (variant: ProductVariant) => {
    setEditingId(variant.id);
    setForm({
      name: variant.name,
      sku: variant.sku ?? '',
      barcode: variant.barcode ?? '',
      isSellable: variant.isSellable,
      tracksStock: variant.tracksStock,
      note: variant.note ?? '',
    });
  };

  const handleSubmit = async () => {
    if (!productId) return;
    if (!form.name.trim()) {
      Alert.alert('Falta nombre', 'El nombre de la variante es obligatorio');
      return;
    }
    const payload: CreateProductVariantDto = {
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      barcode: form.barcode.trim() || null,
      isSellable: form.isSellable,
      tracksStock: form.tracksStock,
      note: form.note.trim() || undefined,
    };
    try {
      if (isEditing && editingId) {
        await updateMut.mutateAsync({ productId, variantId: editingId, data: payload });
      } else {
        await createMut.mutateAsync({ productId, data: payload });
      }
      resetForm();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo guardar la variante');
    }
  };

  const handleDelete = (variant: ProductVariant) => {
    if (!productId) return;
    Alert.alert(
      'Eliminar variante',
      `Se eliminara la variante "${variant.name}" y sus codigos alternos asociados. Continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMut.mutateAsync({ productId, variantId: variant.id });
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'No se pudo eliminar la variante');
            }
          },
        },
      ]
    );
  };

  if (!product) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Title>Variantes (color / atributo)</Title>
              <Caption color="secondary">{product.title}</Caption>
            </View>
            <IconButton icon="close" onPress={onClose} />
          </View>

          <ScrollView contentContainerStyle={styles.scroll}>
            {/* Formulario */}
            <View style={styles.section}>
              <Label>{isEditing ? 'Editar variante' : 'Agregar variante'}</Label>

              <Input
                label="Nombre"
                placeholder="Ej: rojo"
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
              />

              <Input
                label="SKU propio (opcional)"
                placeholder="Ej: PROD-001-ROJO"
                value={form.sku}
                onChangeText={(v) => setForm((f) => ({ ...f, sku: v }))}
              />

              <Input
                label="Codigo de barras propio (opcional)"
                placeholder="Ej: 7750182009999"
                value={form.barcode}
                onChangeText={(v) => setForm((f) => ({ ...f, barcode: v }))}
              />

              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Label>Vendible con codigo propio</Label>
                  <Caption color="secondary">Marca la variante como SKU aparte</Caption>
                </View>
                <Switch
                  value={form.isSellable}
                  onValueChange={(v) => setForm((f) => ({ ...f, isSellable: v }))}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Label>Lleva stock propio (tracksStock)</Label>
                  <Caption color="secondary">
                    Saldo por (producto, almacen, area, variante). Requiere ventana de mantenimiento
                    en BD si nunca se activo.
                  </Caption>
                </View>
                <Switch
                  value={form.tracksStock}
                  onValueChange={(v) => setForm((f) => ({ ...f, tracksStock: v }))}
                />
              </View>

              <Input
                label="Nota (opcional)"
                placeholder="Ej: color temporada"
                value={form.note}
                onChangeText={(v) => setForm((f) => ({ ...f, note: v }))}
              />

              <View style={styles.actions}>
                {isEditing && <Button variant="ghost" onPress={resetForm} title="Cancelar" />}
                <Button
                  onPress={handleSubmit}
                  loading={createMut.isPending || updateMut.isPending}
                  title={isEditing ? 'Guardar cambios' : 'Agregar variante'}
                />
              </View>
            </View>

            {/* Lista */}
            <View style={styles.section}>
              <Label>Variantes existentes ({variants.length})</Label>
              {isLoading ? (
                <Body color="secondary">Cargando...</Body>
              ) : variants.length === 0 ? (
                <EmptyState
                  title="Sin variantes"
                  description="Agrega una variante (color/atributo) usando el formulario de arriba."
                />
              ) : (
                variants.map((variant) => (
                  <View key={variant.id} style={styles.item}>
                    <View style={{ flex: 1 }}>
                      <Text variant="titleMedium">{variant.name}</Text>
                      <View
                        style={{ flexDirection: 'row', gap: 6, marginTop: 2, flexWrap: 'wrap' }}
                      >
                        {variant.sku ? (
                          <Badge variant="default" label={`SKU: ${variant.sku}`} />
                        ) : null}
                        {variant.barcode ? (
                          <Badge variant="default" label={`BC: ${variant.barcode}`} />
                        ) : null}
                        {variant.tracksStock ? (
                          <Badge variant="success" label="Stock propio" />
                        ) : null}
                        {variant.isSellable ? <Badge variant="info" label="Vendible" /> : null}
                      </View>
                      {variant.note ? <Caption color="secondary">{variant.note}</Caption> : null}
                    </View>
                    <IconButton icon="pencil" onPress={() => handleEdit(variant)} />
                    <IconButton icon="trash" onPress={() => handleDelete(variant)} />
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
      justifyContent: 'center',
      alignItems: 'center',
    },
    container: {
      width: '90%',
      maxWidth: 720,
      maxHeight: '90%',
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.space[5],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    scroll: { padding: theme.space[5], gap: theme.space[5] },
    section: { gap: theme.space[3], marginBottom: theme.space[5] },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.space[3],
      gap: theme.space[3],
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: theme.space[3],
      marginTop: theme.space[3],
    },
    item: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: theme.space[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      gap: theme.space[3],
    },
  });

export default ProductVariantsModal;
