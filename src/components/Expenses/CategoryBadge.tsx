import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSafeIconName, getCategoryFallbackIcon } from '@/utils/iconUtils';

interface CategoryBadgeProps {
  category: {
    name: string;
    code: string;
    color?: string;
    icon?: string;
  };
  subcategory?: {
    name: string;
    code: string;
  };
  size?: 'small' | 'medium' | 'large';
  showCode?: boolean;
}

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({
  category,
  subcategory,
  size = 'medium',
  showCode = true,
}) => {
  const sizeStyles = {
    small: {
      container: styles.containerSmall,
      mainBadge: styles.mainBadgeSmall,
      mainText: styles.mainTextSmall,
      subBadge: styles.subBadgeSmall,
      subText: styles.subTextSmall,
      icon: 12,
    },
    medium: {
      container: styles.containerMedium,
      mainBadge: styles.mainBadgeMedium,
      mainText: styles.mainTextMedium,
      subBadge: styles.subBadgeMedium,
      subText: styles.subTextMedium,
      icon: 14,
    },
    large: {
      container: styles.containerLarge,
      mainBadge: styles.mainBadgeLarge,
      mainText: styles.mainTextLarge,
      subBadge: styles.subBadgeLarge,
      subText: styles.subTextLarge,
      icon: 16,
    },
  };

  const currentSize = sizeStyles[size];
  const safeIconName = getSafeIconName(category.icon, getCategoryFallbackIcon(category.name));

  return (
    <View style={[styles.container, currentSize.container]}>
      {/* Categoría Principal */}
      <View
        style={[
          styles.mainBadge,
          currentSize.mainBadge,
          { backgroundColor: category.color || '#6366F1' },
        ]}
      >
        {category.icon && (
          <Ionicons
            name={safeIconName as any}
            size={currentSize.icon}
            color="#FFFFFF"
            style={styles.icon}
          />
        )}
        <Text style={[styles.mainText, currentSize.mainText]} numberOfLines={1}>
          {category.name}
          {showCode && ` (${category.code})`}
        </Text>
      </View>

      {/* Subcategoría */}
      {subcategory && (
        <View style={[styles.subBadge, currentSize.subBadge]}>
          <Text style={[styles.subText, currentSize.subText]} numberOfLines={1}>
            {subcategory.name}
            {showCode && ` (${subcategory.code})`}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  containerSmall: {
    gap: 4,
  },
  containerMedium: {
    gap: 6,
  },
  containerLarge: {
    gap: 8,
  },
  mainBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  mainBadgeSmall: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  mainBadgeMedium: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  mainBadgeLarge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  icon: {
    marginRight: 4,
  },
  mainText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  mainTextSmall: {
    fontSize: 10,
  },
  mainTextMedium: {
    fontSize: 12,
  },
  mainTextLarge: {
    fontSize: 14,
  },
  subBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  subBadgeSmall: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  subBadgeMedium: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  subBadgeLarge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  subText: {
    color: '#475569',
    fontWeight: '500',
  },
  subTextSmall: {
    fontSize: 9,
  },
  subTextMedium: {
    fontSize: 11,
  },
  subTextLarge: {
    fontSize: 13,
  },
});

export default CategoryBadge;
