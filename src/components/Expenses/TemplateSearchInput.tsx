import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { expensesService } from '@/services/api';
import { ExpenseTemplate } from '@/types/expenses';
import { colors, spacing, borderRadius } from '@/design-system/tokens';

interface TemplateSearchInputProps {
  value?: string; // Template ID
  selectedTemplate?: ExpenseTemplate | null;
  onSelect: (template: ExpenseTemplate | null) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
}

export const TemplateSearchInput: React.FC<TemplateSearchInputProps> = ({
  value,
  selectedTemplate,
  onSelect,
  label = 'Plantilla',
  placeholder = 'Buscar plantilla...',
  error,
  disabled = false,
  required = false,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [templates, setTemplates] = useState<ExpenseTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Load initial template if value is provided
  useEffect(() => {
    if (value && !selectedTemplate) {
      loadTemplate(value);
    }
  }, [value]);

  const loadTemplate = async (templateId: string) => {
    try {
      const template = await expensesService.getTemplate(templateId);
      onSelect(template);
    } catch (error) {
      console.error('Error loading template:', error);
    }
  };

  const searchTemplates = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const response = await expensesService.getTemplates({
        includeInactive: false,
      });

      let filteredTemplates = Array.isArray(response) ? response : [];

      // Filter by search query if provided
      if (query.trim()) {
        const lowerQuery = query.toLowerCase();
        filteredTemplates = filteredTemplates.filter(
          (template) =>
            template.name?.toLowerCase().includes(lowerQuery) ||
            template.code?.toLowerCase().includes(lowerQuery) ||
            template.description?.toLowerCase().includes(lowerQuery)
        );
      }

      setTemplates(filteredTemplates);
    } catch (error) {
      console.error('Error searching templates:', error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);

    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Set new timeout for debounced search
    const timeout = setTimeout(() => {
      searchTemplates(text);
    }, 300);

    setSearchTimeout(timeout);
  };

  const handleSelectTemplate = (template: ExpenseTemplate) => {
    onSelect(template);
    setModalVisible(false);
    setSearchQuery('');
    setTemplates([]);
  };

  const handleClearSelection = () => {
    onSelect(null);
  };

  const handleOpenModal = () => {
    if (!disabled) {
      setModalVisible(true);
      // Load initial templates
      searchTemplates('');
    }
  };

  const formatAmount = (amountCents?: number | string, currency?: string) => {
    if (!amountCents) return 'N/A';
    const amount = typeof amountCents === 'string' ? parseFloat(amountCents) / 100 : amountCents / 100;
    const currencySymbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : 'S/';
    return `${currencySymbol} ${amount.toFixed(2)}`;
  };

  const renderTemplateItem = ({ item }: { item: ExpenseTemplate }) => {
    return (
      <TouchableOpacity
        style={styles.templateItem}
        onPress={() => handleSelectTemplate(item)}
        activeOpacity={0.7}
      >
        <View style={styles.templateItemContent}>
          <View style={styles.templateItemHeader}>
            <Text style={styles.templateName} numberOfLines={1}>
              {item.name}
            </Text>
            {item.templateExpenseType && (
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>
                  {item.templateExpenseType === 'RECURRENT' ? 'Recurrente' : 'Semi-recurrente'}
                </Text>
              </View>
            )}
          </View>

          {item.code && (
            <View style={styles.templateItemDetails}>
              <Ionicons name="barcode-outline" size={12} color={colors.neutral[500]} />
              <Text style={styles.templateDetailText}>{item.code}</Text>
            </View>
          )}

          {item.amountCents && (
            <View style={styles.templateItemDetails}>
              <Ionicons name="cash-outline" size={12} color={colors.neutral[500]} />
              <Text style={styles.templateDetailText}>
                {formatAmount(item.amountCents, item.currency)}
              </Text>
            </View>
          )}

          {item.category && (
            <View style={styles.templateItemDetails}>
              <Ionicons name="pricetag-outline" size={12} color={colors.neutral[500]} />
              <Text style={styles.templateDetailText}>{item.category.name}</Text>
            </View>
          )}
        </View>

        <Ionicons name="chevron-forward" size={20} color={colors.neutral[400]} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}

      <TouchableOpacity
        style={[
          styles.inputContainer,
          error && styles.inputContainerError,
          disabled && styles.inputContainerDisabled,
        ]}
        onPress={handleOpenModal}
        disabled={disabled}
        activeOpacity={0.7}
      >
        {selectedTemplate ? (
          <View style={styles.selectedTemplateContainer}>
            <View style={styles.selectedTemplateContent}>
              <Text style={styles.selectedTemplateName} numberOfLines={1}>
                {selectedTemplate.name}
              </Text>
              {selectedTemplate.code && (
                <Text style={styles.selectedTemplateCode} numberOfLines={1}>
                  {selectedTemplate.code}
                </Text>
              )}
            </View>
            {!disabled && (
              <TouchableOpacity
                onPress={handleClearSelection}
                style={styles.clearButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={20} color={colors.neutral[400]} />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.placeholderContainer}>
            <Ionicons name="search" size={20} color={colors.neutral[400]} style={styles.searchIcon} />
            <Text style={styles.placeholder}>{placeholder}</Text>
          </View>
        )}
      </TouchableOpacity>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Search Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={28} color={colors.neutral[800]} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Buscar Plantilla</Text>
            <View style={{ width: 28 }} />
          </View>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.neutral[500]} style={styles.searchIconModal} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={handleSearchChange}
              placeholder="Buscar por nombre, código..."
              placeholderTextColor="#94A3B8"
              autoFocus
            />
            {loading && <ActivityIndicator size="small" color={colors.accent[500]} />}
          </View>

          {/* Results */}
          <FlatList
            data={templates}
            renderItem={renderTemplateItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={48} color={colors.neutral[300]} />
                <Text style={styles.emptyText}>
                  {searchQuery
                    ? 'No se encontraron plantillas'
                    : loading
                    ? 'Cargando plantillas...'
                    : 'No hay plantillas disponibles'}
                </Text>
              </View>
            }
          />
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[4],
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[600],
    marginBottom: spacing[2],
  },
  required: {
    color: colors.danger[500],
  },
  inputContainer: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    minHeight: 48,
  },
  inputContainerError: {
    borderColor: colors.danger[500],
  },
  inputContainerDisabled: {
    backgroundColor: colors.neutral[100],
    opacity: 0.6,
  },
  placeholderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIcon: {
    marginRight: spacing[2],
  },
  placeholder: {
    fontSize: 15,
    color: colors.neutral[400],
  },
  selectedTemplateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedTemplateContent: {
    flex: 1,
  },
  selectedTemplateName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: spacing[0.5],
  },
  selectedTemplateCode: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  clearButton: {
    marginLeft: spacing[2],
  },
  errorText: {
    fontSize: 12,
    color: colors.danger[500],
    marginTop: spacing[1],
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.surface.primary,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  closeButton: {
    padding: spacing[1],
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing[3],
    margin: spacing[4],
  },
  searchIconModal: {
    marginRight: spacing[2],
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing[3],
    fontSize: 15,
    color: colors.neutral[800],
  },
  listContainer: {
    padding: spacing[4],
    paddingTop: 0,
  },
  templateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing[3],
    marginBottom: spacing[2],
  },
  templateItemContent: {
    flex: 1,
  },
  templateItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  templateName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.neutral[800],
    flex: 1,
    marginRight: spacing[2],
  },
  typeBadge: {
    backgroundColor: colors.accent[50],
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.accent[500],
  },
  templateItemDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[1],
  },
  templateDetailText: {
    fontSize: 12,
    color: colors.neutral[500],
    marginLeft: spacing[1],
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[12],
  },
  emptyText: {
    fontSize: 14,
    color: colors.neutral[400],
    marginTop: spacing[3],
  },
});

export default TemplateSearchInput;
