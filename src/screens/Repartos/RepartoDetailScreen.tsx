import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { repartosService } from '@/services/api';
import {
  Reparto,
  RepartoStatus,
  RepartoStatusLabels,
  RepartoStatusColors,
  RepartoProductoStatus,
  RepartoProductoStatusLabels,
  RepartoProductoStatusColors,
  RepartoProductoValidationStatus,
  RepartoProductoValidationStatusLabels,
  RepartoProductoValidationStatusColors,
} from '@/types/repartos';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { ValidacionSalidaModal, ValidacionDetailModal, CircularProgress } from '@/components/Repartos';
import { useAuthStore } from '@/store/auth';

interface RepartoDetailScreenProps {
  navigation: any;
  route: {
    params: {
      repartoId: string;
    };
  };
}

type TabType = 'overview' | 'participantes';

export const RepartoDetailScreen: React.FC<RepartoDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const { repartoId } = route.params;
  const [reparto, setReparto] = useState<Reparto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [validationModalVisible, setValidationModalVisible] = useState(false);
  const [validationDetailModalVisible, setValidationDetailModalVisible] = useState(false);
  const [selectedProducto, setSelectedProducto] = useState<any>(null);
  const { width, height } = useWindowDimensions();
  const { user } = useAuthStore();

  const isTablet = width >= 768 || height >= 768;

  const loadReparto = useCallback(async () => {
    try {
      const data = await repartosService.getReparto(repartoId);
      console.log('📦 Reparto cargado:', JSON.stringify(data, null, 2));
      console.log('👥 Participantes:', data.participantes?.length);
      if (data.participantes && data.participantes.length > 0) {
        console.log('🔍 Primer participante:', JSON.stringify(data.participantes[0], null, 2));
        if (data.participantes[0].productos) {
          console.log('📦 Productos del primer participante:', data.participantes[0].productos.length);
          if (data.participantes[0].productos.length > 0) {
            console.log('🔍 Primer producto:', JSON.stringify(data.participantes[0].productos[0], null, 2));
          }
        }
      }
      setReparto(data);
    } catch (error: any) {
      console.error('Error loading reparto:', error);
      Alert.alert('Error', 'No se pudo cargar el reparto');
      navigation.goBack();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [repartoId, navigation]);

  useFocusEffect(
    useCallback(() => {
      loadReparto();
    }, [loadReparto])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadReparto();
  };

  const handleCancel = async () => {
    if (!reparto) return;

    Alert.alert(
      'Cancelar Reparto',
      '¿Estás seguro de cancelar este reparto? Se liberarán todas las reservas de stock.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, Cancelar',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await repartosService.cancelReparto(repartoId);
              Alert.alert('Éxito', 'Reparto cancelado exitosamente');
              loadReparto();
            } catch (error: any) {
              Alert.alert(
                'Error',
                error.response?.data?.message || 'No se pudo cancelar el reparto'
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleValidateProduct = (producto: any) => {
    setSelectedProducto(producto);
    setValidationModalVisible(true);
  };

  const handleViewValidation = (producto: any) => {
    setSelectedProducto(producto);
    setValidationDetailModalVisible(true);
  };

  const handleSaveValidation = async (data: {
    validatedQuantityBase: string;
    photoUrl: string;
    signatureUrl: string;
    notes?: string;
  }) => {
    if (!selectedProducto) return;

    setActionLoading(true);
    try {
      await repartosService.validarSalida(selectedProducto.id, {
        validatedQuantityBase: data.validatedQuantityBase,
        photoUrl: data.photoUrl,
        signatureUrl: data.signatureUrl,
        validatedByName: user?.name || user?.email || 'Usuario',
        notes: data.notes,
      });

      Alert.alert('Éxito', 'Salida validada exitosamente');
      setValidationModalVisible(false);
      setSelectedProducto(null);
      loadReparto();
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.response?.data?.message || 'No se pudo validar la salida'
      );
      throw error;
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadgeStyle = (status: RepartoStatus) => {
    return {
      backgroundColor: RepartoStatusColors[status] + '20',
      borderColor: RepartoStatusColors[status],
    };
  };

  const getStatusTextStyle = (status: RepartoStatus) => {
    return {
      color: RepartoStatusColors[status],
    };
  };

  const getProductStatusBadgeStyle = (status: RepartoProductoValidationStatus) => {
    return {
      backgroundColor: RepartoProductoValidationStatusColors[status] + '20',
      borderColor: RepartoProductoValidationStatusColors[status],
    };
  };

  const getProductStatusTextStyle = (status: RepartoProductoValidationStatus) => {
    return {
      color: RepartoProductoValidationStatusColors[status],
    };
  };

  const renderTabs = () => {
    const tabs: Array<{ key: TabType; label: string }> = [
      { key: 'overview', label: 'Resumen' },
      { key: 'participantes', label: 'Participantes' },
    ];

    return (
      <View style={styles.tabsContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              isTablet && styles.tabTablet,
              activeTab === tab.key && styles.tabActive,
            ]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text
              style={[
                styles.tabText,
                isTablet && styles.tabTextTablet,
                activeTab === tab.key && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderOverview = () => {
    if (!reparto) return null;

    const totalParticipantes = reparto.participantes?.length || 0;
    // Total de productos (items) en el reparto
    const totalProductos = reparto.participantes?.reduce(
      (sum, p) => sum + (p.productos?.length || 0),
      0
    ) || 0;
    // Cantidad de productos (items) validados
    const productosValidados = reparto.participantes?.reduce(
      (sum, p) => sum + (p.productos?.filter(prod => prod.validationStatus === RepartoProductoValidationStatus.VALIDATED).length || 0),
      0
    ) || 0;

    return (
      <View style={styles.overviewContainer}>
        {/* Reparto Info */}
        <View style={[styles.section, isTablet && styles.sectionTablet]}>
          <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
            Información General
          </Text>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
              Código:
            </Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
              {reparto.code}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
              Nombre:
            </Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
              {reparto.name}
            </Text>
          </View>

          {reparto.campaign && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                Campaña:
              </Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                {reparto.campaign.code} - {reparto.campaign.name}
              </Text>
            </View>
          )}

          {reparto.description && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                Descripción:
              </Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                {reparto.description}
              </Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
              Estado:
            </Text>
            <View
              style={[
                styles.statusBadge,
                isTablet && styles.statusBadgeTablet,
                getStatusBadgeStyle(reparto.status),
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  isTablet && styles.statusTextTablet,
                  getStatusTextStyle(reparto.status),
                ]}
              >
                {RepartoStatusLabels[reparto.status]}
              </Text>
            </View>
          </View>

          {reparto.scheduledDate && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                Fecha Programada:
              </Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                {formatDate(reparto.scheduledDate)}
              </Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
              Creado:
            </Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
              {formatDate(reparto.createdAt)}
            </Text>
          </View>

          {reparto.completedAt && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                Completado:
              </Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                {formatDate(reparto.completedAt)}
              </Text>
            </View>
          )}
        </View>

        {/* Statistics */}
        <View style={[styles.section, isTablet && styles.sectionTablet]}>
          <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
            Estadísticas
          </Text>

          <View style={styles.statsGrid}>
            <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
              <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                {totalParticipantes}
              </Text>
              <Text style={[styles.statLabel, isTablet && styles.statLabelTablet]}>
                Participantes
              </Text>
            </View>

            <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
              <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                {totalProductos}
              </Text>
              <Text style={[styles.statLabel, isTablet && styles.statLabelTablet]}>
                Productos
              </Text>
            </View>

            <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
              <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                {productosValidados}
              </Text>
              <Text style={[styles.statLabel, isTablet && styles.statLabelTablet]}>
                Validados
              </Text>
            </View>

            <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
              <CircularProgress
                size={isTablet ? 90 : 70}
                strokeWidth={isTablet ? 9 : 7}
                progress={totalProductos > 0 ? (productosValidados / totalProductos) * 100 : 0}
                total={totalProductos}
                validated={productosValidados}
                fontSize={isTablet ? 16 : 14}
              />
              <Text style={[styles.statLabel, isTablet && styles.statLabelTablet, { marginTop: 8 }]}>
                Productos Validados
              </Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        {reparto.notes && (
          <View style={[styles.section, isTablet && styles.sectionTablet]}>
            <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
              Notas
            </Text>
            <Text style={[styles.notesText, isTablet && styles.notesTextTablet]}>
              {reparto.notes}
            </Text>
          </View>
        )}

        {/* Actions */}
        {reparto.status !== RepartoStatus.CANCELLED && reparto.status !== RepartoStatus.COMPLETED && (
          <View style={[styles.section, isTablet && styles.sectionTablet]}>
            <TouchableOpacity
              style={[styles.cancelButton, actionLoading && styles.buttonDisabled]}
              onPress={handleCancel}
              disabled={actionLoading}
            >
              <Text style={styles.cancelButtonText}>
                {actionLoading ? 'Cancelando...' : 'Cancelar Reparto'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderParticipantes = () => {
    if (!reparto) return null;

    return (
      <View style={styles.tabContent}>
        <View style={[styles.section, isTablet && styles.sectionTablet]}>
          <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
            Participantes y Productos ({reparto.participantes?.length || 0})
          </Text>

          {!reparto.participantes || reparto.participantes.length === 0 ? (
            <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
              No hay participantes en este reparto
            </Text>
          ) : (
            reparto.participantes
              .slice()
              .sort((a, b) => {
                // Primero sedes (INTERNAL_SITE), luego empresas (EXTERNAL_COMPANY)
                const typeA = a.campaignParticipant?.participantType;
                const typeB = b.campaignParticipant?.participantType;

                if (typeA === 'INTERNAL_SITE' && typeB !== 'INTERNAL_SITE') return -1;
                if (typeA !== 'INTERNAL_SITE' && typeB === 'INTERNAL_SITE') return 1;

                // Ordenar alfabéticamente dentro de cada grupo
                const nameA = typeA === 'EXTERNAL_COMPANY'
                  ? (a.campaignParticipant?.company?.name || '')
                  : (a.campaignParticipant?.site?.name || '');

                const nameB = typeB === 'EXTERNAL_COMPANY'
                  ? (b.campaignParticipant?.company?.name || '')
                  : (b.campaignParticipant?.site?.name || '');

                return nameA.localeCompare(nameB);
              })
              .map((participante) => {
              const participantName = participante.campaignParticipant?.participantType === 'EXTERNAL_COMPANY'
                ? participante.campaignParticipant?.company?.name || 'Empresa'
                : participante.campaignParticipant?.site?.name || 'Sede';

              // Calcular progreso individual del participante (cantidad de productos validados)
              const totalProductosParticipante = participante.productos?.length || 0;
              const productosValidadosParticipante = participante.productos?.filter(
                (p) => p.validationStatus === RepartoProductoValidationStatus.VALIDATED
              ).length || 0;
              const progressPercentageParticipante = totalProductosParticipante > 0
                ? Math.round((productosValidadosParticipante / totalProductosParticipante) * 100)
                : 0;

              return (
                <View
                  key={participante.id}
                  style={[styles.participantCard, isTablet && styles.participantCardTablet]}
                >
                  <View style={styles.participantHeader}>
                    <View style={styles.participantInfo}>
                      <Text style={[styles.participantName, isTablet && styles.participantNameTablet]}>
                        {participantName}
                      </Text>
                      <Text style={[styles.participantType, isTablet && styles.participantTypeTablet]}>
                        {participante.campaignParticipant?.participantType === 'EXTERNAL_COMPANY'
                          ? 'Empresa Externa'
                          : 'Sede Interna'}
                      </Text>
                      <Text style={[styles.participantStats, isTablet && styles.participantStatsTablet]}>
                        Productos Validados: {productosValidadosParticipante} / {totalProductosParticipante}
                      </Text>
                    </View>

                    {/* Circular Progress for Individual Participant */}
                    {totalProductosParticipante > 0 && (
                      <View style={styles.participantProgress}>
                        <CircularProgress
                          progress={progressPercentageParticipante}
                          size={isTablet ? 70 : 60}
                          strokeWidth={isTablet ? 7 : 6}
                        />
                      </View>
                    )}
                  </View>

                  {participante.productos && participante.productos.length > 0 && (
                    <View style={styles.productsList}>
                      <Text style={[styles.productsTitle, isTablet && styles.productsTitleTablet]}>
                        Productos ({participante.productos.length})
                      </Text>
                      {participante.productos
                        .slice()
                        .sort((a, b) => {
                          // Ordenar por correlativo
                          const correlativeA = (a.product as any)?.correlativeNumber || 0;
                          const correlativeB = (b.product as any)?.correlativeNumber || 0;
                          return correlativeA - correlativeB;
                        })
                        .map((producto) => {
                        // ✅ SOLO mostrar por presentación si la VALIDACIÓN fue por presentación
                        const validacionAny = producto.validacion as any;
                        const wasValidatedByPresentation = producto.validationStatus === RepartoProductoValidationStatus.VALIDATED &&
                          (validacionAny?.presentationInfo?.roundingApplied === true);

                        // Calcular cantidades en presentación SOLO si fue validado por presentación
                        let quantityInPresentation = 0;
                        let validatedInPresentation = 0;
                        let presentationName = '';

                        if (wasValidatedByPresentation && validacionAny?.presentationInfo?.largestPresentation) {
                          const factor = validacionAny.presentationInfo.largestPresentation.factorToBase;
                          presentationName = validacionAny.presentationInfo.largestPresentation.name;
                          quantityInPresentation = Math.floor(parseFloat(producto.quantityBase || '0') / factor);
                          if (validacionAny?.validatedQuantityBase) {
                            validatedInPresentation = Math.floor(parseFloat(validacionAny.validatedQuantityBase) / factor);
                          }
                        }

                        return (
                          <View key={producto.id} style={styles.productItem}>
                            <View style={styles.productInfo}>
                              <Text style={[styles.productName, isTablet && styles.productNameTablet]}>
                                {producto.product?.title || 'Producto'}
                              </Text>
                              <Text style={[styles.productSku, isTablet && styles.productSkuTablet]}>
                                {(producto.product as any)?.correlativeNumber && `#${(producto.product as any).correlativeNumber} | `}SKU: {producto.product?.sku}
                              </Text>
                              <Text style={[styles.productQuantity, isTablet && styles.productQuantityTablet]}>
                                Cantidad Asignada: {wasValidatedByPresentation
                                  ? `${quantityInPresentation} ${presentationName} (${producto.quantityBase} unidades)`
                                  : `${producto.quantityBase} unidades`
                                }
                              </Text>
                              {producto.validacion && (
                                <Text style={[styles.validatedQuantity, isTablet && styles.validatedQuantityTablet]}>
                                  Cantidad Validada: {wasValidatedByPresentation
                                    ? `${validatedInPresentation} ${presentationName} (${producto.validacion.validatedQuantityBase} unidades)`
                                    : `${producto.validacion.validatedQuantityBase} unidades`
                                  }
                                </Text>
                              )}
                            </View>
                            <View style={styles.productActions}>
                              <View
                                style={[
                                  styles.productStatusBadge,
                                  getProductStatusBadgeStyle(producto.validationStatus),
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.productStatusText,
                                    getProductStatusTextStyle(producto.validationStatus),
                                  ]}
                                >
                                  {RepartoProductoValidationStatusLabels[producto.validationStatus]}
                                </Text>
                              </View>
                            {producto.validationStatus === RepartoProductoValidationStatus.PENDING && (
                              <TouchableOpacity
                                style={styles.validateButton}
                                onPress={() => handleValidateProduct(producto)}
                              >
                                <Text style={styles.validateButtonText}>Validar Salida</Text>
                              </TouchableOpacity>
                            )}
                            {producto.validationStatus === RepartoProductoValidationStatus.VALIDATED && (
                              <TouchableOpacity
                                style={styles.viewValidationButton}
                                onPress={() => handleViewValidation(producto)}
                              >
                                <Text style={styles.viewValidationButtonText}>Ver Validación</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Cargando reparto...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Volver</Text>
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={[styles.title, isTablet && styles.titleTablet]}>
              {reparto?.code}
            </Text>
            <Text style={[styles.subtitle, isTablet && styles.subtitleTablet]}>
              {reparto?.name}
            </Text>
          </View>
        </View>

        {/* Tabs */}
        {renderTabs()}

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            isTablet && styles.scrollContentTablet,
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {activeTab === 'overview' ? renderOverview() : renderParticipantes()}
        </ScrollView>

        {/* Validation Modal */}
        <ValidacionSalidaModal
          visible={validationModalVisible}
          producto={selectedProducto}
          onClose={() => {
            setValidationModalVisible(false);
            setSelectedProducto(null);
          }}
          onValidate={handleSaveValidation}
        />

        {/* Validation Detail Modal */}
        <ValidacionDetailModal
          visible={validationDetailModalVisible}
          repartoProductoId={selectedProducto?.id}
          onClose={() => {
            setValidationDetailModalVisible(false);
            setSelectedProducto(null);
          }}
        />
      </SafeAreaView>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748B',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTablet: {
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  backButton: {
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#6366F1',
    fontWeight: '500',
  },
  headerInfo: {
    gap: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  titleTablet: {
    fontSize: 32,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
  },
  subtitleTablet: {
    fontSize: 18,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabTablet: {
    paddingVertical: 20,
  },
  tabActive: {
    borderBottomColor: '#6366F1',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
  tabTextTablet: {
    fontSize: 16,
  },
  tabTextActive: {
    color: '#6366F1',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  scrollContentTablet: {
    padding: 32,
  },
  overviewContainer: {
    gap: 16,
  },
  tabContent: {
    gap: 16,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTablet: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 16,
  },
  sectionTitleTablet: {
    fontSize: 22,
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
    width: 140,
  },
  infoLabelTablet: {
    fontSize: 16,
    width: 180,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
  },
  infoValueTablet: {
    fontSize: 16,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  statusBadgeTablet: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextTablet: {
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  statCardTablet: {
    padding: 20,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6366F1',
    marginBottom: 4,
  },
  statValueTablet: {
    fontSize: 28,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  statLabelTablet: {
    fontSize: 14,
  },
  notesText: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  notesTextTablet: {
    fontSize: 16,
    lineHeight: 24,
  },
  cancelButton: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  participantCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  participantCardTablet: {
    padding: 20,
  },
  participantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  participantInfo: {
    flex: 1,
  },
  participantProgress: {
    marginLeft: 16,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  participantNameTablet: {
    fontSize: 18,
  },
  participantType: {
    fontSize: 13,
    color: '#64748B',
  },
  participantTypeTablet: {
    fontSize: 15,
  },
  participantStats: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '600',
    marginTop: 4,
  },
  participantStatsTablet: {
    fontSize: 15,
  },
  productsList: {
    marginTop: 8,
  },
  productsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  productsTitleTablet: {
    fontSize: 16,
  },
  productItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  productInfo: {
    flex: 1,
    marginRight: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  productNameTablet: {
    fontSize: 16,
  },
  productSku: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
  },
  productSkuTablet: {
    fontSize: 14,
  },
  productQuantity: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 2,
  },
  productQuantityTablet: {
    fontSize: 15,
  },
  validatedQuantity: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '500',
  },
  validatedQuantityTablet: {
    fontSize: 15,
  },
  productActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  productStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  productStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  validateButton: {
    backgroundColor: '#6366F1',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  validateButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  viewValidationButton: {
    backgroundColor: '#10B981',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  viewValidationButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 20,
  },
  emptyTextTablet: {
    fontSize: 16,
  },
});
