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
              <Ionicons name="barcode-outline" size={12} color="#64748B" />
              <Text style={styles.templateDetailText}>{item.code}</Text>
            </View>
          )}

          {item.amountCents && (
            <View style={styles.templateItemDetails}>
              <Ionicons name="cash-outline" size={12} color="#64748B" />
              <Text style={styles.templateDetailText}>
                {formatAmount(item.amountCents, item.currency)}
              </Text>
            </View>
          )}

          {item.category && (
            <View style={styles.templateItemDetails}>
              <Ionicons name="pricetag-outline" size={12} color="#64748B" />
              <Text style={styles.templateDetailText}>{item.category.name}</Text>
            </View>
          )}
        </View>

        <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
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
                <Ionicons name="close-circle" size={20} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.placeholderContainer}>
            <Ionicons name="search" size={20} color="#94A3B8" style={styles.searchIcon} />
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
              <Ionicons name="close" size={28} color="#1E293B" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Buscar Plantilla</Text>
            <View style={{ width: 28 }} />
          </View>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#64748B" style={styles.searchIconModal} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={handleSearchChange}
              placeholder="Buscar por nombre, código..."
              placeholderTextColor="#94A3B8"
              autoFocus
            />
            {loading && <ActivityIndicator size="small" color="#6366F1" />}
          </View>

          {/* Results */}
          <FlatList
            data={templates}
            renderItem={renderTemplateItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={48} color="#CBD5E1" />
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
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  inputContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
  },
  inputContainerError: {
    borderColor: '#EF4444',
  },
  inputContainerDisabled: {
    backgroundColor: '#F1F5F9',
    opacity: 0.6,
  },
  placeholderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIcon: {
    marginRight: 8,
  },
  placeholder: {
    fontSize: 15,
    color: '#94A3B8',
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
    color: '#1E293B',
    marginBottom: 2,
  },
  selectedTemplateCode: {
    fontSize: 12,
    color: '#64748B',
  },
  clearButton: {
    marginLeft: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  closeButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    margin: 16,
  },
  searchIconModal: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1E293B',
  },
  listContainer: {
    padding: 16,
    paddingTop: 0,
  },
  templateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 8,
  },
  templateItemContent: {
    flex: 1,
  },
  templateItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  templateName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
    marginRight: 8,
  },
  typeBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6366F1',
  },
  templateItemDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  templateDetailText: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 4,
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 12,
  },
});

export default TemplateSearchInput;
