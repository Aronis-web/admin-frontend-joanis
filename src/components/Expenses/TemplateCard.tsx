import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExpenseTemplate, TemplateFrequencyLabels } from '@/types/expenses';
import { CategoryBadge } from './CategoryBadge';
import { ProtectedTouchableOpacity } from '@/components/ui/ProtectedTouchableOpacity';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

interface TemplateCardProps {
  template: ExpenseTemplate;
  onPress: (template: ExpenseTemplate) => void;
  onGenerate?: (template: ExpenseTemplate) => void;
  onEdit?: (template: ExpenseTemplate) => void;
  onDelete?: (template: ExpenseTemplate) => void;
}

export const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  onPress,
  onGenerate,
  onEdit,
  onDelete,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const formatDate = (dateString?: string) => {
    if (!dateString) {
      return '-';
    }
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatAmount = (amountCents?: number, currency?: string) => {
    if (!amountCents) {
      return 'S/ 0.00';
    }
    const amount = amountCents / 100; // Convert cents to main currency unit
    const currencySymbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : 'S/';
    return `${currencySymbol} ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(template)} activeOpacity={0.7}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.nameContainer}>
            <Text style={styles.templateName} numberOfLines={1}>
              {template.name}
            </Text>
            {!template.isActive && (
              <View style={styles.inactiveBadge}>
                <Text style={styles.inactiveBadgeText}>Inactivo</Text>
              </View>
            )}
          </View>
          {template.description && (
            <Text style={styles.description} numberOfLines={2}>
              {template.description}
            </Text>
          )}
        </View>
        <View
          style={[
            styles.statusIndicator,
            { backgroundColor: template.isActive ? theme.color.icon.success : theme.color.border.strong },
          ]}
        />
      </View>

      <View style={styles.divider} />

      <View style={styles.content}>
        <View style={styles.row}>
          <View style={styles.infoItem}>
            <Text style={styles.label}>Monto Base</Text>
            <Text style={styles.amountValue}>
              {formatAmount(template.amountCents, template.currency)}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.label}>Frecuencia</Text>
            <Text style={styles.value}>{TemplateFrequencyLabels[template.frequency]}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.infoItem}>
            <Text style={styles.label}>Día del Mes</Text>
            <Text style={styles.value}>{template.dayOfMonth}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.label}>Categoría</Text>
            {template.category && template.subcategory ? (
              <CategoryBadge
                category={{
                  name: template.category.name,
                  code: template.category.code || '',
                  color: template.category.color,
                  icon: template.category.icon,
                }}
                subcategory={{
                  name: template.subcategory.name,
                  code: template.subcategory.code || '',
                }}
                size="small"
                showCode={false}
              />
            ) : (
              <Text style={styles.value} numberOfLines={1}>
                {template.category?.name || 'Sin categoría'}
              </Text>
            )}
          </View>
        </View>

        {/* Site Info */}
        {template.site && (
          <View style={styles.siteContainer}>
            <Ionicons name="business" size={14} color={theme.color.icon.accent} />
            <Text style={styles.siteText} numberOfLines={1}>
              {template.site.name}
            </Text>
          </View>
        )}

        <View style={styles.footer}>
          <View style={styles.footerItem}>
            <Text style={styles.footerLabel}>Fecha Inicio:</Text>
            <Text style={styles.footerValue}>{formatDate(template.startDate)}</Text>
          </View>
          {template.endDate && (
            <View style={styles.footerItem}>
              <Text style={styles.footerLabel}>Fecha Fin:</Text>
              <Text style={styles.footerValue}>{formatDate(template.endDate)}</Text>
            </View>
          )}
        </View>

        {template.lastGeneratedDate && (
          <View style={styles.footer}>
            <Text style={styles.footerLabel}>Última Generación:</Text>
            <Text style={styles.footerValue}>{formatDate(template.lastGeneratedDate)}</Text>
          </View>
        )}

        {(onEdit || onDelete) && (
          <View style={styles.actionButtons}>
            {onEdit && (
              <ProtectedTouchableOpacity
                style={styles.actionButton}
                onPress={(e) => {
                  e.stopPropagation();
                  onEdit(template);
                }}
                requiredPermissions={['expenses.templates.update']}
                hideIfNoPermission={true}
              >
                <Ionicons name="create-outline" size={18} color={theme.color.icon.accent} />
                <Text style={styles.actionButtonText}>Editar</Text>
              </ProtectedTouchableOpacity>
            )}
            {onDelete && (
              <ProtectedTouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={(e) => {
                  e.stopPropagation();
                  onDelete(template);
                }}
                requiredPermissions={['expenses.templates.delete']}
                hideIfNoPermission={true}
              >
                <Ionicons name="trash-outline" size={18} color={theme.color.icon.danger} />
                <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Eliminar</Text>
              </ProtectedTouchableOpacity>
            )}
          </View>
        )}

        {onGenerate && template.isActive && (
          <TouchableOpacity
            style={styles.generateButton}
            onPress={(e) => {
              e.stopPropagation();
              onGenerate(template);
            }}
          >
            <Ionicons name="flash-outline" size={18} color={theme.color.text.onAction} />
            <Text style={styles.generateButtonText}>Generar Gasto</Text>
          </TouchableOpacity>
        )}
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
      alignItems: 'flex-start',
      marginBottom: theme.space[3],
    },
    headerLeft: {
      flex: 1,
    },
    nameContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
    },
    templateName: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
      flex: 1,
    },
    inactiveBadge: {
      backgroundColor: theme.color.surface.muted,
      paddingHorizontal: theme.space[2],
      paddingVertical: theme.space[0.5],
      borderRadius: theme.radii.sm,
    },
    inactiveBadgeText: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.color.text.subtle,
    },
    description: {
      fontSize: 13,
      color: theme.color.text.subtle,
      marginTop: theme.space[1],
    },
    statusIndicator: {
      width: 8,
      height: 8,
      borderRadius: theme.radii.full,
    },
    divider: {
      height: 1,
      backgroundColor: theme.color.border.default,
      marginBottom: theme.space[3],
    },
    content: {
      gap: theme.space[3],
    },
    row: {
      flexDirection: 'row',
      gap: theme.space[3],
    },
    infoItem: {
      flex: 1,
    },
    label: {
      fontSize: 10,
      color: theme.color.text.placeholder,
      fontWeight: '600',
      textTransform: 'uppercase',
      marginBottom: theme.space[1],
    },
    value: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.body,
    },
    amountValue: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    siteContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.background.subtle,
      paddingHorizontal: theme.space[2.5],
      paddingVertical: theme.space[1.5],
      borderRadius: theme.radii.md,
      gap: theme.space[1.5],
    },
    siteText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.muted,
      flex: 1,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: theme.space[2],
      borderTopWidth: 1,
      borderTopColor: theme.color.surface.muted,
    },
    footerItem: {
      flex: 1,
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
    generateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.color.brand.accent,
      borderRadius: theme.radii.lg,
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[4],
      gap: theme.space[2],
      marginTop: theme.space[1],
    },
    generateButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: theme.space[2],
      marginTop: theme.space[1],
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.color.surface.muted,
      borderRadius: theme.radii.lg,
      paddingVertical: theme.space[2.5],
      paddingHorizontal: theme.space[3],
      gap: theme.space[1.5],
    },
    actionButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.icon.accent,
    },
    deleteButton: {
      backgroundColor: theme.color.state.danger.background,
    },
    deleteButtonText: {
      color: theme.color.text.danger,
    },
  });

export default TemplateCard;
