/**
 * PriceLabelPrintModal — Modal para imprimir la etiqueta de precio de anaquel
 * de un producto en impresora térmica de 80mm.
 *
 * Permite:
 *  - Elegir el perfil de precio (Socia, Franquicia, etc.).
 *  - Editar el precio manualmente y guardarlo en el sistema.
 *  - Definir el número de copias.
 *  - Previsualizar la etiqueta (marca "Joanis", nombre, código de barras y precio).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { priceProfilesApi } from '@/services/api/price-profiles';
import type { PriceProfile } from '@/types/price-profiles';
import {
  printPriceLabel,
  formatLabelPrice,
  listPrinters,
  isElectronPrinting,
  type PrinterInfo,
} from '@/utils/priceLabel/priceLabelPrint';
import { logger } from '@/utils/logger';
import Alert from '@/utils/alert';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { Button, Caption, Text } from '@/design-system/components';

export interface PriceLabelProduct {
  productId: string;
  name: string;
  sku?: string;
  barcode?: string;
  currency?: string;
}

interface PriceLabelPrintModalProps {
  visible: boolean;
  onClose: () => void;
  product: PriceLabelProduct | null;
}

interface PriceOption {
  profileId: string;
  profileName: string;
  profileCode: string;
  priceCents: number;
}

const toNumber = (value: number | string | undefined | null): number => {
  if (value === undefined || value === null) return 0;
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isNaN(n) ? 0 : n;
};

export const PriceLabelPrintModal: React.FC<PriceLabelPrintModalProps> = ({
  visible,
  onClose,
  product,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [options, setOptions] = useState<PriceOption[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [priceText, setPriceText] = useState('');
  const [copies, setCopies] = useState('3');
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string | null>(null);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [savingPrice, setSavingPrice] = useState(false);

  const supportsPrinterSelection = isElectronPrinting();

  const currency = product?.currency || 'PEN';
  const barcodeValue = (product?.barcode || product?.sku || '').trim();

  const loadPrices = useCallback(async () => {
    if (!product) return;
    try {
      setLoading(true);
      const [profiles, salePricesResponse] = await Promise.all([
        priceProfilesApi.getActivePriceProfiles(),
        priceProfilesApi.getProductSalePrices(product.productId),
      ]);

      const salePrices = salePricesResponse.salePrices || salePricesResponse.data || [];
      const costCents = toNumber(salePricesResponse.costCents);

      const built: PriceOption[] = (profiles as PriceProfile[]).map((profile) => {
        const existing = salePrices.find((sp) => sp.profileId === profile.id && !sp.presentationId);
        const factor = toNumber(profile.factorToCost);
        const priceCents = existing?.priceCents ?? Math.round(costCents * factor);
        return {
          profileId: profile.id,
          profileName: profile.name,
          profileCode: profile.code,
          priceCents,
        };
      });

      setOptions(built);

      // Selección por defecto: perfil "socia" si existe, si no el primero.
      const defaultOption =
        built.find((o) => o.profileName.toLowerCase().includes('socia')) || built[0] || null;
      setSelectedProfileId(defaultOption?.profileId ?? null);
      setPriceText(defaultOption ? (defaultOption.priceCents / 100).toFixed(2) : '');
    } catch (error) {
      logger.error('Error cargando precios para etiqueta', error);
      Alert.alert('Error', 'No se pudieron cargar los precios del producto.');
    } finally {
      setLoading(false);
    }
  }, [product]);

  const loadPrinters = useCallback(async () => {
    if (!isElectronPrinting()) return;
    try {
      setLoadingPrinters(true);
      const list = await listPrinters();
      setPrinters(list);
      // Selección por defecto: la impresora marcada como predeterminada del SO.
      const preferred = list.find((p) => p.isDefault) || list[0] || null;
      setSelectedPrinter((prev) => prev ?? preferred?.name ?? null);
    } catch (error) {
      logger.error('Error cargando impresoras', error);
    } finally {
      setLoadingPrinters(false);
    }
  }, []);

  useEffect(() => {
    if (visible && product) {
      setCopies('3');
      void loadPrices();
      void loadPrinters();
    } else if (!visible) {
      setOptions([]);
      setSelectedProfileId(null);
      setPriceText('');
      setPrinters([]);
      setSelectedPrinter(null);
    }
  }, [visible, product, loadPrices, loadPrinters]);

  const handleSelectProfile = useCallback((option: PriceOption) => {
    setSelectedProfileId(option.profileId);
    setPriceText((option.priceCents / 100).toFixed(2));
  }, []);

  const handlePriceChange = useCallback((value: string) => {
    const sanitized = value.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    const finalValue = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : sanitized;
    setPriceText(finalValue);
  }, []);

  const priceCents = useMemo(() => {
    const value = parseFloat(priceText);
    return Number.isNaN(value) ? 0 : Math.round(value * 100);
  }, [priceText]);

  const selectedProfile = options.find((o) => o.profileId === selectedProfileId) || null;

  // El precio fue modificado respecto al valor guardado del perfil seleccionado.
  const isPriceModified = !!selectedProfile && selectedProfile.priceCents !== priceCents;

  const handleConfirmPrice = useCallback(async () => {
    if (!product || !selectedProfileId) return;
    if (priceCents <= 0) {
      Alert.alert('Precio inválido', 'Ingresa un precio mayor a cero.');
      return;
    }
    try {
      setSavingPrice(true);
      await priceProfilesApi.updateSalePrice(product.productId, {
        productId: product.productId,
        presentationId: null,
        profileId: selectedProfileId,
        priceCents,
      });
      // Reflejar el nuevo precio guardado en las opciones locales.
      setOptions((prev) =>
        prev.map((o) => (o.profileId === selectedProfileId ? { ...o, priceCents } : o))
      );
      Alert.alert('Precio actualizado', 'El precio se guardó correctamente en el sistema.');
    } catch (error) {
      logger.error('Error guardando precio', error);
      Alert.alert('Error', 'No se pudo guardar el precio en el sistema.');
    } finally {
      setSavingPrice(false);
    }
  }, [product, selectedProfileId, priceCents]);

  const handlePrint = useCallback(async () => {
    if (!product) return;
    if (priceCents <= 0) {
      Alert.alert('Precio inválido', 'Ingresa un precio mayor a cero.');
      return;
    }
    if (supportsPrinterSelection && !selectedPrinter) {
      Alert.alert(
        'Sin impresora',
        'No se detecta ninguna impresora conectada. Verifica que la impresora térmica esté encendida y conectada, luego actualiza la lista.'
      );
      return;
    }
    const copiesNum = Math.max(1, Math.min(50, Math.floor(Number(copies) || 1)));
    try {
      setPrinting(true);
      await printPriceLabel({
        productName: product.name,
        barcodeValue,
        priceCents,
        currency,
        profileName: selectedProfile?.profileName,
        copies: copiesNum,
        deviceName: selectedPrinter ?? undefined,
      });
    } catch (error) {
      logger.error('Error imprimiendo etiqueta', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'No se pudo imprimir la etiqueta.'
      );
    } finally {
      setPrinting(false);
    }
  }, [
    product,
    priceCents,
    copies,
    barcodeValue,
    currency,
    selectedProfile,
    supportsPrinterSelection,
    selectedPrinter,
  ]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.flexOne}>
              <Text variant="titleLarge" color="primary" numberOfLines={2}>
                Imprimir etiqueta
              </Text>
              <Caption color="tertiary" numberOfLines={1}>
                {product?.name || 'Producto'}
              </Caption>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.color.icon.muted} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.color.brand.primary} />
              <Caption color="tertiary" style={styles.loadingText}>
                Cargando precios...
              </Caption>
            </View>
          ) : (
            <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
              {/* Vista previa de la etiqueta (marco con bordes redondeados) */}
              <View style={styles.previewCard}>
                <Text style={styles.previewBrand}>Joanis</Text>
                <Text style={styles.previewName} numberOfLines={2}>
                  {product?.name || '—'}
                </Text>
                <Text style={styles.previewPrice}>{formatLabelPrice(priceCents, currency)}</Text>
                <View style={styles.previewBarcode}>
                  <View style={styles.barcodeStripes}>
                    {Array.from({ length: 28 }).map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.barcodeBar,
                          { width: i % 3 === 0 ? 3 : i % 2 === 0 ? 1 : 2 },
                        ]}
                      />
                    ))}
                  </View>
                  <Caption color="tertiary" style={styles.previewCode}>
                    {barcodeValue || 'Sin código de barras'}
                  </Caption>
                </View>
              </View>

              {/* Selección de perfil de precio */}
              <Caption color="secondary" style={styles.sectionLabel}>
                Perfil de precio
              </Caption>
              {options.length === 0 ? (
                <Caption color="tertiary">No hay perfiles de precio disponibles.</Caption>
              ) : (
                <View style={styles.profileRow}>
                  {options.map((option) => {
                    const active = option.profileId === selectedProfileId;
                    return (
                      <Pressable
                        key={option.profileId}
                        onPress={() => handleSelectProfile(option)}
                        style={[styles.profileChip, active && styles.profileChipActive]}
                      >
                        <Text
                          variant="labelMedium"
                          color={active ? theme.color.text.inverse : 'primary'}
                        >
                          {option.profileName}
                        </Text>
                        <Caption color={active ? theme.color.text.inverse : 'tertiary'}>
                          {formatLabelPrice(option.priceCents, currency)}
                        </Caption>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {/* Edición manual del precio */}
              <Caption color="secondary" style={styles.sectionLabel}>
                Precio a imprimir
              </Caption>
              <View style={styles.inputRow}>
                <Text variant="titleMedium" color="primary" style={styles.currencySymbol}>
                  {currency === 'USD' ? '$' : 'S/'}
                </Text>
                <TextInput
                  style={styles.priceInput}
                  value={priceText}
                  onChangeText={handlePriceChange}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={theme.color.text.placeholder}
                  selectTextOnFocus
                />
              </View>
              <Button
                title={isPriceModified ? 'Confirmar precio' : 'Precio guardado'}
                variant={isPriceModified ? 'success' : 'outline'}
                size="small"
                leftIcon={isPriceModified ? 'save-outline' : 'checkmark-circle-outline'}
                onPress={handleConfirmPrice}
                loading={savingPrice}
                disabled={savingPrice || !selectedProfileId || priceCents <= 0 || !isPriceModified}
                style={styles.confirmPriceButton}
              />
              <Caption color="tertiary">
                Guarda este precio en el sistema para el perfil{' '}
                {selectedProfile?.profileName || 'seleccionado'}.
              </Caption>

              {/* Selección de impresora (solo Electron) */}
              {supportsPrinterSelection && (
                <>
                  <View style={styles.printerHeader}>
                    <Caption color="secondary" style={styles.sectionLabel}>
                      Impresora
                    </Caption>
                    <TouchableOpacity
                      style={styles.refreshPrinters}
                      onPress={() => void loadPrinters()}
                      disabled={loadingPrinters}
                    >
                      <Ionicons name="refresh" size={14} color={theme.color.state.info.text} />
                      <Caption color={theme.color.state.info.text}>
                        {loadingPrinters ? 'Buscando...' : 'Actualizar'}
                      </Caption>
                    </TouchableOpacity>
                  </View>
                  {printers.length === 0 ? (
                    <View style={styles.printerWarning}>
                      <Ionicons
                        name="warning-outline"
                        size={16}
                        color={theme.color.state.warning.text}
                      />
                      <Caption color={theme.color.state.warning.text} style={styles.flexOne}>
                        No se detecta ninguna impresora conectada. Enciende y conecta la impresora
                        térmica, luego pulsa Actualizar.
                      </Caption>
                    </View>
                  ) : (
                    <View style={styles.profileRow}>
                      {printers.map((printer) => {
                        const active = printer.name === selectedPrinter;
                        return (
                          <Pressable
                            key={printer.name}
                            onPress={() => setSelectedPrinter(printer.name)}
                            style={[styles.profileChip, active && styles.profileChipActive]}
                          >
                            <Text
                              variant="labelMedium"
                              color={active ? theme.color.text.inverse : 'primary'}
                              numberOfLines={1}
                            >
                              {printer.displayName}
                            </Text>
                            {printer.isDefault && (
                              <Caption color={active ? theme.color.text.inverse : 'tertiary'}>
                                Predeterminada
                              </Caption>
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </>
              )}

              {/* Número de copias */}
              <Caption color="secondary" style={styles.sectionLabel}>
                Copias
              </Caption>
              <View style={styles.copiesRow}>
                <TouchableOpacity
                  style={styles.copyStepBtn}
                  onPress={() =>
                    setCopies((c) => String(Math.max(1, (Math.floor(Number(c)) || 1) - 1)))
                  }
                >
                  <Ionicons name="remove" size={18} color={theme.color.icon.muted} />
                </TouchableOpacity>
                <TextInput
                  style={styles.copiesInput}
                  value={copies}
                  onChangeText={(v) => setCopies(v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                />
                <TouchableOpacity
                  style={styles.copyStepBtn}
                  onPress={() =>
                    setCopies((c) => String(Math.min(50, (Math.floor(Number(c)) || 1) + 1)))
                  }
                >
                  <Ionicons name="add" size={18} color={theme.color.icon.muted} />
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          <View style={styles.footer}>
            <Button
              title="Cancelar"
              variant="outline"
              onPress={onClose}
              disabled={printing}
              style={styles.footerButton}
            />
            <Button
              title="Imprimir"
              variant="primary"
              leftIcon="print-outline"
              onPress={handlePrint}
              disabled={loading || printing || priceCents <= 0}
              loading={printing}
              style={styles.footerButton}
            />
          </View>
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
      padding: theme.space[5],
    },
    container: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      width: '100%',
      maxWidth: 460,
      maxHeight: '90%',
      overflow: 'hidden',
      ...theme.shadow.xl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: theme.space[5],
      paddingTop: theme.space[5],
      paddingBottom: theme.space[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    flexOne: {
      flex: 1,
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.color.surface.subtle,
      marginLeft: theme.space[3],
    },
    loadingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.space[10],
    },
    loadingText: {
      marginTop: theme.space[3],
    },
    content: {
      flexGrow: 0,
    },
    contentInner: {
      padding: theme.space[5],
      gap: theme.space[2],
    },
    previewCard: {
      backgroundColor: '#ffffff',
      borderWidth: 1.5,
      borderColor: '#000000',
      borderRadius: theme.radii.xl,
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[4],
      alignItems: 'center',
      marginBottom: theme.space[3],
    },
    previewBrand: {
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 1.5,
      color: '#333333',
    },
    previewName: {
      fontSize: 18,
      fontWeight: '800',
      color: '#000000',
      textAlign: 'center',
      marginTop: 1,
    },
    previewPrice: {
      fontSize: 40,
      fontWeight: '800',
      color: '#000000',
      marginTop: theme.space[1],
    },
    previewBarcode: {
      alignItems: 'center',
      marginTop: theme.space[1],
    },
    barcodeStripes: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      height: 14,
      gap: 2,
    },
    barcodeBar: {
      height: '100%',
      backgroundColor: '#000000',
    },
    previewCode: {
      marginTop: 2,
      letterSpacing: 2,
    },
    sectionLabel: {
      marginTop: theme.space[2],
      marginBottom: theme.space[1],
    },
    profileRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[2],
    },
    printerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    refreshPrinters: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[1],
      paddingVertical: theme.space[1],
      paddingHorizontal: theme.space[2],
    },
    printerWarning: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      backgroundColor: theme.color.state.warning.background,
      borderRadius: theme.radii.md,
      padding: theme.space[3],
    },
    profileChip: {
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.surface.subtle,
      minWidth: 110,
    },
    profileChipActive: {
      backgroundColor: theme.color.brand.accent,
      borderColor: theme.color.brand.accent,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.surface.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.md,
      paddingHorizontal: theme.space[3],
    },
    currencySymbol: {
      marginRight: theme.space[2],
    },
    priceInput: {
      flex: 1,
      paddingVertical: theme.space[3],
      fontSize: 20,
      fontWeight: '700',
      color: theme.color.text.body,
    },
    confirmPriceButton: {
      marginTop: theme.space[2],
      alignSelf: 'flex-start',
    },
    copiesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
    },
    copyStepBtn: {
      width: 40,
      height: 40,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.surface.subtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copiesInput: {
      width: 72,
      textAlign: 'center',
      paddingVertical: theme.space[2.5],
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.surface.subtle,
      fontSize: 18,
      fontWeight: '700',
      color: theme.color.text.body,
    },
    footer: {
      flexDirection: 'row',
      gap: theme.space[3],
      padding: theme.space[5],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
    },
    footerButton: {
      flex: 1,
    },
  });

export default PriceLabelPrintModal;
