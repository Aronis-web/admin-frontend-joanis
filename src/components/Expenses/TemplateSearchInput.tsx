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
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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
              <Ionicons name="barcode-outline" size={12} color={theme.color.icon.subtle} />
              <Text style={styles.templateDetailText}>{item.code}</Text>
            </View>
          )}

          {item.amountCents && (
            <View style={styles.templateItemDetails}>
              <Ionicons name="cash-outline" size={12} color={theme.color.icon.subtle} />
              <Text style={styles.templateDetailText}>
                {formatAmount(item.amountCents, item.currency)}
              </Text>
            </View>
          )}

          {item.category && (
            <View style={styles.templateItemDetails}>
              <Ionicons name="pricetag-outline" size={12} color={theme.color.icon.subtle} />
              <Text style={styles.templateDetailText}>{item.category.name}</Text>
            </View>
          )}
        </View>

        <Ionicons name="chevron-forward" size={20} color={theme.color.icon.disabled} />
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
                <Ionicons name="close-circle" size={20} color={theme.color.icon.disabled} />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.placeholderContainer}>
            <Ionicons name="search" size={20} color={theme.color.icon.disabled} style={styles.searchIcon} />
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
              <Ionicons name="close" size={28} color={theme.color.text.heading} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Buscar Plantilla</Text>
            <View style={{ width: 28 }} />
          </View>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={theme.color.icon.subtle} style={styles.searchIconModal} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={handleSearchChange}
              placeholder="Buscar por nombre, código..."
              placeholderTextColor={theme.color.text.placeholder}
              autoFocus
            />
            {loading && <ActivityIndicator size="small" color={theme.color.brand.accent} />}
          </View>

          {/* Results */}
          <FlatList
            data={templates}
            renderItem={renderTemplateItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={48} color={theme.color.border.default} />
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      marginBottom: theme.space[4],
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.muted,
      marginBottom: theme.space[2],
    },
    required: {
      color: theme.color.text.danger,
    },
    inputContainer: {
      backgroundColor: theme.color.background.subtle,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[3],
      minHeight: 48,
    },
    inputContainerError: {
      borderColor: theme.color.text.danger,
    },
    inputContainerDisabled: {
      backgroundColor: theme.color.surface.muted,
      opacity: 0.6,
    },
    placeholderContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    searchIcon: {
      marginRight: theme.space[2],
    },
    placeholder: {
      fontSize: 15,
      color: theme.color.text.placeholder,
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
      color: theme.color.text.heading,
      marginBottom: theme.space[0.5],
    },
    selectedTemplateCode: {
      fontSize: 12,
      color: theme.color.text.subtle,
    },
    clearButton: {
      marginLeft: theme.space[2],
    },
    errorText: {
      fontSize: 12,
      color: theme.color.text.danger,
      marginTop: theme.space[1],
    },
    modalContainer: {
      flex: 1,
      backgroundColor: theme.color.surface.base,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[4],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.default,
    },
    closeButton: {
      padding: theme.space[1],
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.background.subtle,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      paddingHorizontal: theme.space[3],
      margin: theme.space[4],
    },
    searchIconModal: {
      marginRight: theme.space[2],
    },
    searchInput: {
      flex: 1,
      paddingVertical: theme.space[3],
      fontSize: 15,
      color: theme.color.text.heading,
    },
    listContainer: {
      padding: theme.space[4],
      paddingTop: 0,
    },
    templateItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      padding: theme.space[3],
      marginBottom: theme.space[2],
    },
    templateItemContent: {
      flex: 1,
    },
    templateItemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.space[1],
    },
    templateName: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.color.text.heading,
      flex: 1,
      marginRight: theme.space[2],
    },
    typeBadge: {
      backgroundColor: theme.color.brand.accentSoft,
      borderRadius: theme.radii.sm,
      paddingHorizontal: theme.space[2],
      paddingVertical: theme.space[0.5],
    },
    typeBadgeText: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.color.brand.accent,
    },
    templateItemDetails: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: theme.space[1],
    },
    templateDetailText: {
      fontSize: 12,
      color: theme.color.text.subtle,
      marginLeft: theme.space[1],
      flex: 1,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.space[12],
    },
    emptyText: {
      fontSize: 14,
      color: theme.color.text.placeholder,
      marginTop: theme.space[3],
    },
  });

export default TemplateSearchInput;
