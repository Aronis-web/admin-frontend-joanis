import React, { useState, useEffect } from 'react';
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
import { CustomerSearchModal } from '@/components/Sales/CustomerSearchModal';
import { ProductSearchModal } from '@/components/Sales/ProductSearchModal';
import { Customer, CustomerType } from '@/types/customers';
import { Product } from '@/services/api/products';
import { StockItemResponse } from '@/services/api/inventory';
import { Warehouse } from '@/types/warehouses';
import { PaymentMethod } from '@/types/companies';
import { SaleType, CreateSaleItemRequest } from '@/types/sales';
import logger from '@/utils/logger';

interface SaleItem {
  product: Product;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
  stock: StockItemResponse[];
  availableStock: number;
}

export const CreateSaleScreen: React.FC = () => {
  const navigation = useNavigation();
  const { currentCompany, currentSite } = useAuthStore();

  // State
  const [saleType, setSaleType] = useState<SaleType>(SaleType.B2C);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [notes, setNotes] = useState('');

  // Modals
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);

  // Data
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

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

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
  };

  const handleSelectProduct = (product: Product, stock: StockItemResponse[]) => {
    // Calcular stock disponible total
    const totalStock = stock.reduce((sum, s) => sum + s.availableQuantityBase, 0);

    // Obtener precio base del producto (en centavos)
    const unitPriceCents = product.costCents || 0;

    const newItem: SaleItem = {
      product,
      quantity: 1,
      unitPriceCents,
      discountCents: 0,
      stock,
      availableStock: totalStock,
    };

    setItems([...items, newItem]);
  };

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
    if (!selectedCustomer) {
      Alert.alert('Error', 'Debe seleccionar un cliente');
      return;
    }

    if (!selectedWarehouse) {
      Alert.alert('Error', 'Debe seleccionar un almacén');
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
        customerId: saleType === SaleType.B2C ? selectedCustomer.id : undefined,
        companyId: saleType === SaleType.B2B ? selectedCustomer.id : undefined,
        siteId: currentSite.id,
        warehouseId: selectedWarehouse.id,
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

        {/* Customer Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {saleType === SaleType.B2C ? 'Cliente' : 'Empresa'}
          </Text>
          {selectedCustomer ? (
            <View style={styles.selectedCard}>
              <View style={styles.selectedCardContent}>
                <Text style={styles.selectedCardTitle}>
                  {selectedCustomer.razonSocial || selectedCustomer.fullName}
                </Text>
                <Text style={styles.selectedCardSubtitle}>
                  {selectedCustomer.documentType}: {selectedCustomer.documentNumber}
                </Text>
                {selectedCustomer.email && (
                  <Text style={styles.selectedCardDetail}>{selectedCustomer.email}</Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => setSelectedCustomer(null)}
                style={styles.removeButton}
              >
                <Text style={styles.removeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setShowCustomerSearch(true)}
            >
              <Text style={styles.selectButtonText}>
                + Seleccionar {saleType === SaleType.B2C ? 'Cliente' : 'Empresa'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Warehouse Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Almacén</Text>
          {loadingWarehouses ? (
            <ActivityIndicator size="small" color="#007bff" />
          ) : (
            <View style={styles.pickerContainer}>
              {warehouses.map((warehouse) => (
                <TouchableOpacity
                  key={warehouse.id}
                  style={[
                    styles.pickerItem,
                    selectedWarehouse?.id === warehouse.id && styles.pickerItemActive,
                  ]}
                  onPress={() => setSelectedWarehouse(warehouse)}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      selectedWarehouse?.id === warehouse.id && styles.pickerItemTextActive,
                    ]}
                  >
                    {warehouse.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

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

        {/* Products */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Productos ({items.length})</Text>
            <TouchableOpacity
              style={styles.addProductButton}
              onPress={() => setShowProductSearch(true)}
              disabled={!selectedWarehouse}
            >
              <Text style={styles.addProductButtonText}>+ Agregar Producto</Text>
            </TouchableOpacity>
          </View>

          {items.length === 0 ? (
            <View style={styles.emptyProducts}>
              <Text style={styles.emptyProductsText}>
                No hay productos agregados
              </Text>
            </View>
          ) : (
            <View style={styles.productsList}>
              {items.map((item, index) => (
                <View key={index} style={styles.productItem}>
                  <View style={styles.productHeader}>
                    <Text style={styles.productName} numberOfLines={2}>
                      {item.product.title}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveItem(index)}
                      style={styles.removeProductButton}
                    >
                      <Text style={styles.removeProductButtonText}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.productSku}>SKU: {item.product.sku}</Text>
                  <Text style={styles.productStock}>
                    Stock disponible: {item.availableStock} unidades
                  </Text>

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

      {/* Modals */}
      <CustomerSearchModal
        visible={showCustomerSearch}
        onClose={() => setShowCustomerSearch(false)}
        onSelectCustomer={handleSelectCustomer}
        customerType={saleType === SaleType.B2C ? CustomerType.PERSONA : CustomerType.EMPRESA}
      />

      <ProductSearchModal
        visible={showProductSearch}
        onClose={() => setShowProductSearch(false)}
        onSelectProduct={handleSelectProduct}
        warehouseId={selectedWarehouse?.id}
        excludeProductIds={items.map((item) => item.product.id)}
      />
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
  addProductButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addProductButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyProducts: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  emptyProductsText: {
    fontSize: 16,
    color: '#999',
  },
  productsList: {
    gap: 12,
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
    marginBottom: 8,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
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
    marginBottom: 4,
  },
  productStock: {
    fontSize: 13,
    color: '#10B981',
    marginBottom: 12,
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
