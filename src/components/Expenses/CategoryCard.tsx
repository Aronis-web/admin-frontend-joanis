import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ExpenseCategory } from '@/types/expenses';

interface CategoryCardProps {
  category: ExpenseCategory;
  onPress: (category: ExpenseCategory) => void;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({ category, onPress }) => {
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(category)} activeOpacity={0.7}>
      <View style={styles.iconContainer}>
        {category.icon ? (
          <Text style={styles.iconText}>{category.icon}</Text>
        ) : (
          <View style={[styles.iconPlaceholder, { backgroundColor: category.color || '#6366F1' }]}>
            <Text style={styles.iconPlaceholderText}>{category.name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <Text style={styles.categoryName} numberOfLines={1}>
          {category.name}
        </Text>
        <Text style={styles.categoryCode}>{category.code}</Text>
        {category.description && (
          <Text style={styles.categoryDescription} numberOfLines={2}>
            {category.description}
          </Text>
        )}
      </View>

      {!category.isActive && (
        <View style={styles.inactiveBadge}>
          <Text style={styles.inactiveBadgeText}>Inactivo</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 32,
  },
  iconPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPlaceholderText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  categoryCode: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366F1',
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  inactiveBadge: {
    backgroundColor: '#94A3B8',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  inactiveBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default CategoryCard;
