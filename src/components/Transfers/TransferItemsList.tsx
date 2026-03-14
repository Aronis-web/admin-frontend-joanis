import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
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
    padding: 16,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemHeader: {
    marginBottom: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemCorrelative: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6366F1',
    fontFamily: 'monospace',
  },
  itemSku: {
    fontSize: 12,
    color: '#64748B',
  },
  quantitiesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    marginBottom: 8,
  },
  quantityItem: {
    alignItems: 'center',
  },
  quantityLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  quantityValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  positive: {
    color: '#10B981',
  },
  negative: {
    color: '#EF4444',
  },
  notesContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 12,
    color: '#475569',
  },
  damageNotesContainer: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  damageNotesLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 4,
  },
  damageNotesText: {
    fontSize: 12,
    color: '#991B1B',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  areasContainer: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  areaInfo: {
    flex: 1,
  },
  areaSeparator: {
    width: 1,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 12,
  },
  areaLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  areaValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  warehouseValue: {
    fontSize: 11,
    color: '#64748B',
  },
});

export default TransferItemsList;
