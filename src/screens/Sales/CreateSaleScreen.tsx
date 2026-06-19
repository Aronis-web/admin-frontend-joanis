import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@/store/auth';
import { salesApi } from '@/services/api/sales';
import { companiesApi } from '@/services/api/companies';
import { warehousesApi } from '@/services/api/warehouses';
import { priceProfilesApi } from '@/services/api/price-profiles';
import { inventoryApi } from '@/services/api/inventory';
import { CustomerAutocomplete } from '@/components/Bizlinks/CustomerAutocomplete';
import { ProductAutocomplete } from '@/components/Bizlinks/ProductAutocomplete';
import { Customer } from '@/types/customers';
import { Product } from '@/services/api/products';
import { StockItemResponse } from '@/services/api/inventory';
import { Warehouse } from '@/types/warehouses';
import { PaymentMethod, Company } from '@/types/companies';
import { PriceProfile } from '@/types/price-profiles';
import { SaleType, DocumentType, CreateSaleItemRequest } from '@/types/sales';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import logger from '@/utils/logger';

const CODIGO_AFECTACION_IGV = {
  GRAVADO_ONEROSA: '10',
  EXONERADO_ONEROSA: '20',
  GRAVADO_BONIFICACIONES: '15',
};

const AFECTACION_IGV_OPTIONS = [
  { value: '10', label: 'Gravado (IGV)', icon: 'checkmark-circle' },
  { value: '20', label: 'Exonerado', icon: 'remove-circle' },
  { value: '15', label: 'BonificaciÃ³n', icon: 'gift' },
];

interface SaleItem {
  product: Product;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
  stock: StockItemResponse[];
  availableStock: number;
  warehouseId?: string;
  warehouseName?: string;
  selectedPresentationId?: string;
  codigoAfectacionIgv: string;
  notes?: string;
}

export const CreateSaleScreen: React.FC = () => {
  const navigation = useNavigation();
  const { currentCompany, currentSite } = useAuthStore();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  // State
  const [saleType, setSaleType] = useState<SaleType>(SaleType.B2C);
  const [documentType, setDocumentType] = useState<DocumentType>(DocumentType.BOLETA);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [selectedPriceProfile, setSelectedPriceProfile] = useState<PriceProfile | null>(null);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [notes, setNotes] = useState('');

  // Loading states
  const [loading, setLoading] = useState(false);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);
  const [loadingPriceProfiles, setLoadingPriceProfiles] = useState(false);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  // Data
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [priceProfiles, setPriceProfiles] = useState<PriceProfile[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  useEffect(() => {
    if (currentSite?.id) {
      loadWarehouses();
    }
  }, [currentSite?.id]);

  useEffect(() => {
    if (currentCompany?.id) {
      loadPaymentMethods();
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    loadPriceProfiles();
  }, []);

  useEffect(() => {
    if (saleType === SaleType.B2B) {
      loadCompanies();
    }
  }, [saleType]);

  const loadWarehouses = async () => {
    if (!currentSite?.id) return;
    setLoadingWarehouses(true);
    try {
      const response = await warehousesApi.getWarehouses(currentCompany?.id, currentSite.id);
      setWarehouses(response);
      if (response.length > 0 && !selectedWarehouse) {
        setSelectedWarehouse(response[0]);
      }
    } catch (error) {
      logger.error('Error cargando almacenes:', error);
    } finally {
      setLoadingWarehouses(false);
    }
  };

  const loadPaymentMethods = async () => {
    if (!currentCompany?.id) return;
    setLoadingPaymentMethods(true);
    try {
      const data = await companiesApi.getPaymentMethods(currentCompany.id);
      setPaymentMethods(data);
      if (data.length > 0 && !selectedPaymentMethod) {
        setSelectedPaymentMethod(data[0]);
      }
    } catch (error) {
      logger.error('Error cargando mÃ©todos de pago:', error);
    } finally {
      setLoadingPaymentMethods(false);
    }
  };

  const loadPriceProfiles = async () => {
    setLoadingPriceProfiles(true);
    try {
      const profiles = await priceProfilesApi.getActivePriceProfiles();
      setPriceProfiles(profiles);
    } catch (error) {
      logger.error('Error cargando perfiles de precio:', error);
    } finally {
      setLoadingPriceProfiles(false);
    }
  };

  const loadCompanies = async () => {
    setLoadingCompanies(true);
    try {
      const data = await companiesApi.getActiveCompanies();
      setCompanies(data);
    } catch (error) {
      logger.error('Error cargando empresas:', error);
    } finally {
      setLoadingCompanies(false);
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
  };

  const handleSelectProduct = useCallback(async (product: Product) => {
    try {
      const stockResponse = await inventoryApi.getStockByProductWithAreas(product.id);

      if (!stockResponse || stockResponse.length === 0) {
        Alert.alert('Sin Stock', 'Este producto no tiene stock disponible.');
        return;
      }

      let filteredStock = stockResponse;
      if (currentSite?.id) {
        filteredStock = stockResponse.filter((s) => s.warehouse?.siteId === currentSite.id);
        if (filteredStock.length === 0) {
          Alert.alert('Sin Stock', 'No hay stock disponible en esta sede.');
          return;
        }
      }

      const warehouseWithMostStock = filteredStock.reduce((prev, current) =>
        current.availableQuantityBase > prev.availableQuantityBase ? current : prev
      );

      const totalStock = filteredStock.reduce((sum, s) => sum + s.availableQuantityBase, 0);

      let unitPriceCents = product.costCents || 0;
      if (selectedPriceProfile && product.salePrices && product.salePrices.length > 0) {
        const salePrice = product.salePrices.find(
          (sp) => sp.profileId === selectedPriceProfile.id && !sp.presentationId
        );
        if (salePrice) {
          unitPriceCents = salePrice.priceCents;
        } else {
          const factor = typeof selectedPriceProfile.factorToCost === 'string'
            ? parseFloat(selectedPriceProfile.factorToCost)
            : selectedPriceProfile.factorToCost;
          unitPriceCents = Math.round(product.costCents * factor);
        }
      }

      const newItem: SaleItem = {
        product,
        quantity: 1,
        unitPriceCents,
        discountCents: 0,
        stock: filteredStock,
        availableStock: totalStock,
        warehouseId: warehouseWithMostStock.warehouseId,
        warehouseName: warehouseWithMostStock.warehouse?.name || 'AlmacÃ©n',
        codigoAfectacionIgv: CODIGO_AFECTACION_IGV.GRAVADO_ONEROSA,
        notes: '',
      };

      setItems([...items, newItem]);
    } catch (error) {
      logger.error('Error al obtener stock:', error);
      Alert.alert('Error', 'No se pudo obtener el stock del producto');
    }
  }, [currentSite?.id, selectedPriceProfile, items]);

  const handleUpdateQuantity = (index: number, quantity: number) => {
    const newItems = [...items];
    const item = newItems[index];
    if (quantity > item.availableStock) {
      Alert.alert('Stock Insuficiente', `Solo hay ${item.availableStock} unidades disponibles`);
      return;
    }
    newItems[index].quantity = quantity;
    setItems(newItems);
  };

  const handleUpdatePrice = (index: number, priceCents: number) => {
    const newItems = [...items];
    newItems[index].unitPriceCents = priceCents;
    setItems(newItems);
  };

  const handleUpdateDiscount = (index: number, discountCents: number) => {
    const newItems = [...items];
    newItems[index].discountCents = discountCents;
    setItems(newItems);
  };

  const handleUpdateCodigoAfectacionIgv = (index: number, codigo: string) => {
    const newItems = [...items];
    newItems[index].codigoAfectacionIgv = codigo;
    setItems(newItems);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let discount = 0;
    let total = 0;

    items.forEach((item) => {
      const itemSubtotal = item.quantity * item.unitPriceCents;
      const itemDiscount = item.quantity * item.discountCents;
      const itemTotal = itemSubtotal - itemDiscount;
      subtotal += itemSubtotal;
      discount += itemDiscount;
      total += itemTotal;
    });

    return { subtotal, discount, total };
  };

  const handleCreateSale = async () => {
    if (saleType === SaleType.B2C && !selectedCustomer) {
      Alert.alert('Error', 'Debe seleccionar un cliente');
      return;
    }
    if (saleType === SaleType.B2B && !selectedCompany) {
      Alert.alert('Error', 'Debe seleccionar una empresa');
      return;
    }
    if (items.length === 0) {
      Alert.alert('Error', 'Debe agregar al menos un producto');
      return;
    }
    if (!currentSite?.id) {
      Alert.alert('Error', 'No se ha seleccionado una sede');
      return;
    }

    const itemsWithoutWarehouse = items.filter(item => !item.warehouseId);
    if (itemsWithoutWarehouse.length > 0) {
      Alert.alert('Error', 'Algunos productos no tienen almacÃ©n asignado');
      return;
    }

    const warehouseId = items[0].warehouseId;
    const differentWarehouse = items.find(item => item.warehouseId !== warehouseId);
    if (differentWarehouse) {
      Alert.alert('Error', 'Todos los productos deben estar en el mismo almacÃ©n.');
      return;
    }

    setLoading(true);
    try {
      const saleItems: CreateSaleItemRequest[] = items.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        discountCents: item.discountCents,
        codigoAfectacionIgv: item.codigoAfectacionIgv,
        notes: item.notes || undefined,
      }));

      const saleData = {
        saleType,
        documentType,
        customerId: saleType === SaleType.B2C ? selectedCustomer?.id : undefined,
        companyId: saleType === SaleType.B2B ? selectedCompany?.id : undefined,
        siteId: currentSite.id,
        warehouseId: warehouseId!,
        items: saleItems,
        paymentMethodId: selectedPaymentMethod?.id,
        notes: notes.trim() || undefined,
      };

      const sale = await salesApi.createSale(saleData);

      Alert.alert('Ã‰xito', `Venta ${sale.code} creada exitosamente`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      logger.error('âŒ Error creando venta:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Error desconocido';
      Alert.alert('Error', `No se pudo crear la venta: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={[theme.color.brand.headerFrom, theme.color.brand.headerTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.color.brand.onHeader} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Nueva Venta</Text>
            <Text style={styles.headerSubtitle}>Crear venta independiente</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Sale Type */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="pricetag-outline" size={20} color={theme.color.icon.muted} />
            <Text style={styles.sectionTitle}>Tipo de Venta</Text>
          </View>
          <View style={styles.typeButtons}>
            <TouchableOpacity
              style={[styles.typeButton, saleType === SaleType.B2C && styles.typeButtonActive]}
              onPress={() => { setSaleType(SaleType.B2C); setSelectedCustomer(null); setSelectedCompany(null); }}
            >
              <Ionicons
                name="person-outline"
                size={24}
                color={saleType === SaleType.B2C ? theme.color.brand.onHeader : theme.color.text.muted}
              />
              <Text style={[styles.typeButtonText, saleType === SaleType.B2C && styles.typeButtonTextActive]}>
                B2C - Cliente
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, saleType === SaleType.B2B && styles.typeButtonActive]}
              onPress={() => { setSaleType(SaleType.B2B); setSelectedCustomer(null); setSelectedCompany(null); }}
            >
              <Ionicons
                name="business-outline"
                size={24}
                color={saleType === SaleType.B2B ? theme.color.brand.onHeader : theme.color.text.muted}
              />
              <Text style={[styles.typeButtonText, saleType === SaleType.B2B && styles.typeButtonTextActive]}>
                B2B - Empresa
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Document Type */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={20} color={theme.color.icon.muted} />
            <Text style={styles.sectionTitle}>Tipo de Documento</Text>
          </View>
          <View style={styles.documentTypeButtons}>
            {[
              { type: DocumentType.BOLETA, icon: 'receipt-outline', label: 'Boleta', hint: 'Documento tributario' },
              { type: DocumentType.FACTURA, icon: 'document-outline', label: 'Factura', hint: 'Documento tributario' },
              { type: DocumentType.NOTA_VENTA, icon: 'create-outline', label: 'Nota de Venta', hint: 'Control interno' },
            ].map((doc) => (
              <TouchableOpacity
                key={doc.type}
                style={[styles.documentTypeButton, documentType === doc.type && styles.documentTypeButtonActive]}
                onPress={() => setDocumentType(doc.type)}
              >
                <Ionicons
                  name={doc.icon as any}
                  size={24}
                  color={documentType === doc.type ? theme.color.brand.onHeader : theme.color.text.subtle}
                />
                <Text style={[styles.documentTypeText, documentType === doc.type && styles.documentTypeTextActive]}>
                  {doc.label}
                </Text>
                <Text style={[styles.documentTypeHint, documentType === doc.type && styles.documentTypeHintActive]}>
                  {doc.hint}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Customer Selection */}
        {saleType === SaleType.B2C && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person-outline" size={20} color={theme.color.icon.muted} />
              <Text style={styles.sectionTitle}>Cliente</Text>
            </View>
            {selectedCustomer ? (
              <View style={styles.selectedCard}>
                <View style={styles.selectedCardIcon}>
                  <Ionicons name="person" size={24} color={theme.color.icon.success} />
                </View>
                <View style={styles.selectedCardContent}>
                  <Text style={styles.selectedCardTitle}>{selectedCustomer.fullName}</Text>
                  <Text style={styles.selectedCardSubtitle}>{selectedCustomer.documentNumber}</Text>
                </View>
                <TouchableOpacity style={styles.removeButton} onPress={() => setSelectedCustomer(null)}>
                  <Ionicons name="close" size={20} color={theme.color.brand.onHeader} />
                </TouchableOpacity>
              </View>
            ) : (
              <CustomerAutocomplete
                onSelectCustomer={handleSelectCustomer}
                placeholder="Buscar cliente por nombre o DNI..."
                documentTypeFilter={documentType === DocumentType.BOLETA ? 'DNI' : documentType === DocumentType.FACTURA ? 'RUC' : 'ALL'}
              />
            )}
          </View>
        )}

        {/* Company Selection for B2B */}
        {saleType === SaleType.B2B && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="business-outline" size={20} color={theme.color.icon.muted} />
              <Text style={styles.sectionTitle}>Empresa</Text>
            </View>
            {loadingCompanies ? (
              <ActivityIndicator size="small" color={theme.color.brand.accent} />
            ) : (
              <View style={styles.pickerContainer}>
                {companies.map((company) => (
                  <TouchableOpacity
                    key={company.id}
                    style={[styles.pickerItem, selectedCompany?.id === company.id && styles.pickerItemActive]}
                    onPress={() => setSelectedCompany(company)}
                  >
                    <View style={styles.pickerItemIcon}>
                      <Ionicons
                        name="business"
                        size={20}
                        color={selectedCompany?.id === company.id ? theme.color.brand.onHeader : theme.color.text.subtle}
                      />
                    </View>
                    <View style={styles.pickerItemContent}>
                      <Text style={[styles.pickerItemText, selectedCompany?.id === company.id && styles.pickerItemTextActive]}>
                        {company.name}
                      </Text>
                      {company.ruc && (
                        <Text style={[styles.pickerItemSubtext, selectedCompany?.id === company.id && styles.pickerItemSubtextActive]}>
                          RUC: {company.ruc}
                        </Text>
                      )}
                    </View>
                    {selectedCompany?.id === company.id && (
                      <Ionicons name="checkmark-circle" size={24} color={theme.color.brand.onHeader} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Payment Method */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="wallet-outline" size={20} color={theme.color.icon.muted} />
            <Text style={styles.sectionTitle}>MÃ©todo de Pago</Text>
            <Text style={styles.optionalTag}>Opcional</Text>
          </View>
          {loadingPaymentMethods ? (
            <ActivityIndicator size="small" color={theme.color.brand.accent} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.horizontalPicker}>
                <TouchableOpacity
                  style={[styles.chipButton, !selectedPaymentMethod && styles.chipButtonActive]}
                  onPress={() => setSelectedPaymentMethod(null)}
                >
                  <Text style={[styles.chipButtonText, !selectedPaymentMethod && styles.chipButtonTextActive]}>
                    Sin mÃ©todo
                  </Text>
                </TouchableOpacity>
                {paymentMethods.map((method) => (
                  <TouchableOpacity
                    key={method.id}
                    style={[styles.chipButton, selectedPaymentMethod?.id === method.id && styles.chipButtonActive]}
                    onPress={() => setSelectedPaymentMethod(method)}
                  >
                    <Text style={[styles.chipButtonText, selectedPaymentMethod?.id === method.id && styles.chipButtonTextActive]}>
                      {method.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
        </View>

        {/* Price Profile */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="pricetags-outline" size={20} color={theme.color.icon.muted} />
            <Text style={styles.sectionTitle}>Perfil de Precio</Text>
            <Text style={styles.optionalTag}>Opcional</Text>
          </View>
          {loadingPriceProfiles ? (
            <ActivityIndicator size="small" color={theme.color.brand.accent} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.horizontalPicker}>
                <TouchableOpacity
                  style={[styles.chipButton, !selectedPriceProfile && styles.chipButtonActive]}
                  onPress={() => setSelectedPriceProfile(null)}
                >
                  <Text style={[styles.chipButtonText, !selectedPriceProfile && styles.chipButtonTextActive]}>
                    Usar costo
                  </Text>
                </TouchableOpacity>
                {priceProfiles.map((profile) => {
                  const factor = typeof profile.factorToCost === 'string' ? parseFloat(profile.factorToCost) : profile.factorToCost;
                  const margin = ((factor - 1) * 100).toFixed(0);
                  return (
                    <TouchableOpacity
                      key={profile.id}
                      style={[styles.chipButton, selectedPriceProfile?.id === profile.id && styles.chipButtonActive]}
                      onPress={() => setSelectedPriceProfile(profile)}
                    >
                      <Text style={[styles.chipButtonText, selectedPriceProfile?.id === profile.id && styles.chipButtonTextActive]}>
                        {profile.name} (+{margin}%)
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </View>

        {/* Products */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cube-outline" size={20} color={theme.color.icon.muted} />
            <Text style={styles.sectionTitle}>Productos ({items.length})</Text>
          </View>

          <ProductAutocomplete
            onSelectProduct={handleSelectProduct}
            placeholder="Buscar producto por nombre, SKU..."
            excludeProductIds={items.map((item) => item.product.id)}
          />

          {items.length === 0 ? (
            <View style={styles.emptyProducts}>
              <Ionicons name="cube-outline" size={48} color={theme.color.border.default} />
              <Text style={styles.emptyProductsText}>No hay productos agregados</Text>
              <Text style={styles.emptyProductsHint}>Usa el buscador para agregar productos</Text>
            </View>
          ) : (
            <View style={styles.productsList}>
              {items.map((item, index) => (
                <View key={`${item.product.id}-${index}`} style={styles.productCard}>
                  <View style={styles.productHeader}>
                    <View style={styles.productHeaderLeft}>
                      <Text style={styles.productName} numberOfLines={2}>{item.product.title}</Text>
                      <View style={styles.productMeta}>
                        <Text style={styles.productSku}>SKU: {item.product.sku}</Text>
                        {item.warehouseName && (
                          <View style={styles.warehouseBadge}>
                            <Ionicons name="cube" size={12} color={theme.color.brand.accent} />
                            <Text style={styles.warehouseText}>{item.warehouseName}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity style={styles.removeProductButton} onPress={() => handleRemoveItem(index)}>
                      <Ionicons name="trash-outline" size={18} color={theme.color.icon.danger} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.stockInfo}>
                    <Ionicons name="layers-outline" size={14} color={theme.color.icon.success} />
                    <Text style={styles.stockText}>Stock disponible: {item.availableStock} uds.</Text>
                  </View>

                  <View style={styles.productInputs}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Cantidad</Text>
                      <TextInput
                        style={styles.input}
                        value={item.quantity.toString()}
                        onChangeText={(text) => handleUpdateQuantity(index, parseInt(text) || 0)}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Precio (S/)</Text>
                      <TextInput
                        style={styles.input}
                        value={(item.unitPriceCents / 100).toFixed(2)}
                        onChangeText={(text) => handleUpdatePrice(index, Math.round((parseFloat(text) || 0) * 100))}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Desc. (S/)</Text>
                      <TextInput
                        style={styles.input}
                        value={(item.discountCents / 100).toFixed(2)}
                        onChangeText={(text) => handleUpdateDiscount(index, Math.round((parseFloat(text) || 0) * 100))}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>

                  {/* IGV Type */}
                  <View style={styles.igvSection}>
                    <Text style={styles.igvLabel}>Tipo IGV:</Text>
                    <View style={styles.igvButtons}>
                      {AFECTACION_IGV_OPTIONS.map((option) => (
                        <TouchableOpacity
                          key={option.value}
                          style={[styles.igvButton, item.codigoAfectacionIgv === option.value && styles.igvButtonActive]}
                          onPress={() => handleUpdateCodigoAfectacionIgv(index, option.value)}
                        >
                          <Ionicons
                            name={option.icon as any}
                            size={14}
                            color={item.codigoAfectacionIgv === option.value ? theme.color.brand.onHeader : theme.color.text.subtle}
                          />
                          <Text style={[styles.igvButtonText, item.codigoAfectacionIgv === option.value && styles.igvButtonTextActive]}>
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.productTotal}>
                    <Text style={styles.productTotalLabel}>Subtotal</Text>
                    <Text style={styles.productTotalValue}>
                      S/ {((item.quantity * item.unitPriceCents - item.quantity * item.discountCents) / 100).toFixed(2)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="chatbox-outline" size={20} color={theme.color.icon.muted} />
            <Text style={styles.sectionTitle}>Notas</Text>
            <Text style={styles.optionalTag}>Opcional</Text>
          </View>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Agregar notas sobre la venta..."
            placeholderTextColor={theme.color.text.placeholder}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Totals */}
        {items.length > 0 && (
          <View style={styles.totalsCard}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>S/ {(totals.subtotal / 100).toFixed(2)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Descuento</Text>
              <Text style={[styles.totalValue, { color: theme.color.text.danger }]}>
                -S/ {(totals.discount / 100).toFixed(2)}
              </Text>
            </View>
            <View style={styles.totalRowFinal}>
              <Text style={styles.totalLabelFinal}>Total</Text>
              <Text style={styles.totalValueFinal}>S/ {(totals.total / 100).toFixed(2)}</Text>
            </View>
          </View>
        )}

        {/* Create Button */}
        <TouchableOpacity
          style={[styles.createButton, loading && styles.createButtonDisabled]}
          onPress={handleCreateSale}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={theme.color.brand.onHeader} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={22} color={theme.color.brand.onHeader} />
              <Text style={styles.createButtonText}>Crear Venta</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background.subtle,
  },
  headerGradient: {
    paddingHorizontal: theme.space[4],
    paddingTop: theme.space[2],
    paddingBottom: theme.space[4],
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.color.brand.headerBadge,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.space[3],
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.color.brand.onHeader,
  },
  headerSubtitle: {
    fontSize: 13,
    color: theme.color.brand.onHeaderMuted,
    marginTop: theme.space[0.5],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.space[4],
  },
  section: {
    marginBottom: theme.space[5],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
    marginBottom: theme.space[3],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.text.body,
    flex: 1,
  },
  optionalTag: {
    fontSize: 11,
    color: theme.color.text.placeholder,
    fontWeight: '500',
    backgroundColor: theme.color.background.muted,
    paddingHorizontal: theme.space[2],
    paddingVertical: theme.space[0.5],
    borderRadius: theme.radii.sm,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: theme.space[3],
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.space[4],
    borderRadius: theme.radii.xl,
    backgroundColor: theme.color.surface.base,
    borderWidth: 2,
    borderColor: theme.color.border.subtle,
    gap: theme.space[2],
    ...theme.shadow.sm,
  },
  typeButtonActive: {
    backgroundColor: theme.color.brand.primary,
    borderColor: theme.color.brand.primary,
  },
  typeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.color.text.muted,
  },
  typeButtonTextActive: {
    color: theme.color.brand.onHeader,
  },
  documentTypeButtons: {
    flexDirection: 'row',
    gap: theme.space[2],
  },
  documentTypeButton: {
    flex: 1,
    alignItems: 'center',
    padding: theme.space[3],
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.surface.base,
    borderWidth: 2,
    borderColor: theme.color.border.subtle,
    gap: theme.space[1],
  },
  documentTypeButtonActive: {
    backgroundColor: theme.color.state.success.border,
    borderColor: theme.color.state.success.border,
  },
  documentTypeText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.color.text.muted,
  },
  documentTypeTextActive: {
    color: theme.color.brand.onHeader,
  },
  documentTypeHint: {
    fontSize: 10,
    color: theme.color.text.placeholder,
  },
  documentTypeHintActive: {
    color: theme.color.brand.onHeaderMuted,
  },
  selectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii.xl,
    padding: theme.space[4],
    borderWidth: 2,
    borderColor: theme.color.state.success.border,
    ...theme.shadow.sm,
  },
  selectedCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.color.state.success.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.space[3],
  },
  selectedCardContent: {
    flex: 1,
  },
  selectedCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.text.heading,
  },
  selectedCardSubtitle: {
    fontSize: 13,
    color: theme.color.text.subtle,
    marginTop: theme.space[0.5],
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.color.action.danger.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    gap: theme.space[2],
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.space[3],
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.surface.base,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    gap: theme.space[3],
  },
  pickerItemActive: {
    backgroundColor: theme.color.brand.primary,
    borderColor: theme.color.brand.primary,
  },
  pickerItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.color.background.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerItemContent: {
    flex: 1,
  },
  pickerItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.color.text.body,
  },
  pickerItemTextActive: {
    color: theme.color.brand.onHeader,
  },
  pickerItemSubtext: {
    fontSize: 12,
    color: theme.color.text.subtle,
    marginTop: theme.space[0.5],
  },
  pickerItemSubtextActive: {
    color: theme.color.brand.onHeaderMuted,
  },
  horizontalPicker: {
    flexDirection: 'row',
    gap: theme.space[2],
    paddingRight: theme.space[4],
  },
  chipButton: {
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2.5],
    borderRadius: theme.radii.full,
    backgroundColor: theme.color.surface.base,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
  },
  chipButtonActive: {
    backgroundColor: theme.color.brand.primary,
    borderColor: theme.color.brand.primary,
  },
  chipButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.color.text.muted,
  },
  chipButtonTextActive: {
    color: theme.color.brand.onHeader,
  },
  emptyProducts: {
    alignItems: 'center',
    padding: theme.space[10],
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii.xl,
    borderWidth: 2,
    borderColor: theme.color.border.subtle,
    borderStyle: 'dashed',
    marginTop: theme.space[3],
  },
  emptyProductsText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.text.subtle,
    marginTop: theme.space[3],
  },
  emptyProductsHint: {
    fontSize: 13,
    color: theme.color.text.placeholder,
    marginTop: theme.space[1],
  },
  productsList: {
    gap: theme.space[3],
    marginTop: theme.space[3],
  },
  productCard: {
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii.xl,
    padding: theme.space[4],
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    ...theme.shadow.sm,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.space[3],
  },
  productHeaderLeft: {
    flex: 1,
    marginRight: theme.space[3],
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.color.text.heading,
    marginBottom: theme.space[2],
  },
  productMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[3],
  },
  productSku: {
    fontSize: 12,
    color: theme.color.text.subtle,
  },
  warehouseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.state.info.background,
    paddingHorizontal: theme.space[2],
    paddingVertical: theme.space[1],
    borderRadius: theme.radii.sm,
    gap: theme.space[1],
  },
  warehouseText: {
    fontSize: 11,
    color: theme.color.state.info.text,
    fontWeight: '500',
  },
  removeProductButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.color.state.danger.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stockInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[1.5],
    marginBottom: theme.space[3],
    backgroundColor: theme.color.state.success.background,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
    borderRadius: theme.radii.md,
  },
  stockText: {
    fontSize: 13,
    color: theme.color.state.success.text,
    fontWeight: '500',
  },
  productInputs: {
    flexDirection: 'row',
    gap: theme.space[2],
    marginBottom: theme.space[3],
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 11,
    color: theme.color.text.subtle,
    fontWeight: '500',
    marginBottom: theme.space[1],
  },
  input: {
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    borderRadius: theme.radii.md,
    padding: theme.space[2.5],
    fontSize: 14,
    backgroundColor: theme.color.background.subtle,
    color: theme.color.text.heading,
    textAlign: 'center',
    fontWeight: '600',
  },
  igvSection: {
    marginBottom: theme.space[3],
  },
  igvLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.color.text.subtle,
    marginBottom: theme.space[2],
  },
  igvButtons: {
    flexDirection: 'row',
    gap: theme.space[2],
  },
  igvButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.space[2],
    borderRadius: theme.radii.md,
    backgroundColor: theme.color.background.muted,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    gap: theme.space[1],
  },
  igvButtonActive: {
    backgroundColor: theme.color.state.success.border,
    borderColor: theme.color.state.success.border,
  },
  igvButtonText: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.color.text.muted,
  },
  igvButtonTextActive: {
    color: theme.color.brand.onHeader,
  },
  productTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.space[3],
    borderTopWidth: 1,
    borderTopColor: theme.color.background.muted,
  },
  productTotalLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.color.text.subtle,
  },
  productTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.text.success,
  },
  notesInput: {
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii.lg,
    padding: theme.space[4],
    fontSize: 14,
    color: theme.color.text.heading,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  totalsCard: {
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii.xl,
    padding: theme.space[5],
    marginBottom: theme.space[5],
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    ...theme.shadow.sm,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.space[2],
  },
  totalLabel: {
    fontSize: 14,
    color: theme.color.text.subtle,
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.body,
  },
  totalRowFinal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: theme.space[3],
    marginTop: theme.space[2],
    borderTopWidth: 2,
    borderTopColor: theme.color.border.subtle,
  },
  totalLabelFinal: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  totalValueFinal: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.color.text.success,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.state.success.border,
    padding: theme.space[4],
    borderRadius: theme.radii.xl,
    gap: theme.space[2],
    ...theme.shadow.md,
  },
  createButtonDisabled: {
    backgroundColor: theme.color.border.default,
  },
  createButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.color.brand.onHeader,
  },
  bottomSpacer: {
    height: theme.space[10],
  },
});
