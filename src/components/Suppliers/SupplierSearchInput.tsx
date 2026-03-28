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
import { colors, spacing, borderRadius } from '@/design-system/tokens';

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
              <Ionicons name="document-text-outline" size={12} color={colors.neutral[500]} />
              <Text style={styles.supplierDetailText} numberOfLines={1}>
                {primaryLegalEntity.legalName}
              </Text>
            </View>
          )}

          {primaryLegalEntity?.ruc && (
            <View style={styles.supplierItemDetails}>
              <Ionicons name="card-outline" size={12} color={colors.neutral[500]} />
              <Text style={styles.supplierDetailText}>RUC: {primaryLegalEntity.ruc}</Text>
            </View>
          )}

          {item.category && (
            <View style={styles.supplierItemDetails}>
              <Ionicons name="pricetag-outline" size={12} color={colors.neutral[500]} />
              <Text style={styles.supplierDetailText}>{item.category}</Text>
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
            <Text style={styles.modalTitle}>Buscar Proveedor</Text>
            <View style={{ width: 28 }} />
          </View>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.neutral[500]} style={styles.searchIconModal} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={handleSearchChange}
              placeholder="Buscar por nombre, RUC, categoría..."
              placeholderTextColor={colors.neutral[400]}
              autoFocus
            />
            {loading && <ActivityIndicator size="small" color={colors.accent[500]} />}
          </View>

          {/* Results */}
          <FlatList
            data={suppliers}
            renderItem={renderSupplierItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={48} color={colors.neutral[300]} />
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
    color: colors.neutral[800],
    marginBottom: spacing[0.5],
  },
  selectedSupplierRuc: {
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
  supplierItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing[3],
    marginBottom: spacing[2],
  },
  supplierItemContent: {
    flex: 1,
  },
  supplierItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  supplierName: {
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
  supplierItemDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[1],
  },
  supplierDetailText: {
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

export default SupplierSearchInput;
