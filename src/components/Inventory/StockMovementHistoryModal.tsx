import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { transfersApi } from '@/services/api/transfers';
import { StockMovement } from '@/types/transfers';

// Design System
import {
  colors,
  spacing,
  borderRadius,
  shadows,
} from '@/design-system/tokens';
import {
  Text,
  Title,
  Body,
  Caption,
  Label,
  Numeric,
  Button,
  Card,
  IconButton,
  EmptyState,
} from '@/design-system/components';

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

      const response = await transfersApi.getProductStockMovementsHistory(productId, { limit });
      console.log('✅ Stock movements loaded:', response);

      // Extract the data array from the paginated response
      const movementsData = Array.isArray(response) ? response : (response as any)?.data || [];
      setMovements(movementsData);
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
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Title size="large">Historial de Movimientos</Title>
              {productTitle && <Body size="medium" color="secondary" style={styles.headerSubtitle}>{productTitle}</Body>}
              {productSku && <Caption color="tertiary">SKU: {productSku}</Caption>}
            </View>
            <IconButton
              icon="close"
              onPress={onClose}
              variant="ghost"
              size="medium"
            />
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Summary */}
            {!loading && movements.length > 0 && (
              <View style={styles.summaryCard}>
                <Label size="medium" color={colors.neutral[0]} style={styles.summaryLabel}>TOTAL DE MOVIMIENTOS</Label>
                <Numeric size="large" color={colors.neutral[0]}>{movements.length}</Numeric>
                <Caption color={colors.neutral[200]}>Mostrando últimos {limit} registros</Caption>
              </View>
            )}
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary[900]} />
                <Body color="secondary" style={styles.loadingText}>Cargando historial...</Body>
              </View>
            ) : movements.length === 0 ? (
              <EmptyState
                icon="document-text-outline"
                title="Sin Movimientos"
                description="No hay movimientos registrados para este producto"
              />
            ) : (
              <View style={styles.movementsList}>
                {movements.map((movement, index) => {
                  const typeInfo = getMovementTypeInfo(movement.movementType);
                  const isPositive = movement.quantity > 0;

                  return (
                    <Card key={movement.id || index} variant="outlined" padding="none" style={styles.movementCard}>
                      {/* Movement Header */}
                      <View style={styles.movementHeader}>
                        <View style={styles.movementTypeContainer}>
                          <Text variant="headingSmall">{typeInfo.icon}</Text>
                          <View style={styles.movementTypeInfo}>
                            <Body size="medium" color="primary">{typeInfo.label}</Body>
                            <Caption color="tertiary">{formatDate(movement.createdAt)}</Caption>
                          </View>
                        </View>
                        <View
                          style={[
                            styles.quantityBadge,
                            { backgroundColor: isPositive ? colors.success[600] : colors.danger[600] },
                          ]}
                        >
                          <Numeric size="small" color={colors.neutral[0]}>
                            {isPositive ? '+' : ''}{movement.quantity}
                          </Numeric>
                        </View>
                      </View>

                      {/* Movement Details */}
                      <View style={styles.movementDetails}>
                        <View style={styles.detailRow}>
                          <Caption color="secondary">Stock antes:</Caption>
                          <Body size="small" color="primary">{movement.stockBefore} unidades</Body>
                        </View>
                        <View style={styles.detailRow}>
                          <Caption color="secondary">Stock después:</Caption>
                          <Text variant="labelLarge" color={colors.accent[600]}>{movement.stockAfter} unidades</Text>
                        </View>

                        {movement.warehouse && (
                          <View style={styles.detailRow}>
                            <Caption color="secondary">🏢 Almacén:</Caption>
                            <Body size="small" color="primary">{movement.warehouse.name}</Body>
                          </View>
                        )}

                        {movement.area && (
                          <View style={styles.detailRow}>
                            <Caption color="secondary">📍 Área:</Caption>
                            <Body size="small" color="primary">{movement.area.name || movement.area.code}</Body>
                          </View>
                        )}

                        {movement.relatedWarehouse && (
                          <View style={styles.detailRow}>
                            <Caption color="secondary">🔗 Relacionado:</Caption>
                            <Body size="small" color="primary">{movement.relatedWarehouse.name}</Body>
                          </View>
                        )}

                        {movement.referenceType && (
                          <View style={styles.detailRow}>
                            <Caption color="secondary">📄 Referencia:</Caption>
                            <Body size="small" color="primary">{movement.referenceType}</Body>
                          </View>
                        )}

                        {movement.performedByUser && (
                          <View style={styles.detailRow}>
                            <Caption color="secondary">👤 Realizado por:</Caption>
                            <Body size="small" color="primary">{movement.performedByUser.name}</Body>
                          </View>
                        )}

                        {movement.notes && (
                          <View style={styles.notesContainer}>
                            <Label size="small" color={colors.warning[800]}>📝 Notas:</Label>
                            <Body size="small" color={colors.warning[900]}>{movement.notes}</Body>
                          </View>
                        )}
                      </View>
                    </Card>
                  );
                })}
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Button
              title="Cerrar"
              variant="primary"
              onPress={onClose}
              fullWidth
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    width: '90%',
    maxWidth: 600,
    height: '85%',
    ...shadows.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.surface.primary,
  },
  headerContent: {
    flex: 1,
    marginRight: spacing[3],
  },
  headerSubtitle: {
    marginTop: spacing[1],
    marginBottom: spacing[0.5],
  },
  summaryCard: {
    backgroundColor: colors.primary[900],
    marginHorizontal: spacing[5],
    marginTop: spacing[4],
    marginBottom: spacing[4],
    padding: spacing[5],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    ...shadows.lg,
  },
  summaryLabel: {
    marginBottom: spacing[2],
    letterSpacing: 1,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing[16],
  },
  loadingText: {
    marginTop: spacing[3],
  },
  movementsList: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[5],
  },
  movementCard: {
    marginBottom: spacing[3],
  },
  movementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    backgroundColor: colors.accent[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.accent[200],
  },
  movementTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing[3],
  },
  movementTypeInfo: {
    flex: 1,
  },
  quantityBadge: {
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    minWidth: 80,
    alignItems: 'center',
  },
  movementDetails: {
    padding: spacing[4],
    gap: spacing[2.5],
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notesContainer: {
    marginTop: spacing[2],
    padding: spacing[3.5],
    backgroundColor: colors.warning[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    padding: spacing[5],
    backgroundColor: colors.surface.primary,
  },
});

export default StockMovementHistoryModal;
