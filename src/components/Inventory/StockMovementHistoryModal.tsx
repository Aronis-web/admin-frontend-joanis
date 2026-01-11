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
import { transfersApi } from '@/services/api/transfers';
import { StockMovement } from '@/types/transfers';

interface StockMovementHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  productId: string;
  productTitle?: string;
  productSku?: string;
}

export const StockMovementHistoryModal: React.FC<StockMovementHistoryModalProps> = ({
  visible,
  onClose,
  productId,
  productTitle,
  productSku,
}) => {
  const [loading, setLoading] = useState(false);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    if (visible && productId) {
      loadMovements();
    }
  }, [visible, productId, limit]);

  const loadMovements = async () => {
    try {
      setLoading(true);
      console.log('📜 Loading stock movements for product:', productId);

      const data = await transfersApi.getProductStockMovementsHistory(productId, { limit });
      console.log('✅ Stock movements loaded:', data);

      setMovements(data || []);
    } catch (error: any) {
      console.error('❌ Error loading stock movements:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'No se pudo cargar el historial de movimientos'
      );
    } finally {
      setLoading(false);
    }
  };

  const getMovementTypeInfo = (type: string) => {
    const types: {
      [key: string]: { label: string; icon: string; color: string };
    } = {
      TRANSFER_OUT: {
        label: 'Salida por Transferencia',
        icon: '📤',
        color: '#EF4444',
      },
      TRANSFER_IN: {
        label: 'Entrada por Transferencia',
        icon: '📥',
        color: '#10B981',
      },
      TRANSFER_INTERNAL: {
        label: 'Transferencia Interna',
        icon: '🔄',
        color: '#3B82F6',
      },
      ADJUSTMENT: {
        label: 'Ajuste de Inventario',
        icon: '⚙️',
        color: '#F59E0B',
      },
      PURCHASE: {
        label: 'Entrada por Compra',
        icon: '🛒',
        color: '#10B981',
      },
      SALE: {
        label: 'Salida por Venta',
        icon: '💰',
        color: '#EF4444',
      },
      RETURN: {
        label: 'Devolución',
        icon: '↩️',
        color: '#8B5CF6',
      },
      TRANSFER_DISCREPANCY: {
        label: 'Ajuste por Discrepancia',
        icon: '⚠️',
        color: '#F97316',
      },
      INITIAL_STOCK: {
        label: 'Stock Inicial',
        icon: '🎯',
        color: '#6366F1',
      },
    };
    return types[type] || { label: type, icon: '❓', color: '#94A3B8' };
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
              <Text style={styles.headerTitle}>Historial de Movimientos</Text>
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
          <ScrollView style={styles.content}>
            {/* Summary */}
            {!loading && movements.length > 0 && (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>TOTAL DE MOVIMIENTOS</Text>
                <Text style={styles.summaryValue}>{movements.length}</Text>
                <Text style={styles.summarySubtext}>
                  Mostrando últimos {limit} registros
                </Text>
              </View>
            )}
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#667eea" />
                <Text style={styles.loadingText}>Cargando historial...</Text>
              </View>
            ) : movements.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📜</Text>
                <Text style={styles.emptyTitle}>Sin Movimientos</Text>
                <Text style={styles.emptyText}>
                  No hay movimientos registrados para este producto
                </Text>
              </View>
            ) : (
              <View style={styles.movementsList}>
                {movements.map((movement, index) => {
                  const typeInfo = getMovementTypeInfo(movement.movementType);
                  const isPositive = movement.quantity > 0;

                  return (
                    <View key={movement.id || index} style={styles.movementCard}>
                      {/* Movement Header */}
                      <View style={styles.movementHeader}>
                        <View style={styles.movementTypeContainer}>
                          <Text style={styles.movementIcon}>{typeInfo.icon}</Text>
                          <View style={styles.movementTypeInfo}>
                            <Text style={styles.movementType}>{typeInfo.label}</Text>
                            <Text style={styles.movementDate}>
                              {formatDate(movement.createdAt)}
                            </Text>
                          </View>
                        </View>
                        <View
                          style={[
                            styles.quantityBadge,
                            {
                              backgroundColor: isPositive
                                ? '#10B981'
                                : '#EF4444',
                            },
                          ]}
                        >
                          <Text style={styles.quantityText}>
                            {isPositive ? '+' : ''}
                            {movement.quantity}
                          </Text>
                        </View>
                      </View>

                      {/* Movement Details */}
                      <View style={styles.movementDetails}>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Stock antes:</Text>
                          <Text style={styles.detailValue}>
                            {movement.stockBefore} unidades
                          </Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Stock después:</Text>
                          <Text style={[styles.detailValue, styles.detailValueHighlight]}>
                            {movement.stockAfter} unidades
                          </Text>
                        </View>

                        {movement.warehouse && (
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>🏢 Almacén:</Text>
                            <Text style={styles.detailValue}>
                              {movement.warehouse.name}
                            </Text>
                          </View>
                        )}

                        {movement.area && (
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>📍 Área:</Text>
                            <Text style={styles.detailValue}>
                              {movement.area.name || movement.area.code}
                            </Text>
                          </View>
                        )}

                        {movement.relatedWarehouse && (
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>🔗 Relacionado:</Text>
                            <Text style={styles.detailValue}>
                              {movement.relatedWarehouse.name}
                            </Text>
                          </View>
                        )}

                        {movement.referenceType && (
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>📄 Referencia:</Text>
                            <Text style={styles.detailValue}>
                              {movement.referenceType}
                            </Text>
                          </View>
                        )}

                        {movement.performedByUser && (
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>👤 Realizado por:</Text>
                            <Text style={styles.detailValue}>
                              {movement.performedByUser.name}
                            </Text>
                          </View>
                        )}

                        {movement.notes && (
                          <View style={styles.notesContainer}>
                            <Text style={styles.notesLabel}>📝 Notas:</Text>
                            <Text style={styles.notesText}>{movement.notes}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
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
    borderRadius: 20,
    width: '90%',
    maxWidth: 600,
    height: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E7FF',
    backgroundColor: '#FAFBFF',
  },
  headerContent: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#667eea',
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 22,
    color: '#667eea',
    fontWeight: '600',
  },
  summaryCard: {
    backgroundColor: '#667eea',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 16,
    padding: 20,
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
    letterSpacing: 1,
    opacity: 0.9,
  },
  summaryValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
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
  movementsList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  movementCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E7FF',
    overflow: 'hidden',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 12,
  },
  movementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F5F7FF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E7FF',
  },
  movementTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  movementIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  movementTypeInfo: {
    flex: 1,
  },
  movementType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  movementDate: {
    fontSize: 12,
    color: '#64748B',
  },
  quantityBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  movementDetails: {
    padding: 16,
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748B',
    flex: 1,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'right',
  },
  detailValueHighlight: {
    color: '#667eea',
    fontSize: 14,
  },
  notesContainer: {
    marginTop: 8,
    padding: 14,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#E0E7FF',
    padding: 20,
    backgroundColor: '#FAFBFF',
  },
  closeFooterButton: {
    backgroundColor: '#667eea',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  closeFooterButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default StockMovementHistoryModal;
