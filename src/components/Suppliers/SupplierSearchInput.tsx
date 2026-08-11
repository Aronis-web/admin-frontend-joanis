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
import { suppliersService } from '@/services/api';
import { Supplier as FullSupplier, SupplierType } from '@/types/suppliers';
import { Supplier } from '@/types/expenses';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

interface SupplierSearchInputProps {
  value?: string; // Supplier ID
  selectedSupplier?: Supplier | null;
  onSelect: (supplier: Supplier | null) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  filterByType?: SupplierType; // Filter suppliers by primary type
}

export const SupplierSearchInput: React.FC<SupplierSearchInputProps> = ({
  value,
  selectedSupplier,
  onSelect,
  label = 'Proveedor',
  placeholder = 'Buscar proveedor...',
  error,
  disabled = false,
  required = false,
  filterByType,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suppliers, setSuppliers] = useState<FullSupplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Load initial supplier if value is provided
  useEffect(() => {
    if (value && !selectedSupplier) {
      loadSupplier(value);
    }
  }, [value]);

  const loadSupplier = async (supplierId: string) => {
    try {
      const supplier = await suppliersService.getSupplier(supplierId);
      onSelect(supplier);
    } catch (error) {
      console.error('Error loading supplier:', error);
    }
  };

  const searchSuppliers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSuppliers([]);
      return;
    }

    setLoading(true);
    try {
      // Use the intelligent search endpoint
      // Backend expects 'query' parameter, not 'q'
      const response = await suppliersService.searchSuppliers({
        query: query, // Backend expects 'query' parameter
        isActive: true,
        limit: 20,
        ...(filterByType && { primaryType: filterByType }), // Filter by type if provided
      });
      setSuppliers(response.data || []);
    } catch (error) {
      console.error('Error searching suppliers:', error);
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, [filterByType]);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);

    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Set new timeout for debounced search
    const timeout = setTimeout(() => {
      searchSuppliers(text);
    }, 300);

    setSearchTimeout(timeout);
  };

  const handleSelectSupplier = (supplier: Supplier) => {
    onSelect(supplier);
    setModalVisible(false);
    setSearchQuery('');
    setSuppliers([]);
  };

  const handleClearSelection = () => {
    onSelect(null);
  };

  const handleOpenModal = () => {
    if (!disabled) {
      setModalVisible(true);
      // Load some initial suppliers
      searchSuppliers('');
    }
  };

  const renderSupplierItem = ({ item }: { item: FullSupplier }) => {
    const primaryLegalEntity = item.legalEntities?.find((le) => le.isPrimary);

    return (
      <TouchableOpacity
        style={styles.supplierItem}
        onPress={() => handleSelectSupplier(item as any)}
        activeOpacity={0.7}
      >
        <View style={styles.supplierItemContent}>
          <View style={styles.supplierItemHeader}>
            <Text style={styles.supplierName} numberOfLines={1}>
              {item.commercialName}
            </Text>
            {item.primaryType && (
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{getSupplierTypeLabel(item.primaryType)}</Text>
              </View>
            )}
          </View>

          {primaryLegalEntity && (
            <View style={styles.supplierItemDetails}>
              <Ionicons name="document-text-outline" size={12} color={theme.color.icon.subtle} />
              <Text style={styles.supplierDetailText} numberOfLines={1}>
                {primaryLegalEntity.legalName}
              </Text>
            </View>
          )}

          {primaryLegalEntity?.ruc && (
            <View style={styles.supplierItemDetails}>
              <Ionicons name="card-outline" size={12} color={theme.color.icon.subtle} />
              <Text style={styles.supplierDetailText}>RUC: {primaryLegalEntity.ruc}</Text>
            </View>
          )}

          {item.category && (
            <View style={styles.supplierItemDetails}>
              <Ionicons name="pricetag-outline" size={12} color={theme.color.icon.subtle} />
              <Text style={styles.supplierDetailText}>{item.category}</Text>
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
        {selectedSupplier ? (
          <View style={styles.selectedSupplierContainer}>
            <View style={styles.selectedSupplierContent}>
              <Text style={styles.selectedSupplierName} numberOfLines={1}>
                {selectedSupplier.commercialName}
              </Text>
              {selectedSupplier.legalEntities?.find((le) => le.isPrimary)?.ruc && (
                <Text style={styles.selectedSupplierRuc} numberOfLines={1}>
                  RUC: {selectedSupplier.legalEntities.find((le) => le.isPrimary)?.ruc}
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
              <Ionicons name="close" size={28} color={theme.color.icon.default} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Buscar Proveedor</Text>
            <View style={{ width: 28 }} />
          </View>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={theme.color.icon.subtle} style={styles.searchIconModal} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={handleSearchChange}
              placeholder="Buscar por nombre, RUC, categoría..."
              placeholderTextColor={theme.color.text.placeholder}
              autoFocus
            />
            {loading && <ActivityIndicator size="small" color={theme.color.brand.accent} />}
          </View>

          {/* Results */}
          <FlatList
            data={suppliers}
            renderItem={renderSupplierItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={48} color={theme.color.border.default} />
                <Text style={styles.emptyText}>
                  {searchQuery
                    ? 'No se encontraron proveedores'
                    : 'Escribe para buscar proveedores'}
                </Text>
              </View>
            }
          />
        </View>
      </Modal>
    </View>
  );
};

// Helper function to get supplier type label
const getSupplierTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    UTILITIES: 'Servicios Básicos',
    MERCHANDISE: 'Mercadería',
    SERVICES: 'Servicios',
    MAINTENANCE: 'Mantenimiento',
    TECHNOLOGY: 'Tecnología',
    MARKETING: 'Marketing',
    LOGISTICS: 'Logística',
    PROFESSIONAL: 'Profesionales',
    GOVERNMENT: 'Gobierno',
    FINANCIAL: 'Financiero',
    RENT: 'Alquiler',
    PAYROLL: 'Nómina',
    TAXES: 'Impuestos',
    LOANS: 'Préstamos',
    INSURANCE: 'Seguros',
    TRANSPORT: 'Transporte',
    OTHER: 'Otros',
  };
  return labels[type] || type;
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
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[3],
      minHeight: 48,
    },
    inputContainerError: {
      borderColor: theme.color.border.error,
    },
    inputContainerDisabled: {
      backgroundColor: theme.color.surface.disabled,
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
    selectedSupplierContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    selectedSupplierContent: {
      flex: 1,
    },
    selectedSupplierName: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[0.5],
    },
    selectedSupplierRuc: {
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
      backgroundColor: theme.color.surface.subtle,
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
    supplierItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      padding: theme.space[3],
      marginBottom: theme.space[2],
    },
    supplierItemContent: {
      flex: 1,
    },
    supplierItemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.space[1],
    },
    supplierName: {
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
    supplierItemDetails: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: theme.space[1],
    },
    supplierDetailText: {
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

export default SupplierSearchInput;
