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
import { ExpenseProject, ProjectStatus, ProjectStatusLabels } from '@/types/expenses';
import { AddButton } from '@/components/Navigation/AddButton';
import { ProjectCard } from '@/components/Expenses/ProjectCard';
import { MAIN_ROUTES } from '@/constants/routes';

interface ExpenseProjectsScreenProps {
  navigation: any;
}

export const ExpenseProjectsScreen: React.FC<ExpenseProjectsScreenProps> = ({
  navigation,
}) => {
  const [projects, setProjects] = useState<ExpenseProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<ProjectStatus | 'ALL'>('ALL');

  const loadProjects = useCallback(async () => {
    try {
      const params = selectedStatus !== 'ALL' ? { status: selectedStatus } : {};
      const response = await expensesService.getProjects(params);
      setProjects(response.data);
    } catch (error: any) {
      console.error('Error loading projects:', error);
      Alert.alert('Error', 'No se pudieron cargar los proyectos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedStatus]);

  useFocusEffect(
    useCallback(() => {
      console.log('📱 ExpenseProjectsScreen focused - reloading projects...');
      setLoading(true);
      loadProjects();
    }, [loadProjects])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadProjects();
  };

  const handleCreateProject = () => {
    navigation.navigate(MAIN_ROUTES.CREATE_EXPENSE_PROJECT);
  };

  const handleProjectPress = (project: ExpenseProject) => {
    navigation.navigate(MAIN_ROUTES.EXPENSE_PROJECT_DETAIL, { projectId: project.id });
  };

  const handleAddExpense = (project: ExpenseProject) => {
    navigation.navigate(MAIN_ROUTES.CREATE_EXPENSE, { projectId: project.id });
  };

  const handleViewExpenses = (project: ExpenseProject) => {
    navigation.navigate(MAIN_ROUTES.EXPENSE_PROJECT_DETAIL, { projectId: project.id });
  };

  const renderStatusFilter = () => {
    const statuses: Array<ProjectStatus | 'ALL'> = [
      'ALL',
      ProjectStatus.PLANNING,
      ProjectStatus.ACTIVE,
      ProjectStatus.ON_HOLD,
      ProjectStatus.COMPLETED,
      ProjectStatus.CANCELLED,
    ];

    return (
      <View style={styles.filterWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          {statuses.map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterButton,
                selectedStatus === status && styles.filterButtonActive,
              ]}
              onPress={() => setSelectedStatus(status)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  selectedStatus === status && styles.filterButtonTextActive,
                ]}
              >
                {status === 'ALL' ? 'Todos' : ProjectStatusLabels[status]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Cargando proyectos...</Text>
        </View>
      );
    }

    if (projects.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No hay proyectos registrados</Text>
          <Text style={styles.emptySubtext}>
            Presiona el botón + para crear un nuevo proyecto
          </Text>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onPress={handleProjectPress}
            onAddExpense={handleAddExpense}
            onViewExpenses={handleViewExpenses}
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
        <Text style={styles.headerTitle}>Proyectos de Gastos</Text>
        <View style={styles.headerRight} />
      </View>
      <View style={styles.container}>
        {renderStatusFilter()}
        {renderContent()}
        <AddButton onPress={handleCreateProject} />
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
  filterWrapper: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  filterContent: {
    paddingRight: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterButtonActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
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
});

export default ExpenseProjectsScreen;
