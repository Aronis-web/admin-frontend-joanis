import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ExpenseStatus, ExpenseStatusLabels, ExpenseStatusColors } from '@/types/expenses';

interface ExpenseStatusBadgeProps {
  status: ExpenseStatus | string;
  size?: 'small' | 'medium' | 'large';
}

export const ExpenseStatusBadge: React.FC<ExpenseStatusBadgeProps> = ({
  status,
  size = 'medium'
}) => {
  const backgroundColor = ExpenseStatusColors[status as ExpenseStatus] || '#6B7280';
  const label = ExpenseStatusLabels[status as ExpenseStatus] || status;

  const sizeStyles = {
    small: styles.small,
    medium: styles.medium,
    large: styles.large,
  };

  const textSizeStyles = {
    small: styles.textSmall,
    medium: styles.textMedium,
    large: styles.textLarge,
  };

  return (
    <View style={[styles.badge, sizeStyles[size], { backgroundColor }]}>
      <Text style={[styles.text, textSizeStyles[size]]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  small: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  medium: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  large: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  textSmall: {
    fontSize: 10,
  },
  textMedium: {
    fontSize: 11,
  },
  textLarge: {
    fontSize: 12,
  },
});

export default ExpenseStatusBadge;
