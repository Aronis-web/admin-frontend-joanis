import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useBizlinksConfig } from '../../hooks/useBizlinks';
import { BizlinksConfig } from '../../types/bizlinks';
import { useAuthStore } from '../../store/auth';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

type Props = NativeStackScreenProps<any, 'BizlinksConfig'>;

export const BizlinksConfigScreen: React.FC<Props> = ({ navigation }) => {
  const { currentCompany } = useAuthStore();
  const { getConfigs, deleteConfig, loading } = useBizlinksConfig();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [configs, setConfigs] = useState<BizlinksConfig[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadConfigs = async () => {
    try {
      console.log('🔍 Cargando configuraciones para companyId:', currentCompany?.id);

      if (!currentCompany?.id) {
        console.error('❌ No hay companyId disponible');
        setConfigs([]);
        return;
      }

      const data = await getConfigs({
        companyId: currentCompany?.id,
      });
      console.log('📦 Datos recibidos del API:', data);
      console.log('📦 Tipo de datos:', typeof data);
      console.log('📦 Es array?:', Array.isArray(data));
      console.log('📦 Cantidad de items:', Array.isArray(data) ? data.length : 'No es array');

      // Si la respuesta es un objeto único en lugar de un array, convertirlo a array
      const configsArray = Array.isArray(data) ? data : (data ? [data] : []);
      console.log('✅ Configuraciones a mostrar:', configsArray);
      console.log('✅ Cantidad final:', configsArray.length);

      setConfigs(configsArray);
    } catch (error: any) {
      console.error('❌ Error loading configs:', error);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error response:', error.response?.data);
      setConfigs([]);
    }
  };

  useEffect(() => {
    console.log('🚀 useEffect ejecutado - llamando loadConfigs');
    loadConfigs();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadConfigs();
    setRefreshing(false);
  };

  const handleDelete = (config: BizlinksConfig) => {
    Alert.alert(
      'Confirmar eliminación',
      `¿Está seguro de eliminar la configuración de ${config.razonSocial}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteConfig(config.id);
              Alert.alert('Éxito', 'Configuración eliminada');
              loadConfigs();
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const renderConfig = ({ item }: { item: BizlinksConfig }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('BizlinksConfigEdit', { config: item })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.cardTitle}>{item.razonSocial}</Text>
          <Text style={styles.cardSubtitle}>RUC: {item.ruc}</Text>
        </View>
        <View style={[styles.badge, item.isActive ? styles.badgeActive : styles.badgeInactive]}>
          <Text style={styles.badgeText}>{item.isActive ? 'Activa' : 'Inactiva'}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>URL:</Text>
          <Text style={styles.infoValue} numberOfLines={1}>
            {item.baseUrl}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email:</Text>
          <Text style={styles.infoValue}>{item.email}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Modo:</Text>
          <Text style={styles.infoValue}>
            {item.isProduction ? 'Producción' : 'Pruebas'}
          </Text>
        </View>

        {item.site && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Sede:</Text>
            <Text style={styles.infoValue}>{item.site.name}</Text>
          </View>
        )}
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('BizlinksConfigEdit', { configId: item.id })}
        >
          <Text style={styles.actionButtonText}>Editar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonDanger]}
          onPress={() => handleDelete(item)}
        >
          <Text style={styles.actionButtonText}>Eliminar</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  console.log('🎨 Renderizando BizlinksConfigScreen');
  console.log('🎨 Loading:', loading);
  console.log('🎨 Refreshing:', refreshing);
  console.log('🎨 Configs:', configs);
  console.log('🎨 Configs length:', configs.length);

  if (loading && !refreshing) {
    console.log('⏳ Mostrando indicador de carga');
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.color.brand.accent} />
        <Text style={{ marginTop: 16, color: theme.color.text.muted }}>Cargando configuraciones...</Text>
      </View>
    );
  }

  console.log('✅ Mostrando lista de configuraciones');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Configuración Bizlinks</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('BizlinksConfigCreate')}
        >
          <Text style={styles.addButtonText}>+ Nueva Config</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={configs}
        renderItem={renderConfig}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay configuraciones</Text>
            <Text style={styles.emptyText}>Configs en estado: {configs.length}</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => navigation.navigate('BizlinksConfigCreate')}
            >
              <Text style={styles.emptyButtonText}>Crear primera configuración</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background.subtle,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.color.text.heading,
  },
  addButton: {
    backgroundColor: theme.color.action.success.background,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: theme.color.action.success.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: theme.color.surface.base,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: theme.color.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  cardHeaderLeft: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.color.text.heading,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: theme.color.text.muted,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeActive: {
    backgroundColor: theme.color.state.active.background,
  },
  badgeInactive: {
    backgroundColor: theme.color.state.draft.background,
  },
  badgeText: {
    color: theme.color.text.inverse,
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardBody: {
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: theme.color.text.muted,
    fontWeight: '600',
    width: 80,
  },
  infoValue: {
    fontSize: 14,
    color: theme.color.text.body,
    flex: 1,
  },
  cardActions: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: theme.color.border.subtle,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    backgroundColor: theme.color.brand.accent,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonDanger: {
    backgroundColor: theme.color.action.danger.background,
  },
  actionButtonText: {
    color: theme.color.text.inverse,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: theme.color.text.muted,
    marginBottom: 16,
  },
  emptyButton: {
    backgroundColor: theme.color.action.success.background,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: theme.color.action.success.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
});
