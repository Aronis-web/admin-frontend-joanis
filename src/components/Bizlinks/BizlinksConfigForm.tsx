import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { useBizlinksConfig } from '../../hooks/useBizlinks';
import config from '@/utils/config';
import {
  BizlinksConfig,
  CreateBizlinksConfigDto,
  UpdateBizlinksConfigDto,
} from '../../types/bizlinks';

interface BizlinksConfigFormProps {
  config?: BizlinksConfig;
  companyId: string;
  siteId?: string;
  onSuccess?: (config: BizlinksConfig) => void;
  onCancel?: () => void;
}

export const BizlinksConfigForm: React.FC<BizlinksConfigFormProps> = ({
  config,
  companyId,
  siteId,
  onSuccess,
  onCancel,
}) => {
  const { createConfig, updateConfig, testConnection, uploadLogo, deleteLogo, loading } = useBizlinksConfig();

  const [formData, setFormData] = useState({
    baseUrl: config?.baseUrl || 'http://localhost:8080',
    contextPath: config?.contextPath || '/einvoice/rest',
    ruc: config?.ruc || '',
    razonSocial: config?.razonSocial || '',
    nombreComercial: config?.nombreComercial || '',
    domicilioFiscal: config?.domicilioFiscal || '',
    ubigeo: config?.ubigeo || '',
    departamento: config?.departamento || '',
    provincia: config?.provincia || '',
    distrito: config?.distrito || '',
    urbanizacion: config?.urbanizacion || '',
    codigoPais: config?.codigoPais || 'PE',
    email: config?.email || '',
    telefono: config?.telefono || '',
    autoSend: config?.autoSend ?? true,
    autoDownloadPdf: config?.autoDownloadPdf ?? true,
    autoDownloadXml: config?.autoDownloadXml ?? true,
    timeoutSeconds: config?.timeoutSeconds || 30,
    isActive: config?.isActive ?? true,
    isProduction: config?.isProduction ?? false,
  });

  const [testing, setTesting] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(config?.logoUrl);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleSubmit = async () => {
    try {
      // Validaciones
      if (!formData.ruc || formData.ruc.length !== 11) {
        Alert.alert('Error', 'El RUC debe tener 11 dígitos');
        return;
      }

      if (!formData.razonSocial) {
        Alert.alert('Error', 'La razón social es requerida');
        return;
      }

      if (!formData.email) {
        Alert.alert('Error', 'El email es requerido');
        return;
      }

      if (!formData.ubigeo || formData.ubigeo.length < 5) {
        Alert.alert('Error', 'El ubigeo debe tener al menos 5 dígitos');
        return;
      }

      if (!companyId) {
        Alert.alert('Error', 'No se ha seleccionado una empresa');
        return;
      }

      // Asegurar que ubigeo tenga 6 dígitos (agregar 0 al inicio si tiene 5)
      const ubigeo = formData.ubigeo.length === 5 ? `0${formData.ubigeo}` : formData.ubigeo;

      let result: BizlinksConfig;

      if (config) {
        // Update
        console.log('📝 Actualizando configuración:', config.id);
        const updateData: UpdateBizlinksConfigDto = {
          ...formData,
          ubigeo,
        };
        console.log('📝 Datos a actualizar:', updateData);
        result = await updateConfig(config.id, updateData);
        Alert.alert('Éxito', 'Configuración actualizada correctamente');
      } else {
        // Create
        const createData: CreateBizlinksConfigDto = {
          ...formData,
          ubigeo,
          companyId,
          siteId,
        };
        console.log('📝 Creando nueva configuración:', createData);
        result = await createConfig(createData);
        console.log('✅ Configuración creada:', result);
        Alert.alert('Éxito', 'Configuración creada correctamente');
      }

      onSuccess?.(result);
    } catch (error: any) {
      console.error('❌ Error al guardar configuración:', error);
      console.error('❌ Error response:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);

      const errorMessage = error.response?.data?.message || error.message || 'Error al guardar la configuración';
      Alert.alert('Error', errorMessage);
    }
  };

  const handleTestConnection = async () => {
    if (!config?.id) {
      Alert.alert('Error', 'Debe guardar la configuración antes de probar la conexión');
      return;
    }

    setTesting(true);
    try {
      const result = await testConnection(config.id);
      if (result.success) {
        Alert.alert(
          'Conexión exitosa',
          `${result.message}\nTiempo de respuesta: ${result.responseTime}ms`
        );
      } else {
        Alert.alert('Error de conexión', result.message);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al probar la conexión');
    } finally {
      setTesting(false);
    }
  };

  const handleUploadLogo = async () => {
    if (!config?.id) {
      Alert.alert('Error', 'Debe guardar la configuración antes de subir un logo');
      return;
    }

    try {
      // Solicitar permisos
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permisos requeridos', 'Se necesitan permisos para acceder a la galería');
        return;
      }

      // Seleccionar imagen
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled) {
        return;
      }

      setUploadingLogo(true);

      const uri = result.assets[0].uri;

      // En React Native, necesitamos pasar un objeto con uri, type y name
      // No convertir a blob porque causa problemas en móvil
      let logoFile: any;

      if (Platform.OS === 'web') {
        // En web, convertir a blob
        const response = await fetch(uri);
        const blob = await response.blob();
        logoFile = blob;
      } else {
        // En móvil, pasar objeto con uri, type y name
        const fileName = uri.split('/').pop() || 'logo.jpg';
        const fileType = fileName.endsWith('.png') ? 'image/png' : 'image/jpeg';

        logoFile = {
          uri: uri,
          type: fileType,
          name: fileName,
        } as any;
      }

      // Subir logo
      const response = await uploadLogo(config.id, logoFile);

      // El backend puede retornar logoUrl o logoPath
      const newLogoUrl = (response as any).logoUrl || (response as any).logoPath;

      if (newLogoUrl) {
        // Si es una ruta relativa, construir la URL completa
        const fullLogoUrl = newLogoUrl.startsWith('http')
          ? newLogoUrl
          : `${config.API_URL}/${newLogoUrl}`;
        setLogoUrl(fullLogoUrl);
      }

      Alert.alert('Éxito', 'Logo subido correctamente');

      // Actualizar config si hay callback
      if (onSuccess && response) {
        onSuccess(response);
      }
    } catch (error: any) {
      console.error('Error al subir logo:', error);
      Alert.alert('Error', error.message || 'Error al subir el logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleDeleteLogo = async () => {
    if (!config?.id) {
      Alert.alert('Error', 'No se puede eliminar el logo');
      return;
    }

    Alert.alert(
      'Confirmar eliminación',
      '¿Está seguro de eliminar el logo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              setUploadingLogo(true);
              const updatedConfig = await deleteLogo(config.id);
              setLogoUrl(undefined);
              Alert.alert('Éxito', 'Logo eliminado correctamente');

              // Actualizar config si hay callback
              if (onSuccess) {
                onSuccess(updatedConfig);
              }
            } catch (error: any) {
              console.error('Error al eliminar logo:', error);
              Alert.alert('Error', error.message || 'Error al eliminar el logo');
            } finally {
              setUploadingLogo(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Conexión</Text>

        <Text style={styles.label}>URL Base *</Text>
        <TextInput
          style={styles.input}
          value={formData.baseUrl}
          onChangeText={(text) => setFormData({ ...formData, baseUrl: text })}
          placeholder="http://localhost:8080"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Context Path *</Text>
        <TextInput
          style={styles.input}
          value={formData.contextPath}
          onChangeText={(text) => setFormData({ ...formData, contextPath: text })}
          placeholder="/einvoice/rest"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Timeout (segundos)</Text>
        <TextInput
          style={styles.input}
          value={formData.timeoutSeconds.toString()}
          onChangeText={(text) =>
            setFormData({ ...formData, timeoutSeconds: parseInt(text) || 30 })
          }
          keyboardType="numeric"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Datos del Emisor</Text>

        <Text style={styles.label}>RUC *</Text>
        <TextInput
          style={styles.input}
          value={formData.ruc}
          onChangeText={(text) => setFormData({ ...formData, ruc: text })}
          placeholder="20123456789"
          keyboardType="numeric"
          maxLength={11}
        />

        <Text style={styles.label}>Razón Social *</Text>
        <TextInput
          style={styles.input}
          value={formData.razonSocial}
          onChangeText={(text) => setFormData({ ...formData, razonSocial: text })}
          placeholder="MI EMPRESA SAC"
        />

        <Text style={styles.label}>Nombre Comercial</Text>
        <TextInput
          style={styles.input}
          value={formData.nombreComercial}
          onChangeText={(text) => setFormData({ ...formData, nombreComercial: text })}
          placeholder="Mi Empresa"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Domicilio Fiscal</Text>

        <Text style={styles.label}>Dirección *</Text>
        <TextInput
          style={styles.input}
          value={formData.domicilioFiscal}
          onChangeText={(text) => setFormData({ ...formData, domicilioFiscal: text })}
          placeholder="Av. Principal 123"
        />

        <Text style={styles.label}>Ubigeo *</Text>
        <TextInput
          style={styles.input}
          value={formData.ubigeo}
          onChangeText={(text) => setFormData({ ...formData, ubigeo: text })}
          placeholder="150101"
          keyboardType="numeric"
          maxLength={6}
        />

        <Text style={styles.label}>Departamento *</Text>
        <TextInput
          style={styles.input}
          value={formData.departamento}
          onChangeText={(text) => setFormData({ ...formData, departamento: text })}
          placeholder="LIMA"
        />

        <Text style={styles.label}>Provincia *</Text>
        <TextInput
          style={styles.input}
          value={formData.provincia}
          onChangeText={(text) => setFormData({ ...formData, provincia: text })}
          placeholder="LIMA"
        />

        <Text style={styles.label}>Distrito *</Text>
        <TextInput
          style={styles.input}
          value={formData.distrito}
          onChangeText={(text) => setFormData({ ...formData, distrito: text })}
          placeholder="LIMA"
        />

        <Text style={styles.label}>Urbanización</Text>
        <TextInput
          style={styles.input}
          value={formData.urbanizacion}
          onChangeText={(text) => setFormData({ ...formData, urbanizacion: text })}
          placeholder="Opcional"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contacto</Text>

        <Text style={styles.label}>Email *</Text>
        <TextInput
          style={styles.input}
          value={formData.email}
          onChangeText={(text) => setFormData({ ...formData, email: text })}
          placeholder="facturacion@miempresa.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Teléfono</Text>
        <TextInput
          style={styles.input}
          value={formData.telefono}
          onChangeText={(text) => setFormData({ ...formData, telefono: text })}
          placeholder="01-1234567"
          keyboardType="phone-pad"
        />
      </View>

      {config && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Logo de la Empresa</Text>
          <Text style={styles.helperText}>
            El logo aparecerá en los documentos electrónicos (facturas, boletas, guías de remisión).
            Formatos aceptados: JPG, PNG
          </Text>

          {logoUrl ? (
            <View style={styles.logoContainer}>
              <Image
                source={{ uri: logoUrl }}
                style={styles.logoPreview}
                resizeMode="contain"
              />
              <View style={styles.logoActions}>
                <TouchableOpacity
                  style={[styles.logoButton, styles.changeLogoButton]}
                  onPress={handleUploadLogo}
                  disabled={uploadingLogo || loading}
                >
                  {uploadingLogo ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.logoButtonText}>Cambiar Logo</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.logoButton, styles.deleteLogoButton]}
                  onPress={handleDeleteLogo}
                  disabled={uploadingLogo || loading}
                >
                  <Text style={styles.logoButtonText}>Eliminar Logo</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.uploadLogoButton]}
              onPress={handleUploadLogo}
              disabled={uploadingLogo || loading}
            >
              {uploadingLogo ? (
                <ActivityIndicator color="#007AFF" />
              ) : (
                <>
                  <Text style={styles.uploadLogoIcon}>📷</Text>
                  <Text style={styles.uploadLogoText}>Subir Logo</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Opciones</Text>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Envío automático a SUNAT</Text>
          <Switch
            value={formData.autoSend}
            onValueChange={(value) => setFormData({ ...formData, autoSend: value })}
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Descarga automática de PDF</Text>
          <Switch
            value={formData.autoDownloadPdf}
            onValueChange={(value) => setFormData({ ...formData, autoDownloadPdf: value })}
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Descarga automática de XML</Text>
          <Switch
            value={formData.autoDownloadXml}
            onValueChange={(value) => setFormData({ ...formData, autoDownloadXml: value })}
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Configuración activa</Text>
          <Switch
            value={formData.isActive}
            onValueChange={(value) => setFormData({ ...formData, isActive: value })}
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Modo producción</Text>
          <Switch
            value={formData.isProduction}
            onValueChange={(value) => setFormData({ ...formData, isProduction: value })}
          />
        </View>
      </View>

      <View style={styles.buttonContainer}>
        {config && (
          <TouchableOpacity
            style={[styles.button, styles.testButton]}
            onPress={handleTestConnection}
            disabled={testing || loading}
          >
            {testing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Probar Conexión</Text>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.button, styles.saveButton]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {config ? 'Actualizar' : 'Crear'} Configuración
            </Text>
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
    backgroundColor: '#f5f5f5',
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#555',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  switchLabel: {
    fontSize: 14,
    color: '#555',
    flex: 1,
  },
  buttonContainer: {
    padding: 16,
    gap: 12,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#28a745',
  },
  testButton: {
    backgroundColor: '#17a2b8',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  helperText: {
    fontSize: 12,
    color: '#888',
    marginBottom: 16,
    lineHeight: 18,
  },
  logoContainer: {
    alignItems: 'center',
    gap: 16,
  },
  logoPreview: {
    width: 200,
    height: 150,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  logoActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  logoButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  changeLogoButton: {
    backgroundColor: '#007AFF',
  },
  deleteLogoButton: {
    backgroundColor: '#dc3545',
  },
  logoButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  uploadLogoButton: {
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
  },
  uploadLogoIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  uploadLogoText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
});
