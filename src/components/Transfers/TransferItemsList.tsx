import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
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
  const styles = useThemedStyles(createStyles);
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    listContainer: {
      padding: theme.space[4],
    },
    itemCard: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      padding: theme.space[3],
      marginBottom: theme.space[3],
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    itemHeader: {
      marginBottom: theme.space[3],
    },
    itemInfo: {
      flex: 1,
    },
    itemTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    itemMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
    },
    itemCorrelative: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.color.brand.accent,
      fontFamily: 'monospace',
    },
    itemSku: {
      fontSize: 12,
      color: theme.color.text.muted,
    },
    quantitiesContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: theme.space[2],
      backgroundColor: theme.color.background.subtle,
      borderRadius: theme.radii.md,
      marginBottom: theme.space[2],
    },
    quantityItem: {
      alignItems: 'center',
    },
    quantityLabel: {
      fontSize: 10,
      color: theme.color.text.placeholder,
      fontWeight: '600',
      textTransform: 'uppercase',
      marginBottom: theme.space[1],
    },
    quantityValue: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.body,
    },
    positive: {
      color: theme.color.state.success.border,
    },
    negative: {
      color: theme.color.state.danger.border,
    },
    notesContainer: {
      marginTop: theme.space[2],
      padding: theme.space[2],
      backgroundColor: theme.color.surface.muted,
      borderRadius: theme.radii.sm,
    },
    notesLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.color.text.muted,
      marginBottom: theme.space[1],
    },
    notesText: {
      fontSize: 12,
      color: theme.color.text.muted,
    },
    damageNotesContainer: {
      backgroundColor: theme.color.state.danger.background,
      borderLeftWidth: 3,
      borderLeftColor: theme.color.state.danger.border,
    },
    damageNotesLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.color.text.danger,
      marginBottom: theme.space[1],
    },
    damageNotesText: {
      fontSize: 12,
      color: theme.color.state.danger.text,
    },
    emptyContainer: {
      padding: theme.space[8],
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 14,
      color: theme.color.text.placeholder,
      fontStyle: 'italic',
    },
    areasContainer: {
      flexDirection: 'row',
      backgroundColor: theme.color.background.subtle,
      borderRadius: theme.radii.md,
      padding: theme.space[3],
      marginBottom: theme.space[3],
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    areaInfo: {
      flex: 1,
    },
    areaSeparator: {
      width: 1,
      backgroundColor: theme.color.border.default,
      marginHorizontal: theme.space[3],
    },
    areaLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.color.text.muted,
      marginBottom: theme.space[1],
      textTransform: 'uppercase',
    },
    areaValue: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[0.5],
    },
    warehouseValue: {
      fontSize: 11,
      color: theme.color.text.muted,
    },
  });

export default TransferItemsList;
