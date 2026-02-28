import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { expensesService } from '@/services/api';
import { ExpenseCategory } from '@/types/expenses';
import { AddButton } from '@/components/Navigation/AddButton';
import { CategoryCard } from '@/components/Expenses/CategoryCard';

interface ExpenseCategoriesScreenProps {
  navigation: any;
}

export const ExpenseCategoriesScreen: React.FC<ExpenseCategoriesScreenProps> = ({ navigation }) => {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      const response = await expensesService.getCategories();
      console.log('📦 Categories response:', response);
      console.log('📦 Categories data:', response.data);
      console.log('📦 Categories data type:', typeof response.data);
      console.log('📦 Categories data is array:', Array.isArray(response.data));

      // Filter to show only main categories (subcategories are nested)
      const mainCategories = response.data.filter((cat) => !cat.isSubcategory);
      setCategories(mainCategories);
    } catch (error: any) {
      console.error('Error loading categories:', error);
      Alert.alert('Error', 'No se pudieron cargar las categorías');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      console.log('📱 ExpenseCategoriesScreen focused - reloading categories...');
      setLoading(true);
      loadCategories();
    }, [loadCategories])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadCategories();
  };

  const handleCreateCategory = () => {
    navigation.navigate('CreateExpenseCategory');
  };

  const handleCategoryPress = (category: ExpenseCategory) => {
    // Navigate to edit screen instead of detail
    navigation.navigate('CreateExpenseCategory', { categoryId: category.id });
  };

  const handleCreateSubcategory = (category: ExpenseCategory) => {
    // Navigate to create subcategory screen
    navigation.navigate('CreateExpenseCategory', { parentCategoryId: category.id });
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Cargando categorías...</Text>
        </View>
      );
    }

    if (categories.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="folder-open-outline" size={64} color="#CBD5E1" />
          <Text style={styles.emptyText}>No hay categorías registradas</Text>
          <Text style={styles.emptySubtext}>
            Presiona el botón + para crear una nueva categoría
          </Text>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color="#6366F1" />
          <Text style={styles.infoText}>
            Las categorías se organizan en dos niveles: categorías principales y subcategorías
          </Text>
        </View>

        {categories.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            onPress={handleCategoryPress}
            onCreateSubcategory={handleCreateSubcategory}
            showSubcategories={true}
          />
        ))}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Categorías de Gastos</Text>
        <View style={styles.headerRight} />
      </View>
      <View style={styles.container}>
        {renderContent()}
        <AddButton onPress={handleCreateCategory} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 32,
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#4338CA',
    lineHeight: 18,
  },
});

export default ExpenseCategoriesScreen;
