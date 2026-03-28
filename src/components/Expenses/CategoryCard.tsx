import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExpenseCategory } from '@/types/expenses';
import { getSafeIconName, getCategoryFallbackIcon } from '@/utils/iconUtils';

// Design System
import { colors, spacing, borderRadius, shadows } from '@/design-system/tokens';

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
              color={category.color || colors.accent[500]}
            />
          ) : (
            <View
              style={[
                styles.iconPlaceholder,
                isSubcategory && styles.iconPlaceholderSmall,
                { backgroundColor: category.color || colors.accent[500] },
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
              <Ionicons name="folder-outline" size={12} color={colors.accent[500]} />
              <Text style={styles.subcategoryCountText}>{category.subcategories!.length}</Text>
            </View>
          )}
        </View>

        {/* Action buttons for main categories */}
        {!isSubcategory && (
          <View style={styles.actionButtons}>
            {onCreateSubcategory && (
              <TouchableOpacity onPress={handleCreateSubcategory} style={styles.addButton}>
                <Ionicons name="add-circle-outline" size={20} color={colors.success[500]} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleEditPress} style={styles.editButton}>
              <Ionicons name="create-outline" size={20} color={colors.accent[500]} />
            </TouchableOpacity>
            {hasSubcategories && (
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.neutral[500]}
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

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[2],
  },
  card: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  subcategoryCard: {
    marginLeft: spacing[6],
    marginTop: spacing[2],
    backgroundColor: colors.surface.secondary,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent[500],
    elevation: 1,
  },
  subcategoryIndicator: {
    position: 'absolute',
    left: -24,
    top: '50%',
    width: 20,
    height: 2,
    backgroundColor: colors.border.default,
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
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPlaceholderSmall: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
  },
  iconPlaceholderText: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.neutral[0],
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
    color: colors.text.primary,
    marginBottom: spacing[0.5],
  },
  subcategoryName: {
    fontSize: 14,
    fontWeight: '600',
  },
  categoryCode: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent[500],
    marginBottom: spacing[1],
  },
  categoryDescription: {
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 16,
  },
  badges: {
    gap: spacing[1],
    alignItems: 'flex-end',
  },
  inactiveBadge: {
    backgroundColor: colors.neutral[400],
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
  },
  inactiveBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  subcategoryCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent[50],
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    gap: spacing[1],
  },
  subcategoryCountText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.accent[500],
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginLeft: spacing[2],
  },
  addButton: {
    padding: spacing[1],
  },
  editButton: {
    padding: spacing[1],
  },
  expandIcon: {
    marginLeft: spacing[1],
  },
  subcategoriesContainer: {
    marginTop: spacing[1],
  },
});

export default CategoryCard;
