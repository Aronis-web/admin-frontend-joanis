import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { TransferItem, Transfer } from '@/types/transfers';

interface TransferItemsListProps {
  items: TransferItem[];
  showShipped?: boolean;
  showReceived?: boolean;
  showDifference?: boolean;
  transfer?: Transfer; // Agregamos el transfer completo para acceder a las áreas
}

export const TransferItemsList: React.FC<TransferItemsListProps> = ({
  items,
  showShipped = false,
  showReceived = false,
  showDifference = false,
  transfer,
}) => {
  // Debug: Log transfer data
  React.useEffect(() => {
    if (transfer) {
      console.log('🔍 TransferItemsList - Transfer data:', {
        id: transfer.id,
        transferNumber: transfer.transferNumber,
        hasOriginArea: !!transfer.originArea,
        hasDestinationArea: !!transfer.destinationArea,
        originArea: transfer.originArea,
        destinationArea: transfer.destinationArea,
        originWarehouse: transfer.originWarehouse,
        destinationWarehouse: transfer.destinationWarehouse,
      });
    } else {
      console.log('⚠️ TransferItemsList - No transfer data provided');
    }
  }, [transfer]);

  const renderItem = ({ item }: { item: TransferItem }) => {
    const hasDifference = showDifference && item.quantityDifference !== 0;

    return (
      <View style={styles.itemCard}>
        <View style={styles.itemHeader}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemTitle} numberOfLines={2}>
              {item.product?.title || 'Producto sin nombre'}
            </Text>
            <View style={styles.itemMetaRow}>
              {item.product?.correlativeNumber && (
                <Text style={styles.itemCorrelative}>#{item.product.correlativeNumber}</Text>
              )}
              <Text style={styles.itemSku}>SKU: {item.product?.sku || 'N/A'}</Text>
            </View>
          </View>
        </View>

        {/* Información de Áreas de Origen y Destino */}
        {transfer && (
          <View style={styles.areasContainer}>
            <View style={styles.areaInfo}>
              <Text style={styles.areaLabel}>📤 Área de Origen:</Text>
              <Text style={styles.areaValue}>
                {transfer.originArea?.name || 'Sin área asignada'}
              </Text>
              <Text style={styles.warehouseValue}>
                {transfer.originWarehouse?.name || 'Sin almacén'}
              </Text>
            </View>
            <View style={styles.areaSeparator} />
            <View style={styles.areaInfo}>
              <Text style={styles.areaLabel}>📥 Área de Destino:</Text>
              <Text style={styles.areaValue}>
                {transfer.destinationArea?.name || 'Sin área asignada'}
              </Text>
              <Text style={styles.warehouseValue}>
                {transfer.destinationWarehouse?.name || 'Sin almacén'}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.quantitiesContainer}>
          <View style={styles.quantityItem}>
            <Text style={styles.quantityLabel}>Solicitado</Text>
            <Text style={styles.quantityValue}>{item.quantityRequested}</Text>
          </View>

          {showShipped && (
            <View style={styles.quantityItem}>
              <Text style={styles.quantityLabel}>Despachado</Text>
              <Text style={styles.quantityValue}>{item.quantityShipped || 0}</Text>
            </View>
          )}

          {showReceived && (
            <View style={styles.quantityItem}>
              <Text style={styles.quantityLabel}>Recibido</Text>
              <Text style={styles.quantityValue}>{item.quantityReceived || 0}</Text>
            </View>
          )}

          {showDifference && (
            <View style={styles.quantityItem}>
              <Text style={styles.quantityLabel}>Diferencia</Text>
              <Text
                style={[
                  styles.quantityValue,
                  hasDifference &&
                    (item.quantityDifference! > 0 ? styles.positive : styles.negative),
                ]}
              >
                {item.quantityDifference || 0}
              </Text>
            </View>
          )}
        </View>

        {item.notes && (
          <View style={styles.notesContainer}>
            <Text style={styles.notesLabel}>Notas:</Text>
            <Text style={styles.notesText}>{item.notes}</Text>
          </View>
        )}

        {item.damageNotes && (
          <View style={[styles.notesContainer, styles.damageNotesContainer]}>
            <Text style={styles.damageNotesLabel}>⚠️ Daños:</Text>
            <Text style={styles.damageNotesText}>{item.damageNotes}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <FlatList
      data={items}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContainer}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No hay items en este traslado</Text>
        </View>
      }
    />
  );
};

const styles = StyleSheet.create({
  listContainer: {
    padding: spacing[4],
  },
  itemCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  itemHeader: {
    marginBottom: spacing[3],
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: spacing[1],
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  itemCorrelative: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent[500],
    fontFamily: 'monospace',
  },
  itemSku: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  quantitiesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing[2],
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    marginBottom: spacing[2],
  },
  quantityItem: {
    alignItems: 'center',
  },
  quantityLabel: {
    fontSize: 10,
    color: colors.neutral[400],
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: spacing[1],
  },
  quantityValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  positive: {
    color: colors.success[500],
  },
  negative: {
    color: colors.danger[500],
  },
  notesContainer: {
    marginTop: spacing[2],
    padding: spacing[2],
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.sm,
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral[500],
    marginBottom: spacing[1],
  },
  notesText: {
    fontSize: 12,
    color: colors.neutral[600],
  },
  damageNotesContainer: {
    backgroundColor: colors.danger[50],
    borderLeftWidth: 3,
    borderLeftColor: colors.danger[500],
  },
  damageNotesLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.danger[600],
    marginBottom: spacing[1],
  },
  damageNotesText: {
    fontSize: 12,
    color: colors.danger[800],
  },
  emptyContainer: {
    padding: spacing[8],
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.neutral[400],
    fontStyle: 'italic',
  },
  areasContainer: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing[3],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  areaInfo: {
    flex: 1,
  },
  areaSeparator: {
    width: 1,
    backgroundColor: colors.neutral[300],
    marginHorizontal: spacing[3],
  },
  areaLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral[500],
    marginBottom: spacing[1],
    textTransform: 'uppercase',
  },
  areaValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: spacing[0.5],
  },
  warehouseValue: {
    fontSize: 11,
    color: colors.neutral[500],
  },
});

export default TransferItemsList;
