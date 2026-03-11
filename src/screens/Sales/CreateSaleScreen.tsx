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
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@/store/auth';
import { salesApi } from '@/services/api/sales';
import { companiesApi } from '@/services/api/companies';
import { warehousesApi } from '@/services/api/warehouses';
import { priceProfilesApi } from '@/services/api/price-profiles';
import { inventoryApi } from '@/services/api/inventory';
import { CustomerAutocomplete } from '@/components/Bizlinks/CustomerAutocomplete';
import { ProductAutocomplete } from '@/components/Bizlinks/ProductAutocomplete';
import { Customer, CustomerType } from '@/types/customers';
import { Product, ProductSalePrice } from '@/services/api/products';
import { StockItemResponse } from '@/services/api/inventory';
import { Warehouse } from '@/types/warehouses';
import { PaymentMethod, Company } from '@/types/companies';
import { PriceProfile } from '@/types/price-profiles';
import { SaleType, DocumentType, CreateSaleItemRequest } from '@/types/sales';
import logger from '@/utils/logger';

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
}

export const CreateSaleScreen: React.FC = () => {
  const navigation = useNavigation();
  const { currentCompany, currentSite } = useAuthStore();

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

  // Load warehouses
  useEffect(() => {
    if (currentSite?.id) {
      loadWarehouses();
    }
  }, [currentSite?.id]);

  // Load payment methods
  useEffect(() => {
    if (currentCompany?.id) {
      loadPaymentMethods();
    }
  }, [currentCompany?.id]);

  // Load price profiles
  useEffect(() => {
    loadPriceProfiles();
  }, []);

  // Load companies for B2B
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

      // Auto-select first warehouse
      if (response.length > 0 && !selectedWarehouse) {
        setSelectedWarehouse(response[0]);
      }
    } catch (error) {
      logger.error('Error cargando almacenes:', error);
      Alert.alert('Error', 'No se pudieron cargar los almacenes');
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

      // Auto-select first payment method
      if (data.length > 0 && !selectedPaymentMethod) {
        setSelectedPaymentMethod(data[0]);
      }
    } catch (error) {
      logger.error('Error cargando métodos de pago:', error);
      Alert.alert('Error', 'No se pudieron cargar los métodos de pago');
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
      // No mostrar alerta, es opcional
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
      Alert.alert('Error', 'No se pudieron cargar las empresas');
    } finally {
      setLoadingCompanies(false);
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
  };

  const handleSelectProduct = useCallback(async (product: Product) => {
    try {
      // Obtener stock del producto en todos los almacenes
      const stockResponse = await inventoryApi.getStockByProductWithAreas(product.id);

      if (!stockResponse || stockResponse.length === 0) {
        Alert.alert(
          'Sin Stock',
          'Este producto no tiene stock disponible en ningún almacén.'
        );
        return;
      }

      // Filtrar solo almacenes del sitio actual si hay sitio seleccionado
      let filteredStock = stockResponse;
      if (currentSite?.id) {
        filteredStock = stockResponse.filter(
          (s) => s.warehouse?.siteId === currentSite.id
        );

        if (filteredStock.length === 0) {
          Alert.alert(
            'Sin Stock',
            'Este producto no tiene stock disponible en los almacenes de esta sede.'
          );
          return;
        }
      }

      // Encontrar el almacén con mayor stock disponible
      const warehouseWithMostStock = filteredStock.reduce((prev, current) => {
        return (current.availableQuantityBase > prev.availableQuantityBase) ? current : prev;
      });

      const totalStock = filteredStock.reduce((sum, s) => sum + s.availableQuantityBase, 0);

      // Obtener precio de venta según el perfil seleccionado
      let unitPriceCents = product.costCents || 0;

      if (selectedPriceProfile && product.salePrices && product.salePrices.length > 0) {
        // Buscar el precio de venta para el perfil seleccionado
        const salePrice = product.salePrices.find(
          (sp) => sp.profileId === selectedPriceProfile.id && !sp.presentationId
        );

        if (salePrice) {
          unitPriceCents = salePrice.priceCents;
        } else {
          // Calcular precio basado en el factor del perfil
          const factor = typeof selectedPriceProfile.factorToCost === 'string'
            ? parseFloat(selectedPriceProfile.factorToCost)
            : selectedPriceProfile.factorToCost;
          unitPriceCents = Math.round(product.costCents * factor);
        }
      }

      // Auto-seleccionar el almacén deducido
      const deducedWarehouse = warehouses.find(w => w.id === warehouseWithMostStock.warehouseId);
      if (deducedWarehouse && !selectedWarehouse) {
        setSelectedWarehouse(deducedWarehouse);
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
      };

      setItems([...items, newItem]);
    } catch (error) {
      logger.error('Error al obtener stock del producto:', error);
      Alert.alert('Error', 'No se pudo obtener el stock del producto');
    }
  }, [currentSite?.id, selectedPriceProfile, selectedWarehouse, warehouses, items]);

  const handleUpdateQuantity = (index: number, quantity: number) => {
    const newItems = [...items];
    const item = newItems[index];

    if (quantity > item.availableStock) {
      Alert.alert(
        'Stock Insuficiente',
        `Solo hay ${item.availableStock} unidades disponibles`
      );
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

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
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
    // Validaciones
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

    // Verificar que todos los productos tengan almacén asignado
    const itemsWithoutWarehouse = items.filter(item => !item.warehouseId);
    if (itemsWithoutWarehouse.length > 0) {
      Alert.alert('Error', 'Algunos productos no tienen almacén asignado');
      return;
    }

    // Obtener el almacén del primer producto (todos deberían estar en el mismo almacén)
    const warehouseId = items[0].warehouseId;

    // Verificar que todos los productos estén en el mismo almacén
    const differentWarehouse = items.find(item => item.warehouseId !== warehouseId);
    if (differentWarehouse) {
      Alert.alert(
        'Error',
        'Todos los productos deben estar en el mismo almacén. Por favor, selecciona productos del mismo almacén.'
      );
      return;
    }

    setLoading(true);
    try {
      const saleItems: CreateSaleItemRequest[] = items.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        discountCents: item.discountCents,
      }));

      const saleData = {
        saleType,
        documentType,
        customerId: saleType === SaleType.B2C ? selectedCustomer?.id : undefined,
        companyId: saleType === SaleType.B2B ? selectedCompany?.id : undefined,
        siteId: currentSite.id,
        warehouseId: warehouseId!, // Usar el almacén deducido de los productos
        items: saleItems,
        paymentMethodId: selectedPaymentMethod?.id,
        notes: notes.trim() || undefined,
      };

      logger.info('📝 Creando venta:', saleData);

      const sale = await salesApi.createSale(saleData);

      logger.info('✅ Venta creada exitosamente:', sale);

      Alert.alert(
        'Éxito',
        `Venta ${sale.code} creada exitosamente`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
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
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Volver</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Nueva Venta</Text>
        </View>

        {/* Sale Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tipo de Venta</Text>
          <View style={styles.typeButtons}>
            <TouchableOpacity
              style={[
                styles.typeButton,
                saleType === SaleType.B2C && styles.typeButtonActive,
              ]}
              onPress={() => {
                setSaleType(SaleType.B2C);
                setSelectedCustomer(null);
                setSelectedCompany(null);
              }}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  saleType === SaleType.B2C && styles.typeButtonTextActive,
                ]}
              >
                B2C - Cliente
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.typeButton,
                saleType === SaleType.B2B && styles.typeButtonActive,
              ]}
              onPress={() => {
                setSaleType(SaleType.B2B);
                setSelectedCustomer(null);
                setSelectedCompany(null);
              }}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  saleType === SaleType.B2B && styles.typeButtonTextActive,
                ]}
              >
                B2B - Empresa
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Document Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tipo de Documento</Text>
          <Text style={styles.sectionHint}>
            Selecciona el tipo de documento a generar para esta venta
          </Text>
          <View style={styles.documentTypeButtons}>
            <TouchableOpacity
              style={[
                styles.documentTypeButton,
                documentType === DocumentType.BOLETA && styles.documentTypeButtonActive,
              ]}
              onPress={() => setDocumentType(DocumentType.BOLETA)}
            >
              <Text
                style={[
                  styles.documentTypeButtonText,
                  documentType === DocumentType.BOLETA && styles.documentTypeButtonTextActive,
                ]}
              >
                📄 Boleta
              </Text>
              <Text
                style={[
                  styles.documentTypeButtonHint,
                  documentType === DocumentType.BOLETA && styles.documentTypeButtonHintActive,
                ]}
              >
                Documento tributario
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.documentTypeButton,
                documentType === DocumentType.FACTURA && styles.documentTypeButtonActive,
              ]}
              onPress={() => setDocumentType(DocumentType.FACTURA)}
            >
              <Text
                style={[
                  styles.documentTypeButtonText,
                  documentType === DocumentType.FACTURA && styles.documentTypeButtonTextActive,
                ]}
              >
                📋 Factura
              </Text>
              <Text
                style={[
                  styles.documentTypeButtonHint,
                  documentType === DocumentType.FACTURA && styles.documentTypeButtonHintActive,
                ]}
              >
                Documento tributario
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.documentTypeButton,
                documentType === DocumentType.NOTA_VENTA && styles.documentTypeButtonActive,
              ]}
              onPress={() => setDocumentType(DocumentType.NOTA_VENTA)}
            >
              <Text
                style={[
                  styles.documentTypeButtonText,
                  documentType === DocumentType.NOTA_VENTA && styles.documentTypeButtonTextActive,
                ]}
              >
                📝 Nota de Venta
              </Text>
              <Text
                style={[
                  styles.documentTypeButtonHint,
                  documentType === DocumentType.NOTA_VENTA && styles.documentTypeButtonHintActive,
                ]}
              >
                Solo control interno
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Customer/Company Selection */}
        {saleType === SaleType.B2C && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cliente</Text>
            <Text style={styles.sectionHint}>
              {documentType === DocumentType.BOLETA
                ? 'Buscar persona natural (DNI, CE, Pasaporte)'
                : documentType === DocumentType.FACTURA
                ? 'Buscar empresa (RUC)'
                : 'Buscar cliente'}
            </Text>
            <CustomerAutocomplete
              onSelectCustomer={handleSelectCustomer}
              placeholder={
                documentType === DocumentType.BOLETA
                  ? 'Buscar cliente por nombre o DNI...'
                  : documentType === DocumentType.FACTURA
                  ? 'Buscar empresa por razón social o RUC...'
                  : 'Buscar cliente...'
              }
              documentTypeFilter={
                documentType === DocumentType.BOLETA
                  ? 'DNI'
                  : documentType === DocumentType.FACTURA
                  ? 'RUC'
                  : 'ALL'
              }
            />
          </View>
        )}

        {saleType === SaleType.B2B && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Empresa</Text>
            <Text style={styles.sectionHint}>
              Selecciona una empresa configurada en el sistema
            </Text>
            {loadingCompanies ? (
              <ActivityIndicator size="small" color="#007bff" />
            ) : (
              <View style={styles.pickerContainer}>
                {companies.length === 0 ? (
                  <View style={styles.emptyCompanies}>
                    <Text style={styles.emptyCompaniesText}>
                      No hay empresas disponibles
                    </Text>
                  </View>
                ) : (
                  companies.map((company) => (
                    <TouchableOpacity
                      key={company.id}
                      style={[
                        styles.pickerItem,
                        selectedCompany?.id === company.id && styles.pickerItemActive,
                      ]}
                      onPress={() => setSelectedCompany(company)}
                    >
                      <View style={styles.pickerItemContent}>
                        <View style={styles.companyItemInfo}>
                          <Text
                            style={[
                              styles.pickerItemText,
                              selectedCompany?.id === company.id && styles.pickerItemTextActive,
                            ]}
                          >
                            {company.name}
                          </Text>
                          {company.ruc && (
                            <Text
                              style={[
                                styles.pickerItemSubtext,
                                selectedCompany?.id === company.id && styles.pickerItemSubtextActive,
                              ]}
                            >
                              RUC: {company.ruc}
                            </Text>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </View>
        )}

        {/* Payment Method Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Método de Pago (Opcional)</Text>
          {loadingPaymentMethods ? (
            <ActivityIndicator size="small" color="#007bff" />
          ) : (
            <View style={styles.pickerContainer}>
              <TouchableOpacity
                style={[
                  styles.pickerItem,
                  !selectedPaymentMethod && styles.pickerItemActive,
                ]}
                onPress={() => setSelectedPaymentMethod(null)}
              >
                <Text
                  style={[
                    styles.pickerItemText,
                    !selectedPaymentMethod && styles.pickerItemTextActive,
                  ]}
                >
                  Sin método de pago
                </Text>
              </TouchableOpacity>
              {paymentMethods.map((method) => (
                <TouchableOpacity
                  key={method.id}
                  style={[
                    styles.pickerItem,
                    selectedPaymentMethod?.id === method.id && styles.pickerItemActive,
                  ]}
                  onPress={() => setSelectedPaymentMethod(method)}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      selectedPaymentMethod?.id === method.id && styles.pickerItemTextActive,
                    ]}
                  >
                    {method.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Price Profile Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Perfil de Precio de Venta (Opcional)</Text>
          <Text style={styles.sectionHint}>
            Selecciona un perfil para aplicar precios automáticamente a los productos
          </Text>
          {loadingPriceProfiles ? (
            <ActivityIndicator size="small" color="#007bff" />
          ) : (
            <View style={styles.pickerContainer}>
              <TouchableOpacity
                style={[
                  styles.pickerItem,
                  !selectedPriceProfile && styles.pickerItemActive,
                ]}
                onPress={() => setSelectedPriceProfile(null)}
              >
                <Text
                  style={[
                    styles.pickerItemText,
                    !selectedPriceProfile && styles.pickerItemTextActive,
                  ]}
                >
                  Sin perfil (usar costo)
                </Text>
              </TouchableOpacity>
              {priceProfiles.map((profile) => {
                const factor = typeof profile.factorToCost === 'string'
                  ? parseFloat(profile.factorToCost)
                  : profile.factorToCost;
                const margin = ((factor - 1) * 100).toFixed(0);
                return (
                  <TouchableOpacity
                    key={profile.id}
                    style={[
                      styles.pickerItem,
                      selectedPriceProfile?.id === profile.id && styles.pickerItemActive,
                    ]}
                    onPress={() => setSelectedPriceProfile(profile)}
                  >
                    <View style={styles.pickerItemContent}>
                      <Text
                        style={[
                          styles.pickerItemText,
                          selectedPriceProfile?.id === profile.id && styles.pickerItemTextActive,
                        ]}
                      >
                        {profile.name}
                      </Text>
                      <Text
                        style={[
                          styles.pickerItemSubtext,
                          selectedPriceProfile?.id === profile.id && styles.pickerItemSubtextActive,
                        ]}
                      >
                        +{margin}% margen
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Products */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Productos ({items.length})</Text>
          <Text style={styles.sectionHint}>
            Busca y agrega productos a la venta
          </Text>

          {/* Product Autocomplete - Always visible */}
          <ProductAutocomplete
            onSelectProduct={handleSelectProduct}
            placeholder="Buscar producto por nombre, SKU o código de barras..."
            excludeProductIds={items.map((item) => item.product.id)}
          />

          {items.length === 0 ? (
            <View style={styles.emptyProducts}>
              <Text style={styles.emptyProductsText}>
                No hay productos agregados
              </Text>
              <Text style={styles.emptyProductsHint}>
                Usa el buscador de arriba para agregar productos
              </Text>
            </View>
          ) : (
            <View style={styles.productsList}>
              {items.map((item, index) => (
                <View key={`${item.product.id}-${index}`} style={styles.productItem}>
                  <View style={styles.productHeader}>
                    <View style={styles.productHeaderLeft}>
                      <Text style={styles.productName} numberOfLines={2}>
                        {item.product.title}
                      </Text>
                      <Text style={styles.productSku}>SKU: {item.product.sku}</Text>
                      {item.warehouseName && (
                        <Text style={styles.productWarehouse}>
                          📦 {item.warehouseName}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemoveItem(index)}
                      style={styles.removeProductButton}
                    >
                      <Text style={styles.removeProductButtonText}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.stockInfo}>
                    <Text style={styles.productStock}>
                      Stock disponible: {item.availableStock} unidades
                    </Text>
                  </View>

                  <View style={styles.productInputs}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Cantidad</Text>
                      <TextInput
                        style={styles.input}
                        value={item.quantity.toString()}
                        onChangeText={(text) => {
                          const qty = parseInt(text) || 0;
                          handleUpdateQuantity(index, qty);
                        }}
                        keyboardType="numeric"
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Precio Unit. (S/)</Text>
                      <TextInput
                        style={styles.input}
                        value={(item.unitPriceCents / 100).toFixed(2)}
                        onChangeText={(text) => {
                          const price = parseFloat(text) || 0;
                          handleUpdatePrice(index, Math.round(price * 100));
                        }}
                        keyboardType="decimal-pad"
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Descuento (S/)</Text>
                      <TextInput
                        style={styles.input}
                        value={(item.discountCents / 100).toFixed(2)}
                        onChangeText={(text) => {
                          const discount = parseFloat(text) || 0;
                          handleUpdateDiscount(index, Math.round(discount * 100));
                        }}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>

                  <View style={styles.productTotal}>
                    <Text style={styles.productTotalLabel}>Subtotal:</Text>
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
          <Text style={styles.sectionTitle}>Notas (Opcional)</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Agregar notas sobre la venta..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Totals */}
        {items.length > 0 && (
          <View style={styles.totalsSection}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal:</Text>
              <Text style={styles.totalValue}>S/ {(totals.subtotal / 100).toFixed(2)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Descuento:</Text>
              <Text style={styles.totalValue}>- S/ {(totals.discount / 100).toFixed(2)}</Text>
            </View>
            <View style={[styles.totalRow, styles.totalRowFinal]}>
              <Text style={styles.totalLabelFinal}>Total:</Text>
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
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.createButtonText}>Crear Venta</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 20,
  },
  backButton: {
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007bff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  sectionHint: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  typeButtonActive: {
    borderColor: '#007bff',
    backgroundColor: '#E3F2FD',
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  typeButtonTextActive: {
    color: '#007bff',
  },
  documentTypeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  documentTypeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  documentTypeButtonActive: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  documentTypeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  documentTypeButtonTextActive: {
    color: '#10B981',
  },
  documentTypeButtonHint: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
  },
  documentTypeButtonHintActive: {
    color: '#059669',
  },
  selectedCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  selectedCardContent: {
    flex: 1,
  },
  selectedCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  selectedCardSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  selectedCardDetail: {
    fontSize: 13,
    color: '#999',
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  selectButton: {
    backgroundColor: '#007bff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  pickerContainer: {
    gap: 8,
  },
  pickerItem: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  pickerItemActive: {
    borderColor: '#007bff',
    backgroundColor: '#E3F2FD',
  },
  pickerItemText: {
    fontSize: 15,
    color: '#666',
  },
  pickerItemTextActive: {
    color: '#007bff',
    fontWeight: '600',
  },
  pickerItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  pickerItemSubtext: {
    fontSize: 12,
    color: '#999',
  },
  pickerItemSubtextActive: {
    color: '#007bff',
  },
  companyItemInfo: {
    flex: 1,
  },
  emptyCompanies: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  emptyCompaniesText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  emptyProducts: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    marginTop: 16,
  },
  emptyProductsText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 8,
  },
  emptyProductsHint: {
    fontSize: 13,
    color: '#bbb',
    fontStyle: 'italic',
  },
  productsList: {
    gap: 12,
    marginTop: 16,
  },
  productItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  productHeaderLeft: {
    flex: 1,
    gap: 4,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  removeProductButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeProductButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  productSku: {
    fontSize: 13,
    color: '#666',
  },
  productWarehouse: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '500',
  },
  stockInfo: {
    marginBottom: 12,
  },
  productStock: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '500',
  },
  productInputs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  productTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  productTotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  productTotalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#fff',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  totalsSection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 15,
    color: '#666',
  },
  totalValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  totalRowFinal: {
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#ddd',
    marginTop: 4,
  },
  totalLabelFinal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValueFinal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#10B981',
  },
  createButton: {
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButtonDisabled: {
    backgroundColor: '#ccc',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
