import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExpenseProject, ProjectStatusLabels, ProjectStatusColors } from '@/types/expenses';
import { ProjectStatusBadge } from './ProjectStatusBadge';

interface ProjectCardProps {
  project: ExpenseProject;
  onPress: (project: ExpenseProject) => void;
  onAddExpense?: (project: ExpenseProject) => void;
  onViewExpenses?: (project: ExpenseProject) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onPress,
  onAddExpense,
  onViewExpenses,
}) => {
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatAmount = (cents: number) => {
    const amount = cents / 100;
    return `S/ ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getBudgetProgress = () => {
    if (project.budgetCents === 0) return 0;
    return (project.spentCents / project.budgetCents) * 100;
  };

  const getRemainingBudget = () => {
    return project.budgetCents - project.spentCents;
  };

  const budgetProgress = getBudgetProgress();
  const remainingBudget = getRemainingBudget();
  const isOverBudget = remainingBudget < 0;

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(project)} activeOpacity={0.7}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.projectCode}>{project.code}</Text>
          <Text style={styles.projectName} numberOfLines={1}>{project.name}</Text>
        </View>
        <ProjectStatusBadge status={project.status} size="small" />
      </View>

      <View style={styles.divider} />

      <View style={styles.content}>
        {project.description && (
          <Text style={styles.description} numberOfLines={2}>
            {project.description}
          </Text>
        )}

        <View style={styles.budgetContainer}>
          <View style={styles.budgetRow}>
            <Text style={styles.budgetLabel}>Presupuesto:</Text>
            <Text style={styles.budgetValue}>{formatAmount(project.budgetCents)}</Text>
          </View>
          <View style={styles.budgetRow}>
            <Text style={styles.budgetLabelSecondary}>Gastado:</Text>
            <Text style={styles.budgetValueSecondary}>{formatAmount(project.spentCents)}</Text>
          </View>
          <View style={styles.budgetRow}>
            <Text style={styles.budgetLabelSecondary}>
              {isOverBudget ? 'Excedido:' : 'Disponible:'}
            </Text>
            <Text style={[
              styles.budgetValueSecondary,
              isOverBudget ? styles.overBudget : styles.underBudget
            ]}>
              {formatAmount(Math.abs(remainingBudget))}
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[
              styles.progressFill,
              { width: `${Math.min(budgetProgress, 100)}%` },
              isOverBudget && styles.progressOverBudget
            ]} />
          </View>
          <Text style={styles.progressText}>
            {budgetProgress.toFixed(1)}% utilizado
          </Text>
        </View>

        <View style={styles.footer}>
          {project.site && (
            <View style={styles.footerItem}>
              <Ionicons name="business" size={12} color="#6366F1" />
              <Text style={styles.footerValue}>{project.site.name}</Text>
            </View>
          )}
          <View style={styles.footerItem}>
            <Text style={styles.footerLabel}>Inicio:</Text>
            <Text style={styles.footerValue}>{formatDate(project.startDate)}</Text>
          </View>
          {project.endDate && (
            <View style={styles.footerItem}>
              <Text style={styles.footerLabel}>Fin:</Text>
              <Text style={styles.footerValue}>{formatDate(project.endDate)}</Text>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.actions}>
          {onViewExpenses && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={(e) => {
                e.stopPropagation();
                onViewExpenses(project);
              }}
            >
              <Ionicons name="receipt-outline" size={18} color="#6366F1" />
              <Text style={styles.actionButtonText}>Gastos</Text>
            </TouchableOpacity>
          )}
          {onAddExpense && (
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonPrimary]}
              onPress={(e) => {
                e.stopPropagation();
                onAddExpense(project);
              }}
            >
              <Ionicons name="add-circle" size={18} color="#FFFFFF" />
              <Text style={styles.actionButtonTextPrimary}>Agregar Gasto</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  projectCode: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366F1',
    marginBottom: 2,
  },
  projectName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 12,
  },
  content: {
    gap: 12,
  },
  description: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  budgetContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  budgetValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  budgetLabelSecondary: {
    fontSize: 11,
    color: '#64748B',
  },
  budgetValueSecondary: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  underBudget: {
    color: '#10B981',
  },
  overBudget: {
    color: '#EF4444',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 4,
  },
  progressOverBudget: {
    backgroundColor: '#EF4444',
  },
  progressText: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerLabel: {
    fontSize: 11,
    color: '#94A3B8',
  },
  footerValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionButtonPrimary: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  actionButtonTextPrimary: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default ProjectCard;
