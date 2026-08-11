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
  Image,
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
import { productsApi } from '@/services/api/products';
import { photoCampaignsApi } from '@/services/api/photo-campaigns';
import type { PriceProfile } from '@/types/price-profiles';
import {
  printPriceLabel,
  formatLabelPrice,
  listPrinters,
  isElectronPrinting,
  type PrinterInfo,
} from '@/utils/priceLabel/priceLabelPrint';
import { printPriceStickers } from '@/utils/priceLabel/stickerLabelPrint';
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
  /** Stock actual del producto en la sede actual (default de cantidad de stickers). */
  sedeStock?: number;
}

type LabelTab = 'etiqueta' | 'sticker';

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

/**
 * Genera un código de barras aleatorio de 12 dígitos. Longitud par → el Code128
 * usa el modo C (compacto y bien escaneable en la etiqueta).
 */
const generateRandomBarcode = (): string => {
  let code = '';
  for (let i = 0; i < 12; i++) code += Math.floor(Math.random() * 10);
  return code;
};

/**
 * Devuelve `true` si el código de barras ya existe en el catálogo. Usa la
 * búsqueda de productos y verifica coincidencia exacta de `barcode` o `sku`.
 */
const barcodeExists = async (code: string): Promise<boolean> => {
  try {
    const { results } = await productsApi.searchProductsV2({ q: code, limit: 10 });
    return (results || []).some((p) => p.barcode === code || p.sku === code);
  } catch {
    return false;
  }
};

/**
 * Genera un código de barras aleatorio garantizando que no colisione con uno
 * existente. Reintenta hasta `maxAttempts` veces; si todas colisionan devuelve
 * el último candidato para no bloquear la operación.
 */
const generateUniqueBarcode = async (maxAttempts = 6): Promise<string> => {
  let candidate = generateRandomBarcode();
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (!(await barcodeExists(candidate))) return candidate;
    candidate = generateRandomBarcode();
  }
  return candidate;
};

export const PriceLabelPrintModal: React.FC<PriceLabelPrintModalProps> = ({
  visible,
  onClose,
  product,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [activeTab, setActiveTab] = useState<LabelTab>('etiqueta');
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [options, setOptions] = useState<PriceOption[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [priceText, setPriceText] = useState('');
  const [copies, setCopies] = useState('3');
  const [stickerQty, setStickerQty] = useState('1');
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string | null>(null);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [savingPrice, setSavingPrice] = useState(false);
  const [useRandomBarcode, setUseRandomBarcode] = useState(false);
  const [barcodeText, setBarcodeText] = useState('');
  const [generatingBarcode, setGeneratingBarcode] = useState(false);
  const [savingBarcode, setSavingBarcode] = useState(false);
  const [barcodeSaved, setBarcodeSaved] = useState(false);
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);

  const supportsPrinterSelection = isElectronPrinting();

  const currency = product?.currency || 'PEN';

  // El SKU impreso siempre es el original del producto (no se genera).
  const originalSku = (product?.sku || '').trim();
  const originalBarcode = (product?.barcode || product?.sku || '').trim();
  const effectiveSku = originalSku;
  // Código de barras efectivo: editable como texto libre. Se inicializa con el
  // del producto y se actualiza al generar uno aleatorio o al escribirlo.
  const barcodeValue = barcodeText.trim();

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

  // Foto del producto para mostrar al final del modal. Igual que el módulo de
  // campaña: prioriza el "design", luego el "reference" y por último la foto de
  // validación de compra (o cualquier otra disponible).
  const loadProductImage = useCallback(async () => {
    if (!product) return;
    try {
      setLoadingImage(true);
      // Fotos de campaña (design / reference) y datos del producto (catálogo /
      // foto de validación de compra) en paralelo.
      const [assets, productDetail] = await Promise.all([
        photoCampaignsApi.getProductPhotos(product.productId).catch(() => []),
        productsApi.getProductById(product.productId).catch(() => null),
      ]);

      const byType = (t: string) =>
        assets.find((a) => String(a.photoType).toLowerCase() === t && !!a.fileUrl)?.fileUrl;

      // Foto de validación de compra: se persiste como foto de catálogo del
      // producto (imageUrl / imageUrls / photos).
      const purchaseValidationUrl =
        productDetail?.imageUrl ||
        productDetail?.imageUrls?.find((u) => !!u) ||
        productDetail?.photos?.find((u) => !!u) ||
        undefined;

      const url =
        byType('design') ||
        byType('reference') ||
        purchaseValidationUrl ||
        assets.find((a) => !!a.fileUrl)?.fileUrl ||
        null;
      setProductImageUrl(url);
    } catch (error) {
      logger.error('Error cargando foto del producto para etiqueta', error);
      setProductImageUrl(null);
    } finally {
      setLoadingImage(false);
    }
  }, [product]);

  useEffect(() => {
    if (visible && product) {
      setActiveTab('etiqueta');
      setCopies('3');
      // Cantidad de stickers por defecto = stock actual del producto en la sede.
      const defaultQty = Math.max(1, Math.floor(product.sedeStock ?? 1));
      setStickerQty(String(defaultQty));
      setUseRandomBarcode(false);
      setBarcodeText((product.barcode || product.sku || '').trim());
      setBarcodeSaved(false);
      setProductImageUrl(null);
      void loadPrices();
      void loadPrinters();
      void loadProductImage();
    } else if (!visible) {
      setOptions([]);
      setSelectedProfileId(null);
      setPriceText('');
      setPrinters([]);
      setSelectedPrinter(null);
      setUseRandomBarcode(false);
      setBarcodeText('');
      setBarcodeSaved(false);
      setProductImageUrl(null);
    }
  }, [visible, product, loadPrices, loadPrinters, loadProductImage]);

  const handleSelectProfile = useCallback((option: PriceOption) => {
    setSelectedProfileId(option.profileId);
    setPriceText((option.priceCents / 100).toFixed(2));
  }, []);

  // Genera un código de barras aleatorio (verificando que no colisione con uno
  // existente); con el mismo botón regresa al código original del producto.
  const handleToggleRandomBarcode = useCallback(async () => {
    setBarcodeSaved(false);
    if (useRandomBarcode) {
      setUseRandomBarcode(false);
      setBarcodeText(originalBarcode);
      return;
    }
    try {
      setGeneratingBarcode(true);
      const unique = await generateUniqueBarcode();
      setBarcodeText(unique);
      setUseRandomBarcode(true);
    } catch (error) {
      logger.error('Error generando código de barras único', error);
      Alert.alert('Error', 'No se pudo generar un código de barras. Intenta de nuevo.');
    } finally {
      setGeneratingBarcode(false);
    }
  }, [useRandomBarcode, originalBarcode]);

  // Guarda el código de barras creado en el producto y confirma el guardado.
  const handleSaveBarcode = useCallback(async () => {
    if (!product || !barcodeValue) return;
    try {
      setSavingBarcode(true);
      await productsApi.updateProduct(product.productId, { barcode: barcodeValue });
      setBarcodeSaved(true);
      Alert.alert(
        'Código de barras guardado',
        'El código de barras se guardó correctamente en el producto.'
      );
    } catch (error) {
      logger.error('Error guardando código de barras', error);
      Alert.alert('Error', 'No se pudo guardar el código de barras en el producto.');
    } finally {
      setSavingBarcode(false);
    }
  }, [product, barcodeValue]);

  // El código de barras difiere del guardado en el producto.
  const canSaveBarcode =
    !!product && !!barcodeValue && barcodeValue !== originalBarcode && !barcodeSaved;

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
    try {
      setPrinting(true);
      if (activeTab === 'sticker') {
        const qtyNum = Math.max(1, Math.min(200, Math.floor(Number(stickerQty) || 1)));
        await printPriceStickers({
          productName: product.name,
          barcodeValue,
          sku: effectiveSku,
          priceCents,
          currency,
          quantity: qtyNum,
          deviceName: selectedPrinter ?? undefined,
        });
      } else {
        const copiesNum = Math.max(1, Math.min(50, Math.floor(Number(copies) || 1)));
        await printPriceLabel({
          productName: product.name,
          barcodeValue,
          priceCents,
          currency,
          profileName: selectedProfile?.profileName,
          copies: copiesNum,
          deviceName: selectedPrinter ?? undefined,
        });
      }
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
    stickerQty,
    activeTab,
    barcodeValue,
    effectiveSku,
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

          {/* Selector de cartilla: Etiqueta precio / Sticker precio */}
          <View style={styles.tabsRow}>
            {(
              [
                { key: 'etiqueta', label: 'Etiqueta precio', icon: 'pricetag-outline' },
                { key: 'sticker', label: 'Sticker precio', icon: 'documents-outline' },
              ] as { key: LabelTab; label: string; icon: keyof typeof Ionicons.glyphMap }[]
            ).map((tab) => {
              const active = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tabButton, active && styles.tabButtonActive]}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Ionicons
                    name={tab.icon}
                    size={16}
                    color={active ? theme.color.brand.accent : theme.color.icon.muted}
                  />
                  <Text
                    variant="labelMedium"
                    color={active ? theme.color.brand.accent : 'secondary'}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
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
              {/* Vista previa de la ETIQUETA (marco con bordes redondeados) */}
              {activeTab === 'etiqueta' && (
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
              )}

              {/* Vista previa de los STICKERS (3 por fila, 33 × 20 mm) */}
              {activeTab === 'sticker' && (
                <View style={styles.stickerPreviewWrap}>
                  <View style={styles.stickerRow}>
                    {Array.from({ length: 3 }).map((_, idx) => (
                      <View key={idx} style={styles.stickerCard}>
                        <Text style={styles.stickerBrand}>Joanis</Text>
                        <Text style={styles.stickerName} numberOfLines={1}>
                          {product?.name || '—'}
                        </Text>
                        <Text style={styles.stickerPrice} numberOfLines={1}>
                          {formatLabelPrice(priceCents, currency)}
                        </Text>
                        <View style={styles.stickerBarcodeStripes}>
                          {Array.from({ length: 20 }).map((__, i) => (
                            <View
                              key={i}
                              style={[styles.barcodeBar, { width: i % 3 === 0 ? 2 : 1 }]}
                            />
                          ))}
                        </View>
                        <Text style={styles.stickerSku} numberOfLines={1}>
                          {effectiveSku || barcodeValue || '—'}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <Caption color="tertiary" style={styles.stickerHint}>
                    Se imprimirán {Math.max(1, Math.floor(Number(stickerQty) || 1))} sticker(s), 3
                    por fila.
                  </Caption>
                </View>
              )}

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

              {/* Código de barras (ambas cartillas) */}
              <Caption color="secondary" style={styles.sectionLabel}>
                Código de barras
              </Caption>
              <TextInput
                style={styles.barcodeInput}
                value={barcodeText}
                onChangeText={(v) => {
                  setBarcodeText(v);
                  setUseRandomBarcode(false);
                  setBarcodeSaved(false);
                }}
                placeholder="Ingresa o genera el código de barras"
                placeholderTextColor={theme.color.text.placeholder}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <View style={styles.skuRow}>
                <View style={styles.flexOne}>
                  <Caption color="tertiary">
                    {generatingBarcode
                      ? 'Verificando disponibilidad...'
                      : useRandomBarcode
                        ? 'Código aleatorio verificado (sin duplicar)'
                        : barcodeValue === originalBarcode
                          ? 'Código original del producto'
                          : 'Código editado manualmente'}
                  </Caption>
                </View>
                <Button
                  title={useRandomBarcode ? 'Regresar' : 'Generar aleatorio'}
                  variant={useRandomBarcode ? 'outline' : 'primary'}
                  size="small"
                  leftIcon={useRandomBarcode ? 'arrow-undo-outline' : 'shuffle-outline'}
                  onPress={() => void handleToggleRandomBarcode()}
                  loading={generatingBarcode}
                  disabled={generatingBarcode}
                />
              </View>
              <Button
                title={barcodeSaved ? 'Código guardado' : 'Guardar código de barras'}
                variant={barcodeSaved ? 'outline' : 'success'}
                size="small"
                leftIcon={barcodeSaved ? 'checkmark-circle-outline' : 'save-outline'}
                onPress={handleSaveBarcode}
                loading={savingBarcode}
                disabled={savingBarcode || !canSaveBarcode}
                style={styles.confirmPriceButton}
              />

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

              {/* Número de copias / cantidad de stickers */}
              <Caption color="secondary" style={styles.sectionLabel}>
                {activeTab === 'sticker' ? 'Cantidad de stickers' : 'Copias'}
              </Caption>
              {activeTab === 'sticker' && (
                <Caption color="tertiary">
                  Por defecto: stock actual en la sede (
                  {Math.max(0, Math.floor(product?.sedeStock ?? 0))}).
                </Caption>
              )}
              <View style={styles.copiesRow}>
                <TouchableOpacity
                  style={styles.copyStepBtn}
                  onPress={() =>
                    activeTab === 'sticker'
                      ? setStickerQty((c) => String(Math.max(1, (Math.floor(Number(c)) || 1) - 1)))
                      : setCopies((c) => String(Math.max(1, (Math.floor(Number(c)) || 1) - 1)))
                  }
                >
                  <Ionicons name="remove" size={18} color={theme.color.icon.muted} />
                </TouchableOpacity>
                <TextInput
                  style={styles.copiesInput}
                  value={activeTab === 'sticker' ? stickerQty : copies}
                  onChangeText={(v) =>
                    activeTab === 'sticker'
                      ? setStickerQty(v.replace(/[^0-9]/g, ''))
                      : setCopies(v.replace(/[^0-9]/g, ''))
                  }
                  keyboardType="number-pad"
                />
                <TouchableOpacity
                  style={styles.copyStepBtn}
                  onPress={() =>
                    activeTab === 'sticker'
                      ? setStickerQty((c) =>
                          String(Math.min(200, (Math.floor(Number(c)) || 1) + 1))
                        )
                      : setCopies((c) => String(Math.min(50, (Math.floor(Number(c)) || 1) + 1)))
                  }
                >
                  <Ionicons name="add" size={18} color={theme.color.icon.muted} />
                </TouchableOpacity>
              </View>

              {/* Foto del producto (design → referencia → validación de compra) */}
              <Caption color="secondary" style={styles.sectionLabel}>
                Foto del producto
              </Caption>
              {loadingImage ? (
                <View style={styles.productImageLoading}>
                  <ActivityIndicator size="small" color={theme.color.brand.accent} />
                </View>
              ) : productImageUrl ? (
                <Image
                  source={{ uri: productImageUrl }}
                  style={styles.productImage}
                  resizeMode="contain"
                />
              ) : (
                <Caption color="tertiary">Sin foto disponible para este producto.</Caption>
              )}
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
              title={activeTab === 'sticker' ? 'Imprimir stickers' : 'Imprimir'}
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
    tabsRow: {
      flexDirection: 'row',
      gap: theme.space[2],
      paddingHorizontal: theme.space[5],
      paddingTop: theme.space[3],
      paddingBottom: theme.space[1],
    },
    tabButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space[1.5],
      paddingVertical: theme.space[2.5],
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.surface.subtle,
    },
    tabButtonActive: {
      borderColor: theme.color.brand.accent,
      backgroundColor: theme.color.surface.base,
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
    stickerPreviewWrap: {
      alignItems: 'center',
      marginBottom: theme.space[3],
    },
    stickerRow: {
      flexDirection: 'row',
      gap: theme.space[2],
      justifyContent: 'center',
    },
    stickerCard: {
      backgroundColor: '#ffffff',
      borderWidth: 1,
      borderColor: '#000000',
      borderRadius: theme.radii.sm,
      paddingVertical: theme.space[1.5],
      paddingHorizontal: theme.space[1.5],
      alignItems: 'center',
      width: 96,
    },
    stickerBrand: {
      fontSize: 8,
      fontWeight: '700',
      letterSpacing: 0.5,
      color: '#333333',
    },
    stickerName: {
      fontSize: 9,
      fontWeight: '700',
      color: '#000000',
      textAlign: 'center',
    },
    stickerPrice: {
      fontSize: 16,
      fontWeight: '800',
      color: '#000000',
      marginVertical: 1,
    },
    stickerBarcodeStripes: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      height: 10,
      gap: 1,
      marginTop: 1,
    },
    stickerSku: {
      fontSize: 7,
      letterSpacing: 0.5,
      color: '#333333',
      marginTop: 1,
    },
    stickerHint: {
      marginTop: theme.space[2],
      textAlign: 'center',
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
    barcodeInput: {
      backgroundColor: theme.color.surface.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.md,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[3],
      fontSize: 16,
      fontWeight: '600',
      letterSpacing: 1,
      color: theme.color.text.body,
    },
    productImage: {
      width: '100%',
      height: 200,
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.surface.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    productImageLoading: {
      height: 200,
      alignItems: 'center',
      justifyContent: 'center',
    },
    skuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.space[3],
      backgroundColor: theme.color.surface.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.md,
      paddingVertical: theme.space[2.5],
      paddingHorizontal: theme.space[3],
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
