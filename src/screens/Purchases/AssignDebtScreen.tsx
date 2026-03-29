import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { purchasesService } from '@/services/api';
import { PurchaseProduct, PurchaseProductStatus } from '@/types/purchases';
import {
  ScreenContainer,
  ScreenHeader,
  Card,
  Button,
  Badge,
  Text,
  EmptyState,
  Divider,
} from '@/design-system';
import { colors, spacing, borderRadius, shadows } from '@/design-system/tokens';

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
      <ScreenContainer>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text variant="bodyMedium" color="secondary" style={{ marginTop: spacing[4] }}>
            Cargando datos...
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  if (products.length === 0) {
    return (
      <ScreenContainer>
        <ScreenHeader
          title="Asignar Deudas"
          onBack={() => navigation.goBack()}
        />
        <EmptyState
          emoji="📋"
          title="Sin productos validados"
          description="No hay productos validados para asignar deudas"
        />
      </ScreenContainer>
    );
  }

  const debtsByLegalEntity = getDebtByLegalEntity();

  return (
    <ScreenContainer>
      <ScreenHeader
        title="Asignar Deudas"
        subtitle={purchase?.code || 'Compra'}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, isTablet && styles.contentContainerTablet]}
      >
        {/* Summary Card */}
        <Card style={styles.summaryCard}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Resumen de Deudas
          </Text>
          <View style={styles.summaryRow}>
            <Text variant="bodyMedium" color="secondary">Total de Productos:</Text>
            <Text variant="bodyMedium">{products.length}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text variant="bodyMedium" color="secondary">Productos Asignados:</Text>
            <Text variant="bodyMedium">{Object.keys(selectedLegalEntities).length}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text variant="bodyMedium" color="secondary">Deuda Total:</Text>
            <Text variant="titleMedium" style={{ color: colors.primary[500] }}>
              {formatCurrency(getTotalDebt())}
            </Text>
          </View>
        </Card>

        {/* Debt by Legal Entity */}
        {debtsByLegalEntity.length > 0 && (
          <Card style={styles.debtCard}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Deudas por Razón Social
            </Text>
            {debtsByLegalEntity.map((item, index) => (
              <View
                key={item.legalEntity.id}
                style={[
                  styles.debtItem,
                  index < debtsByLegalEntity.length - 1 && styles.debtItemBorder,
                ]}
              >
                <View style={styles.debtItemHeader}>
                  <Text variant="bodyMedium">{item.legalEntity.legalName}</Text>
                  <Text variant="caption" color="secondary">RUC: {item.legalEntity.ruc}</Text>
                </View>
                <View style={styles.debtItemBody}>
                  <View style={styles.debtRow}>
                    <Text variant="caption" color="secondary">Productos:</Text>
                    <Text variant="caption">{item.products}</Text>
                  </View>
                  <View style={styles.debtRow}>
                    <Text variant="caption" color="secondary">Deuda:</Text>
                    <Text variant="bodyMedium" style={{ color: colors.success[600] }}>
                      {formatCurrency(item.debtCents)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Products List */}
        <View style={styles.productsSection}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Asignar Productos ({products.length})
          </Text>

          {products.map((product) => (
            <Card key={product.id} style={styles.productCard}>
              <View style={styles.productHeader}>
                <View style={styles.productHeaderLeft}>
                  <Text variant="bodyMedium">{product.name}</Text>
                  <Text variant="caption" color="secondary">
                    {product.correlativeNumber && `#${product.correlativeNumber} | `}SKU: {product.sku}
                  </Text>
                </View>
              </View>

              <View style={styles.productBody}>
                <View style={styles.productRow}>
                  <Text variant="caption" color="secondary">Stock Validado:</Text>
                  <Text variant="caption">{product.validatedStock}</Text>
                </View>
                <View style={styles.productRow}>
                  <Text variant="caption" color="secondary">Costo Unitario:</Text>
                  <Text variant="caption">{formatCurrency(product.costCents)}</Text>
                </View>
                <View style={styles.productRow}>
                  <Text variant="caption" color="secondary">Deuda Total:</Text>
                  <Text variant="bodyMedium" style={{ color: colors.primary[500] }}>
                    {formatCurrency(calculateDebt(product))}
                  </Text>
                </View>
              </View>

              {/* Legal Entity Selector */}
              <View style={styles.selectorSection}>
                <Text variant="labelMedium" style={styles.selectorLabel}>
                  Razón Social <Text style={styles.required}>*</Text>
                </Text>
                <TouchableOpacity
                  style={[styles.selector, isTablet && styles.selectorTablet]}
                  onPress={() => setShowSelector(showSelector === product.id ? null : product.id)}
                  disabled={actionLoading}
                >
                  <Text
                    variant="bodyMedium"
                    color={selectedLegalEntities[product.id] ? 'primary' : 'secondary'}
                    style={styles.selectorText}
                  >
                    {selectedLegalEntities[product.id]
                      ? getLegalEntityName(selectedLegalEntities[product.id])
                      : 'Seleccionar razón social'}
                  </Text>
                  <Text style={styles.selectorIcon}>{showSelector === product.id ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {showSelector === product.id && (
                  <View style={styles.optionsList}>
                    {legalEntities.map((entity) => (
                      <TouchableOpacity
                        key={entity.id}
                        style={[
                          styles.optionItem,
                          selectedLegalEntities[product.id] === entity.id && styles.optionItemSelected,
                        ]}
                        onPress={() => handleAssignDebt(product.id, entity.id)}
                        disabled={actionLoading}
                      >
                        <View style={styles.optionContent}>
                          <Text
                            variant="bodyMedium"
                            style={selectedLegalEntities[product.id] === entity.id ? { color: colors.primary[500] } : undefined}
                          >
                            {entity.legalName}
                          </Text>
                          <Text variant="caption" color="secondary">RUC: {entity.ruc}</Text>
                        </View>
                        {entity.isPrimary && (
                          <Badge label="Principal" variant="info" size="small" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </Card>
          ))}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Action Button */}
      <View style={styles.footer}>
        <Button
          title="Continuar"
          onPress={handleSaveAll}
          loading={actionLoading}
          fullWidth
        />
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing[5],
  },
  contentContainerTablet: {
    padding: spacing[8],
    maxWidth: 1000,
    alignSelf: 'center',
    width: '100%',
  },
  summaryCard: {
    marginBottom: spacing[5],
  },
  sectionTitle: {
    marginBottom: spacing[4],
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  debtCard: {
    marginBottom: spacing[5],
  },
  debtItem: {
    paddingVertical: spacing[3],
  },
  debtItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  debtItemHeader: {
    marginBottom: spacing[2],
  },
  debtItemBody: {
    gap: spacing[1.5],
  },
  debtRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  productsSection: {
    marginBottom: spacing[5],
  },
  productCard: {
    marginBottom: spacing[4],
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[3],
  },
  productHeaderLeft: {
    flex: 1,
  },
  productBody: {
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  selectorSection: {
    marginTop: spacing[2],
  },
  selectorLabel: {
    marginBottom: spacing[2],
  },
  required: {
    color: colors.danger[500],
  },
  selector: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorTablet: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3.5],
    borderRadius: borderRadius.xl,
  },
  selectorText: {
    flex: 1,
  },
  selectorIcon: {
    fontSize: 12,
    color: colors.neutral[500],
    marginLeft: spacing[2],
  },
  optionsList: {
    backgroundColor: colors.surface.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.lg,
    marginTop: spacing[2],
    maxHeight: 200,
    ...shadows.sm,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  optionItemSelected: {
    backgroundColor: colors.primary[50],
  },
  optionContent: {
    flex: 1,
  },
  bottomSpacer: {
    height: spacing[10],
  },
  footer: {
    backgroundColor: colors.surface.primary,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
});

export default AssignDebtScreen;
