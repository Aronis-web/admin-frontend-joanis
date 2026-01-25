import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

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
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});
