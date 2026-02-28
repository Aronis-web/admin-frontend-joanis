import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExpenseCategory } from '@/types/expenses';
import { getSafeIconName, getCategoryFallbackIcon } from '@/utils/iconUtils';

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
              color={category.color || '#6366F1'}
            />
          ) : (
            <View
              style={[
                styles.iconPlaceholder,
                isSubcategory && styles.iconPlaceholderSmall,
                { backgroundColor: category.color || '#6366F1' },
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
              <Ionicons name="folder-outline" size={12} color="#6366F1" />
              <Text style={styles.subcategoryCountText}>{category.subcategories!.length}</Text>
            </View>
          )}
        </View>

        {/* Action buttons for main categories */}
        {!isSubcategory && (
          <View style={styles.actionButtons}>
            {onCreateSubcategory && (
              <TouchableOpacity onPress={handleCreateSubcategory} style={styles.addButton}>
                <Ionicons name="add-circle-outline" size={20} color="#10B981" />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleEditPress} style={styles.editButton}>
              <Ionicons name="create-outline" size={20} color="#6366F1" />
            </TouchableOpacity>
            {hasSubcategories && (
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#64748B"
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
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
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
  subcategoryCard: {
    marginLeft: 24,
    marginTop: 8,
    backgroundColor: '#F8FAFC',
    borderLeftWidth: 3,
    borderLeftColor: '#6366F1',
    elevation: 1,
  },
  subcategoryIndicator: {
    position: 'absolute',
    left: -24,
    top: '50%',
    width: 20,
    height: 2,
    backgroundColor: '#CBD5E1',
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
  iconPlaceholderSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  iconPlaceholderText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
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
    color: '#1E293B',
    marginBottom: 2,
  },
  subcategoryName: {
    fontSize: 14,
    fontWeight: '600',
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
  badges: {
    gap: 4,
    alignItems: 'flex-end',
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
  subcategoryCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  subcategoryCountText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6366F1',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  addButton: {
    padding: 4,
  },
  editButton: {
    padding: 4,
  },
  expandIcon: {
    marginLeft: 4,
  },
  subcategoriesContainer: {
    marginTop: 4,
  },
});

export default CategoryCard;
