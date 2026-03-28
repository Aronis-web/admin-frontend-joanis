import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExpenseTemplate, TemplateFrequencyLabels } from '@/types/expenses';
import { CategoryBadge } from './CategoryBadge';
import { ProtectedTouchableOpacity } from '@/components/ui/ProtectedTouchableOpacity';
import { colors, spacing, borderRadius } from '@/design-system/tokens';

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
            { backgroundColor: template.isActive ? colors.success[500] : colors.neutral[400] },
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
            <Ionicons name="business" size={14} color={colors.primary[500]} />
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
                <Ionicons name="create-outline" size={18} color={colors.primary[500]} />
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
                <Ionicons name="trash-outline" size={18} color={colors.danger[500]} />
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
            <Ionicons name="flash-outline" size={18} color={colors.neutral[0]} />
            <Text style={styles.generateButtonText}>Generar Gasto</Text>
          </TouchableOpacity>
        )}
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
    alignItems: 'flex-start',
    marginBottom: spacing[3],
  },
  headerLeft: {
    flex: 1,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  templateName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[800],
    flex: 1,
  },
  inactiveBadge: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: borderRadius.sm,
  },
  inactiveBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  description: {
    fontSize: 13,
    color: colors.neutral[500],
    marginTop: spacing[1],
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: borderRadius.full,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginBottom: spacing[3],
  },
  content: {
    gap: spacing[3],
  },
  row: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  infoItem: {
    flex: 1,
  },
  label: {
    fontSize: 10,
    color: colors.neutral[400],
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: spacing[1],
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  amountValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  siteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.md,
    gap: spacing[1.5],
  },
  siteText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[600],
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  footerItem: {
    flex: 1,
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
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    gap: spacing[2],
    marginTop: spacing[1],
  },
  generateButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[1],
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[3],
    gap: spacing[1.5],
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary[500],
  },
  deleteButton: {
    backgroundColor: colors.danger[50],
  },
  deleteButtonText: {
    color: colors.danger[500],
  },
});

export default TemplateCard;
