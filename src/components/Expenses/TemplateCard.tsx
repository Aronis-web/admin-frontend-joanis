import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExpenseTemplate, TemplateFrequencyLabels } from '@/types/expenses';
import { CategoryBadge } from './CategoryBadge';

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
            { backgroundColor: template.isActive ? '#10B981' : '#94A3B8' },
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
            <Ionicons name="business" size={14} color="#6366F1" />
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
              <TouchableOpacity
                style={styles.actionButton}
                onPress={(e) => {
                  e.stopPropagation();
                  onEdit(template);
                }}
              >
                <Ionicons name="create-outline" size={18} color="#6366F1" />
                <Text style={styles.actionButtonText}>Editar</Text>
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={(e) => {
                  e.stopPropagation();
                  onDelete(template);
                }}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Eliminar</Text>
              </TouchableOpacity>
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
            <Ionicons name="flash-outline" size={18} color="#FFFFFF" />
            <Text style={styles.generateButtonText}>Generar Gasto</Text>
          </TouchableOpacity>
        )}
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
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  inactiveBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  inactiveBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  description: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 12,
  },
  content: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  infoItem: {
    flex: 1,
  },
  label: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  amountValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  siteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  siteText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  footerItem: {
    flex: 1,
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
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 4,
  },
  generateButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366F1',
  },
  deleteButton: {
    backgroundColor: '#FEF2F2',
  },
  deleteButtonText: {
    color: '#EF4444',
  },
});

export default TemplateCard;
