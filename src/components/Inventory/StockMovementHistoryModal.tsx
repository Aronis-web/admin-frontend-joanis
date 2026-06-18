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

import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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
        color: theme.color.state.danger.border,
      },
      TRANSFER_IN: {
        label: 'Entrada por Transferencia',
        icon: '📥',
        color: theme.color.state.success.border,
      },
      TRANSFER_INTERNAL: {
        label: 'Transferencia Interna',
        icon: '🔄',
        color: theme.color.brand.accent,
      },
      ADJUSTMENT: {
        label: 'Ajuste de Inventario',
        icon: '⚙️',
        color: theme.color.state.warning.border,
      },
      PURCHASE: {
        label: 'Entrada por Compra',
        icon: '🛒',
        color: theme.color.state.success.border,
      },
      SALE: {
        label: 'Salida por Venta',
        icon: '💰',
        color: theme.color.state.danger.border,
      },
      RETURN: {
        label: 'Devolución',
        icon: '↩️',
        color: theme.color.brand.accent,
      },
      TRANSFER_DISCREPANCY: {
        label: 'Ajuste por Discrepancia',
        icon: '⚠️',
        color: theme.color.state.warning.border,
      },
      INITIAL_STOCK: {
        label: 'Stock Inicial',
        icon: '🎯',
        color: theme.color.brand.accent,
      },
    };
    return types[type] || { label: type, icon: '❓', color: theme.color.text.muted };
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
                <Label size="medium" color={theme.color.text.onAction} style={styles.summaryLabel}>TOTAL DE MOVIMIENTOS</Label>
                <Numeric size="large" color={theme.color.text.onAction}>{movements.length}</Numeric>
                <Caption color={theme.color.brand.onHeaderMuted}>Mostrando últimos {limit} registros</Caption>
              </View>
            )}
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.color.brand.primary} />
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
                            { backgroundColor: isPositive ? theme.color.action.success.background : theme.color.action.danger.background },
                          ]}
                        >
                          <Numeric size="small" color={theme.color.text.onAction}>
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
                          <Text variant="labelLarge" color={theme.color.brand.accent}>{movement.stockAfter} unidades</Text>
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
                            <Label size="small" color={theme.color.state.warning.text}>📝 Notas:</Label>
                            <Body size="small" color={theme.color.state.warning.text}>{movement.notes}</Body>
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContainer: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      width: '90%',
      maxWidth: 600,
      height: '85%',
      ...theme.shadow.xl,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: theme.space[6],
      paddingVertical: theme.space[5],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.base,
    },
    headerContent: {
      flex: 1,
      marginRight: theme.space[3],
    },
    headerSubtitle: {
      marginTop: theme.space[1],
      marginBottom: theme.space[0.5],
    },
    summaryCard: {
      backgroundColor: theme.color.brand.primary,
      marginHorizontal: theme.space[5],
      marginTop: theme.space[4],
      marginBottom: theme.space[4],
      padding: theme.space[5],
      borderRadius: theme.radii.xl,
      alignItems: 'center',
      ...theme.shadow.lg,
    },
    summaryLabel: {
      marginBottom: theme.space[2],
      letterSpacing: 1,
    },
    content: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: theme.space[16],
    },
    loadingText: {
      marginTop: theme.space[3],
    },
    movementsList: {
      paddingHorizontal: theme.space[5],
      paddingBottom: theme.space[5],
    },
    movementCard: {
      marginBottom: theme.space[3],
    },
    movementHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: theme.space[4],
      backgroundColor: theme.color.brand.accentSoft,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.state.info.border,
    },
    movementTypeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: theme.space[3],
    },
    movementTypeInfo: {
      flex: 1,
    },
    quantityBadge: {
      paddingHorizontal: theme.space[3.5],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.md,
      minWidth: 80,
      alignItems: 'center',
    },
    movementDetails: {
      padding: theme.space[4],
      gap: theme.space[2.5],
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    notesContainer: {
      marginTop: theme.space[2],
      padding: theme.space[3.5],
      backgroundColor: theme.color.state.warning.background,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.state.warning.border,
    },
    footer: {
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
      padding: theme.space[5],
      backgroundColor: theme.color.surface.base,
    },
  });

export default StockMovementHistoryModal;
