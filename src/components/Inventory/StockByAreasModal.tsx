import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { inventoryApi, StockItemResponse } from '@/services/api/inventory';

interface StockByAreasModalProps {
  visible: boolean;
  onClose: () => void;
  productId: string;
  productTitle?: string;
  productSku?: string;
}

export const StockByAreasModal: React.FC<StockByAreasModalProps> = ({
  visible,
  onClose,
  productId,
  productTitle,
  productSku,
}) => {
  const [loading, setLoading] = useState(false);
  const [stockItems, setStockItems] = useState<StockItemResponse[]>([]);

  useEffect(() => {
    if (visible && productId) {
      loadStockByAreas();
    }
  }, [visible, productId]);

  const loadStockByAreas = async () => {
    try {
      setLoading(true);
      console.log('📦 Loading stock by areas for product:', productId);

      const data = await inventoryApi.getStockByProductWithAreas(productId);
      console.log('✅ Stock by areas loaded:', data);
      console.log('✅ Number of stock items:', data?.length || 0);

      // Log each item to debug
      data?.forEach((item, index) => {
        console.log(`Item ${index}:`, {
          warehouseId: item.warehouseId,
          warehouseName: item.warehouse?.name,
          areaId: item.areaId,
          areaName: item.area?.name,
          quantity: item.quantityBase,
        });
      });

      setStockItems(data || []);
    } catch (error: any) {
      console.error('❌ Error loading stock by areas:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'No se pudo cargar el stock por áreas'
      );
    } finally {
      setLoading(false);
    }
  };

  const getTotalStock = () => {
    return stockItems.reduce((sum, item) => {
      // Use availableQuantityBase (stock disponible) instead of quantityBase (stock total)
      const quantity = typeof item.availableQuantityBase === 'number'
        ? item.availableQuantityBase
        : (typeof item.quantityBase === 'string'
          ? parseFloat(item.quantityBase)
          : (item.quantityBase || 0));
      return sum + quantity;
    }, 0);
  };

  const groupByWarehouse = () => {
    const grouped: { [key: string]: StockItemResponse[] } = {};

    stockItems.forEach((item) => {
      const warehouseId = item.warehouseId;
      if (!grouped[warehouseId]) {
        grouped[warehouseId] = [];
      }
      grouped[warehouseId].push(item);
    });

    console.log('📊 Grouped warehouses:', Object.keys(grouped).length);
    Object.entries(grouped).forEach(([warehouseId, items]) => {
      console.log(`  Warehouse ${warehouseId}: ${items.length} items`);
      items.forEach((item, idx) => {
        console.log(`    Item ${idx}:`, {
          areaCode: item.area?.code,
          areaName: item.area?.name,
          quantity: item.quantityBase,
        });
      });
    });

    return grouped;
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Stock por Áreas</Text>
              {productTitle && (
                <Text style={styles.headerSubtitle}>{productTitle}</Text>
              )}
              {productSku && (
                <Text style={styles.headerSku}>SKU: {productSku}</Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView
            style={styles.content}
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#667eea" />
                <Text style={styles.loadingText}>Cargando stock...</Text>
              </View>
            ) : stockItems.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📦</Text>
                <Text style={styles.emptyTitle}>Sin Stock</Text>
                <Text style={styles.emptyText}>
                  Este producto no tiene stock en ningún almacén o área
                </Text>
              </View>
            ) : (
              <>
                {/* Total Stock Summary */}
                <View style={[styles.summaryCard, { marginHorizontal: 20, marginBottom: 16 }]}>
                  <Text style={styles.summaryLabel}>Stock Disponible</Text>
                  <Text style={styles.summaryValue}>
                    {getTotalStock().toFixed(2)} unidades
                  </Text>
                  <Text style={styles.summarySubtext}>
                    En {stockItems.length} ubicación(es)
                  </Text>
                </View>

                {/* Warehouse Sections */}
                {Object.entries(groupByWarehouse()).map(([warehouseId, items]) => {
                  const warehouseName = items[0].warehouse?.name || 'Almacén desconocido';
                  const warehouseCode = items[0].warehouse?.code || 'N/A';
                  const warehouseTotal = items.reduce((sum, item) => {
                    // Use availableQuantityBase (stock disponible)
                    const quantity = typeof item.availableQuantityBase === 'number'
                      ? item.availableQuantityBase
                      : (typeof item.quantityBase === 'string'
                        ? parseFloat(item.quantityBase)
                        : (item.quantityBase || 0));
                    return sum + quantity;
                  }, 0);

                  console.log('🎨 Rendering warehouse section:', warehouseName, 'with', items.length, 'areas');

                  return (
                    <View key={warehouseId} style={[styles.warehouseSection, { marginBottom: 16, marginHorizontal: 20 }]}>
                      {/* Warehouse Header */}
                      <View style={styles.warehouseHeader}>
                        <View style={styles.warehouseHeaderLeft}>
                          <Text style={styles.warehouseIcon}>🏢</Text>
                          <View style={styles.warehouseHeaderInfo}>
                            <Text style={styles.warehouseHeaderName}>
                              {warehouseName}
                            </Text>
                            <Text style={styles.warehouseHeaderCode}>
                              Código: {warehouseCode}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.warehouseTotalBadge}>
                          <Text style={styles.warehouseTotalValue}>
                            {warehouseTotal.toFixed(2)}
                          </Text>
                          <Text style={styles.warehouseTotalLabel}>unidades</Text>
                        </View>
                      </View>

                      {/* Areas within this warehouse */}
                      {items.map((item, index) => {
                        // Use availableQuantityBase (stock disponible)
                        const quantity = typeof item.availableQuantityBase === 'number'
                          ? item.availableQuantityBase
                          : (typeof item.quantityBase === 'string'
                            ? parseFloat(item.quantityBase)
                            : (item.quantityBase || 0));

                        console.log('🎨 Rendering area:', item.area?.code || 'unknown', 'quantity:', quantity);

                        return (
                          <View key={index} style={styles.areaCard}>
                            <View style={styles.areaCardContent}>
                              <View style={styles.areaCardLeft}>
                                <Text style={styles.areaCardIcon}>📍</Text>
                                <View style={styles.areaCardInfo}>
                                  <Text style={styles.areaCardName}>
                                    {item.area
                                      ? (item.area.name || `Área ${item.area.code}` || 'Sin nombre')
                                      : 'Sin área específica'}
                                  </Text>
                                  {item.area?.code && item.area?.name && (
                                    <Text style={styles.areaCardCode}>
                                      Código: {item.area.code}
                                    </Text>
                                  )}
                                </View>
                              </View>
                              <View style={styles.areaQuantityBadge}>
                                <Text style={styles.areaQuantityValue}>
                                  {quantity.toFixed(2)}
                                </Text>
                              </View>
                            </View>
                            <View style={styles.areaCardFooter}>
                              <Text style={styles.areaUpdatedText}>
                                Actualizado: {new Date(item.updatedAt).toLocaleDateString('es-ES', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
              </>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.closeFooterButton}
              onPress={onClose}
            >
              <Text style={styles.closeFooterButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '90%',
    maxWidth: 600,
    height: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 0,
    backgroundColor: '#FFFFFF',
  },
  headerContent: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 2,
  },
  headerSku: {
    fontSize: 14,
    color: '#64748B',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#64748B',
    fontWeight: '300',
  },
  summaryCard: {
    backgroundColor: '#667eea',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
    opacity: 0.9,
  },
  summaryValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  summarySubtext: {
    fontSize: 13,
    color: '#FFFFFF',
    opacity: 0.85,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748B',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },

  warehouseSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E7FF',
    overflow: 'hidden',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  warehouseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    backgroundColor: '#F5F7FF',
    borderBottomWidth: 2,
    borderBottomColor: '#E0E7FF',
  },
  warehouseHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  warehouseIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  warehouseHeaderInfo: {
    flex: 1,
  },
  warehouseHeaderName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  warehouseHeaderCode: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '600',
  },
  warehouseTotalBadge: {
    backgroundColor: '#667eea',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 90,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  warehouseTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  warehouseTotalLabel: {
    fontSize: 10,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  areaCard: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  areaCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    paddingLeft: 28,
  },
  areaCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  areaCardIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  areaCardInfo: {
    flex: 1,
  },
  areaCardName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  areaCardCode: {
    fontSize: 12,
    color: '#64748B',
  },
  areaQuantityBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  areaQuantityValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  areaCardFooter: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingLeft: 56,
  },
  areaUpdatedText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    padding: 16,
  },
  closeFooterButton: {
    backgroundColor: '#667eea',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeFooterButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default StockByAreasModal;
