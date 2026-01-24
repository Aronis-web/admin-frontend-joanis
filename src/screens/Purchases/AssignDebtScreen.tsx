import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { purchasesService } from '@/services/api';
import { PurchaseProduct, PurchaseProductStatus } from '@/types/purchases';

interface AssignDebtScreenProps {
  navigation: any;
  route: {
    params: {
      purchaseId: string;
    };
  };
}

export const AssignDebtScreen: React.FC<AssignDebtScreenProps> = ({ navigation, route }) => {
  const { purchaseId } = route.params;
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [products, setProducts] = useState<PurchaseProduct[]>([]);
  const [purchase, setPurchase] = useState<any>(null);
  const [legalEntities, setLegalEntities] = useState<any[]>([]);
  const [selectedLegalEntities, setSelectedLegalEntities] = useState<Record<string, string>>({});
  const [showSelector, setShowSelector] = useState<string | null>(null);

  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [purchaseData, productsData] = await Promise.all([
        purchasesService.getPurchase(purchaseId),
        purchasesService.getPurchaseProducts(purchaseId),
      ]);

      setPurchase(purchaseData);

      // Filter only validated products
      const validatedProducts = productsData.filter(
        (p) => p.status === PurchaseProductStatus.VALIDATED
      );
      setProducts(validatedProducts);

      // Get legal entities from supplier
      if (purchaseData.supplier?.legalEntities) {
        setLegalEntities(purchaseData.supplier.legalEntities);
      }

      // Pre-fill already assigned legal entities
      const assignments: Record<string, string> = {};
      validatedProducts.forEach((product) => {
        if (product.supplierLegalEntityId) {
          assignments[product.id] = product.supplierLegalEntityId;
        }
      });
      setSelectedLegalEntities(assignments);
    } catch (error: any) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'No se pudo cargar los datos');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleAssignDebt = async (productId: string, legalEntityId: string) => {
    setActionLoading(true);
    try {
      await purchasesService.assignDebt(purchaseId, productId, {
        supplierLegalEntityId: legalEntityId,
      });

      setSelectedLegalEntities((prev) => ({
        ...prev,
        [productId]: legalEntityId,
      }));

      Alert.alert('Éxito', 'Deuda asignada correctamente');
      setShowSelector(null);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo asignar la deuda');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveAll = async () => {
    // Check if all products have assigned legal entities
    const unassigned = products.filter((p) => !selectedLegalEntities[p.id]);

    if (unassigned.length > 0) {
      Alert.alert(
        'Productos sin asignar',
        `Hay ${unassigned.length} producto(s) sin razón social asignada. ¿Desea continuar de todas formas?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Continuar', onPress: () => navigation.goBack() },
        ]
      );
      return;
    }

    Alert.alert('Éxito', 'Todas las deudas han sido asignadas', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  const formatCurrency = (cents: number) => {
    return `S/ ${(cents / 100).toFixed(2)}`;
  };

  const calculateDebt = (product: PurchaseProduct) => {
    const stock = product.validatedStock || 0;
    const cost = product.costCents || 0;
    return stock * cost;
  };

  const getTotalDebt = () => {
    return products.reduce((total, product) => {
      return total + calculateDebt(product);
    }, 0);
  };

  const getDebtByLegalEntity = () => {
    const debtMap: Record<string, { legalEntity: any; debtCents: number; products: number }> = {};

    products.forEach((product) => {
      const legalEntityId = selectedLegalEntities[product.id];
      if (legalEntityId) {
        const legalEntity = legalEntities.find((le) => le.id === legalEntityId);
        if (legalEntity) {
          if (!debtMap[legalEntityId]) {
            debtMap[legalEntityId] = {
              legalEntity,
              debtCents: 0,
              products: 0,
            };
          }
          debtMap[legalEntityId].debtCents += calculateDebt(product);
          debtMap[legalEntityId].products += 1;
        }
      }
    });

    return Object.values(debtMap);
  };

  const getLegalEntityName = (legalEntityId: string) => {
    const entity = legalEntities.find((le) => le.id === legalEntityId);
    return entity ? entity.legalName : 'N/A';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Cargando datos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (products.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={[styles.title, isTablet && styles.titleTablet]}>Asignar Deudas</Text>
          </View>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyIcon, isTablet && styles.emptyIconTablet]}>📋</Text>
          <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
            No hay productos validados para asignar deudas
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const debtsByLegalEntity = getDebtByLegalEntity();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, isTablet && styles.headerTablet]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.title, isTablet && styles.titleTablet]}>Asignar Deudas</Text>
          <Text style={[styles.subtitle, isTablet && styles.subtitleTablet]}>
            {purchase?.code || 'Compra'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, isTablet && styles.contentContainerTablet]}
      >
        {/* Summary Card */}
        <View style={[styles.summaryCard, isTablet && styles.summaryCardTablet]}>
          <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
            Resumen de Deudas
          </Text>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, isTablet && styles.summaryLabelTablet]}>
              Total de Productos:
            </Text>
            <Text style={[styles.summaryValue, isTablet && styles.summaryValueTablet]}>
              {products.length}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, isTablet && styles.summaryLabelTablet]}>
              Productos Asignados:
            </Text>
            <Text style={[styles.summaryValue, isTablet && styles.summaryValueTablet]}>
              {Object.keys(selectedLegalEntities).length}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, isTablet && styles.summaryLabelTablet]}>
              Deuda Total:
            </Text>
            <Text
              style={[
                styles.summaryValue,
                isTablet && styles.summaryValueTablet,
                styles.summaryHighlight,
              ]}
            >
              {formatCurrency(getTotalDebt())}
            </Text>
          </View>
        </View>

        {/* Debt by Legal Entity */}
        {debtsByLegalEntity.length > 0 && (
          <View style={[styles.debtCard, isTablet && styles.debtCardTablet]}>
            <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
              Deudas por Razón Social
            </Text>
            {debtsByLegalEntity.map((item, index) => (
              <View
                key={item.legalEntity.id}
                style={[
                  styles.debtItem,
                  isTablet && styles.debtItemTablet,
                  index < debtsByLegalEntity.length - 1 && styles.debtItemBorder,
                ]}
              >
                <View style={styles.debtItemHeader}>
                  <Text style={[styles.debtLegalName, isTablet && styles.debtLegalNameTablet]}>
                    {item.legalEntity.legalName}
                  </Text>
                  <Text style={[styles.debtRuc, isTablet && styles.debtRucTablet]}>
                    RUC: {item.legalEntity.ruc}
                  </Text>
                </View>
                <View style={styles.debtItemBody}>
                  <View style={styles.debtRow}>
                    <Text style={[styles.debtLabel, isTablet && styles.debtLabelTablet]}>
                      Productos:
                    </Text>
                    <Text style={[styles.debtValue, isTablet && styles.debtValueTablet]}>
                      {item.products}
                    </Text>
                  </View>
                  <View style={styles.debtRow}>
                    <Text style={[styles.debtLabel, isTablet && styles.debtLabelTablet]}>
                      Deuda:
                    </Text>
                    <Text
                      style={[
                        styles.debtValue,
                        isTablet && styles.debtValueTablet,
                        styles.debtAmount,
                      ]}
                    >
                      {formatCurrency(item.debtCents)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Products List */}
        <View style={styles.productsSection}>
          <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
            Asignar Productos ({products.length})
          </Text>

          {products.map((product) => (
            <View
              key={product.id}
              style={[styles.productCard, isTablet && styles.productCardTablet]}
            >
              <View style={styles.productHeader}>
                <View style={styles.productHeaderLeft}>
                  <Text style={[styles.productName, isTablet && styles.productNameTablet]}>
                    {product.name}
                  </Text>
                  <Text style={[styles.productSku, isTablet && styles.productSkuTablet]}>
                    {product.correlativeNumber && `#${product.correlativeNumber} | `}SKU:{' '}
                    {product.sku}
                  </Text>
                </View>
              </View>

              <View style={styles.productBody}>
                <View style={styles.productRow}>
                  <Text style={[styles.productLabel, isTablet && styles.productLabelTablet]}>
                    Stock Validado:
                  </Text>
                  <Text style={[styles.productValue, isTablet && styles.productValueTablet]}>
                    {product.validatedStock}
                  </Text>
                </View>
                <View style={styles.productRow}>
                  <Text style={[styles.productLabel, isTablet && styles.productLabelTablet]}>
                    Costo Unitario:
                  </Text>
                  <Text style={[styles.productValue, isTablet && styles.productValueTablet]}>
                    {formatCurrency(product.costCents)}
                  </Text>
                </View>
                <View style={styles.productRow}>
                  <Text style={[styles.productLabel, isTablet && styles.productLabelTablet]}>
                    Deuda Total:
                  </Text>
                  <Text
                    style={[
                      styles.productValue,
                      isTablet && styles.productValueTablet,
                      styles.productDebt,
                    ]}
                  >
                    {formatCurrency(calculateDebt(product))}
                  </Text>
                </View>
              </View>

              {/* Legal Entity Selector */}
              <View style={styles.selectorSection}>
                <Text style={[styles.selectorLabel, isTablet && styles.selectorLabelTablet]}>
                  Razón Social <Text style={styles.required}>*</Text>
                </Text>
                <TouchableOpacity
                  style={[styles.selector, isTablet && styles.selectorTablet]}
                  onPress={() => setShowSelector(showSelector === product.id ? null : product.id)}
                  disabled={actionLoading}
                >
                  <Text
                    style={[
                      styles.selectorText,
                      isTablet && styles.selectorTextTablet,
                      !selectedLegalEntities[product.id] && styles.selectorPlaceholder,
                    ]}
                  >
                    {selectedLegalEntities[product.id]
                      ? getLegalEntityName(selectedLegalEntities[product.id])
                      : 'Seleccionar razón social'}
                  </Text>
                  <Text style={styles.selectorIcon}>{showSelector === product.id ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {showSelector === product.id && (
                  <View style={[styles.optionsList, isTablet && styles.optionsListTablet]}>
                    {legalEntities.map((entity) => (
                      <TouchableOpacity
                        key={entity.id}
                        style={[
                          styles.optionItem,
                          isTablet && styles.optionItemTablet,
                          selectedLegalEntities[product.id] === entity.id &&
                            styles.optionItemSelected,
                        ]}
                        onPress={() => handleAssignDebt(product.id, entity.id)}
                        disabled={actionLoading}
                      >
                        <View style={styles.optionContent}>
                          <Text
                            style={[
                              styles.optionText,
                              isTablet && styles.optionTextTablet,
                              selectedLegalEntities[product.id] === entity.id &&
                                styles.optionTextSelected,
                            ]}
                          >
                            {entity.legalName}
                          </Text>
                          <Text
                            style={[styles.optionSubtext, isTablet && styles.optionSubtextTablet]}
                          >
                            RUC: {entity.ruc}
                          </Text>
                        </View>
                        {entity.isPrimary && (
                          <View style={styles.primaryBadge}>
                            <Text style={styles.primaryBadgeText}>Principal</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Action Button */}
      <View style={[styles.footer, isTablet && styles.footerTablet]}>
        <TouchableOpacity
          style={[styles.saveButton, isTablet && styles.saveButtonTablet]}
          onPress={handleSaveAll}
          disabled={actionLoading}
        >
          {actionLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[styles.saveButtonText, isTablet && styles.saveButtonTextTablet]}>
              Continuar
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyIconTablet: {
    fontSize: 80,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
  },
  emptyTextTablet: {
    fontSize: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTablet: {
    paddingHorizontal: 32,
    paddingVertical: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 28,
    color: '#64748B',
    fontWeight: '300',
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  titleTablet: {
    fontSize: 24,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
  },
  subtitleTablet: {
    fontSize: 15,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },
  contentContainerTablet: {
    padding: 32,
    maxWidth: 1000,
    alignSelf: 'center',
    width: '100%',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryCardTablet: {
    padding: 24,
    borderRadius: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  sectionTitleTablet: {
    fontSize: 18,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  summaryLabelTablet: {
    fontSize: 16,
  },
  summaryValue: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
  },
  summaryValueTablet: {
    fontSize: 16,
  },
  summaryHighlight: {
    color: '#6366F1',
    fontSize: 16,
  },
  debtCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  debtCardTablet: {
    padding: 24,
    borderRadius: 18,
  },
  debtItem: {
    paddingVertical: 12,
  },
  debtItemTablet: {
    paddingVertical: 16,
  },
  debtItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  debtItemHeader: {
    marginBottom: 8,
  },
  debtLegalName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  debtLegalNameTablet: {
    fontSize: 17,
  },
  debtRuc: {
    fontSize: 12,
    color: '#64748B',
  },
  debtRucTablet: {
    fontSize: 14,
  },
  debtItemBody: {
    gap: 6,
  },
  debtRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  debtLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  debtLabelTablet: {
    fontSize: 15,
  },
  debtValue: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '600',
  },
  debtValueTablet: {
    fontSize: 15,
  },
  debtAmount: {
    color: '#10B981',
    fontSize: 14,
  },
  productsSection: {
    marginBottom: 24,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  productCardTablet: {
    padding: 20,
    borderRadius: 18,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  productHeaderLeft: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  productNameTablet: {
    fontSize: 17,
  },
  productSku: {
    fontSize: 12,
    color: '#64748B',
  },
  productSkuTablet: {
    fontSize: 14,
  },
  productBody: {
    gap: 8,
    marginBottom: 16,
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  productLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  productLabelTablet: {
    fontSize: 15,
  },
  productValue: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '600',
  },
  productValueTablet: {
    fontSize: 15,
  },
  productDebt: {
    color: '#6366F1',
    fontSize: 14,
  },
  selectorSection: {
    marginTop: 8,
  },
  selectorLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  selectorLabelTablet: {
    fontSize: 15,
  },
  required: {
    color: '#EF4444',
  },
  selector: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorTablet: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
  },
  selectorText: {
    fontSize: 14,
    color: '#1E293B',
    flex: 1,
  },
  selectorTextTablet: {
    fontSize: 16,
  },
  selectorPlaceholder: {
    color: '#94A3B8',
  },
  selectorIcon: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 8,
  },
  optionsList: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    marginTop: 8,
    maxHeight: 200,
  },
  optionsListTablet: {
    borderRadius: 14,
    maxHeight: 300,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  optionItemTablet: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  optionItemSelected: {
    backgroundColor: '#EEF2FF',
  },
  optionContent: {
    flex: 1,
  },
  optionText: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
    marginBottom: 2,
  },
  optionTextTablet: {
    fontSize: 16,
  },
  optionTextSelected: {
    color: '#6366F1',
  },
  optionSubtext: {
    fontSize: 12,
    color: '#64748B',
  },
  optionSubtextTablet: {
    fontSize: 14,
  },
  primaryBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  primaryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1E40AF',
  },
  bottomSpacer: {
    height: 40,
  },
  footer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  footerTablet: {
    paddingHorizontal: 32,
    paddingVertical: 20,
  },
  saveButton: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    alignItems: 'center',
  },
  saveButtonTablet: {
    paddingVertical: 16,
    borderRadius: 14,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  saveButtonTextTablet: {
    fontSize: 17,
  },
});

export default AssignDebtScreen;
