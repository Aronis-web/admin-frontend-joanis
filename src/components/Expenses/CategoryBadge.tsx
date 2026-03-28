import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSafeIconName, getCategoryFallbackIcon } from '@/utils/iconUtils';
import { colors, spacing, borderRadius } from '@/design-system/tokens';

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
          { backgroundColor: category.color || colors.accent[500] },
        ]}
      >
        {category.icon && (
          <Ionicons
            name={safeIconName as any}
            size={currentSize.icon}
            color={colors.neutral[0]}
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
    gap: spacing[1],
  },
  containerMedium: {
    gap: spacing[1.5],
  },
  containerLarge: {
    gap: spacing[2],
  },
  mainBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  mainBadgeSmall: {
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[1.5],
    paddingVertical: spacing[0.5],
  },
  mainBadgeMedium: {
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  mainBadgeLarge: {
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1.5],
  },
  icon: {
    marginRight: spacing[1],
  },
  mainText: {
    color: colors.neutral[0],
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
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderWidth: 1,
    borderColor: colors.neutral[300],
  },
  subBadgeSmall: {
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[1.5],
    paddingVertical: spacing[0.5],
  },
  subBadgeMedium: {
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  subBadgeLarge: {
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1.5],
  },
  subText: {
    color: colors.neutral[600],
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
