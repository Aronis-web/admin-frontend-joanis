import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { customersService } from '@/services/api/customers';
import { Customer, CustomerType } from '@/types/customers';
import { useDebounce } from '@/hooks/useDebounce';

interface CustomerSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectCustomer: (customer: Customer) => void;
  customerType?: CustomerType;
}

export const CustomerSearchModal: React.FC<CustomerSearchModalProps> = ({
  visible,
  onClose,
  onSelectCustomer,
  customerType,
}) => {
  const [searchText, setSearchText] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  const debouncedSearch = useDebounce(searchText, 300);

  // Buscar clientes
  const searchCustomers = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setCustomers([]);
      return;
    }

    setLoading(true);
    try {
      const response = await customersService.getCustomers({
        search: query,
        customerType,
        limit: 20,
      });

      // La API devuelve { data: { data: [], meta: { ... } } }
      const customersData = response.data?.data || response.data || [];
      setCustomers(customersData);
    } catch (error) {
      console.error('Error buscando clientes:', error);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [customerType]);

  // Efecto para buscar cuando cambia el texto con debounce
  React.useEffect(() => {
    searchCustomers(debouncedSearch);
  }, [debouncedSearch, searchCustomers]);

  const handleSelectCustomer = (customer: Customer) => {
    onSelectCustomer(customer);
    setSearchText('');
    setCustomers([]);
    onClose();
  };

  const renderCustomerItem = ({ item }: { item: Customer }) => {
    const isCompany = item.customerType === CustomerType.EMPRESA;

    return (
      <TouchableOpacity
        style={styles.customerItem}
        onPress={() => handleSelectCustomer(item)}
      >
        <View style={styles.customerInfo}>
          <View style={styles.customerHeader}>
            <Text style={styles.customerName} numberOfLines={1}>
              {item.razonSocial || item.fullName}
            </Text>
            {isCompany ? (
              <View style={styles.companyBadge}>
                <Text style={styles.companyBadgeText}>Empresa</Text>
              </View>
            ) : (
              <View style={styles.personBadge}>
                <Text style={styles.personBadgeText}>Persona</Text>
              </View>
            )}
          </View>
          <Text style={styles.customerDocument}>
            {item.documentType}: {item.documentNumber}
          </Text>
          {item.email && (
            <Text style={styles.customerEmail}>{item.email}</Text>
          )}
          {item.phone && (
            <Text style={styles.customerPhone}>📞 {item.phone}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>
              Buscar {customerType === CustomerType.EMPRESA ? 'Empresa' : 'Cliente'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              value={searchText}
              onChangeText={setSearchText}
              placeholder={`Buscar por nombre, ${customerType === CustomerType.EMPRESA ? 'RUC' : 'DNI'}...`}
              placeholderTextColor="#999"
              autoFocus
            />
            {loading && (
              <ActivityIndicator
                size="small"
                color="#007bff"
                style={styles.loader}
              />
            )}
          </View>

          <FlatList
            data={customers}
            renderItem={renderCustomerItem}
            keyExtractor={(item) => item.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              searchText.length >= 2 && !loading ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    No se encontraron {customerType === CustomerType.EMPRESA ? 'empresas' : 'clientes'}
                  </Text>
                </View>
              ) : searchText.length < 2 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    Escribe al menos 2 caracteres para buscar
                  </Text>
                </View>
              ) : null
            }
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface.primary,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    maxHeight: '90%',
    paddingBottom: spacing[5],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.neutral[800],
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: colors.neutral[500],
  },
  searchContainer: {
    padding: spacing[4],
    position: 'relative',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    fontSize: 16,
    backgroundColor: colors.surface.primary,
  },
  loader: {
    position: 'absolute',
    right: 28,
    top: 28,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing[4],
  },
  customerItem: {
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
    backgroundColor: colors.surface.primary,
  },
  customerInfo: {
    gap: spacing[1.5],
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[800],
    flex: 1,
  },
  companyBadge: {
    backgroundColor: colors.info[100],
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
  },
  companyBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.info[800],
  },
  personBadge: {
    backgroundColor: colors.warning[50],
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
  },
  personBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.warning[800],
  },
  customerDocument: {
    fontSize: 14,
    color: colors.neutral[500],
  },
  customerEmail: {
    fontSize: 13,
    color: colors.neutral[400],
  },
  customerPhone: {
    fontSize: 13,
    color: colors.neutral[400],
  },
  emptyContainer: {
    padding: spacing[10],
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.neutral[400],
    textAlign: 'center',
  },
});
