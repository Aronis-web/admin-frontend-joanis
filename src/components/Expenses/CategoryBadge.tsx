import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSafeIconName, getCategoryFallbackIcon } from '@/utils/iconUtils';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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
          { backgroundColor: category.color || theme.color.brand.accent },
        ]}
      >
        {category.icon && (
          <Ionicons
            name={safeIconName as any}
            size={currentSize.icon}
            color={theme.color.text.onAction}
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    containerSmall: {
      gap: theme.space[1],
    },
    containerMedium: {
      gap: theme.space[1.5],
    },
    containerLarge: {
      gap: theme.space[2],
    },
    mainBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: theme.radii.xl,
      paddingHorizontal: theme.space[2],
      paddingVertical: theme.space[1],
    },
    mainBadgeSmall: {
      borderRadius: theme.radii.lg,
      paddingHorizontal: theme.space[1.5],
      paddingVertical: theme.space[0.5],
    },
    mainBadgeMedium: {
      borderRadius: theme.radii.xl,
      paddingHorizontal: theme.space[2],
      paddingVertical: theme.space[1],
    },
    mainBadgeLarge: {
      borderRadius: theme.radii.xl,
      paddingHorizontal: theme.space[2.5],
      paddingVertical: theme.space[1.5],
    },
    icon: {
      marginRight: theme.space[1],
    },
    mainText: {
      color: theme.color.text.onAction,
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
      backgroundColor: theme.color.surface.muted,
      borderRadius: theme.radii.xl,
      paddingHorizontal: theme.space[2],
      paddingVertical: theme.space[1],
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    subBadgeSmall: {
      borderRadius: theme.radii.lg,
      paddingHorizontal: theme.space[1.5],
      paddingVertical: theme.space[0.5],
    },
    subBadgeMedium: {
      borderRadius: theme.radii.xl,
      paddingHorizontal: theme.space[2],
      paddingVertical: theme.space[1],
    },
    subBadgeLarge: {
      borderRadius: theme.radii.xl,
      paddingHorizontal: theme.space[2.5],
      paddingVertical: theme.space[1.5],
    },
    subText: {
      color: theme.color.text.muted,
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
