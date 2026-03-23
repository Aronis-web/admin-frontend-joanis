import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Picker } from '@react-native-picker/picker';
import { useAuthStore } from '@/store/auth';
import { bizlinksApi } from '@/services/api/bizlinks';
import { CreateRetencionDto, ProveedorRetencionDto, RetencionItemDto, BizlinksDocumentType } from '@/types/bizlinks';
import { DatePicker, DatePickerButton } from '@/components/DatePicker';
import { formatDateToString } from '@/utils/dateHelpers';
import { billingApi, DocumentSeries, DocumentType } from '@/services/api/billing';
import { suppliersService } from '@/services/api/suppliers';
import { Supplier } from '@/types/suppliers';
import { salesApi } from '@/services/api/sales';
import { Sale, DocumentType as SaleDocumentType } from '@/types/sales';

type Props = NativeStackScreenProps<any, 'CreateRetencion'>;

// Catálogo 23 - Régimen de Retención
const REGIMEN_RETENCION_OPTIONS = [
  { value: '01', label: 'Tasa 3%', tasa: 3.00 },
  { value: '02', label: 'Tasa 6%', tasa: 6.00 },
  { value: '03', label: 'Otros', tasa: 0 },
];

// Catálogo 01 - Tipo de Documento
const TIPO_DOCUMENTO_OPTIONS = [
  { value: '01', label: 'Factura' },
  { value: '03', label: 'Boleta' },
  { value: '07', label: 'Nota de Crédito' },
  { value: '08', label: 'Nota de Débito' },
];

const TIPO_MONEDA_OPTIONS = [
  { value: 'PEN', label: 'Soles (PEN)' },
  { value: 'USD', label: 'Dólares (USD)' },
];

export const CreateRetencionScreen: React.FC<Props> = ({ navigation }) => {
  const { currentCompany, currentSite } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [loadingSeries, setLoadingSeries] = useState(true);

  // Series disponibles
  const [availableSeries, setAvailableSeries] = useState<DocumentSeries[]>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('');
  const [documentTypeId, setDocumentTypeId] = useState<string>('');

  // Datos del emisor (se cargan de la empresa actual)
  const [fechaEmision, setFechaEmision] = useState(formatDateToString(new Date()));
  const [showFechaEmisionPicker, setShowFechaEmisionPicker] = useState(false);

  // Búsqueda de proveedores
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Supplier[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchingSuppliers, setSearchingSuppliers] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // Datos del proveedor
  const [proveedor, setProveedor] = useState<ProveedorRetencionDto>({
    tipoDocumentoProveedor: '6',
    numeroDocumentoProveedor: '',
    razonSocialProveedor: '',
    nombreComercialProveedor: '',
    ubigeoProveedor: '150101',
    direccionProveedor: '',
    provinciaProveedor: 'LIMA',
    departamentoProveedor: 'LIMA',
    distritoProveedor: 'LIMA',
    codigoPaisProveedor: 'PE',
  });

  // Régimen y tasa
  const [regimenRetencion, setRegimenRetencion] = useState<'01' | '02' | '03'>('01');
  const [tasaRetencion, setTasaRetencion] = useState(3.00);
  const [observaciones, setObservaciones] = useState('');

  // Items (documentos relacionados)
  const [items, setItems] = useState<RetencionItemDto[]>([]);
  const [showAddItemModal, setShowAddItemModal] = useState(false);

  // Totales calculados
  const [importeTotalPagado, setImporteTotalPagado] = useState(0);
  const [importeTotalRetenido, setImporteTotalRetenido] = useState(0);
  const [tipoMoneda, setTipoMoneda] = useState<'PEN' | 'USD'>('PEN');

  // Cargar series al montar el componente
  useEffect(() => {
    loadSeriesForRetenciones();
  }, [currentSite]);

  // Actualizar tasa cuando cambia el régimen
  useEffect(() => {
    const regimen = REGIMEN_RETENCION_OPTIONS.find(r => r.value === regimenRetencion);
    if (regimen && regimen.tasa > 0) {
      setTasaRetencion(regimen.tasa);
    }
  }, [regimenRetencion]);

  // Recalcular totales cuando cambian los items
  useEffect(() => {
    const totalPagado = items.reduce((sum, item) => sum + item.importePagoSinRetencion, 0);
    const totalRetenido = items.reduce((sum, item) => sum + item.importeRetenido, 0);
    setImporteTotalPagado(totalPagado);
    setImporteTotalRetenido(totalRetenido);
  }, [items]);

  const loadSeriesForRetenciones = async () => {
    if (!currentSite?.id) {
      setLoadingSeries(false);
      return;
    }

    try {
      setLoadingSeries(true);

      // Primero obtener el tipo de documento "Retención" (código 20)
      const documentTypes = await billingApi.getDocumentTypes({ isActive: true });
      const retencionType = documentTypes.find(dt => dt.code === BizlinksDocumentType.RETENCION);

      if (!retencionType) {
        Alert.alert(
          'Configuración Requerida',
          'No se encontró el tipo de documento "Retención" (código 20) en el sistema.\n\n' +
          'Por favor, contacta al administrador para configurar este tipo de documento.',
          [{ text: 'Entendido', onPress: () => navigation.goBack() }]
        );
        return;
      }

      setDocumentTypeId(retencionType.id);

      // Obtener series activas para retenciones en la sede actual
      const series = await billingApi.getDocumentSeries({
        siteId: currentSite.id,
        documentTypeId: retencionType.id,
        isActive: true,
      });

      if (series.length === 0) {
        Alert.alert(
          'Serie Requerida',
          'No hay series configuradas para retenciones en esta sede.\n\n' +
          'Por favor, crea una serie desde:\n' +
          'Menú → Configuración → Puntos de Emisión → Series\n\n' +
          'Formato recomendado: R001',
          [
            { text: 'Cancelar', style: 'cancel', onPress: () => navigation.goBack() },
            { text: 'Continuar sin serie', style: 'default' }
          ]
        );
        setAvailableSeries([]);
        return;
      }

      setAvailableSeries(series);

      // Seleccionar la serie por defecto si existe
      const defaultSeries = series.find(s => s.isDefault);
      if (defaultSeries) {
        setSelectedSeriesId(defaultSeries.id);
      } else if (series.length > 0) {
        setSelectedSeriesId(series[0].id);
      }
    } catch (error: any) {
      console.error('Error cargando series:', error);
      Alert.alert(
        'Error',
        'No se pudieron cargar las series de retenciones.\n\n' +
        error.message || 'Error desconocido'
      );
    } finally {
      setLoadingSeries(false);
    }
  };

  const searchSuppliers = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    try {
      setSearchingSuppliers(true);
      const response = await suppliersService.autocompleteSuppliers(query, 10, false);
      setSearchResults(response.data || []);
      setShowSearchResults(true);
    } catch (error: any) {
      console.error('Error buscando proveedores:', error);
      setSearchResults([]);
    } finally {
      setSearchingSuppliers(false);
    }
  };

  const handleSelectSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setSearchQuery(supplier.commercialName);
    setShowSearchResults(false);

    // Obtener la entidad legal principal (RUC)
    const primaryLegalEntity = supplier.legalEntities?.find(le => le.isPrimary) || supplier.legalEntities?.[0];

    // Autocompletar datos del proveedor
    setProveedor({
      tipoDocumentoProveedor: '6', // RUC
      numeroDocumentoProveedor: primaryLegalEntity?.ruc || '',
      razonSocialProveedor: primaryLegalEntity?.legalName || supplier.commercialName,
      nombreComercialProveedor: supplier.commercialName,
      ubigeoProveedor: '150101', // Default, puede mejorarse con datos del supplier
      direccionProveedor: supplier.addressLine1 || '',
      provinciaProveedor: supplier.province || 'LIMA',
      departamentoProveedor: supplier.department || 'LIMA',
      distritoProveedor: supplier.district || 'LIMA',
      codigoPaisProveedor: 'PE',
    });
  };

  const handleClearSupplier = () => {
    setSelectedSupplier(null);
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
    setProveedor({
      tipoDocumentoProveedor: '6',
      numeroDocumentoProveedor: '',
      razonSocialProveedor: '',
      nombreComercialProveedor: '',
      ubigeoProveedor: '150101',
      direccionProveedor: '',
      provinciaProveedor: 'LIMA',
      departamentoProveedor: 'LIMA',
      distritoProveedor: 'LIMA',
      codigoPaisProveedor: 'PE',
    });
  };

  const handleAddItem = (item: RetencionItemDto) => {
    setItems([...items, item]);
    setShowAddItemModal(false);
  };

  const handleRemoveItem = (index: number) => {
    Alert.alert(
      'Eliminar Documento',
      '¿Está seguro de eliminar este documento de la retención?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            const newItems = items.filter((_, i) => i !== index);
            setItems(newItems);
          },
        },
      ]
    );
  };

  const validateForm = (): string | null => {
    if (!selectedSeriesId) return 'Debe seleccionar una serie';
    if (!fechaEmision) return 'Debe seleccionar la fecha de emisión';
    if (!proveedor.numeroDocumentoProveedor.trim()) return 'Debe ingresar el RUC del proveedor';
    if (!proveedor.razonSocialProveedor.trim()) return 'Debe ingresar la razón social del proveedor';
    if (!proveedor.direccionProveedor?.trim()) return 'Debe ingresar la dirección del proveedor';
    if (items.length === 0) return 'Debe agregar al menos un documento relacionado';
    if (importeTotalRetenido <= 0) return 'El importe total retenido debe ser mayor a 0';

    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      Alert.alert('Error de Validación', validationError);
      return;
    }

    if (!currentCompany || !currentSite) {
      Alert.alert('Error', 'No se ha seleccionado una empresa o sede');
      return;
    }

    const selectedSeries = availableSeries.find(s => s.id === selectedSeriesId);
    if (!selectedSeries) {
      Alert.alert('Error', 'Serie no encontrada');
      return;
    }

    const serieNumero = selectedSeries.series;

    Alert.alert(
      'Confirmar Emisión',
      `¿Está seguro de emitir la retención con serie ${serieNumero}?\n\n` +
      `Proveedor: ${proveedor.razonSocialProveedor}\n` +
      `Total Pagado: ${tipoMoneda} ${importeTotalPagado.toFixed(2)}\n` +
      `Total Retenido: ${tipoMoneda} ${importeTotalRetenido.toFixed(2)}\n` +
      `Documentos: ${items.length}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Emitir',
          onPress: async () => {
            try {
              setLoading(true);

              // Nota: El backend generará el número correlativo automáticamente
              // Solo enviamos la serie, no el número completo
              const dto: CreateRetencionDto = {
                serieNumero, // Solo la serie (ej: "R001"), el backend agregará el correlativo
                fechaEmision,
                rucEmisor: currentCompany.ruc || '',
                razonSocialEmisor: currentCompany.razonSocial || currentCompany.name,
                nombreComercialEmisor: currentCompany.nombreComercial,
                ubigeoEmisor: currentCompany.ubigeo || '150101',
                direccionEmisor: currentCompany.direccion || '',
                provinciaEmisor: currentCompany.provincia || 'LIMA',
                departamentoEmisor: currentCompany.departamento || 'LIMA',
                distritoEmisor: currentCompany.distrito || 'LIMA',
                codigoPaisEmisor: 'PE',
                correoEmisor: currentCompany.email || '',
                correoAdquiriente: proveedor.razonSocialProveedor.toLowerCase().includes('@')
                  ? proveedor.razonSocialProveedor
                  : undefined,
                proveedor,
                regimenRetencion,
                tasaRetencion,
                observaciones: observaciones.trim() || undefined,
                importeTotalRetenido,
                tipoMonedaTotalRetenido: tipoMoneda,
                importeTotalPagado,
                tipoMonedaTotalPagado: tipoMoneda,
                items,
              };

              const result = await bizlinksApi.createRetencion(dto);

              Alert.alert(
                'Retención Creada',
                `La retención ${result.serieNumero} ha sido creada exitosamente.\n\n` +
                `Estado: ${result.status}\n` +
                `${result.messageSunat ? `SUNAT: ${result.messageSunat.mensaje}` : ''}`,
                [
                  {
                    text: 'Ver Detalle',
                    onPress: () => {
                      navigation.replace('RetencionDetail', { retencionId: result.id });
                    },
                  },
                  {
                    text: 'Crear Otra',
                    onPress: () => {
                      // Resetear formulario
                      setItems([]);
                      setObservaciones('');
                      setProveedor({
                        tipoDocumentoProveedor: '6',
                        numeroDocumentoProveedor: '',
                        razonSocialProveedor: '',
                        nombreComercialProveedor: '',
                        ubigeoProveedor: '150101',
                        direccionProveedor: '',
                        provinciaProveedor: 'LIMA',
                        departamentoProveedor: 'LIMA',
                        distritoProveedor: 'LIMA',
                        codigoPaisProveedor: 'PE',
                      });
                    },
                  },
                ]
              );
            } catch (error: any) {
              console.error('Error al crear retención:', error);
              Alert.alert(
                'Error',
                error.response?.data?.message ||
                error.message ||
                'No se pudo crear la retención'
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loadingSeries) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nueva Retención</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Cargando series...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nueva Retención</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Datos Generales */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📄 Datos Generales</Text>

          <Text style={styles.label}>Serie *</Text>
          {availableSeries.length > 0 ? (
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedSeriesId}
                onValueChange={(value) => setSelectedSeriesId(value)}
                style={styles.picker}
              >
                <Picker.Item label="Seleccionar serie..." value="" />
                {availableSeries.map(serie => (
                  <Picker.Item
                    key={serie.id}
                    label={`${serie.series}${serie.isDefault ? ' (Por defecto)' : ''} - ${serie.description || 'Sin descripción'}`}
                    value={serie.id}
                  />
                ))}
              </Picker>
            </View>
          ) : (
            <View style={styles.noSeriesContainer}>
              <Ionicons name="alert-circle-outline" size={24} color="#F59E0B" />
              <Text style={styles.noSeriesText}>
                No hay series configuradas para retenciones
              </Text>
              <Text style={styles.noSeriesSubtext}>
                Configura una serie desde Puntos de Emisión
              </Text>
            </View>
          )}
          {selectedSeriesId && (
            <Text style={styles.hint}>
              El número correlativo se generará automáticamente
            </Text>
          )}

          <Text style={styles.label}>Fecha de Emisión *</Text>
          <DatePickerButton
            label=""
            value={fechaEmision}
            onPress={() => setShowFechaEmisionPicker(true)}
          />

          <Text style={styles.label}>Régimen de Retención *</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={regimenRetencion}
              onValueChange={(value) => setRegimenRetencion(value as '01' | '02' | '03')}
              style={styles.picker}
            >
              {REGIMEN_RETENCION_OPTIONS.map(option => (
                <Picker.Item key={option.value} label={option.label} value={option.value} />
              ))}
            </Picker>
          </View>

          <Text style={styles.label}>Tasa de Retención (%)</Text>
          <TextInput
            style={styles.input}
            value={tasaRetencion.toString()}
            onChangeText={(text) => setTasaRetencion(parseFloat(text) || 0)}
            keyboardType="decimal-pad"
            placeholder="3.00"
            placeholderTextColor="#9CA3AF"
            editable={regimenRetencion === '03'}
          />

          <Text style={styles.label}>Moneda *</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={tipoMoneda}
              onValueChange={(value) => setTipoMoneda(value as 'PEN' | 'USD')}
              style={styles.picker}
            >
              {TIPO_MONEDA_OPTIONS.map(option => (
                <Picker.Item key={option.value} label={option.label} value={option.value} />
              ))}
            </Picker>
          </View>
        </View>

        {/* Datos del Proveedor */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🏢 Datos del Proveedor</Text>
            {selectedSupplier && (
              <TouchableOpacity onPress={handleClearSupplier} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color="#EF4444" />
                <Text style={styles.clearButtonText}>Limpiar</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Buscador de Proveedores */}
          <Text style={styles.label}>Buscar Proveedor</Text>
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color="#6B7280" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  searchSuppliers(text);
                }}
                placeholder="Buscar por nombre o RUC..."
                placeholderTextColor="#9CA3AF"
              />
              {searchingSuppliers && (
                <ActivityIndicator size="small" color="#8B5CF6" style={styles.searchLoader} />
              )}
            </View>

            {/* Resultados de búsqueda */}
            {showSearchResults && searchResults.length > 0 && (
              <View style={styles.searchResultsContainer}>
                <ScrollView style={styles.searchResultsList} nestedScrollEnabled>
                  {searchResults.map((supplier) => {
                    const primaryLegalEntity = supplier.legalEntities?.find(le => le.isPrimary) || supplier.legalEntities?.[0];
                    return (
                      <TouchableOpacity
                        key={supplier.id}
                        style={styles.searchResultItem}
                        onPress={() => handleSelectSupplier(supplier)}
                      >
                        <View style={styles.searchResultContent}>
                          <Text style={styles.searchResultName}>{supplier.commercialName}</Text>
                          {primaryLegalEntity && (
                            <Text style={styles.searchResultRuc}>RUC: {primaryLegalEntity.ruc}</Text>
                          )}
                          {supplier.addressLine1 && (
                            <Text style={styles.searchResultAddress}>{supplier.addressLine1}</Text>
                          )}
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {showSearchResults && searchResults.length === 0 && searchQuery.length >= 2 && !searchingSuppliers && (
              <View style={styles.noResultsContainer}>
                <Ionicons name="search-outline" size={32} color="#9CA3AF" />
                <Text style={styles.noResultsText}>No se encontraron proveedores</Text>
                <Text style={styles.noResultsSubtext}>Intenta con otro término de búsqueda</Text>
              </View>
            )}
          </View>

          {selectedSupplier && (
            <View style={styles.selectedSupplierBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.selectedSupplierText}>
                Proveedor seleccionado: {selectedSupplier.commercialName}
              </Text>
            </View>
          )}

          <Text style={styles.label}>Tipo de Documento *</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={proveedor.tipoDocumentoProveedor}
              onValueChange={(value) => setProveedor({ ...proveedor, tipoDocumentoProveedor: value as '1' | '6' })}
              style={styles.picker}
              enabled={!selectedSupplier}
            >
              <Picker.Item label="RUC" value="6" />
              <Picker.Item label="DNI" value="1" />
            </Picker>
          </View>

          <Text style={styles.label}>
            {proveedor.tipoDocumentoProveedor === '6' ? 'RUC' : 'DNI'} *
          </Text>
          <TextInput
            style={[styles.input, selectedSupplier && styles.inputDisabled]}
            value={proveedor.numeroDocumentoProveedor}
            onChangeText={(text) => setProveedor({ ...proveedor, numeroDocumentoProveedor: text })}
            placeholder={proveedor.tipoDocumentoProveedor === '6' ? '20100000000' : '12345678'}
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            maxLength={proveedor.tipoDocumentoProveedor === '6' ? 11 : 8}
            editable={!selectedSupplier}
          />

          <Text style={styles.label}>Razón Social *</Text>
          <TextInput
            style={[styles.input, selectedSupplier && styles.inputDisabled]}
            value={proveedor.razonSocialProveedor}
            onChangeText={(text) => setProveedor({ ...proveedor, razonSocialProveedor: text })}
            placeholder="PROVEEDOR SAC"
            placeholderTextColor="#9CA3AF"
            editable={!selectedSupplier}
          />

          <Text style={styles.label}>Nombre Comercial</Text>
          <TextInput
            style={[styles.input, selectedSupplier && styles.inputDisabled]}
            value={proveedor.nombreComercialProveedor}
            onChangeText={(text) => setProveedor({ ...proveedor, nombreComercialProveedor: text })}
            placeholder="Nombre comercial (opcional)"
            placeholderTextColor="#9CA3AF"
            editable={!selectedSupplier}
          />

          <Text style={styles.label}>Dirección *</Text>
          <TextInput
            style={[styles.input, selectedSupplier && styles.inputDisabled]}
            value={proveedor.direccionProveedor}
            onChangeText={(text) => setProveedor({ ...proveedor, direccionProveedor: text })}
            placeholder="Av. Principal 123"
            placeholderTextColor="#9CA3AF"
            editable={!selectedSupplier}
          />

          <View style={styles.row}>
            <View style={styles.column}>
              <Text style={styles.label}>Departamento</Text>
              <TextInput
                style={[styles.input, selectedSupplier && styles.inputDisabled]}
                value={proveedor.departamentoProveedor}
                onChangeText={(text) => setProveedor({ ...proveedor, departamentoProveedor: text })}
                placeholder="LIMA"
                placeholderTextColor="#9CA3AF"
                editable={!selectedSupplier}
              />
            </View>
            <View style={styles.column}>
              <Text style={styles.label}>Provincia</Text>
              <TextInput
                style={[styles.input, selectedSupplier && styles.inputDisabled]}
                value={proveedor.provinciaProveedor}
                onChangeText={(text) => setProveedor({ ...proveedor, provinciaProveedor: text })}
                placeholder="LIMA"
                placeholderTextColor="#9CA3AF"
                editable={!selectedSupplier}
              />
            </View>
          </View>

          <Text style={styles.label}>Distrito</Text>
          <TextInput
            style={[styles.input, selectedSupplier && styles.inputDisabled]}
            value={proveedor.distritoProveedor}
            onChangeText={(text) => setProveedor({ ...proveedor, distritoProveedor: text })}
            placeholder="MIRAFLORES"
            placeholderTextColor="#9CA3AF"
            editable={!selectedSupplier}
          />

          <Text style={styles.label}>Ubigeo</Text>
          <TextInput
            style={[styles.input, selectedSupplier && styles.inputDisabled]}
            value={proveedor.ubigeoProveedor}
            onChangeText={(text) => setProveedor({ ...proveedor, ubigeoProveedor: text })}
            placeholder="150122"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            maxLength={6}
            editable={!selectedSupplier}
          />
        </View>

        {/* Documentos Relacionados */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📋 Documentos Relacionados</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddItemModal(true)}
            >
              <Ionicons name="add-circle" size={24} color="#8B5CF6" />
            </TouchableOpacity>
          </View>

          {items.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyText}>No hay documentos agregados</Text>
              <Text style={styles.emptySubtext}>
                Agregue las facturas o documentos a los que se aplicará la retención
              </Text>
            </View>
          ) : (
            <View style={styles.itemsList}>
              {items.map((item, index) => (
                <View key={index} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemTitle}>
                      {TIPO_DOCUMENTO_OPTIONS.find(t => t.value === item.tipoDocumentoRelacionado)?.label} {item.numeroDocumentoRelacionado}
                    </Text>
                    <TouchableOpacity onPress={() => handleRemoveItem(index)}>
                      <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemDetailText}>
                      Fecha: {item.fechaEmisionDocumentoRelacionado}
                    </Text>
                    <Text style={styles.itemDetailText}>
                      Total Doc: {item.tipoMonedaDocumentoRelacionado} {item.importeTotalDocumentoRelacionado.toFixed(2)}
                    </Text>
                    <Text style={styles.itemDetailText}>
                      Pago: {item.monedaPago} {item.importePagoSinRetencion.toFixed(2)}
                    </Text>
                    <Text style={styles.itemDetailTextBold}>
                      Retenido: {item.monedaImporteRetenido} {item.importeRetenido.toFixed(2)}
                    </Text>
                    <Text style={styles.itemDetailTextSuccess}>
                      Neto: {item.monedaMontoNetoPagado} {item.importeTotalPagarNeto.toFixed(2)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Totales */}
        {items.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>💰 Totales</Text>
            <View style={styles.totalsContainer}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Pagado:</Text>
                <Text style={styles.totalValue}>
                  {tipoMoneda} {importeTotalPagado.toFixed(2)}
                </Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Retenido:</Text>
                <Text style={styles.totalValueHighlight}>
                  {tipoMoneda} {importeTotalRetenido.toFixed(2)}
                </Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabelBold}>Total Neto:</Text>
                <Text style={styles.totalValueBold}>
                  {tipoMoneda} {(importeTotalPagado - importeTotalRetenido).toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Observaciones */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📝 Observaciones</Text>
          <TextInput
            style={styles.textArea}
            value={observaciones}
            onChangeText={setObservaciones}
            placeholder="Observaciones adicionales (opcional)"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Botón de Envío */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="send" size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>Emitir Retención</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Date Picker */}
      <DatePicker
        visible={showFechaEmisionPicker}
        date={fechaEmision}
        onConfirm={(date) => {
          setFechaEmision(formatDateToString(date));
          setShowFechaEmisionPicker(false);
        }}
        onCancel={() => setShowFechaEmisionPicker(false)}
      />

      {/* Modal para agregar item */}
      <AddItemModal
        visible={showAddItemModal}
        onClose={() => setShowAddItemModal(false)}
        onAdd={handleAddItem}
        tasaRetencion={tasaRetencion}
        tipoMoneda={tipoMoneda}
        nextItemNumber={items.length + 1}
      />
    </SafeAreaView>
  );
};

// Modal para agregar item
interface AddItemModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (item: RetencionItemDto) => void;
  tasaRetencion: number;
  tipoMoneda: 'PEN' | 'USD';
  nextItemNumber: number;
}

const AddItemModal: React.FC<AddItemModalProps> = ({
  visible,
  onClose,
  onAdd,
  tasaRetencion,
  tipoMoneda,
  nextItemNumber,
}) => {
  // Modo de entrada: 'search' o 'manual'
  const [inputMode, setInputMode] = useState<'search' | 'manual'>('search');

  // Búsqueda de facturas
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Sale[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchingSales, setSearchingSales] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  // Datos del item
  const [tipoDocumento, setTipoDocumento] = useState<'01' | '03' | '07' | '08'>('01');
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [fechaEmision, setFechaEmision] = useState(formatDateToString(new Date()));
  const [showFechaEmisionPicker, setShowFechaEmisionPicker] = useState(false);
  const [importeTotal, setImporteTotal] = useState('');
  const [fechaPago, setFechaPago] = useState(formatDateToString(new Date()));
  const [showFechaPagoPicker, setShowFechaPagoPicker] = useState(false);
  const [importePago, setImportePago] = useState('');

  const searchSales = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    try {
      setSearchingSales(true);
      const response = await salesApi.getSales({
        search: query,
        limit: 10,
        includeDocuments: true,
        documentType: SaleDocumentType.FACTURA, // Solo facturas
      });
      setSearchResults(response.data || []);
      setShowSearchResults(true);
    } catch (error: any) {
      console.error('Error buscando facturas:', error);
      setSearchResults([]);
    } finally {
      setSearchingSales(false);
    }
  };

  const handleSelectSale = (sale: Sale) => {
    setSelectedSale(sale);
    setSearchQuery(sale.code);
    setShowSearchResults(false);

    // Obtener el documento principal (factura)
    const mainDocument = sale.documents?.find(doc => doc.documentType === SaleDocumentType.FACTURA);

    if (mainDocument) {
      // Mapear tipo de documento de Sales a Bizlinks
      let bizlinksTipoDoc: '01' | '03' | '07' | '08' = '01';
      switch (mainDocument.documentType) {
        case SaleDocumentType.FACTURA:
          bizlinksTipoDoc = '01';
          break;
        case SaleDocumentType.BOLETA:
          bizlinksTipoDoc = '03';
          break;
        case SaleDocumentType.NOTA_CREDITO:
          bizlinksTipoDoc = '07';
          break;
        case SaleDocumentType.NOTA_DEBITO:
          bizlinksTipoDoc = '08';
          break;
      }

      setTipoDocumento(bizlinksTipoDoc);
      setNumeroDocumento(mainDocument.fullNumber);
      setFechaEmision(mainDocument.issueDate);

      // Convertir de centavos a unidades
      const totalAmount = sale.totalCents / 100;
      setImporteTotal(totalAmount.toString());
      setImportePago(totalAmount.toString());
    }
  };

  const handleClearSale = () => {
    setSelectedSale(null);
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
    setNumeroDocumento('');
    setFechaEmision(formatDateToString(new Date()));
    setImporteTotal('');
    setImportePago('');
  };

  const calcularRetencion = () => {
    const pago = parseFloat(importePago) || 0;
    const retenido = pago * (tasaRetencion / 100);
    const neto = pago - retenido;
    return { retenido, neto };
  };

  const handleAdd = () => {
    if (!numeroDocumento.trim()) {
      Alert.alert('Error', 'Debe ingresar el número de documento');
      return;
    }
    if (!importeTotal || parseFloat(importeTotal) <= 0) {
      Alert.alert('Error', 'Debe ingresar el importe total del documento');
      return;
    }
    if (!importePago || parseFloat(importePago) <= 0) {
      Alert.alert('Error', 'Debe ingresar el importe del pago');
      return;
    }

    const { retenido, neto } = calcularRetencion();

    const item: RetencionItemDto = {
      numeroOrdenItem: nextItemNumber,
      tipoDocumentoRelacionado: tipoDocumento,
      numeroDocumentoRelacionado: numeroDocumento,
      fechaEmisionDocumentoRelacionado: fechaEmision,
      importeTotalDocumentoRelacionado: parseFloat(importeTotal),
      tipoMonedaDocumentoRelacionado: tipoMoneda,
      fechaPago,
      numeroPago: 1,
      importePagoSinRetencion: parseFloat(importePago),
      monedaPago: tipoMoneda,
      importeRetenido: retenido,
      monedaImporteRetenido: tipoMoneda,
      fechaRetencion: fechaPago,
      importeTotalPagarNeto: neto,
      monedaMontoNetoPagado: tipoMoneda,
    };

    onAdd(item);

    // Reset form
    setInputMode('search');
    setSelectedSale(null);
    setSearchQuery('');
    setNumeroDocumento('');
    setFechaEmision(formatDateToString(new Date()));
    setImporteTotal('');
    setFechaPago(formatDateToString(new Date()));
    setImportePago('');
  };

  const { retenido, neto } = calcularRetencion();

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Agregar Documento</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Selector de modo */}
            <View style={styles.modeSelector}>
              <TouchableOpacity
                style={[styles.modeButton, inputMode === 'search' && styles.modeButtonActive]}
                onPress={() => {
                  setInputMode('search');
                  handleClearSale();
                }}
              >
                <Ionicons
                  name="search"
                  size={20}
                  color={inputMode === 'search' ? '#8B5CF6' : '#6B7280'}
                />
                <Text style={[styles.modeButtonText, inputMode === 'search' && styles.modeButtonTextActive]}>
                  Buscar Factura
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeButton, inputMode === 'manual' && styles.modeButtonActive]}
                onPress={() => {
                  setInputMode('manual');
                  handleClearSale();
                }}
              >
                <Ionicons
                  name="create"
                  size={20}
                  color={inputMode === 'manual' ? '#8B5CF6' : '#6B7280'}
                />
                <Text style={[styles.modeButtonText, inputMode === 'manual' && styles.modeButtonTextActive]}>
                  Ingresar Manual
                </Text>
              </TouchableOpacity>
            </View>

            {/* Modo: Buscar Factura */}
            {inputMode === 'search' && (
              <>
                <Text style={styles.label}>Buscar Factura</Text>
                <View style={styles.searchContainer}>
                  <View style={styles.searchInputContainer}>
                    <Ionicons name="search" size={20} color="#6B7280" style={styles.searchIcon} />
                    <TextInput
                      style={styles.searchInput}
                      value={searchQuery}
                      onChangeText={(text) => {
                        setSearchQuery(text);
                        searchSales(text);
                      }}
                      placeholder="Buscar por código o número de factura..."
                      placeholderTextColor="#9CA3AF"
                    />
                    {searchingSales && (
                      <ActivityIndicator size="small" color="#8B5CF6" style={styles.searchLoader} />
                    )}
                  </View>

                  {/* Resultados de búsqueda */}
                  {showSearchResults && searchResults.length > 0 && (
                    <View style={styles.searchResultsContainer}>
                      <ScrollView style={styles.searchResultsList} nestedScrollEnabled>
                        {searchResults.map((sale) => {
                          const mainDocument = sale.documents?.find(doc => doc.documentType === SaleDocumentType.FACTURA);
                          return (
                            <TouchableOpacity
                              key={sale.id}
                              style={styles.searchResultItem}
                              onPress={() => handleSelectSale(sale)}
                            >
                              <View style={styles.searchResultContent}>
                                <Text style={styles.searchResultName}>
                                  {mainDocument?.fullNumber || sale.code}
                                </Text>
                                <Text style={styles.searchResultRuc}>
                                  {sale.companySnapshot?.razonSocial || sale.customerSnapshot?.fullName}
                                </Text>
                                <Text style={styles.searchResultAddress}>
                                  Total: {tipoMoneda} {(sale.totalCents / 100).toFixed(2)} | {sale.saleDate}
                                </Text>
                              </View>
                              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}

                  {showSearchResults && searchResults.length === 0 && searchQuery.length >= 2 && !searchingSales && (
                    <View style={styles.noResultsContainer}>
                      <Ionicons name="search-outline" size={32} color="#9CA3AF" />
                      <Text style={styles.noResultsText}>No se encontraron facturas</Text>
                      <Text style={styles.noResultsSubtext}>Intenta con otro término de búsqueda</Text>
                    </View>
                  )}
                </View>

                {selectedSale && (
                  <View style={styles.selectedSupplierBadge}>
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    <Text style={styles.selectedSupplierText}>
                      Factura seleccionada: {selectedSale.documents?.find(d => d.documentType === SaleDocumentType.FACTURA)?.fullNumber || selectedSale.code}
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* Campos del documento (compartidos entre ambos modos) */}
            <Text style={styles.label}>Tipo de Documento *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={tipoDocumento}
                onValueChange={(value) => setTipoDocumento(value as '01' | '03' | '07' | '08')}
                style={styles.picker}
                enabled={inputMode === 'manual'}
              >
                {TIPO_DOCUMENTO_OPTIONS.map(option => (
                  <Picker.Item key={option.value} label={option.label} value={option.value} />
                ))}
              </Picker>
            </View>

            <Text style={styles.label}>Número de Documento *</Text>
            <TextInput
              style={[styles.input, selectedSale && styles.inputDisabled]}
              value={numeroDocumento}
              onChangeText={setNumeroDocumento}
              placeholder="F001-00000050"
              placeholderTextColor="#9CA3AF"
              editable={inputMode === 'manual'}
            />

            <Text style={styles.label}>Fecha de Emisión *</Text>
            <DatePickerButton
              label=""
              value={fechaEmision}
              onPress={() => inputMode === 'manual' && setShowFechaEmisionPicker(true)}
            />

            <Text style={styles.label}>Importe Total del Documento *</Text>
            <TextInput
              style={[styles.input, selectedSale && styles.inputDisabled]}
              value={importeTotal}
              onChangeText={setImporteTotal}
              placeholder="0.00"
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
              editable={inputMode === 'manual'}
            />

            <Text style={styles.label}>Fecha de Pago *</Text>
            <DatePickerButton
              label=""
              value={fechaPago}
              onPress={() => setShowFechaPagoPicker(true)}
            />

            <Text style={styles.label}>Importe del Pago *</Text>
            <TextInput
              style={styles.input}
              value={importePago}
              onChangeText={setImportePago}
              placeholder="0.00"
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
            />

            {importePago && parseFloat(importePago) > 0 && (
              <View style={styles.calculationCard}>
                <Text style={styles.calculationTitle}>Cálculo de Retención ({tasaRetencion}%)</Text>
                <View style={styles.calculationRow}>
                  <Text style={styles.calculationLabel}>Importe Pago:</Text>
                  <Text style={styles.calculationValue}>
                    {tipoMoneda} {parseFloat(importePago).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.calculationRow}>
                  <Text style={styles.calculationLabel}>Retención:</Text>
                  <Text style={styles.calculationValueHighlight}>
                    {tipoMoneda} {retenido.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.calculationRow}>
                  <Text style={styles.calculationLabelBold}>Neto a Pagar:</Text>
                  <Text style={styles.calculationValueBold}>
                    {tipoMoneda} {neto.toFixed(2)}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.modalCancelButton} onPress={onClose}>
              <Text style={styles.modalCancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalAddButton} onPress={handleAdd}>
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.modalAddButtonText}>Agregar</Text>
            </TouchableOpacity>
          </View>

          <DatePicker
            visible={showFechaEmisionPicker}
            date={fechaEmision}
            onConfirm={(date) => {
              setFechaEmision(formatDateToString(date));
              setShowFechaEmisionPicker(false);
            }}
            onCancel={() => setShowFechaEmisionPicker(false)}
          />

          <DatePicker
            visible={showFechaPagoPicker}
            date={fechaPago}
            onConfirm={(date) => {
              setFechaPago(formatDateToString(date));
              setShowFechaPagoPicker(false);
            }}
            onCancel={() => setShowFechaPagoPicker(false)}
          />
        </View>
      </View>
    </Modal>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  noSeriesContainer: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  noSeriesText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginTop: 8,
    textAlign: 'center',
  },
  noSeriesSubtext: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  addButton: {
    padding: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
  },
  hint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2937',
  },
  inputDisabled: {
    backgroundColor: '#F3F4F6',
    color: '#6B7280',
  },
  textArea: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2937',
    minHeight: 100,
  },
  pickerContainer: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    color: '#1F2937',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  column: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
  itemsList: {
    gap: 12,
  },
  itemCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  itemDetails: {
    gap: 4,
  },
  itemDetailText: {
    fontSize: 13,
    color: '#6B7280',
  },
  itemDetailTextBold: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F59E0B',
  },
  itemDetailTextSuccess: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  totalsContainer: {
    gap: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  totalLabelBold: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  totalValueBold: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
  totalValueHighlight: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#C4B5FD',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    maxHeight: 500,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  modalAddButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#8B5CF6',
    gap: 8,
  },
  modalAddButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  calculationCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  calculationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4338CA',
    marginBottom: 8,
  },
  calculationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  calculationLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  calculationValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  calculationLabelBold: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  calculationValueBold: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10B981',
  },
  calculationValueHighlight: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F59E0B',
  },
  // Supplier search styles
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2937',
  },
  searchLoader: {
    marginLeft: 8,
  },
  searchResultsContainer: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxHeight: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchResultsList: {
    maxHeight: 250,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  searchResultRuc: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  searchResultAddress: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  noResultsContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  noResultsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 8,
  },
  noResultsSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
  selectedSupplierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  selectedSupplierText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#065F46',
    flex: 1,
  },
  // Mode selector styles
  modeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  modeButtonActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#8B5CF6',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  modeButtonTextActive: {
    color: '#8B5CF6',
  },
});
