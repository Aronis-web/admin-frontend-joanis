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

      setCustomers(response.data);
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
  },
  searchContainer: {
    padding: 16,
    position: 'relative',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
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
    paddingHorizontal: 16,
  },
  customerItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  customerInfo: {
    gap: 6,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  companyBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  companyBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E40AF',
  },
  personBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  personBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
  },
  customerDocument: {
    fontSize: 14,
    color: '#666',
  },
  customerEmail: {
    fontSize: 13,
    color: '#999',
  },
  customerPhone: {
    fontSize: 13,
    color: '#999',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
});
