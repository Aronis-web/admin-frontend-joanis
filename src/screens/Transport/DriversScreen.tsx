import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { transportService } from '@/services/api';
import { Driver, DriverStatus } from '@/types/transport';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { AddButton } from '@/components/Navigation/AddButton';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

interface DriversScreenProps {
  navigation: any;
}

export const DriversScreen: React.FC<DriversScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadDrivers();
  }, []);

  useEffect(() => {
    filterDrivers();
  }, [searchQuery, drivers]);

  const loadDrivers = async () => {
    try {
      setLoading(true);
      const response = await transportService.getDrivers({ limit: 1000 });
      setDrivers(response.data);
      setFilteredDrivers(response.data);
    } catch (error: any) {
      console.error('Error loading drivers:', error);
      Alert.alert('Error', 'No se pudieron cargar los conductores');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDrivers();
    setRefreshing(false);
  };

  const filterDrivers = () => {
    if (!searchQuery.trim()) {
      setFilteredDrivers(drivers);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = drivers.filter(
      (driver) =>
        driver.nombre.toLowerCase().includes(query) ||
        driver.apellido.toLowerCase().includes(query) ||
        driver.numeroDocumento.includes(query) ||
        driver.numeroLicencia.toLowerCase().includes(query)
    );
    setFilteredDrivers(filtered);
  };

  const getStatusColors = (status: DriverStatus) => {
    switch (status) {
      case DriverStatus.ACTIVE:
        return {
          bg: theme.color.state.success.background,
          text: theme.color.state.success.text,
        };
      case DriverStatus.SUSPENDED:
        return {
          bg: theme.color.state.danger.background,
          text: theme.color.state.danger.text,
        };
      case DriverStatus.INACTIVE:
      default:
        return {
          bg: theme.color.surface.muted,
          text: theme.color.text.muted,
        };
    }
  };

  const getStatusLabel = (status: DriverStatus) => {
    switch (status) {
      case DriverStatus.ACTIVE:
        return 'Activo';
      case DriverStatus.INACTIVE:
        return 'Inactivo';
      case DriverStatus.SUSPENDED:
        return 'Suspendido';
      default:
        return status;
    }
  };

  const handleAddDriver = () => {
    navigation.navigate('DriverDetail', {});
  };

  const handleDriverPress = (driver: Driver) => {
    navigation.navigate('DriverDetail', { driverId: driver.id });
  };

  const renderDriverItem = ({ item }: { item: Driver }) => {
    const fullName = `${item.nombre} ${item.apellido}`;
    const statusColors = getStatusColors(item.status);

    return (
      <TouchableOpacity
        style={styles.driverCard}
        onPress={() => handleDriverPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.driverHeader}>
          <View style={styles.driverIcon}>
            <Ionicons name="person-outline" size={24} color={theme.color.brand.accent} />
          </View>
          <View style={styles.driverMainInfo}>
            <Text style={styles.driverName}>{fullName}</Text>
            <Text style={styles.driverDocument}>Doc: {item.numeroDocumento}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            <Text style={[styles.statusText, { color: statusColors.text }]}>
              {getStatusLabel(item.status)}
            </Text>
          </View>
        </View>

        <View style={styles.driverDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="card-outline" size={16} color={theme.color.text.muted} />
            <Text style={styles.detailText}>Licencia: {item.numeroLicencia}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="ribbon-outline" size={16} color={theme.color.text.muted} />
            <Text style={styles.detailText}>Categoría: {item.categoriaLicencia}</Text>
          </View>
          {item.telefono && (
            <View style={styles.detailRow}>
              <Ionicons name="call-outline" size={16} color={theme.color.text.muted} />
              <Text style={styles.detailText}>{item.telefono}</Text>
            </View>
          )}
          {item.email && (
            <View style={styles.detailRow}>
              <Ionicons name="mail-outline" size={16} color={theme.color.text.muted} />
              <Text style={styles.detailText}>{item.email}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <ScreenLayout navigation={navigation}>
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.color.brand.accent} />
            <Text style={styles.loadingText}>Cargando conductores...</Text>
          </View>
        </SafeAreaView>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.color.text.heading} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Conductores</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddDriver}
          >
            <Ionicons name="add" size={24} color={theme.color.brand.accent} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={theme.color.text.placeholder} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombre, documento o licencia..."
            placeholderTextColor={theme.color.text.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="words"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color={theme.color.text.placeholder} />
            </TouchableOpacity>
          )}
        </View>

        {/* List */}
        {filteredDrivers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="person-outline" size={64} color={theme.color.border.default} />
            <Text style={styles.emptyText}>
              {searchQuery ? 'No se encontraron conductores' : 'No hay conductores registrados'}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery ? 'Intenta con otra búsqueda' : 'Agrega tu primer conductor'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredDrivers}
            renderItem={renderDriverItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[theme.color.brand.accent]}
                tintColor={theme.color.brand.accent}
              />
            }
          />
        )}

        {/* Floating Add Button */}
        <AddButton onPress={handleAddDriver} />
      </SafeAreaView>
    </ScreenLayout>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: theme.color.text.muted,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.color.surface.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    backButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.color.text.heading,
    },
    addButton: {
      padding: 8,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.surface.base,
      borderRadius: 12,
      marginHorizontal: 16,
      marginTop: 16,
      marginBottom: 12,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 12,
      fontSize: 16,
      color: theme.color.text.heading,
    },
    clearButton: {
      padding: 4,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
    },
    emptyText: {
      marginTop: 16,
      fontSize: 18,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    emptySubtext: {
      marginTop: 8,
      fontSize: 14,
      color: theme.color.text.placeholder,
    },
    listContent: {
      padding: 16,
    },
    driverCard: {
      backgroundColor: theme.color.surface.base,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    driverHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    driverIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.color.brand.accentSoft,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    driverMainInfo: {
      flex: 1,
    },
    driverName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.color.text.heading,
      marginBottom: 4,
    },
    driverDocument: {
      fontSize: 14,
      color: theme.color.text.muted,
    },
    statusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
    },
    driverDetails: {
      gap: 8,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    detailText: {
      fontSize: 14,
      color: theme.color.text.muted,
    },
  });
