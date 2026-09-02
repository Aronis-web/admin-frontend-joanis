import React, { useState } from 'react';
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
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { customersService } from '@/services/api/customers';
import { Customer, CustomerAutocompleteItem, CustomerType } from '@/types/customers';
import { useDebounce } from '@/hooks/useDebounce';
import { useCustomersAutocomplete } from '@/hooks/api/useCustomers';
import { logger } from '@/utils/logger';
import Alert from '@/utils/alert';

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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [searchText, setSearchText] = useState('');
  const [selectingCustomerId, setSelectingCustomerId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(searchText, 300);
  const normalizedSearch = debouncedSearch.trim();
  const {
    data: autocompleteResponse,
    isFetching,
    isError,
  } = useCustomersAutocomplete(
    { query: normalizedSearch, customerType, limit: 20 },
    visible
  );
  const customers = autocompleteResponse?.data ?? [];

  const handleSelectCustomer = async (suggestion: CustomerAutocompleteItem) => {
    try {
      setSelectingCustomerId(suggestion.id);
      const customer = await customersService.getCustomer(suggestion.id);
      onSelectCustomer(customer);
      setSearchText('');
      onClose();
    } catch (error) {
      logger.error('Error cargando el detalle del cliente seleccionado:', error);
      Alert.alert('Cliente no disponible', 'No se pudo cargar el cliente seleccionado');
    } finally {
      setSelectingCustomerId(null);
    }
  };

  const renderCustomerItem = ({ item }: { item: CustomerAutocompleteItem }) => {
    const isCompany = item.customerType === CustomerType.EMPRESA;

    return (
      <TouchableOpacity
        style={styles.customerItem}
        onPress={() => handleSelectCustomer(item)}
        disabled={selectingCustomerId !== null}
      >
        <View style={styles.customerInfo}>
          <View style={styles.customerHeader}>
            <Text style={styles.customerName} numberOfLines={1}>
              {item.fullName}
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
          {item.phone && <Text style={styles.customerPhone}>📞 {item.phone}</Text>}
          {selectingCustomerId === item.id && (
            <ActivityIndicator size="small" color={theme.color.brand.accent} />
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
              placeholderTextColor={theme.color.text.placeholder}
              autoFocus
            />
            {isFetching && (
              <ActivityIndicator
                size="small"
                color={theme.color.brand.accent}
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
              normalizedSearch.length >= 2 && !isFetching ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    {isError
                      ? 'No se pudo realizar la búsqueda'
                      : `No se encontraron ${
                          customerType === CustomerType.EMPRESA ? 'empresas' : 'clientes'
                        }`}
                  </Text>
                </View>
              ) : normalizedSearch.length < 2 ? (
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: theme.color.surface.base,
      borderTopLeftRadius: theme.radii['2xl'],
      borderTopRightRadius: theme.radii['2xl'],
      maxHeight: '90%',
      paddingBottom: theme.space[5],
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: theme.space[5],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.color.text.heading,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.surface.muted,
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeButtonText: {
      fontSize: 20,
      color: theme.color.text.muted,
    },
    searchContainer: {
      padding: theme.space[4],
      position: 'relative',
    },
    searchInput: {
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.lg,
      padding: theme.space[3],
      fontSize: 16,
      backgroundColor: theme.color.surface.base,
      color: theme.color.text.body,
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
      paddingHorizontal: theme.space[4],
    },
    customerItem: {
      padding: theme.space[4],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.base,
    },
    customerInfo: {
      gap: theme.space[1.5],
    },
    customerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
    },
    customerName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
      flex: 1,
    },
    companyBadge: {
      backgroundColor: theme.color.state.info.background,
      paddingHorizontal: theme.space[2],
      paddingVertical: 2,
      borderRadius: theme.radii.xs,
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
      borderRadius: theme.radii.xs,
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
      fontSize: 13,
      color: theme.color.text.placeholder,
    },
    customerPhone: {
      fontSize: 13,
      color: theme.color.text.placeholder,
    },
    emptyContainer: {
      padding: theme.space[10],
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 16,
      color: theme.color.text.placeholder,
      textAlign: 'center',
    },
  });
