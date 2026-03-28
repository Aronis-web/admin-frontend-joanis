import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useBizlinksDocuments, useBizlinksConfig } from '../../hooks/useBizlinks';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import {
  EmitirFacturaDto,
  BizlinksItemDto,
  BizlinksCurrency,
  BizlinksUnitMeasure,
  BizlinksTaxType,
  BizlinksDocumentIdentityType,
  BizlinksDocumentType,
} from '../../types/bizlinks';
import {
  formatDateForBizlinks,
  formatTimeForBizlinks,
} from '../../utils/bizlinksHelpers';
import { CustomerAutocomplete } from './CustomerAutocomplete';
import { ProductAutocomplete } from './ProductAutocomplete';
import { Customer } from '../../types/customers';
import { Product } from '../../services/api/products';

interface EmitirFacturaFormProps {
  companyId: string;
  siteId?: string;
  correlativeId?: string;
  serieNumero?: string;
  seriesId?: string;
  series?: string;
  documentType?: string;
  onSuccess?: (documentId: string) => void;
  onCancel?: () => void;
}

export const EmitirFacturaForm: React.FC<EmitirFacturaFormProps> = ({
  companyId,
  siteId,
  correlativeId,
  serieNumero,
  seriesId,
  series,
  documentType,
  onSuccess,
  onCancel,
}) => {
  const { emitirFactura, emitirComprobante, loading } = useBizlinksDocuments();
  const { getActiveConfig, loading: loadingConfig } = useBizlinksConfig();
  const [configLoaded, setConfigLoaded] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const now = new Date();
  // Si se proporcionó una serie desde la selección, usarla
  const initialSerieNumero = series || serieNumero || '';
  const isSeriesPreSelected = Boolean(seriesId && series);

  const [formData, setFormData] = useState({
    // Datos generales
    serieNumero: initialSerieNumero,
    fechaEmision: formatDateForBizlinks(now),
    horaEmision: formatTimeForBizlinks(now),
    fechaVencimiento: '',
    observaciones: '',
    ordenCompra: '',
    guiaRemision: '',

    // Emisor (se llenará desde la config)
    rucEmisor: '',
    razonSocialEmisor: '',
    nombreComercialEmisor: '',
    ubigeoEmisor: '',
    direccionEmisor: '',
    urbanizacionEmisor: '',
    provinciaEmisor: '',
    departamentoEmisor: '',
    distritoEmisor: '',
    codigoPaisEmisor: 'PE',
    correoEmisor: '',
    telefonoEmisor: '',

    // Adquiriente
    tipoDocumentoAdquiriente: '6' as string,
    numeroDocumentoAdquiriente: '',
    razonSocialAdquiriente: '',
    direccionAdquiriente: '',
    correoAdquiriente: '',
    telefonoAdquiriente: '',

    // Moneda
    tipoMoneda: BizlinksCurrency.PEN,
  });

  const [items, setItems] = useState<BizlinksItemDto[]>([
    {
      numeroOrdenItem: 1,
      cantidad: 1,
      unidadMedida: BizlinksUnitMeasure.NIU,
      codigoProducto: '',
      codigoProductoSunat: '',
      descripcion: '',
      valorUnitario: 0,
      precioVentaUnitario: 0,
      codigoAfectacionIgv: BizlinksTaxType.IGV,
      porcentajeIgv: 18,
      montoIgvItem: 0,
      valorVentaItem: 0,
      descuentoItem: 0,
    },
  ]);

  // Cargar configuración activa al montar el componente
  useEffect(() => {
    const loadActiveConfig = async () => {
      if (!companyId) {
        Alert.alert('Error', 'No se ha seleccionado una empresa');
        return;
      }

      try {
        console.log('🔍 Cargando configuración activa para companyId:', companyId, 'siteId:', siteId);
        const config = await getActiveConfig(companyId, siteId);
        console.log('✅ Configuración activa cargada:', config);

        // Llenar los datos del emisor desde la configuración
        // Asegurar que ubigeo tenga 6 dígitos (agregar 0 al inicio si tiene 5)
        const ubigeo = config.ubigeo.length === 5 ? `0${config.ubigeo}` : config.ubigeo;

        setFormData((prev) => ({
          ...prev,
          rucEmisor: config.ruc,
          razonSocialEmisor: config.razonSocial,
          nombreComercialEmisor: config.nombreComercial || '',
          ubigeoEmisor: ubigeo,
          direccionEmisor: config.domicilioFiscal,
          urbanizacionEmisor: config.urbanizacion || '',
          provinciaEmisor: config.provincia,
          departamentoEmisor: config.departamento,
          distritoEmisor: config.distrito,
          codigoPaisEmisor: 'PE',
          correoEmisor: config.email,
          telefonoEmisor: config.telefono || '',
        }));

        setConfigLoaded(true);
      } catch (error: any) {
        console.error('❌ Error al cargar configuración activa:', error);
        const errorMessage = error.response?.data?.message || error.message || 'No se encontró una configuración activa';
        Alert.alert(
          'Configuración no encontrada',
          `${errorMessage}\n\nPor favor, configure Bizlinks antes de emitir documentos.`,
          [
            {
              text: 'Cancelar',
              onPress: () => onCancel?.(),
              style: 'cancel',
            },
          ]
        );
      }
    };

    loadActiveConfig();
  }, [companyId, siteId]);

  // Manejar selección de cliente
  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);

    // Determinar tipo de documento
    let tipoDoc = BizlinksDocumentIdentityType.DNI;
    if (customer.documentType === 'RUC') {
      tipoDoc = BizlinksDocumentIdentityType.RUC;
    } else if (customer.documentType === 'CE') {
      tipoDoc = BizlinksDocumentIdentityType.CARNET_EXTRANJERIA;
    } else if (customer.documentType === 'PASSPORT') {
      tipoDoc = BizlinksDocumentIdentityType.PASAPORTE;
    }

    // Llenar datos del cliente automáticamente
    setFormData((prev) => ({
      ...prev,
      tipoDocumentoAdquiriente: tipoDoc,
      numeroDocumentoAdquiriente: customer.documentNumber,
      razonSocialAdquiriente: customer.razonSocial || customer.fullName,
      correoAdquiriente: customer.email || '',
      direccionAdquiriente: customer.direccion || '',
      telefonoAdquiriente: customer.phone || '',
    }));
  };

  // Manejar selección de producto
  const handleSelectProduct = (product: Product) => {
    // Obtener la primera presentación o usar valores por defecto
    const presentation = product.presentations?.[0];
    const precioVenta = presentation?.salePrice || 0;
    const precioConIgv = precioVenta * 1.18;

    const newItem: BizlinksItemDto = {
      numeroOrdenItem: items.length + 1,
      cantidad: 1,
      unidadMedida: BizlinksUnitMeasure.NIU,
      codigoProducto: product.sku || '',
      codigoProductoSunat: product.barcode || '',
      descripcion: product.title,
      valorUnitario: precioVenta,
      precioVentaUnitario: precioConIgv,
      codigoAfectacionIgv: BizlinksTaxType.IGV,
      porcentajeIgv: 18,
      montoIgvItem: precioVenta * 0.18,
      valorVentaItem: precioVenta,
      descuentoItem: 0,
    };

    setItems([...items, newItem]);
  };

  // Calcular totales
  const calcularTotales = () => {
    let totalValorVenta = 0;
    let totalIgv = 0;
    let totalOperacionesGravadas = 0;
    let totalOperacionesExoneradas = 0;
    let totalOperacionesInafectas = 0;

    items.forEach((item) => {
      totalValorVenta += item.valorVentaItem;
      totalIgv += item.montoIgvItem;

      if (item.codigoAfectacionIgv.startsWith('1')) {
        totalOperacionesGravadas += item.valorVentaItem;
      } else if (item.codigoAfectacionIgv === BizlinksTaxType.EXONERADO) {
        totalOperacionesExoneradas += item.valorVentaItem;
      } else if (item.codigoAfectacionIgv === BizlinksTaxType.INAFECTO) {
        totalOperacionesInafectas += item.valorVentaItem;
      }
    });

    const totalPrecioVenta = totalValorVenta + totalIgv;
    const totalVenta = totalPrecioVenta;

    return {
      totalValorVenta,
      totalPrecioVenta,
      totalIgv,
      totalVenta,
      totalOperacionesGravadas,
      totalOperacionesExoneradas,
      totalOperacionesInafectas,
    };
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        numeroOrdenItem: items.length + 1,
        cantidad: 1,
        unidadMedida: BizlinksUnitMeasure.NIU,
        codigoProducto: '',
        codigoProductoSunat: '',
        descripcion: '',
        valorUnitario: 0,
        precioVentaUnitario: 0,
        codigoAfectacionIgv: BizlinksTaxType.IGV,
        porcentajeIgv: 18,
        montoIgvItem: 0,
        valorVentaItem: 0,
        descuentoItem: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) {
      Alert.alert('Error', 'Debe haber al menos un item');
      return;
    }
    const newItems = items.filter((_, i) => i !== index);
    // Renumerar items
    newItems.forEach((item, i) => {
      item.numeroOrdenItem = i + 1;
    });
    setItems(newItems);
  };

  const handleItemChange = (index: number, field: keyof BizlinksItemDto, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    // Recalcular valores si cambia cantidad o precio
    if (['cantidad', 'valorUnitario', 'porcentajeIgv'].includes(field)) {
      const item = newItems[index];
      const valorVentaItem = item.cantidad * item.valorUnitario;
      const montoIgvItem = (valorVentaItem * item.porcentajeIgv) / 100;
      const precioVentaUnitario = item.valorUnitario + (item.valorUnitario * item.porcentajeIgv) / 100;

      newItems[index] = {
        ...item,
        valorVentaItem,
        montoIgvItem,
        precioVentaUnitario,
      };
    }

    setItems(newItems);
  };

  const handleSubmit = async () => {
    try {
      // Validaciones
      if (!formData.serieNumero) {
        Alert.alert('Error', 'La serie y número son requeridos');
        return;
      }

      if (!formData.numeroDocumentoAdquiriente) {
        Alert.alert('Error', 'El documento del cliente es requerido');
        return;
      }

      if (!formData.razonSocialAdquiriente) {
        Alert.alert('Error', 'La razón social del cliente es requerida');
        return;
      }

      // Validar tipo de documento según el tipo de comprobante
      if (documentType === BizlinksDocumentType.BOLETA) {
        // Boletas solo para personas naturales (DNI, CE, Pasaporte)
        if (formData.tipoDocumentoAdquiriente === BizlinksDocumentIdentityType.RUC) {
          Alert.alert(
            'Error de Validación',
            'Las boletas solo pueden emitirse para personas naturales (DNI, Carnet de Extranjería o Pasaporte).\n\nPara empresas (RUC) debe emitir una Factura.'
          );
          return;
        }
      } else if (documentType === BizlinksDocumentType.FACTURA) {
        // Facturas solo para empresas (RUC)
        if (formData.tipoDocumentoAdquiriente !== BizlinksDocumentIdentityType.RUC) {
          Alert.alert(
            'Error de Validación',
            'Las facturas solo pueden emitirse para empresas (RUC).\n\nPara personas naturales debe emitir una Boleta.'
          );
          return;
        }
      }

      if (items.length === 0) {
        Alert.alert('Error', 'Debe agregar al menos un item');
        return;
      }

      // Validar items
      for (const item of items) {
        if (!item.descripcion) {
          Alert.alert('Error', `El item ${item.numeroOrdenItem} debe tener descripción`);
          return;
        }
        if (item.cantidad <= 0) {
          Alert.alert('Error', `El item ${item.numeroOrdenItem} debe tener cantidad mayor a 0`);
          return;
        }
        if (item.valorUnitario <= 0) {
          Alert.alert('Error', `El item ${item.numeroOrdenItem} debe tener valor unitario mayor a 0`);
          return;
        }
      }

      const totales = calcularTotales();

      // Limpiar items: eliminar campos que el backend no espera
      const cleanedItems = items.map(({ codigoProducto, descuentoItem, ...item }) => item);

      const dto: EmitirFacturaDto = {
        correlativeId: seriesId || correlativeId,
        serieNumero: formData.serieNumero,
        fechaEmision: formData.fechaEmision,
        horaEmision: formData.horaEmision,
        fechaVencimiento: formData.fechaVencimiento || undefined,
        emisor: {
          rucEmisor: formData.rucEmisor,
          razonSocialEmisor: formData.razonSocialEmisor,
          nombreComercialEmisor: formData.nombreComercialEmisor || undefined,
          ubigeoEmisor: formData.ubigeoEmisor,
          direccionEmisor: formData.direccionEmisor,
          urbanizacionEmisor: formData.urbanizacionEmisor || undefined,
          provinciaEmisor: formData.provinciaEmisor,
          departamentoEmisor: formData.departamentoEmisor,
          distritoEmisor: formData.distritoEmisor,
          codigoPaisEmisor: formData.codigoPaisEmisor,
          correoEmisor: formData.correoEmisor || undefined,
          telefonoEmisor: formData.telefonoEmisor || undefined,
        },
        adquiriente: {
          tipoDocumentoAdquiriente: formData.tipoDocumentoAdquiriente,
          numeroDocumentoAdquiriente: formData.numeroDocumentoAdquiriente,
          razonSocialAdquiriente: formData.razonSocialAdquiriente,
          direccionAdquiriente: formData.direccionAdquiriente || undefined,
          correoAdquiriente: formData.correoAdquiriente || undefined,
          telefonoAdquiriente: formData.telefonoAdquiriente || undefined,
        },
        items: cleanedItems,
        totales: {
          ...totales,
          tipoMoneda: formData.tipoMoneda,
        },
        observaciones: formData.observaciones || undefined,
        ordenCompra: formData.ordenCompra || undefined,
        guiaRemision: formData.guiaRemision || undefined,
      };

      console.log('📝 DTO a enviar:', JSON.stringify(dto, null, 2));
      console.log('📋 Tipo de documento:', documentType);

      // Usar el método correcto según el tipo de documento
      let result;
      if (documentType && emitirComprobante) {
        result = await emitirComprobante(dto, documentType);
      } else {
        // Fallback al método original si no se especifica tipo
        result = await emitirFactura(dto);
      }

      Alert.alert('Éxito', 'Comprobante emitido correctamente');
      onSuccess?.(result.id);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al emitir el comprobante');
    }
  };

  const totales = calcularTotales();

  // Mostrar indicador de carga mientras se carga la configuración
  if (loadingConfig || !configLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Cargando configuración de Bizlinks...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Datos Generales</Text>

        {isSeriesPreSelected ? (
          <>
            <Text style={styles.label}>Serie Seleccionada</Text>
            <View style={styles.seriesSelectedContainer}>
              <View style={styles.seriesSelectedBadge}>
                <Text style={styles.seriesSelectedText}>{formData.serieNumero}</Text>
              </View>
              <Text style={styles.seriesSelectedNote}>
                ✓ Serie asignada automáticamente
              </Text>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.label}>Serie y Número *</Text>
            <TextInput
              style={styles.input}
              value={formData.serieNumero}
              onChangeText={(text) => setFormData({ ...formData, serieNumero: text })}
              placeholder="F001-00000001"
              editable={!serieNumero}
            />
          </>
        )}

        <Text style={styles.label}>Fecha de Emisión *</Text>
        <TextInput
          style={styles.input}
          value={formData.fechaEmision}
          onChangeText={(text) => setFormData({ ...formData, fechaEmision: text })}
          placeholder="YYYY-MM-DD"
        />

        <Text style={styles.label}>Moneda</Text>
        <Picker
          selectedValue={formData.tipoMoneda}
          onValueChange={(value) => setFormData({ ...formData, tipoMoneda: value })}
          style={styles.picker}
        >
          <Picker.Item label="Soles (PEN)" value={BizlinksCurrency.PEN} />
          <Picker.Item label="Dólares (USD)" value={BizlinksCurrency.USD} />
          <Picker.Item label="Euros (EUR)" value={BizlinksCurrency.EUR} />
        </Picker>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cliente</Text>

        <Text style={styles.label}>Buscar Cliente</Text>
        <CustomerAutocomplete
          onSelectCustomer={handleSelectCustomer}
          placeholder={
            documentType === BizlinksDocumentType.BOLETA
              ? 'Buscar persona natural (DNI, CE, Pasaporte)...'
              : documentType === BizlinksDocumentType.FACTURA
              ? 'Buscar empresa (RUC)...'
              : 'Buscar por nombre, RUC o DNI...'
          }
          documentTypeFilter={
            documentType === BizlinksDocumentType.BOLETA
              ? 'DNI'
              : documentType === BizlinksDocumentType.FACTURA
              ? 'RUC'
              : 'ALL'
          }
        />

        {selectedCustomer && (
          <View style={styles.customerSelectedInfo}>
            <Text style={styles.customerSelectedLabel}>Cliente seleccionado:</Text>
            <Text style={styles.customerSelectedName}>
              {formData.razonSocialAdquiriente}
            </Text>
            <Text style={styles.customerSelectedDoc}>
              {formData.tipoDocumentoAdquiriente === BizlinksDocumentIdentityType.RUC ? 'RUC' : 'DNI'}: {formData.numeroDocumentoAdquiriente}
            </Text>
          </View>
        )}

        {!selectedCustomer && (
          <>
            <Text style={styles.label}>Tipo de Documento *</Text>
            <Picker
              selectedValue={formData.tipoDocumentoAdquiriente}
              onValueChange={(value) =>
                setFormData({ ...formData, tipoDocumentoAdquiriente: value })
              }
              style={styles.picker}
            >
              <Picker.Item label="DNI" value={BizlinksDocumentIdentityType.DNI} />
              <Picker.Item label="RUC" value={BizlinksDocumentIdentityType.RUC} />
              <Picker.Item
                label="Carnet de Extranjería"
                value={BizlinksDocumentIdentityType.CARNET_EXTRANJERIA}
              />
              <Picker.Item label="Pasaporte" value={BizlinksDocumentIdentityType.PASAPORTE} />
            </Picker>

            <Text style={styles.label}>Número de Documento *</Text>
            <TextInput
              style={styles.input}
              value={formData.numeroDocumentoAdquiriente}
              onChangeText={(text) =>
                setFormData({ ...formData, numeroDocumentoAdquiriente: text })
              }
              placeholder="20123456789"
              keyboardType="numeric"
            />

            <Text style={styles.label}>Razón Social / Nombre *</Text>
            <TextInput
              style={styles.input}
              value={formData.razonSocialAdquiriente}
              onChangeText={(text) => setFormData({ ...formData, razonSocialAdquiriente: text })}
              placeholder="CLIENTE SAC"
            />
          </>
        )}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={formData.correoAdquiriente}
          onChangeText={(text) => setFormData({ ...formData, correoAdquiriente: text })}
          placeholder="cliente@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Items</Text>
          <TouchableOpacity style={styles.addButton} onPress={handleAddItem}>
            <Text style={styles.addButtonText}>+ Agregar Item Manual</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Buscar Producto</Text>
        <ProductAutocomplete
          onSelectProduct={handleSelectProduct}
          placeholder="Buscar producto por nombre o código..."
          excludeProductIds={items.map(item => item.codigoProducto).filter(Boolean)}
        />

        {items.map((item, index) => (
          <View key={index} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemNumber}>Item {item.numeroOrdenItem}</Text>
              {items.length > 1 && (
                <TouchableOpacity onPress={() => handleRemoveItem(index)}>
                  <Text style={styles.removeButton}>Eliminar</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.label}>Descripción *</Text>
            <TextInput
              style={styles.input}
              value={item.descripcion}
              onChangeText={(text) => handleItemChange(index, 'descripcion', text)}
              placeholder="Descripción del producto/servicio"
            />

            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Text style={styles.label}>Cantidad *</Text>
                <TextInput
                  style={styles.input}
                  value={item.cantidad.toString()}
                  onChangeText={(text) =>
                    handleItemChange(index, 'cantidad', parseFloat(text) || 0)
                  }
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.halfWidth}>
                <Text style={styles.label}>Unidad</Text>
                <Picker
                  selectedValue={item.unidadMedida}
                  onValueChange={(value) => handleItemChange(index, 'unidadMedida', value)}
                  style={styles.picker}
                >
                  <Picker.Item label="Unidad" value={BizlinksUnitMeasure.NIU} />
                  <Picker.Item label="Servicio" value={BizlinksUnitMeasure.ZZ} />
                  <Picker.Item label="Kilogramo" value={BizlinksUnitMeasure.KGM} />
                  <Picker.Item label="Litro" value={BizlinksUnitMeasure.LTR} />
                </Picker>
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Text style={styles.label}>Valor Unitario *</Text>
                <TextInput
                  style={styles.input}
                  value={item.valorUnitario.toString()}
                  onChangeText={(text) =>
                    handleItemChange(index, 'valorUnitario', parseFloat(text) || 0)
                  }
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.halfWidth}>
                <Text style={styles.label}>IGV %</Text>
                <TextInput
                  style={styles.input}
                  value={item.porcentajeIgv.toString()}
                  onChangeText={(text) =>
                    handleItemChange(index, 'porcentajeIgv', parseFloat(text) || 0)
                  }
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.itemTotals}>
              <Text style={styles.itemTotalLabel}>Valor Venta:</Text>
              <Text style={styles.itemTotalValue}>
                {item.valorVentaItem.toFixed(2)}
              </Text>
            </View>

            <View style={styles.itemTotals}>
              <Text style={styles.itemTotalLabel}>IGV:</Text>
              <Text style={styles.itemTotalValue}>
                {item.montoIgvItem.toFixed(2)}
              </Text>
            </View>

            <View style={styles.itemTotals}>
              <Text style={styles.itemTotalLabel}>Precio Venta:</Text>
              <Text style={styles.itemTotalValueBold}>
                {item.precioVentaUnitario.toFixed(2)}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Totales</Text>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal:</Text>
          <Text style={styles.totalValue}>{totales.totalValorVenta.toFixed(2)}</Text>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>IGV (18%):</Text>
          <Text style={styles.totalValue}>{totales.totalIgv.toFixed(2)}</Text>
        </View>

        <View style={styles.totalRowFinal}>
          <Text style={styles.totalLabelFinal}>TOTAL:</Text>
          <Text style={styles.totalValueFinal}>{totales.totalVenta.toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.submitButton]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Emitir Factura</Text>
          )}
        </TouchableOpacity>

        {onCancel && (
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={onCancel}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Cancelar</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[5],
    backgroundColor: colors.background.secondary,
  },
  loadingText: {
    marginTop: spacing[4],
    fontSize: 16,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  section: {
    backgroundColor: colors.surface.primary,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.neutral[700],
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing[2],
    color: colors.neutral[600],
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    marginBottom: spacing[4],
    fontSize: 14,
    backgroundColor: colors.surface.primary,
  },
  picker: {
    marginBottom: spacing[4],
    color: colors.neutral[800],
  },
  row: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  halfWidth: {
    flex: 1,
  },
  addButton: {
    backgroundColor: colors.success[500],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.lg,
  },
  addButtonText: {
    color: colors.neutral[0],
    fontSize: 14,
    fontWeight: 'bold',
  },
  itemCard: {
    backgroundColor: colors.background.secondary,
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[4],
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  itemNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.neutral[700],
  },
  removeButton: {
    color: colors.danger[500],
    fontSize: 14,
    fontWeight: '600',
  },
  itemTotals: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[1],
  },
  itemTotalLabel: {
    fontSize: 14,
    color: colors.neutral[500],
  },
  itemTotalValue: {
    fontSize: 14,
    color: colors.neutral[700],
  },
  itemTotalValueBold: {
    fontSize: 14,
    color: colors.neutral[700],
    fontWeight: 'bold',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  totalLabel: {
    fontSize: 16,
    color: colors.neutral[500],
  },
  totalValue: {
    fontSize: 16,
    color: colors.neutral[700],
    fontWeight: '600',
  },
  totalRowFinal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    marginTop: spacing[2],
    backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.lg,
  },
  totalLabelFinal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.neutral[700],
  },
  totalValueFinal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.success[500],
  },
  buttonContainer: {
    padding: spacing[4],
    gap: spacing[3],
  },
  button: {
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  submitButton: {
    backgroundColor: colors.success[500],
  },
  cancelButton: {
    backgroundColor: colors.neutral[500],
  },
  buttonText: {
    color: colors.neutral[0],
    fontSize: 16,
    fontWeight: 'bold',
  },
  seriesSelectedContainer: {
    marginBottom: spacing[4],
  },
  seriesSelectedBadge: {
    backgroundColor: colors.primary[50],
    borderWidth: 2,
    borderColor: colors.primary[500],
    borderRadius: borderRadius.xl,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[5],
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  seriesSelectedText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary[700],
    letterSpacing: 1,
  },
  seriesSelectedNote: {
    fontSize: 13,
    color: colors.success[500],
    fontWeight: '600',
    textAlign: 'center',
  },
  customerSelectedInfo: {
    backgroundColor: colors.success[50],
    borderWidth: 1,
    borderColor: colors.success[500],
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    marginBottom: spacing[4],
  },
  customerSelectedLabel: {
    fontSize: 12,
    color: colors.success[600],
    fontWeight: '600',
    marginBottom: spacing[1],
  },
  customerSelectedName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.success[800],
    marginBottom: spacing[0.5],
  },
  customerSelectedDoc: {
    fontSize: 14,
    color: colors.success[700],
  },
});
