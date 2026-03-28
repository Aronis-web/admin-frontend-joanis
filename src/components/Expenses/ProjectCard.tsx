import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExpenseProject, ProjectStatusLabels, ProjectStatusColors } from '@/types/expenses';
import { ProjectStatusBadge } from './ProjectStatusBadge';
import { ProtectedTouchableOpacity } from '@/components/ui/ProtectedTouchableOpacity';
import { colors, spacing, borderRadius } from '@/design-system/tokens';

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
    if (!dateString) {
      return '-';
    }
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatAmount = (cents: number) => {
    const amount = cents / 100;
    return `S/ ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getBudgetProgress = () => {
    if (project.budgetCents === 0) {
      return 0;
    }
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
          <Text style={styles.projectName} numberOfLines={1}>
            {project.name}
          </Text>
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
            <Text
              style={[
                styles.budgetValueSecondary,
                isOverBudget ? styles.overBudget : styles.underBudget,
              ]}
            >
              {formatAmount(Math.abs(remainingBudget))}
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min(budgetProgress, 100)}%` },
                isOverBudget && styles.progressOverBudget,
              ]}
            />
          </View>
          <Text style={styles.progressText}>{budgetProgress.toFixed(1)}% utilizado</Text>
        </View>

        <View style={styles.footer}>
          {project.site && (
            <View style={styles.footerItem}>
              <Ionicons name="business" size={12} color={colors.primary[500]} />
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
            <ProtectedTouchableOpacity
              style={styles.actionButton}
              onPress={(e) => {
                e.stopPropagation();
                onViewExpenses(project);
              }}
              requiredPermissions={['expenses.read']}
              hideIfNoPermission={true}
            >
              <Ionicons name="receipt-outline" size={18} color={colors.primary[500]} />
              <Text style={styles.actionButtonText}>Gastos</Text>
            </ProtectedTouchableOpacity>
          )}
          {onAddExpense && (
            <ProtectedTouchableOpacity
              style={[styles.actionButton, styles.actionButtonPrimary]}
              onPress={(e) => {
                e.stopPropagation();
                onAddExpense(project);
              }}
              requiredPermissions={['expenses.create']}
              hideIfNoPermission={true}
            >
              <Ionicons name="add-circle" size={18} color={colors.neutral[0]} />
              <Text style={styles.actionButtonTextPrimary}>Agregar Gasto</Text>
            </ProtectedTouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[3],
    shadowColor: colors.neutral[950],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  headerLeft: {
    flex: 1,
  },
  projectCode: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary[500],
    marginBottom: spacing[0.5],
  },
  projectName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginBottom: spacing[3],
  },
  content: {
    gap: spacing[3],
  },
  description: {
    fontSize: 13,
    color: colors.neutral[500],
    lineHeight: 18,
  },
  budgetContainer: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    gap: spacing[1.5],
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[600],
  },
  budgetValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  budgetLabelSecondary: {
    fontSize: 11,
    color: colors.neutral[500],
  },
  budgetValueSecondary: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[600],
  },
  underBudget: {
    color: colors.success[500],
  },
  overBudget: {
    color: colors.danger[500],
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.border.default,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    marginTop: spacing[1],
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.sm,
  },
  progressOverBudget: {
    backgroundColor: colors.danger[500],
  },
  progressText: {
    fontSize: 10,
    color: colors.neutral[500],
    textAlign: 'center',
    marginTop: spacing[0.5],
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  footerLabel: {
    fontSize: 11,
    color: colors.neutral[400],
  },
  footerValue: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral[600],
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1.5],
    paddingVertical: spacing[2.5],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  actionButtonPrimary: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[600],
  },
  actionButtonTextPrimary: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[0],
  },
});

export default ProjectCard;
