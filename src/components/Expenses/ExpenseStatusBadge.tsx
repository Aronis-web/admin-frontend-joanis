import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ExpenseStatus, ExpenseStatusLabels, ExpenseStatusColors } from '@/types/expenses';
import { colors, spacing, borderRadius } from '@/design-system/tokens';

interface ExpenseStatusBadgeProps {
  status: ExpenseStatus | string;
  size?: 'small' | 'medium' | 'large';
}

export const ExpenseStatusBadge: React.FC<ExpenseStatusBadgeProps> = ({
  status,
  size = 'medium',
}) => {
  const backgroundColor = ExpenseStatusColors[status as ExpenseStatus] || colors.neutral[500];
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
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    alignSelf: 'flex-start',
  },
  small: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: borderRadius.xl,
  },
  medium: {
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.xl,
  },
  large: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.xl,
  },
  text: {
    color: colors.neutral[0],
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
