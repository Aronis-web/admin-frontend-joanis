import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { config } from '@/utils/config';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';

type Props = NativeStackScreenProps<any, 'SeriesConfig'>;

interface SeriesConfig {
  id: string;
  serie: string;
  sedeId: string;
  tipoDocumento: string;
  descripcion: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  sede?: {
    id: string;
    name: string;
    code: string;
  };
}

interface NewSerie {
  serie: string;
  tipoDocumento: string;
  descripcion: string;
}

export const SeriesConfigScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { token } = useAuthStore();
  const { selectedSite } = useTenantStore();
  const [seriesConfigs, setSeriesConfigs] = useState<SeriesConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSeries, setNewSeries] = useState<NewSerie[]>([
    { serie: '', tipoDocumento: 'B', descripcion: '' },
  ]);

  const tiposDocumento = [
    { value: 'B', label: 'Boleta' },
    { value: 'F', label: 'Factura' },
    { value: 'BC', label: 'Boleta Contingencia' },
    { value: 'FC', label: 'Factura Contingencia' },
    { value: 'NC', label: 'Nota de Crédito' },
  ];

  useEffect(() => {
    loadSeriesConfigs();
  }, [selectedSite]);

  const loadSeriesConfigs = async () => {
    if (!selectedSite?.id) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `${config.API_URL}/cash-reconciliation/series-config?sedeId=${selectedSite.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-App-Id': config.APP_ID,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSeriesConfigs(data);
      } else {
        throw new Error('Error al cargar configuraciones');
      }
    } catch (error: any) {
      console.error('❌ Error al cargar series:', error);
      Alert.alert('Error', 'No se pudieron cargar las configuraciones de series');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBulk = async () => {
    if (!selectedSite?.id) {
      Alert.alert('Error', 'No hay sede seleccionada');
      return;
    }

    // Validar que todas las series tengan datos
    const invalidSeries = newSeries.filter((s) => !s.serie || !s.descripcion);
    if (invalidSeries.length > 0) {
      Alert.alert('Error', 'Todas las series deben tener código y descripción');
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch(`${config.API_URL}/cash-reconciliation/series-config/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-App-Id': config.APP_ID,
        },
        body: JSON.stringify({
          sedeId: selectedSite.id,
          series: newSeries,
        }),
      });

      if (response.ok) {
        Alert.alert('Éxito', 'Series creadas correctamente', [
          {
            text: 'OK',
            onPress: () => {
              setShowAddForm(false);
              setNewSeries([{ serie: '', tipoDocumento: 'B', descripcion: '' }]);
              loadSeriesConfigs();
            },
          },
        ]);
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Error al crear series');
      }
    } catch (error: any) {
      console.error('❌ Error al crear series:', error);
      Alert.alert('Error', error.message || 'No se pudieron crear las series');
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleActive = async (id: string) => {
    try {
      const response = await fetch(
        `${config.API_URL}/cash-reconciliation/series-config/${id}/toggle-active`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'X-App-Id': config.APP_ID,
          },
        }
      );

      if (response.ok) {
        loadSeriesConfigs();
      } else {
        throw new Error('Error al cambiar estado');
      }
    } catch (error: any) {
      console.error('❌ Error:', error);
      Alert.alert('Error', 'No se pudo cambiar el estado de la serie');
    }
  };

  const handleDelete = async (id: string, serie: string) => {
    Alert.alert(
      'Confirmar Eliminación',
      `¿Estás seguro de eliminar la serie ${serie}?\n\n⚠️ Si esta serie tiene ventas cargadas, quedarán huérfanas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(
                `${config.API_URL}/cash-reconciliation/series-config/${id}`,
                {
                  method: 'DELETE',
                  headers: {
                    Authorization: `Bearer ${token}`,
                    'X-App-Id': config.APP_ID,
                  },
                }
              );

              if (response.ok) {
                Alert.alert('Éxito', 'Serie eliminada correctamente');
                loadSeriesConfigs();
              } else {
                throw new Error('Error al eliminar');
              }
            } catch (error: any) {
              console.error('❌ Error:', error);
              Alert.alert('Error', 'No se pudo eliminar la serie');
            }
          },
        },
      ]
    );
  };

  const addNewSerieField = () => {
    setNewSeries([...newSeries, { serie: '', tipoDocumento: 'B', descripcion: '' }]);
  };

  const removeSerieField = (index: number) => {
    const updated = newSeries.filter((_, i) => i !== index);
    setNewSeries(updated);
  };

  const updateSerieField = (index: number, field: keyof NewSerie, value: string) => {
    const updated = [...newSeries];
    updated[index] = { ...updated[index], [field]: value };
    setNewSeries(updated);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#06B6D4" />
        <Text style={styles.loadingText}>Cargando configuraciones...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Configuración de Series</Text>
          <Text style={styles.headerSubtitle}>{selectedSite?.name || 'Sin sede'}</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>ℹ️ Configuración de Series</Text>
          <Text style={styles.infoText}>
            Configura qué series de comprobantes pertenecen a esta sede. Esto permite identificar
            automáticamente la sede al procesar ventas.
          </Text>
        </View>

        {/* Add Button */}
        {!showAddForm && (
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAddForm(true)}>
            <Text style={styles.addButtonIcon}>➕</Text>
            <Text style={styles.addButtonText}>Agregar Series</Text>
          </TouchableOpacity>
        )}

        {/* Add Form */}
        {showAddForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Agregar Series para {selectedSite?.name}</Text>

            {newSeries.map((serie, index) => (
              <View key={index} style={styles.serieFormGroup}>
                <View style={styles.serieFormHeader}>
                  <Text style={styles.serieFormLabel}>Serie {index + 1}</Text>
                  {newSeries.length > 1 && (
                    <TouchableOpacity onPress={() => removeSerieField(index)}>
                      <Text style={styles.removeButton}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="Serie (ej: B002, F001)"
                  value={serie.serie}
                  onChangeText={(text) => updateSerieField(index, 'serie', text.toUpperCase())}
                  autoCapitalize="characters"
                />

                <View style={styles.tipoDocumentoContainer}>
                  {tiposDocumento.map((tipo) => (
                    <TouchableOpacity
                      key={tipo.value}
                      style={[
                        styles.tipoButton,
                        serie.tipoDocumento === tipo.value && styles.tipoButtonActive,
                      ]}
                      onPress={() => updateSerieField(index, 'tipoDocumento', tipo.value)}
                    >
                      <Text
                        style={[
                          styles.tipoButtonText,
                          serie.tipoDocumento === tipo.value && styles.tipoButtonTextActive,
                        ]}
                      >
                        {tipo.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="Descripción"
                  value={serie.descripcion}
                  onChangeText={(text) => updateSerieField(index, 'descripcion', text)}
                />
              </View>
            ))}

            <TouchableOpacity style={styles.addMoreButton} onPress={addNewSerieField}>
              <Text style={styles.addMoreButtonText}>+ Agregar otra serie</Text>
            </TouchableOpacity>

            <View style={styles.formActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowAddForm(false);
                  setNewSeries([{ serie: '', tipoDocumento: 'B', descripcion: '' }]);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, isCreating && styles.saveButtonDisabled]}
                onPress={handleCreateBulk}
                disabled={isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Guardar Series</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Series List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Series Configuradas ({seriesConfigs.length})
          </Text>

          {seriesConfigs.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>📋</Text>
              <Text style={styles.emptyStateText}>No hay series configuradas</Text>
              <Text style={styles.emptyStateSubtext}>
                Agrega series para identificar las ventas de esta sede
              </Text>
            </View>
          ) : (
            seriesConfigs.map((config) => (
              <View key={config.id} style={styles.serieCard}>
                <View style={styles.serieHeader}>
                  <View style={styles.serieInfo}>
                    <Text style={styles.serieName}>{config.serie}</Text>
                    <Text style={styles.serieType}>{config.tipoDocumento}</Text>
                  </View>
                  <View style={styles.serieActions}>
                    <TouchableOpacity onPress={() => handleToggleActive(config.id)}>
                      <View
                        style={[
                          styles.statusBadge,
                          config.activo ? styles.statusBadgeActive : styles.statusBadgeInactive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            config.activo
                              ? styles.statusBadgeTextActive
                              : styles.statusBadgeTextInactive,
                          ]}
                        >
                          {config.activo ? 'Activo' : 'Inactivo'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(config.id, config.serie)}>
                      <Text style={styles.deleteButton}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.serieDescription}>{config.descripcion}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#374151',
    fontWeight: '600',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  infoCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#1E3A8A',
    lineHeight: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#06B6D4',
    borderRadius: 12,
  },
  addButtonIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  formCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  serieFormGroup: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  serieFormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  serieFormLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  removeButton: {
    fontSize: 20,
    color: '#EF4444',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#1F2937',
    marginBottom: 12,
  },
  tipoDocumentoContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tipoButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  tipoButtonActive: {
    backgroundColor: '#06B6D4',
    borderColor: '#06B6D4',
  },
  tipoButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  tipoButtonTextActive: {
    color: '#FFFFFF',
  },
  addMoreButton: {
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  addMoreButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#06B6D4',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveButton: {
    flex: 1,
    padding: 14,
    backgroundColor: '#06B6D4',
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  serieCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  serieHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  serieInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  serieName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  serieType: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  serieActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeActive: {
    backgroundColor: '#D1FAE5',
  },
  statusBadgeInactive: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadgeTextActive: {
    color: '#065F46',
  },
  statusBadgeTextInactive: {
    color: '#991B1B',
  },
  deleteButton: {
    fontSize: 20,
  },
  serieDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
});
