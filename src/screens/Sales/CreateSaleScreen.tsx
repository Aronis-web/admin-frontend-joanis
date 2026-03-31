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
import { colors, spacing, borderRadius, shadows } from '@/design-system/tokens';
import logger from '@/utils/logger';

const CODIGO_AFECTACION_IGV = {
  GRAVADO_ONEROSA: '10',
  EXONERADO_ONEROSA: '20',
  GRAVADO_BONIFICACIONES: '15',
};

const AFECTACION_IGV_OPTIONS = [
  { value: '10', label: 'Gravado (IGV)', icon: 'checkmark-circle' },
  { value: '20', label: 'Exonerado', icon: 'remove-circle' },
  { value: '15', label: 'Bonificación', icon: 'gift' },
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
      logger.error('Error cargando métodos de pago:', error);
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
        warehouseName: warehouseWithMostStock.warehouse?.name || 'Almacén',
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
      Alert.alert('Error', 'Algunos productos no tienen almacén asignado');
      return;
    }

    const warehouseId = items[0].warehouseId;
    const differentWarehouse = items.find(item => item.warehouseId !== warehouseId);
    if (differentWarehouse) {
      Alert.alert('Error', 'Todos los productos deben estar en el mismo almacén.');
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

      Alert.alert('Éxito', `Venta ${sale.code} creada exitosamente`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      logger.error('❌ Error creando venta:', error);
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
        colors={[colors.primary[900], colors.primary[800]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.neutral[0]} />
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
            <Ionicons name="pricetag-outline" size={20} color={colors.neutral[600]} />
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
                color={saleType === SaleType.B2C ? colors.neutral[0] : colors.neutral[600]}
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
                color={saleType === SaleType.B2B ? colors.neutral[0] : colors.neutral[600]}
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
            <Ionicons name="document-text-outline" size={20} color={colors.neutral[600]} />
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
                  color={documentType === doc.type ? colors.neutral[0] : colors.neutral[500]}
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
              <Ionicons name="person-outline" size={20} color={colors.neutral[600]} />
              <Text style={styles.sectionTitle}>Cliente</Text>
            </View>
            {selectedCustomer ? (
              <View style={styles.selectedCard}>
                <View style={styles.selectedCardIcon}>
                  <Ionicons name="person" size={24} color={colors.success[600]} />
                </View>
                <View style={styles.selectedCardContent}>
                  <Text style={styles.selectedCardTitle}>{selectedCustomer.fullName}</Text>
                  <Text style={styles.selectedCardSubtitle}>{selectedCustomer.documentNumber}</Text>
                </View>
                <TouchableOpacity style={styles.removeButton} onPress={() => setSelectedCustomer(null)}>
                  <Ionicons name="close" size={20} color={colors.neutral[0]} />
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
              <Ionicons name="business-outline" size={20} color={colors.neutral[600]} />
              <Text style={styles.sectionTitle}>Empresa</Text>
            </View>
            {loadingCompanies ? (
              <ActivityIndicator size="small" color={colors.accent[500]} />
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
                        color={selectedCompany?.id === company.id ? colors.neutral[0] : colors.neutral[500]}
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
                      <Ionicons name="checkmark-circle" size={24} color={colors.neutral[0]} />
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
            <Ionicons name="wallet-outline" size={20} color={colors.neutral[600]} />
            <Text style={styles.sectionTitle}>Método de Pago</Text>
            <Text style={styles.optionalTag}>Opcional</Text>
          </View>
          {loadingPaymentMethods ? (
            <ActivityIndicator size="small" color={colors.accent[500]} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.horizontalPicker}>
                <TouchableOpacity
                  style={[styles.chipButton, !selectedPaymentMethod && styles.chipButtonActive]}
                  onPress={() => setSelectedPaymentMethod(null)}
                >
                  <Text style={[styles.chipButtonText, !selectedPaymentMethod && styles.chipButtonTextActive]}>
                    Sin método
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
            <Ionicons name="pricetags-outline" size={20} color={colors.neutral[600]} />
            <Text style={styles.sectionTitle}>Perfil de Precio</Text>
            <Text style={styles.optionalTag}>Opcional</Text>
          </View>
          {loadingPriceProfiles ? (
            <ActivityIndicator size="small" color={colors.accent[500]} />
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
            <Ionicons name="cube-outline" size={20} color={colors.neutral[600]} />
            <Text style={styles.sectionTitle}>Productos ({items.length})</Text>
          </View>

          <ProductAutocomplete
            onSelectProduct={handleSelectProduct}
            placeholder="Buscar producto por nombre, SKU..."
            excludeProductIds={items.map((item) => item.product.id)}
          />

          {items.length === 0 ? (
            <View style={styles.emptyProducts}>
              <Ionicons name="cube-outline" size={48} color={colors.neutral[300]} />
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
                            <Ionicons name="cube" size={12} color={colors.accent[600]} />
                            <Text style={styles.warehouseText}>{item.warehouseName}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity style={styles.removeProductButton} onPress={() => handleRemoveItem(index)}>
                      <Ionicons name="trash-outline" size={18} color={colors.danger[500]} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.stockInfo}>
                    <Ionicons name="layers-outline" size={14} color={colors.success[600]} />
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
                            color={item.codigoAfectacionIgv === option.value ? colors.neutral[0] : colors.neutral[500]}
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
            <Ionicons name="chatbox-outline" size={20} color={colors.neutral[600]} />
            <Text style={styles.sectionTitle}>Notas</Text>
            <Text style={styles.optionalTag}>Opcional</Text>
          </View>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Agregar notas sobre la venta..."
            placeholderTextColor={colors.neutral[400]}
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
              <Text style={[styles.totalValue, { color: colors.danger[500] }]}>
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
            <ActivityIndicator size="small" color={colors.neutral[0]} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={22} color={colors.neutral[0]} />
              <Text style={styles.createButtonText}>Crear Venta</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  headerGradient: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[4],
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.neutral[0],
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: spacing[0.5],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[4],
  },
  section: {
    marginBottom: spacing[5],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[700],
    flex: 1,
  },
  optionalTag: {
    fontSize: 11,
    color: colors.neutral[400],
    fontWeight: '500',
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: borderRadius.sm,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surface.primary,
    borderWidth: 2,
    borderColor: colors.neutral[200],
    gap: spacing[2],
    ...shadows.sm,
  },
  typeButtonActive: {
    backgroundColor: colors.primary[900],
    borderColor: colors.primary[900],
  },
  typeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.neutral[600],
  },
  typeButtonTextActive: {
    color: colors.neutral[0],
  },
  documentTypeButtons: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  documentTypeButton: {
    flex: 1,
    alignItems: 'center',
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface.primary,
    borderWidth: 2,
    borderColor: colors.neutral[200],
    gap: spacing[1],
  },
  documentTypeButtonActive: {
    backgroundColor: colors.success[500],
    borderColor: colors.success[500],
  },
  documentTypeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[600],
  },
  documentTypeTextActive: {
    color: colors.neutral[0],
  },
  documentTypeHint: {
    fontSize: 10,
    color: colors.neutral[400],
  },
  documentTypeHintActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  selectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    borderWidth: 2,
    borderColor: colors.success[300],
    ...shadows.sm,
  },
  selectedCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.success[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  selectedCardContent: {
    flex: 1,
  },
  selectedCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[800],
  },
  selectedCardSubtitle: {
    fontSize: 13,
    color: colors.neutral[500],
    marginTop: spacing[0.5],
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.danger[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    gap: spacing[2],
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface.primary,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    gap: spacing[3],
  },
  pickerItemActive: {
    backgroundColor: colors.primary[900],
    borderColor: colors.primary[900],
  },
  pickerItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerItemContent: {
    flex: 1,
  },
  pickerItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.neutral[700],
  },
  pickerItemTextActive: {
    color: colors.neutral[0],
  },
  pickerItemSubtext: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: spacing[0.5],
  },
  pickerItemSubtextActive: {
    color: 'rgba(255,255,255,0.7)',
  },
  horizontalPicker: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingRight: spacing[4],
  },
  chipButton: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface.primary,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  chipButtonActive: {
    backgroundColor: colors.primary[900],
    borderColor: colors.primary[900],
  },
  chipButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.neutral[600],
  },
  chipButtonTextActive: {
    color: colors.neutral[0],
  },
  emptyProducts: {
    alignItems: 'center',
    padding: spacing[10],
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.neutral[200],
    borderStyle: 'dashed',
    marginTop: spacing[3],
  },
  emptyProductsText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[500],
    marginTop: spacing[3],
  },
  emptyProductsHint: {
    fontSize: 13,
    color: colors.neutral[400],
    marginTop: spacing[1],
  },
  productsList: {
    gap: spacing[3],
    marginTop: spacing[3],
  },
  productCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    ...shadows.sm,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[3],
  },
  productHeaderLeft: {
    flex: 1,
    marginRight: spacing[3],
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: spacing[2],
  },
  productMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  productSku: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  warehouseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent[50],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
    gap: spacing[1],
  },
  warehouseText: {
    fontSize: 11,
    color: colors.accent[700],
    fontWeight: '500',
  },
  removeProductButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.danger[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  stockInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    marginBottom: spacing[3],
    backgroundColor: colors.success[50],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
  },
  stockText: {
    fontSize: 13,
    color: colors.success[700],
    fontWeight: '500',
  },
  productInputs: {
    flexDirection: 'row',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 11,
    color: colors.neutral[500],
    fontWeight: '500',
    marginBottom: spacing[1],
  },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.md,
    padding: spacing[2.5],
    fontSize: 14,
    backgroundColor: colors.neutral[50],
    color: colors.neutral[800],
    textAlign: 'center',
    fontWeight: '600',
  },
  igvSection: {
    marginBottom: spacing[3],
  },
  igvLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.neutral[500],
    marginBottom: spacing[2],
  },
  igvButtons: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  igvButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    gap: spacing[1],
  },
  igvButtonActive: {
    backgroundColor: colors.success[500],
    borderColor: colors.success[500],
  },
  igvButtonText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.neutral[600],
  },
  igvButtonTextActive: {
    color: colors.neutral[0],
  },
  productTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  productTotalLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.neutral[500],
  },
  productTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.success[600],
  },
  notesInput: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    fontSize: 14,
    color: colors.neutral[800],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    minHeight: 80,
    textAlignVertical: 'top',
  },
  totalsCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[5],
    marginBottom: spacing[5],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    ...shadows.sm,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  totalLabel: {
    fontSize: 14,
    color: colors.neutral[500],
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  totalRowFinal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing[3],
    marginTop: spacing[2],
    borderTopWidth: 2,
    borderTopColor: colors.neutral[200],
  },
  totalLabelFinal: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  totalValueFinal: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.success[600],
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success[500],
    padding: spacing[4],
    borderRadius: borderRadius.xl,
    gap: spacing[2],
    ...shadows.md,
  },
  createButtonDisabled: {
    backgroundColor: colors.neutral[300],
  },
  createButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.neutral[0],
  },
  bottomSpacer: {
    height: spacing[10],
  },
});
