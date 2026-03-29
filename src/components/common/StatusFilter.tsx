import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, borderRadius } from '@/design-system/tokens';

export interface StatusOption {
  value: string;
  label: string;
  color: string;
}

interface StatusFilterProps {
  statuses: StatusOption[];
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  style?: any;
}

export const StatusFilter: React.FC<StatusFilterProps> = ({
  statuses,
  selectedStatus,
  onStatusChange,
  style,
}) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.container, style]}
      contentContainerStyle={styles.contentContainer}
    >
      {statuses.map((status) => {
        const isSelected = selectedStatus === status.value;
        return (
          <TouchableOpacity
            key={status.value}
            style={[
              styles.filterButton,
              isSelected && { backgroundColor: status.color },
            ]}
            onPress={() => onStatusChange(status.value)}
          >
            <Text
              style={[
                styles.filterText,
                isSelected && styles.filterTextActive,
              ]}
            >
              {status.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    maxHeight: 50,
  },
  contentContainer: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    gap: spacing[2],
  },
  filterButton: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    marginRight: spacing[2],
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.neutral[500],
  },
  filterTextActive: {
    color: colors.neutral[0],
    fontWeight: '600',
  },
});
