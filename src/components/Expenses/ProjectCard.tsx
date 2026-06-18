import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExpenseProject, ProjectStatusLabels, ProjectStatusColors } from '@/types/expenses';
import { ProjectStatusBadge } from './ProjectStatusBadge';
import { ProtectedTouchableOpacity } from '@/components/ui/ProtectedTouchableOpacity';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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
              <Ionicons name="business" size={12} color={theme.color.icon.accent} />
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
              <Ionicons name="receipt-outline" size={18} color={theme.color.icon.accent} />
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
              <Ionicons name="add-circle" size={18} color={theme.color.text.onAction} />
              <Text style={styles.actionButtonTextPrimary}>Agregar Gasto</Text>
            </ProtectedTouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
      marginBottom: theme.space[3],
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[3],
    },
    headerLeft: {
      flex: 1,
    },
    projectCode: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.brand.accent,
      marginBottom: theme.space[0.5],
    },
    projectName: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    divider: {
      height: 1,
      backgroundColor: theme.color.border.default,
      marginBottom: theme.space[3],
    },
    content: {
      gap: theme.space[3],
    },
    description: {
      fontSize: 13,
      color: theme.color.text.subtle,
      lineHeight: 18,
    },
    budgetContainer: {
      backgroundColor: theme.color.background.subtle,
      borderRadius: theme.radii.lg,
      padding: theme.space[3],
      gap: theme.space[1.5],
    },
    budgetRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    budgetLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    budgetValue: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    budgetLabelSecondary: {
      fontSize: 11,
      color: theme.color.text.subtle,
    },
    budgetValueSecondary: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    underBudget: {
      color: theme.color.text.success,
    },
    overBudget: {
      color: theme.color.text.danger,
    },
    progressBar: {
      height: 8,
      backgroundColor: theme.color.border.default,
      borderRadius: theme.radii.sm,
      overflow: 'hidden',
      marginTop: theme.space[1],
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.color.brand.accent,
      borderRadius: theme.radii.sm,
    },
    progressOverBudget: {
      backgroundColor: theme.color.icon.danger,
    },
    progressText: {
      fontSize: 10,
      color: theme.color.text.subtle,
      textAlign: 'center',
      marginTop: theme.space[0.5],
    },
    footer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[2],
      paddingTop: theme.space[2],
      borderTopWidth: 1,
      borderTopColor: theme.color.surface.muted,
    },
    footerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[1],
    },
    footerLabel: {
      fontSize: 11,
      color: theme.color.text.placeholder,
    },
    footerValue: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    actions: {
      flexDirection: 'row',
      gap: theme.space[2],
      paddingTop: theme.space[3],
      borderTopWidth: 1,
      borderTopColor: theme.color.surface.muted,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space[1.5],
      paddingVertical: theme.space[2.5],
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.background.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    actionButtonPrimary: {
      backgroundColor: theme.color.brand.accent,
      borderColor: theme.color.brand.accent,
    },
    actionButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    actionButtonTextPrimary: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
  });

export default ProjectCard;
