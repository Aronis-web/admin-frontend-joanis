import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

export interface Column<T> {
  key: string;
  title: string;
  width?: number | string;
  flex?: number;
  render?: (item: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowPress?: (item: T) => void;
  loading?: boolean;
  emptyMessage?: string;
  keyExtractor?: (item: T, index: number) => string;
  style?: any;
  headerStyle?: any;
  rowStyle?: any;
}

export const DataTable = <T extends Record<string, any>>({
  data,
  columns,
  onRowPress,
  loading = false,
  emptyMessage = 'No hay datos disponibles',
  keyExtractor,
  style,
  headerStyle,
  rowStyle,
}: DataTableProps<T>) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const renderHeader = () => (
    <View style={[styles.headerRow, headerStyle]}>
      {columns.map((column) => (
        <View
          key={column.key}
          style={[
            styles.headerCell,
            column.width ? { width: column.width } : undefined,
            column.flex ? { flex: column.flex } : undefined,
            column.align ? { alignItems: getAlignment(column.align) } : undefined,
          ]}
        >
          <Text style={styles.headerText}>{column.title}</Text>
        </View>
      ))}
    </View>
  );

  const renderRow = ({ item, index }: { item: T; index: number }) => {
    const isEven = index % 2 === 0;
    return (
      <TouchableOpacity
        style={[
          styles.row,
          isEven && styles.rowEven,
          rowStyle,
        ]}
        onPress={() => onRowPress?.(item)}
        disabled={!onRowPress}
      >
        {columns.map((column) => (
          <View
            key={column.key}
            style={[
              styles.cell,
              column.width ? { width: column.width } : undefined,
              column.flex ? { flex: column.flex } : undefined,
              column.align ? { alignItems: getAlignment(column.align) } : undefined,
            ]}
          >
            {column.render ? (
              column.render(item)
            ) : (
              <Text style={styles.cellText} numberOfLines={2}>
                {item[column.key]?.toString() || '-'}
              </Text>
            )}
          </View>
        ))}
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>{emptyMessage}</Text>
    </View>
  );

  const renderFooter = () => {
    if (!loading) return null;
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={theme.color.brand.primary} />
      </View>
    );
  };

  const getAlignment = (align: 'left' | 'center' | 'right') => {
    switch (align) {
      case 'left':
        return 'flex-start';
      case 'center':
        return 'center';
      case 'right':
        return 'flex-end';
      default:
        return 'flex-start';
    }
  };

  return (
    <View style={[styles.container, style]}>
      {renderHeader()}
      <FlatList
        data={data}
        renderItem={renderRow}
        keyExtractor={keyExtractor || ((item, index) => index.toString())}
        ListEmptyComponent={!loading ? renderEmpty : null}
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={true}
      />
    </View>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.surface.base,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: theme.color.background.subtle,
    borderBottomWidth: 2,
    borderBottomColor: theme.color.border.default,
    paddingVertical: theme.space[3],
    paddingHorizontal: theme.space[4],
  },
  headerCell: {
    justifyContent: 'center',
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.muted,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: theme.space[3],
    paddingHorizontal: theme.space[4],
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  rowEven: {
    backgroundColor: theme.color.background.subtle,
  },
  cell: {
    justifyContent: 'center',
  },
  cellText: {
    fontSize: 14,
    color: theme.color.text.body,
  },
  emptyContainer: {
    padding: theme.space[8],
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: theme.color.text.muted,
    textAlign: 'center',
  },
  loadingContainer: {
    padding: theme.space[4],
    alignItems: 'center',
  },
});
