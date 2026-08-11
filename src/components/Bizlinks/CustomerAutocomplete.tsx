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
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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

      // La API devuelve CustomersResponse con estructura { data: { data: [], meta: { ... } } }
      const customersData = (response as any).data?.data || response.data || [];

      // Filtrar por tipo de documento si se especifica
      let filteredCustomers = customersData;
      if (documentTypeFilter !== 'ALL') {
        filteredCustomers = customersData.filter((customer: Customer) => {
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
          placeholderTextColor={theme.color.text.placeholder}
          editable={!selectedCustomer}
        />
        {loading && (
          <ActivityIndicator
            size="small"
            color={theme.color.brand.accent}
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      marginBottom: theme.space[4],
      zIndex: 1000,
    },
    inputContainer: {
      position: 'relative',
    },
    input: {
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.lg,
      padding: theme.space[3],
      fontSize: 16,
      backgroundColor: theme.color.surface.base,
      color: theme.color.text.body,
    },
    inputSelected: {
      borderColor: theme.color.text.success,
      backgroundColor: theme.color.state.success.background,
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
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.text.danger,
      justifyContent: 'center',
      alignItems: 'center',
    },
    clearButtonText: {
      color: theme.color.text.inverse,
      fontSize: 14,
      fontWeight: 'bold',
    },
    selectedBadge: {
      marginTop: theme.space[2],
      padding: theme.space[2],
      backgroundColor: theme.color.state.success.background,
      borderRadius: theme.radii.md,
      alignItems: 'center',
    },
    selectedBadgeText: {
      color: theme.color.state.success.text,
      fontSize: 13,
      fontWeight: '600',
    },
    dropdown: {
      position: 'absolute',
      top: 50,
      left: 0,
      right: 0,
      backgroundColor: theme.color.surface.base,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.lg,
      maxHeight: 250,
      shadowColor: theme.color.shadow,
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
      padding: theme.space[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.surface.muted,
    },
    customerInfo: {
      gap: theme.space[1],
    },
    customerNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
    },
    customerName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.body,
      flex: 1,
    },
    companyBadge: {
      backgroundColor: theme.color.state.info.background,
      paddingHorizontal: theme.space[2],
      paddingVertical: 2,
      borderRadius: theme.radii.sm,
    },
    companyBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.color.state.info.text,
    },
    personBadge: {
      backgroundColor: theme.color.state.warning.background,
      paddingHorizontal: theme.space[2],
      paddingVertical: 2,
      borderRadius: theme.radii.sm,
    },
    personBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.color.state.warning.text,
    },
    customerDocument: {
      fontSize: 14,
      color: theme.color.text.muted,
    },
    customerEmail: {
      fontSize: 12,
      color: theme.color.text.placeholder,
    },
    emptyText: {
      padding: theme.space[4],
      textAlign: 'center',
      color: theme.color.text.placeholder,
    },
  });
