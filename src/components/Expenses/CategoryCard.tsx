import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExpenseCategory } from '@/types/expenses';
import { getSafeIconName, getCategoryFallbackIcon } from '@/utils/iconUtils';

// Design System
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

interface CategoryCardProps {
  category: ExpenseCategory;
  onPress: (category: ExpenseCategory) => void;
  onCreateSubcategory?: (category: ExpenseCategory) => void;
  isSubcategory?: boolean;
  showSubcategories?: boolean;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  onPress,
  onCreateSubcategory,
  isSubcategory = false,
  showSubcategories = true,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const hasSubcategories = category.subcategories && category.subcategories.length > 0;
  const safeIconName = getSafeIconName(category.icon, getCategoryFallbackIcon(category.name));

  const handlePress = () => {
    if (!isSubcategory && hasSubcategories) {
      // Toggle expansion for main categories with subcategories
      setIsExpanded(!isExpanded);
    } else {
      // Navigate to edit for subcategories or categories without subcategories
      onPress(category);
    }
  };

  const handleEditPress = (e: any) => {
    e.stopPropagation();
    onPress(category);
  };

  const handleCreateSubcategory = (e: any) => {
    e.stopPropagation();
    if (onCreateSubcategory) {
      onCreateSubcategory(category);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.card, isSubcategory && styles.subcategoryCard]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        {isSubcategory && <View style={styles.subcategoryIndicator} />}

        <View style={styles.iconContainer}>
          {category.icon ? (
            <Ionicons
              name={safeIconName as any}
              size={isSubcategory ? 24 : 32}
              color={category.color || theme.color.brand.accent}
            />
          ) : (
            <View
              style={[
                styles.iconPlaceholder,
                isSubcategory && styles.iconPlaceholderSmall,
                { backgroundColor: category.color || theme.color.brand.accent },
              ]}
            >
              <Text
                style={[
                  styles.iconPlaceholderText,
                  isSubcategory && styles.iconPlaceholderTextSmall,
                ]}
              >
                {category.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          <Text style={[styles.categoryName, isSubcategory && styles.subcategoryName]} numberOfLines={1}>
            {category.name}
          </Text>
          <Text style={styles.categoryCode}>{category.code}</Text>
          {category.description && (
            <Text style={styles.categoryDescription} numberOfLines={2}>
              {category.description}
            </Text>
          )}
        </View>

        <View style={styles.badges}>
          {!category.isActive && (
            <View style={styles.inactiveBadge}>
              <Text style={styles.inactiveBadgeText}>Inactivo</Text>
            </View>
          )}
          {!isSubcategory && hasSubcategories && (
            <View style={styles.subcategoryCountBadge}>
              <Ionicons name="folder-outline" size={12} color={theme.color.brand.accent} />
              <Text style={styles.subcategoryCountText}>{category.subcategories!.length}</Text>
            </View>
          )}
        </View>

        {/* Action buttons for main categories */}
        {!isSubcategory && (
          <View style={styles.actionButtons}>
            {onCreateSubcategory && (
              <TouchableOpacity onPress={handleCreateSubcategory} style={styles.addButton}>
                <Ionicons name="add-circle-outline" size={20} color={theme.color.icon.success} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleEditPress} style={styles.editButton}>
              <Ionicons name="create-outline" size={20} color={theme.color.icon.accent} />
            </TouchableOpacity>
            {hasSubcategories && (
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={theme.color.icon.subtle}
                style={styles.expandIcon}
              />
            )}
          </View>
        )}
      </TouchableOpacity>

      {/* Render subcategories - only when expanded */}
      {!isSubcategory && showSubcategories && hasSubcategories && isExpanded && (
        <View style={styles.subcategoriesContainer}>
          {category.subcategories!.map((subcat) => (
            <CategoryCard
              key={subcat.id}
              category={subcat}
              onPress={onPress}
              isSubcategory={true}
              showSubcategories={false}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      marginBottom: theme.space[2],
    },
    card: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
      ...theme.shadow.sm,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
    },
    subcategoryCard: {
      marginLeft: theme.space[6],
      marginTop: theme.space[2],
      backgroundColor: theme.color.surface.subtle,
      borderLeftWidth: 3,
      borderLeftColor: theme.color.brand.accent,
      elevation: 1,
    },
    subcategoryIndicator: {
      position: 'absolute',
      left: -24,
      top: '50%',
      width: 20,
      height: 2,
      backgroundColor: theme.color.border.default,
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
      borderRadius: theme.radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconPlaceholderSmall: {
      width: 40,
      height: 40,
      borderRadius: theme.radii.full,
    },
    iconPlaceholderText: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.color.text.onAction,
    },
    iconPlaceholderTextSmall: {
      fontSize: 18,
    },
    content: {
      flex: 1,
    },
    categoryName: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: theme.space[0.5],
    },
    subcategoryName: {
      fontSize: 14,
      fontWeight: '600',
    },
    categoryCode: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.brand.accent,
      marginBottom: theme.space[1],
    },
    categoryDescription: {
      fontSize: 12,
      color: theme.color.text.muted,
      lineHeight: 16,
    },
    badges: {
      gap: theme.space[1],
      alignItems: 'flex-end',
    },
    inactiveBadge: {
      backgroundColor: theme.color.border.strong,
      borderRadius: theme.radii.full,
      paddingHorizontal: theme.space[2],
      paddingVertical: theme.space[0.5],
    },
    inactiveBadgeText: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
    subcategoryCountBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.brand.accentSoft,
      borderRadius: theme.radii.full,
      paddingHorizontal: theme.space[2],
      paddingVertical: theme.space[0.5],
      gap: theme.space[1],
    },
    subcategoryCountText: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.color.brand.accent,
    },
    actionButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      marginLeft: theme.space[2],
    },
    addButton: {
      padding: theme.space[1],
    },
    editButton: {
      padding: theme.space[1],
    },
    expandIcon: {
      marginLeft: theme.space[1],
    },
    subcategoriesContainer: {
      marginTop: theme.space[1],
    },
  });

export default CategoryCard;
