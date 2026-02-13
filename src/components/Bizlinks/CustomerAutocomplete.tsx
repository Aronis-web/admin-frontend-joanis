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
import { Customer } from '@/types/customers';
import { useDebounce } from '@/hooks/useDebounce';

interface CustomerAutocompleteProps {
  onSelectCustomer: (customer: Customer) => void;
  placeholder?: string;
  initialValue?: string;
  documentTypeFilter?: 'RUC' | 'DNI' | 'ALL'; // Filtrar por tipo de documento
}

export const CustomerAutocomplete: React.FC<CustomerAutocompleteProps> = ({
  onSelectCustomer,
  placeholder = 'Buscar cliente por nombre, RUC o DNI...',
  initialValue = '',
  documentTypeFilter = 'ALL',
}) => {
  const [searchText, setSearchText] = useState(initialValue);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const debouncedSearch = useDebounce(searchText, 300);

  // Buscar clientes
  const searchCustomers = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setCustomers([]);
      setShowDropdown(false);
      return;
    }

    setLoading(true);
    try {
      const response = await customersService.getCustomers({
        search: query,
        limit: 10,
      });

      // Filtrar por tipo de documento si se especifica
      let filteredCustomers = response.data;
      if (documentTypeFilter !== 'ALL') {
        filteredCustomers = response.data.filter((customer) => {
          if (documentTypeFilter === 'RUC') {
            return customer.documentType === 'RUC';
          } else if (documentTypeFilter === 'DNI') {
            return customer.documentType !== 'RUC'; // DNI, CE, Passport, etc.
          }
          return true;
        });
      }

      setCustomers(filteredCustomers);
      setShowDropdown(filteredCustomers.length > 0);
    } catch (error) {
      console.error('Error buscando clientes:', error);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [documentTypeFilter]);

  // Efecto para buscar cuando cambia el texto con debounce
  React.useEffect(() => {
    if (!selectedCustomer) {
      searchCustomers(debouncedSearch);
    }
  }, [debouncedSearch, selectedCustomer, searchCustomers]);

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setSearchText(customer.razonSocial || customer.fullName);
    setShowDropdown(false);
    onSelectCustomer(customer);
  };

  const handleClearSelection = () => {
    setSelectedCustomer(null);
    setSearchText('');
    setCustomers([]);
    setShowDropdown(false);
  };

  const renderCustomerItem = ({ item }: { item: Customer }) => {
    const isCompany = item.documentType === 'RUC';

    return (
      <TouchableOpacity
        style={styles.dropdownItem}
        onPress={() => handleSelectCustomer(item)}
      >
        <View style={styles.customerInfo}>
          <View style={styles.customerNameRow}>
            <Text style={styles.customerName}>
              {item.razonSocial || item.fullName}
            </Text>
            {isCompany && (
              <View style={styles.companyBadge}>
                <Text style={styles.companyBadgeText}>Empresa</Text>
              </View>
            )}
            {!isCompany && (
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
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={[
            styles.input,
            selectedCustomer && styles.inputSelected,
          ]}
          value={searchText}
          onChangeText={(text) => {
            setSearchText(text);
            if (selectedCustomer) {
              setSelectedCustomer(null);
            }
          }}
          placeholder={placeholder}
          placeholderTextColor="#999"
          editable={!selectedCustomer}
        />
        {loading && (
          <ActivityIndicator
            size="small"
            color="#007bff"
            style={styles.loader}
          />
        )}
        {selectedCustomer && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearSelection}
          >
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {selectedCustomer && (
        <View style={styles.selectedBadge}>
          <Text style={styles.selectedBadgeText}>
            ✓ Cliente seleccionado
          </Text>
        </View>
      )}

      {showDropdown && !selectedCustomer && (
        <View style={styles.dropdown}>
          <FlatList
            data={customers}
            renderItem={renderCustomerItem}
            keyExtractor={(item) => item.id}
            style={styles.dropdownList}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                No se encontraron clientes
              </Text>
            }
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    zIndex: 1000,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputSelected: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  loader: {
    position: 'absolute',
    right: 40,
    top: 12,
  },
  clearButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  selectedBadge: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#D1FAE5',
    borderRadius: 6,
    alignItems: 'center',
  },
  selectedBadgeText: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '600',
  },
  dropdown: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    maxHeight: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1001,
  },
  dropdownList: {
    maxHeight: 250,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  customerInfo: {
    gap: 4,
  },
  customerNameRow: {
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
    fontSize: 12,
    color: '#999',
  },
  emptyText: {
    padding: 16,
    textAlign: 'center',
    color: '#999',
  },
});
