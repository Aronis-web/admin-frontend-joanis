import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { photoCampaignsApi } from '@/services/api';
import {
  PhotoCampaignProductItem,
  PhotoCampaignWhatsappContact,
  PhotoType,
  ProductPhotoAsset,
} from '@/types/photo-campaigns';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';

interface SendPhotoCampaignWhatsAppModalProps {
  visible: boolean;
  /** Id de la campaña de fotos cuyas fotos se enviarán. */
  photoCampaignId: string;
  /** Nombre de la campaña, se muestra en el subtítulo. */
  photoCampaignName?: string;
  onClose: () => void;
  /** Callback opcional tras disparar el envío (fire-and-forget). */
  onSent?: () => void;
}

const PHOTO_TYPE_LABELS: Record<PhotoType, string> = {
  reference: 'Referencia',
  design: 'Diseño',
  price: 'Con precio',
};

const isUuid = (value?: string): boolean =>
  !!value &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const getWhatsappContactUuid = (contact: PhotoCampaignWhatsappContact): string => {
  const directCandidates = [
    contact.id,
    (contact as any).contactId,
    (contact as any).whatsappContactId,
    (contact as any).uuid,
  ].filter(Boolean) as string[];

  const directMatch = directCandidates.find((candidate) => isUuid(candidate));
  if (directMatch) {
    return directMatch;
  }

  const allValues = Object.values(contact || {}).filter((v) => typeof v === 'string') as string[];
  return allValues.find((candidate) => isUuid(candidate)) || '';
};

/**
 * Modal reutilizable para enviar las fotos de una campaña por WhatsApp.
 *
 * Permite elegir contacto destino, decidir si mandar TODOS los productos o
 * SELECCIONAR un subconjunto (con búsqueda), filtrar por tipo de foto
 * (referencia/diseño/precio) y agregar un mensaje opcional.
 *
 * Encapsula la carga de contactos y productos de la campaña, así como la
 * resolución de photoAssetIds cuando se seleccionan productos específicos.
 */
export const SendPhotoCampaignWhatsAppModal: React.FC<SendPhotoCampaignWhatsAppModalProps> = ({
  visible,
  photoCampaignId,
  photoCampaignName,
  onClose,
  onSent,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [contacts, setContacts] = useState<PhotoCampaignWhatsappContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactId, setContactId] = useState('');

  const [sendAll, setSendAll] = useState(true);
  const [products, setProducts] = useState<PhotoCampaignProductItem[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  const [selectedPhotoTypes, setSelectedPhotoTypes] = useState<Set<PhotoType>>(new Set());
  const [caption, setCaption] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const resetState = useCallback(() => {
    setContacts([]);
    setContactId('');
    setSendAll(true);
    setProducts([]);
    setProductSearchQuery('');
    setSelectedProductIds(new Set());
    setSelectedPhotoTypes(new Set());
    setCaption('');
  }, []);

  // Carga contactos + productos al abrir. Los productos solo se usan si el
  // usuario cambia a modo "Seleccionar", pero los precargamos para no tener
  // spinner extra en la transición.
  useEffect(() => {
    if (!visible || !photoCampaignId) {
      return;
    }

    resetState();

    let cancelled = false;

    const load = async () => {
      try {
        setContactsLoading(true);
        setProductsLoading(true);
        const [contactsResp, productsResp] = await Promise.all([
          photoCampaignsApi.getCampaignWhatsappContacts(photoCampaignId),
          photoCampaignsApi.getCampaignProducts(photoCampaignId).catch(() => []),
        ]);
        if (cancelled) {
          return;
        }
        const safeContacts = contactsResp || [];
        setContacts(safeContacts);
        setContactId(getWhatsappContactUuid((safeContacts[0] as any) || {}) || '');
        setProducts(productsResp || []);
      } catch (error: any) {
        if (!cancelled) {
          Alert.alert(
            'Error',
            error?.message || 'No se pudieron cargar los contactos de WhatsApp.'
          );
        }
      } finally {
        if (!cancelled) {
          setContactsLoading(false);
          setProductsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [visible, photoCampaignId, resetState]);

  const toggleProduct = useCallback((productId: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  }, []);

  const togglePhotoType = useCallback((photoType: PhotoType) => {
    setSelectedPhotoTypes((prev) => {
      const next = new Set(prev);
      if (next.has(photoType)) {
        next.delete(photoType);
      } else {
        next.add(photoType);
      }
      return next;
    });
  }, []);

  const filteredProducts = useMemo(() => {
    const query = productSearchQuery.trim().toLowerCase();
    if (!query) {
      return products;
    }
    return products.filter((item) => {
      const haystack = `${item.product?.title || ''} ${item.product?.sku || ''}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [products, productSearchQuery]);

  const handleSelectAllProducts = useCallback(() => {
    setSelectedProductIds(new Set(filteredProducts.map((p) => p.productId)));
  }, [filteredProducts]);

  const handleClearProducts = useCallback(() => {
    setSelectedProductIds(new Set());
  }, []);

  const handleSend = useCallback(async () => {
    if (!photoCampaignId) {
      return;
    }
    if (!contactId) {
      Alert.alert('Validación', 'Selecciona un contacto destino.');
      return;
    }
    if (!isUuid(contactId)) {
      Alert.alert('Validación', 'El contacto seleccionado no tiene un UUID válido.');
      return;
    }
    if (!sendAll && selectedProductIds.size === 0) {
      Alert.alert('Validación', 'Selecciona al menos un producto o cambia a "Todos".');
      return;
    }

    const photoTypesArray = Array.from(selectedPhotoTypes);

    // Cuando el usuario selecciona productos específicos, resolvemos sus
    // photoAssetIds concretos filtrando (si corresponde) por tipo de foto.
    let photoAssetIds: string[] = [];
    if (!sendAll) {
      try {
        setSubmitting(true);
        const productIds = Array.from(selectedProductIds);
        const assetLists = await Promise.all(
          productIds.map((productId) =>
            photoCampaignsApi.getProductPhotos(productId).catch(() => [] as ProductPhotoAsset[])
          )
        );
        const flat = assetLists.flat().filter((asset) => asset.isActive);
        const byType =
          photoTypesArray.length > 0
            ? flat.filter((asset) => photoTypesArray.includes(asset.photoType))
            : flat;
        photoAssetIds = Array.from(new Set(byType.map((asset) => asset.id)));

        if (photoAssetIds.length === 0) {
          Alert.alert(
            'Validación',
            'Los productos seleccionados no tienen fotos disponibles para el tipo elegido.'
          );
          return;
        }
      } catch (error: any) {
        Alert.alert(
          'Error',
          error?.message || 'No se pudieron obtener las fotos de los productos seleccionados.'
        );
        return;
      } finally {
        setSubmitting(false);
      }
    }

    // Fire-and-forget: el backend procesa en segundo plano.
    void photoCampaignsApi
      .sendCampaignPhotosWhatsapp(photoCampaignId, {
        contactId,
        sendAll,
        photoAssetIds: sendAll ? [] : photoAssetIds,
        photoTypes: photoTypesArray.length > 0 ? photoTypesArray : undefined,
        caption: caption.trim() || undefined,
      })
      .catch((error: any) => {
        logger.error('Error solicitando envío de fotos por WhatsApp', error);
      });

    Alert.alert(
      'Envío en proceso',
      'El envío de fotos por WhatsApp se está procesando en segundo plano.'
    );
    onSent?.();
    onClose();
  }, [
    photoCampaignId,
    contactId,
    sendAll,
    selectedProductIds,
    selectedPhotoTypes,
    caption,
    onSent,
    onClose,
  ]);

  const disabledSend = !contactId || submitting;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>Enviar fotos por WhatsApp</Text>
              {!!photoCampaignName && (
                <Text style={styles.subtitle}>Campaña: {photoCampaignName}</Text>
              )}
            </View>
            <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.sectionLabel}>Contacto destino</Text>
            {contactsLoading ? (
              <View style={styles.inlineLoadingRow}>
                <ActivityIndicator size="small" color={theme.color.brand.accent} />
                <Text style={styles.loaderText}>Cargando contactos...</Text>
              </View>
            ) : contacts.length === 0 ? (
              <Text style={styles.emptyText}>No hay contactos de WhatsApp configurados.</Text>
            ) : (
              <View style={styles.chipRow}>
                {contacts.map((contact) => {
                  const resolvedContactId = getWhatsappContactUuid(contact);
                  const selected = contactId === resolvedContactId;
                  const label =
                    contact.name ||
                    (contact as any).fullName ||
                    (contact as any).contactName ||
                    (contact as any).displayName ||
                    'Contacto sin nombre';
                  return (
                    <TouchableOpacity
                      key={contact.id}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => setContactId(resolvedContactId)}
                      disabled={!resolvedContactId}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <Text style={styles.sectionLabel}>Productos a enviar</Text>
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, sendAll && styles.chipSelected]}
                onPress={() => setSendAll(true)}
              >
                <Text style={[styles.chipText, sendAll && styles.chipTextSelected]}>Todos</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, !sendAll && styles.chipSelected]}
                onPress={() => setSendAll(false)}
              >
                <Text style={[styles.chipText, !sendAll && styles.chipTextSelected]}>
                  Seleccionar
                </Text>
              </TouchableOpacity>
            </View>

            {!sendAll && (
              <>
                <TextInput
                  style={styles.input}
                  value={productSearchQuery}
                  onChangeText={setProductSearchQuery}
                  placeholder="Buscar producto por nombre o SKU"
                  placeholderTextColor={theme.color.text.placeholder}
                />

                <View style={styles.selectionRow}>
                  <Text style={styles.selectionCount}>
                    {selectedProductIds.size} de {filteredProducts.length} seleccionado(s)
                  </Text>
                  <View style={styles.selectionActions}>
                    <TouchableOpacity
                      style={styles.linkButton}
                      onPress={handleSelectAllProducts}
                      disabled={filteredProducts.length === 0}
                    >
                      <Text style={styles.linkButtonText}>Seleccionar todos</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.linkButton}
                      onPress={handleClearProducts}
                      disabled={selectedProductIds.size === 0}
                    >
                      <Text style={styles.linkButtonText}>Limpiar</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {productsLoading ? (
                  <View style={styles.inlineLoadingRow}>
                    <ActivityIndicator size="small" color={theme.color.brand.accent} />
                    <Text style={styles.loaderText}>Cargando productos...</Text>
                  </View>
                ) : filteredProducts.length === 0 ? (
                  <Text style={styles.emptyText}>
                    No hay productos en la campaña para este filtro.
                  </Text>
                ) : (
                  <ScrollView
                    style={styles.productsList}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                  >
                    {filteredProducts.map((item) => {
                      const selected = selectedProductIds.has(item.productId);
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[styles.productRow, selected && styles.productRowSelected]}
                          onPress={() => toggleProduct(item.productId)}
                        >
                          <View style={styles.productInfo}>
                            <Text style={styles.productTitle}>
                              {item.product?.title || item.productId}
                            </Text>
                            <Text style={styles.productMeta}>SKU: {item.product?.sku || '-'}</Text>
                          </View>
                          <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                            {selected && <Text style={styles.checkboxCheck}>✓</Text>}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </>
            )}

            <Text style={styles.sectionLabel}>Tipo de foto (opcional)</Text>
            <View style={styles.chipRow}>
              {(Object.keys(PHOTO_TYPE_LABELS) as PhotoType[]).map((photoType) => {
                const selected = selectedPhotoTypes.has(photoType);
                return (
                  <TouchableOpacity
                    key={photoType}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => togglePhotoType(photoType)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {PHOTO_TYPE_LABELS[photoType]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>Mensaje (opcional)</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              multiline
              value={caption}
              onChangeText={setCaption}
              placeholder="Ej: Hola, te compartimos las fotos de la campaña"
              placeholderTextColor={theme.color.text.placeholder}
            />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.whatsappButton, disabledSend && styles.whatsappButtonDisabled]}
              onPress={() => void handleSend()}
              disabled={disabledSend}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={theme.color.text.success} />
              ) : (
                <Text style={styles.whatsappButtonText}>Enviar WhatsApp</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.space[4],
    },
    card: {
      width: '100%',
      maxWidth: 640,
      maxHeight: '90%',
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.surface.base,
      padding: theme.space[3.5],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      ...theme.shadow.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: theme.space[2],
      gap: theme.space[2],
    },
    headerText: {
      flex: 1,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    subtitle: {
      marginTop: theme.space[0.5],
      fontSize: 12,
      color: theme.color.text.muted,
    },
    body: {
      flexGrow: 0,
    },
    bodyContent: {
      paddingBottom: theme.space[2],
    },
    loaderText: {
      color: theme.color.text.muted,
      fontSize: 12,
    },
    sectionLabel: {
      marginTop: theme.space[3],
      marginBottom: theme.space[2],
      fontSize: 13,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    emptyText: {
      color: theme.color.text.muted,
      fontSize: 12,
      paddingVertical: theme.space[1],
    },
    inlineLoadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      paddingVertical: theme.space[2],
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[2],
      marginBottom: theme.space[2],
    },
    chip: {
      paddingVertical: theme.space[1.5],
      paddingHorizontal: theme.space[3],
      borderRadius: theme.radii.full,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.background.subtle,
    },
    chipSelected: {
      borderColor: theme.color.brand.accent,
      backgroundColor: theme.color.brand.accentSoft,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    chipTextSelected: {
      color: theme.color.brand.accent,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.background.subtle,
      color: theme.color.text.body,
      paddingHorizontal: theme.space[2.5],
      paddingVertical: theme.space[2],
      marginBottom: theme.space[2],
    },
    multilineInput: {
      minHeight: 72,
      textAlignVertical: 'top',
    },
    selectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.space[2],
      gap: theme.space[2],
    },
    selectionCount: {
      fontSize: 12,
      color: theme.color.text.muted,
      fontWeight: '600',
    },
    selectionActions: {
      flexDirection: 'row',
      gap: theme.space[3],
    },
    linkButton: {
      paddingVertical: theme.space[1],
    },
    linkButtonText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.color.brand.accent,
    },
    productsList: {
      maxHeight: 240,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      borderRadius: theme.radii.md,
      marginBottom: theme.space[2],
      backgroundColor: theme.color.background.subtle,
    },
    productRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.space[2.5],
      paddingVertical: theme.space[2],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      gap: theme.space[2],
    },
    productRowSelected: {
      backgroundColor: theme.color.brand.accentSoft,
    },
    productInfo: {
      flex: 1,
    },
    productTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    productMeta: {
      marginTop: theme.space[0.5],
      fontSize: 11,
      color: theme.color.text.muted,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: theme.radii.sm,
      borderWidth: 2,
      borderColor: theme.color.border.default,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.color.surface.base,
    },
    checkboxSelected: {
      borderColor: theme.color.brand.accent,
      backgroundColor: theme.color.brand.accent,
    },
    checkboxCheck: {
      color: theme.color.text.inverse,
      fontSize: 14,
      fontWeight: '700',
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: theme.space[2],
      marginTop: theme.space[2],
    },
    secondaryButton: {
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[3],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.surface.subtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryButtonText: {
      color: theme.color.text.heading,
      fontWeight: '700',
      fontSize: 12,
    },
    whatsappButton: {
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[3],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.state.success.background,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 140,
    },
    whatsappButtonDisabled: {
      opacity: 0.5,
    },
    whatsappButtonText: {
      color: theme.color.text.success,
      fontWeight: '700',
      fontSize: 12,
    },
  });

export default SendPhotoCampaignWhatsAppModal;
