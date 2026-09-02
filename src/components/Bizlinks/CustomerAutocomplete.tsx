import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { customersService } from '@/services/api/customers';
import { useCustomersAutocomplete } from '@/hooks/api/useCustomers';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { Customer, CustomerAutocompleteItem, CustomerType } from '@/types/customers';
import { useDebounce } from '@/hooks/useDebounce';
import { logger } from '@/utils/logger';
import Alert from '@/utils/alert';

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
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectingCustomerId, setSelectingCustomerId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(searchText, 300);
  const normalizedSearch = debouncedSearch.trim();
  const customerType =
    documentTypeFilter === 'RUC'
      ? CustomerType.EMPRESA
      : documentTypeFilter === 'DNI'
        ? CustomerType.PERSONA
        : undefined;
  const {
    data: autocompleteResponse,
    isFetching,
    isError,
  } = useCustomersAutocomplete(
    { query: normalizedSearch, limit: 10, customerType },
    !selectedCustomer
  );
  const customers = autocompleteResponse?.data ?? [];
  const canShowDropdown = showDropdown && !selectedCustomer && normalizedSearch.length >= 2;

  const handleSelectCustomer = async (suggestion: CustomerAutocompleteItem) => {
    try {
      setSelectingCustomerId(suggestion.id);
      const customer = await customersService.getCustomer(suggestion.id);
      setSelectedCustomer(customer);
      setSearchText(customer.razonSocial || customer.fullName);
      setShowDropdown(false);
      onSelectCustomer(customer);
    } catch (error) {
      logger.error('Error cargando el detalle del cliente seleccionado:', error);
      Alert.alert('Cliente no disponible', 'No se pudo cargar el cliente seleccionado');
    } finally {
      setSelectingCustomerId(null);
    }
  };

  const handleClearSelection = () => {
    setSelectedCustomer(null);
    setSearchText('');
        setShowDropdown(false);
  };

  const renderCustomerItem = ({ item }: { item: CustomerAutocompleteItem }) => {
    const isCompany = item.documentType === 'RUC';

    return (
      <TouchableOpacity
        style={styles.dropdownItem}
        onPress={() => handleSelectCustomer(item)}
        disabled={selectingCustomerId !== null}
      >
        <View style={styles.customerInfo}>
          <View style={styles.customerNameRow}>
            <Text style={styles.customerName}>
              {item.fullName}
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
          {item.email && <Text style={styles.customerEmail}>{item.email}</Text>}
          {selectingCustomerId === item.id && (
            <ActivityIndicator size="small" color={theme.color.brand.accent} />
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
            setShowDropdown(text.trim().length >= 2);
            if (selectedCustomer) {
              setSelectedCustomer(null);
            }
          }}
          placeholder={placeholder}
          placeholderTextColor={theme.color.text.placeholder}
          editable={!selectedCustomer}
        />
        {isFetching && (
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

      {canShowDropdown && (
        <View style={styles.dropdown}>
          <FlatList
            data={customers}
            renderItem={renderCustomerItem}
            keyExtractor={(item) => item.id}
            style={styles.dropdownList}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              !isFetching ? (
                <Text style={styles.emptyText}>
                  {isError ? 'No se pudo realizar la búsqueda' : 'No se encontraron clientes'}
                </Text>
              ) : null
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
