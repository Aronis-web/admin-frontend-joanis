import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TransferStatus, getTransferStatusLabel, getTransferStatusColor } from '@/types/transfers';

interface TransferStatusBadgeProps {
  status: TransferStatus;
  size?: 'small' | 'medium' | 'large';
}

export const TransferStatusBadge: React.FC<TransferStatusBadgeProps> = ({ status, size = 'medium' }) => {
  const color = getTransferStatusColor(status);
  const label = getTransferStatusLabel(status);

  const sizeStyles = {
    small: { paddingHorizontal: 6, paddingVertical: 2, fontSize: 10 },
    medium: { paddingHorizontal: 8, paddingVertical: 4, fontSize: 11 },
    large: { paddingHorizontal: 10, paddingVertical: 6, fontSize: 12 },
  };

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: `${color}15`, borderColor: color },
        {
          paddingHorizontal: sizeStyles[size].paddingHorizontal,
          paddingVertical: sizeStyles[size].paddingVertical,
        },
      ]}
    >
      <Text style={[styles.badgeText, { color, fontSize: sizeStyles[size].fontSize }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontWeight: '600',
  },
});

export default TransferStatusBadge;
