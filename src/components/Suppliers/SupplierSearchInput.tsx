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
import { Supplier as FullSupplier } from '@/types/suppliers';
import { Supplier } from '@/types/expenses';

interface SupplierSearchInputProps {
  value?: string; // Supplier ID
  selectedSupplier?: Supplier | null;
  onSelect: (supplier: Supplier | null) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
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
      });
      setSuppliers(response.data || []);
    } catch (error) {
      console.error('Error searching suppliers:', error);
      setSuppliers([]);
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
              <Ionicons name="document-text-outline" size={12} color="#64748B" />
              <Text style={styles.supplierDetailText} numberOfLines={1}>
                {primaryLegalEntity.legalName}
              </Text>
            </View>
          )}

          {primaryLegalEntity?.ruc && (
            <View style={styles.supplierItemDetails}>
              <Ionicons name="card-outline" size={12} color="#64748B" />
              <Text style={styles.supplierDetailText}>RUC: {primaryLegalEntity.ruc}</Text>
            </View>
          )}

          {item.category && (
            <View style={styles.supplierItemDetails}>
              <Ionicons name="pricetag-outline" size={12} color="#64748B" />
              <Text style={styles.supplierDetailText}>{item.category}</Text>
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
            <Text style={styles.modalTitle}>Buscar Proveedor</Text>
            <View style={{ width: 28 }} />
          </View>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#64748B" style={styles.searchIconModal} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={handleSearchChange}
              placeholder="Buscar por nombre, RUC, categoría..."
              placeholderTextColor="#94A3B8"
              autoFocus
            />
            {loading && <ActivityIndicator size="small" color="#6366F1" />}
          </View>

          {/* Results */}
          <FlatList
            data={suppliers}
            renderItem={renderSupplierItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={48} color="#CBD5E1" />
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
    color: '#1E293B',
    marginBottom: 2,
  },
  selectedSupplierRuc: {
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
  supplierItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 8,
  },
  supplierItemContent: {
    flex: 1,
  },
  supplierItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  supplierName: {
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
  supplierItemDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  supplierDetailText: {
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

export default SupplierSearchInput;
