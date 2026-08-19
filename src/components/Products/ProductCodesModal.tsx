import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme, useThemedStyles } from '@/design-system/themes';
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
} from '@/design-system/components';
import { Product } from '@/services/api/products';
import { ProductCode, ProductCodeType, CreateProductCodeDto } from '@/services/api/product-codes';
import {
  useProductCodes,
  useCreateProductCode,
  useUpdateProductCode,
  useDeleteProductCode,
} from '@/hooks/api/useProductCodes';
import { useProductVariants } from '@/hooks/api/useProductVariants';
import Alert from '@/utils/alert';

interface Props {
  visible: boolean;
  onClose: () => void;
  product: Product | null;
}

const CODE_TYPES: { value: ProductCodeType; label: string }[] = [
  { value: 'BARCODE', label: 'Codigo de barras' },
  { value: 'SKU', label: 'SKU' },
  { value: 'NAME', label: 'Alias / Nombre' },
];

interface FormState {
  codeType: ProductCodeType;
  value: string;
  variantId: string | null;
  note: string;
  isPrimary: boolean;
}

const emptyForm: FormState = {
  codeType: 'BARCODE',
  value: '',
  variantId: null,
  note: '',
  isPrimary: false,
};

export const ProductCodesModal: React.FC<Props> = ({ visible, onClose, product }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const productId = product?.id ?? '';

  const { data: codes = [], isLoading } = useProductCodes(productId, visible && !!productId);
  const { data: variants = [] } = useProductVariants(productId, visible && !!productId);

  const createMut = useCreateProductCode();
  const updateMut = useUpdateProductCode();
  const deleteMut = useDeleteProductCode();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const isEditing = editingId !== null;

  const variantOptions = useMemo(
    () => [
      { id: null as string | null, name: '(Sin variante)' },
      ...variants.map((v) => ({ id: v.id, name: v.name })),
    ],
    [variants]
  );

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleEdit = (code: ProductCode) => {
    setEditingId(code.id);
    setForm({
      codeType: code.codeType,
      value: code.value,
      variantId: code.variantId,
      note: code.note ?? '',
      isPrimary: code.isPrimary,
    });
  };

  const handleSubmit = async () => {
    if (!productId) return;
    if (!form.value.trim()) {
      Alert.alert('Falta valor', 'El valor del codigo es obligatorio');
      return;
    }
    const payload: CreateProductCodeDto = {
      codeType: form.codeType,
      value: form.value.trim(),
      variantId: form.variantId,
      isPrimary: form.isPrimary,
      note: form.note.trim() || undefined,
    };
    try {
      if (isEditing && editingId) {
        await updateMut.mutateAsync({ productId, codeId: editingId, data: payload });
      } else {
        await createMut.mutateAsync({ productId, data: payload });
      }
      resetForm();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo guardar el codigo');
    }
  };

  const handleDelete = (code: ProductCode) => {
    if (!productId) return;
    Alert.alert('Eliminar codigo', `Se eliminara el codigo "${code.value}". Continuar?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMut.mutateAsync({ productId, codeId: code.id });
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'No se pudo eliminar el codigo');
          }
        },
      },
    ]);
  };

  if (!product) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Title>Codigos alternos</Title>
              <Caption color="secondary">{product.title}</Caption>
            </View>
            <IconButton icon="close" onPress={onClose} />
          </View>

          <ScrollView contentContainerStyle={styles.scroll}>
            {/* Formulario */}
            <View style={styles.section}>
              <Label>{isEditing ? 'Editar codigo' : 'Agregar codigo'}</Label>

              <View style={styles.row}>
                {CODE_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    style={[
                      styles.chip,
                      form.codeType === t.value && { backgroundColor: theme.color.brand.primary },
                    ]}
                    onPress={() => setForm((f) => ({ ...f, codeType: t.value }))}
                  >
                    <Text
                      variant="labelSmall"
                      style={{
                        color:
                          form.codeType === t.value
                            ? theme.color.text.inverse
                            : theme.color.text.body,
                      }}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Input
                label="Valor"
                placeholder="Ej: 7750182000123"
                value={form.value}
                onChangeText={(v) => setForm((f) => ({ ...f, value: v }))}
              />

              {variantOptions.length > 1 && (
                <View style={styles.rowWrap}>
                  <Caption color="secondary" style={{ width: '100%', marginBottom: 4 }}>
                    Variante (opcional)
                  </Caption>
                  {variantOptions.map((v) => {
                    const selected = form.variantId === v.id;
                    return (
                      <TouchableOpacity
                        key={v.id ?? 'none'}
                        style={[
                          styles.chip,
                          selected && { backgroundColor: theme.color.brand.primary },
                        ]}
                        onPress={() => setForm((f) => ({ ...f, variantId: v.id }))}
                      >
                        <Text
                          variant="labelSmall"
                          style={{
                            color: selected ? theme.color.text.inverse : theme.color.text.body,
                          }}
                        >
                          {v.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <Input
                label="Nota (opcional)"
                placeholder="Ej: codigo del proveedor X"
                value={form.note}
                onChangeText={(v) => setForm((f) => ({ ...f, note: v }))}
              />

              <View style={styles.actions}>
                {isEditing && <Button variant="ghost" onPress={resetForm} title="Cancelar" />}
                <Button
                  onPress={handleSubmit}
                  loading={createMut.isPending || updateMut.isPending}
                  title={isEditing ? 'Guardar cambios' : 'Agregar codigo'}
                />
              </View>
            </View>

            {/* Lista */}
            <View style={styles.section}>
              <Label>Codigos existentes ({codes.length})</Label>
              {isLoading ? (
                <Body color="secondary">Cargando...</Body>
              ) : codes.length === 0 ? (
                <EmptyState
                  title="Sin codigos"
                  description="Agrega un codigo alterno usando el formulario de arriba."
                />
              ) : (
                codes.map((code) => {
                  const variantName = variants.find((v) => v.id === code.variantId)?.name;
                  return (
                    <View key={code.id} style={styles.item}>
                      <View style={{ flex: 1 }}>
                        <Text variant="titleMedium">{code.value}</Text>
                        <Caption color="secondary">
                          {code.codeType}
                          {variantName ? ` - Variante: ${variantName}` : ''}
                          {code.note ? ` - ${code.note}` : ''}
                        </Caption>
                      </View>
                      <IconButton icon="pencil" onPress={() => handleEdit(code)} />
                      <IconButton icon="trash" onPress={() => handleDelete(code)} />
                    </View>
                  );
                })
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
    row: { flexDirection: 'row', gap: theme.space[2], flexWrap: 'wrap' },
    rowWrap: { flexDirection: 'row', gap: theme.space[2], flexWrap: 'wrap' },
    chip: {
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[3],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.surface.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: theme.space[3],
      marginTop: theme.space[3],
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.space[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
  });

export default ProductCodesModal;
