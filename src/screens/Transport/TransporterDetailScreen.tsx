import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { transportService } from '@/services/api/transport';
import { usePermissions } from '@/hooks/usePermissions';
import type { Transporter } from '@/types/transport';

export const TransporterDetailScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { hasPermission } = usePermissions();

  const { transporterId } = route.params as { transporterId: string };

  const [transporter, setTransporter] = useState<Transporter | null>(null);
  const [loading, setLoading] = useState(true);

  const canUpdate = hasPermission('transport.transporters.update');
  const canDelete = hasPermission('transport.transporters.delete');

  useEffect(() => {
    fetchTransporter();
  }, [transporterId]);

  const fetchTransporter = async () => {
    try {
      setLoading(true);
      const data = await transportService.getTransporter(transporterId);
      setTransporter(data);
    } catch (error: any) {
      console.error('Error fetching transporter:', error);
      Alert.alert('Error', error.message || 'No se pudo cargar el transportista');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    Alert.alert('Próximamente', 'La funcionalidad de editar transportista estará disponible pronto');
  };

  const handleDelete = () => {
    if (!canDelete) {
      Alert.alert('Sin permisos', 'No tienes permisos para eliminar transportistas');
      return;
    }

    Alert.alert(
      'Confirmar eliminación',
      `¿Estás seguro de eliminar el transportista "${transporter?.razonSocial}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await transportService.deleteTransporter(transporterId);
              Alert.alert('Éxito', 'Transportista eliminado correctamente');
              navigation.goBack();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'No se pudo eliminar el transportista');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return '#10B981';
      case 'INACTIVE':
        return '#6B7280';
      case 'SUSPENDED':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'Activo';
      case 'INACTIVE':
        return 'Inactivo';
      case 'SUSPENDED':
        return 'Suspendido';
      default:
        return status;
    }
  };

  const getCodigoAutorizadoLabel = (codigo?: string) => {
    const codigos: Record<string, string> = {
      '01': 'Transporte Privado',
      '02': 'Transporte Público',
      '03': 'Transporte de Carga',
      '04': 'Transporte de Pasajeros',
      '05': 'Transporte Mixto',
      '06': 'Transporte Especial',
      '07': 'Transporte Internacional',
    };
    return codigo ? codigos[codigo] || codigo : '-';
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalle de Transportista</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Cargando transportista...</Text>
        </View>
      </View>
    );
  }

  if (!transporter) {
    return null;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalle de Transportista</Text>
        <View style={styles.headerRight}>
          {canUpdate && (
            <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
              <Text style={styles.editButtonText}>✏️</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Status Badge */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(transporter.status) }]}>
            <Text style={styles.statusText}>{getStatusLabel(transporter.status)}</Text>
          </View>
        </View>

        {/* Main Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información Principal</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Razón Social</Text>
              <Text style={styles.infoValue}>{transporter.razonSocial}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>RUC</Text>
              <Text style={styles.infoValue}>{transporter.numeroRuc}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tipo de Documento</Text>
              <Text style={styles.infoValue}>{transporter.tipoDocumento === '6' ? 'RUC' : transporter.tipoDocumento}</Text>
            </View>
          </View>
        </View>

        {/* Transport Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información de Transporte</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Registro MTC</Text>
              <Text style={styles.infoValue}>{transporter.numeroRegistroMTC}</Text>
            </View>
            {transporter.numeroAutorizacion && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Número de Autorización</Text>
                  <Text style={styles.infoValue}>{transporter.numeroAutorizacion}</Text>
                </View>
              </>
            )}
            {transporter.codigoAutorizado && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Código Autorizado</Text>
                  <Text style={styles.infoValue}>
                    {transporter.codigoAutorizado} - {getCodigoAutorizadoLabel(transporter.codigoAutorizado)}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Contact Info */}
        {(transporter.telefono || transporter.email || transporter.direccion) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Información de Contacto</Text>
            <View style={styles.card}>
              {transporter.telefono && (
                <>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Teléfono</Text>
                    <Text style={styles.infoValue}>{transporter.telefono}</Text>
                  </View>
                  {(transporter.email || transporter.direccion) && <View style={styles.divider} />}
                </>
              )}
              {transporter.email && (
                <>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Email</Text>
                    <Text style={styles.infoValue}>{transporter.email}</Text>
                  </View>
                  {transporter.direccion && <View style={styles.divider} />}
                </>
              )}
              {transporter.direccion && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Dirección</Text>
                  <Text style={styles.infoValue}>{transporter.direccion}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Notes */}
        {transporter.notas && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notas</Text>
            <View style={styles.card}>
              <Text style={styles.notesText}>{transporter.notas}</Text>
            </View>
          </View>
        )}

        {/* Metadata */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información del Sistema</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Fecha de Creación</Text>
              <Text style={styles.infoValue}>
                {new Date(transporter.createdAt).toLocaleDateString('es-PE', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Última Actualización</Text>
              <Text style={styles.infoValue}>
                {new Date(transporter.updatedAt).toLocaleDateString('es-PE', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          </View>
        </View>

        {/* Delete Button */}
        {canDelete && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>🗑️ Eliminar Transportista</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
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
    color: '#1F2937',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 20,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  statusBadge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoRow: {
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 8,
  },
  notesText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6B7280',
  },
});
