import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  Switch,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { customersService } from '@/services/api/customers';
import {
  Customer,
  CreateCustomerRequest,
  UpdateCustomerRequest,
  CustomerType,
  DocumentType,
  CustomerStatus,
} from '@/types/customers';
import { getDepartamentos, getProvincias, getDistritos } from '@/constants/ubigeo';

export const CustomerDetailScreen = ({ navigation, route }: any) => {
  const customerId = route?.params?.customerId;
  const isCreateMode = !customerId;

  const [loading, setLoading] = useState(!isCreateMode);
  const [saving, setSaving] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [consultingApi, setConsultingApi] = useState(false);
  const [isEditing, setIsEditing] = useState(isCreateMode);

  // Form state
  const [formData, setFormData] = useState({
    customerType: CustomerType.PERSONA,
    documentType: DocumentType.DNI,
    documentNumber: '',
    nombres: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    razonSocial: '',
    nombreComercial: '',
    email: '',
    phone: '',
    mobile: '',
    direccion: '',
    distrito: '',
    departamento: '',
    provincia: '',
    country: 'Perú',
    aceptaPublicidad: false,
    status: CustomerStatus.ACTIVE,
    notes: '',
  });

  // Ubigeo selects
  const [showDepartamentoModal, setShowDepartamentoModal] = useState(false);
  const [showProvinciaModal, setShowProvinciaModal] = useState(false);
  const [showDistritoModal, setShowDistritoModal] = useState(false);
  const [departamentos] = useState(getDepartamentos());
  const [provincias, setProvincias] = useState<{ value: string; label: string }[]>([]);
  const [distritos, setDistritos] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    if (!isCreateMode) {
      loadCustomer();
    }
  }, [customerId]);

  // Update provincias when departamento changes
  useEffect(() => {
    if (formData.departamento) {
      const newProvincias = getProvincias(formData.departamento);
      setProvincias(newProvincias);
      if (!newProvincias.find((p) => p.value === formData.provincia)) {
        setFormData((prev) => ({ ...prev, provincia: '', distrito: '' }));
        setDistritos([]);
      }
    } else {
      setProvincias([]);
      setDistritos([]);
    }
  }, [formData.departamento]);

  // Update distritos when provincia changes
  useEffect(() => {
    if (formData.departamento && formData.provincia) {
      const newDistritos = getDistritos(formData.departamento, formData.provincia);
      setDistritos(newDistritos);
      if (!newDistritos.find((d) => d.value === formData.distrito)) {
        setFormData((prev) => ({ ...prev, distrito: '' }));
      }
    } else {
      setDistritos([]);
    }
  }, [formData.provincia]);

  const loadCustomer = async () => {
    if (!customerId) return;

    try {
      setLoading(true);
      const data = await customersService.getCustomer(customerId);
      setCustomer(data);

      setFormData({
        customerType: data.customerType,
        documentType: data.documentType,
        documentNumber: data.documentNumber,
        nombres: data.nombres || '',
        apellidoPaterno: data.apellidoPaterno || '',
        apellidoMaterno: data.apellidoMaterno || '',
        razonSocial: data.razonSocial || '',
        nombreComercial: data.nombreComercial || '',
        email: data.email || '',
        phone: data.phone || '',
        mobile: data.mobile || '',
        direccion: data.direccion || '',
        distrito: data.distrito || '',
        departamento: data.departamento || '',
        provincia: data.provincia || '',
        country: data.country || 'Perú',
        aceptaPublicidad: data.aceptaPublicidad,
        status: data.status,
        notes: data.notes || '',
      });
    } catch (error: any) {
      console.error('Error loading customer:', error);
      Alert.alert('Error', error.response?.data?.message || 'No se pudo cargar el cliente');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleConsultarDni = async () => {
    if (!formData.documentNumber || formData.documentNumber.length !== 8) {
      Alert.alert('Error', 'El DNI debe tener 8 dígitos');
      return;
    }

    try {
      setConsultingApi(true);
      const response = await customersService.consultarDni(formData.documentNumber);

      if (response.success && response.data) {
        setFormData({
          ...formData,
          nombres: response.data.nombres,
          apellidoPaterno: response.data.apellido_paterno,
          apellidoMaterno: response.data.apellido_materno,
        });
        Alert.alert('Éxito', 'Datos obtenidos correctamente de RENIEC');
      }
    } catch (error: any) {
      console.error('Error consulting DNI:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'No se pudo consultar el DNI en ApiPeruDev'
      );
    } finally {
      setConsultingApi(false);
    }
  };

  const handleConsultarRuc = async () => {
    if (!formData.documentNumber || formData.documentNumber.length !== 11) {
      Alert.alert('Error', 'El RUC debe tener 11 dígitos');
      return;
    }

    try {
      setConsultingApi(true);
      const response = await customersService.consultarRuc(formData.documentNumber);

      if (response.success && response.data) {
        setFormData({
          ...formData,
          razonSocial: response.data.nombre_o_razon_social,
          direccion: response.data.direccion,
          distrito: response.data.distrito,
          departamento: response.data.departamento,
          provincia: response.data.provincia,
        });
        Alert.alert('Éxito', 'Datos obtenidos correctamente de SUNAT');
      }
    } catch (error: any) {
      console.error('Error consulting RUC:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'No se pudo consultar el RUC en ApiPeruDev'
      );
    } finally {
      setConsultingApi(false);
    }
  };

  const validateForm = (): boolean => {
    if (!formData.documentNumber.trim()) {
      Alert.alert('Error', 'El número de documento es obligatorio');
      return false;
    }

    if (formData.customerType === CustomerType.PERSONA) {
      if (!formData.nombres.trim()) {
        Alert.alert('Error', 'Los nombres son obligatorios');
        return false;
      }
      if (!formData.apellidoPaterno.trim()) {
        Alert.alert('Error', 'El apellido paterno es obligatorio');
        return false;
      }
      if (!formData.apellidoMaterno.trim()) {
        Alert.alert('Error', 'El apellido materno es obligatorio');
        return false;
      }
    } else {
      if (!formData.razonSocial.trim()) {
        Alert.alert('Error', 'La razón social es obligatoria');
        return false;
      }
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);

      if (!isCreateMode) {
        const updateData: UpdateCustomerRequest = {
          customerType: formData.customerType,
          documentType: formData.documentType,
          documentNumber: formData.documentNumber,
          nombres: formData.nombres || undefined,
          apellidoPaterno: formData.apellidoPaterno || undefined,
          apellidoMaterno: formData.apellidoMaterno || undefined,
          razonSocial: formData.razonSocial || undefined,
          nombreComercial: formData.nombreComercial || undefined,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          mobile: formData.mobile || undefined,
          direccion: formData.direccion || undefined,
          distrito: formData.distrito || undefined,
          departamento: formData.departamento || undefined,
          provincia: formData.provincia || undefined,
          country: formData.country || undefined,
          aceptaPublicidad: formData.aceptaPublicidad,
          status: formData.status,
          notes: formData.notes || undefined,
        };
        await customersService.updateCustomer(customerId, updateData);
        Alert.alert('Éxito', 'Cliente actualizado correctamente');
        setIsEditing(false);
        loadCustomer();
      } else {
        const createData: CreateCustomerRequest = {
          customerType: formData.customerType,
          documentType: formData.documentType,
          documentNumber: formData.documentNumber,
          nombres: formData.nombres || undefined,
          apellidoPaterno: formData.apellidoPaterno || undefined,
          apellidoMaterno: formData.apellidoMaterno || undefined,
          razonSocial: formData.razonSocial || undefined,
          nombreComercial: formData.nombreComercial || undefined,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          mobile: formData.mobile || undefined,
          direccion: formData.direccion || undefined,
          distrito: formData.distrito || undefined,
          departamento: formData.departamento || undefined,
          provincia: formData.provincia || undefined,
          country: formData.country || undefined,
          aceptaPublicidad: formData.aceptaPublicidad,
          notes: formData.notes || undefined,
        };
        await customersService.createCustomer(createData);
        Alert.alert('Éxito', 'Cliente creado correctamente');
        navigation.goBack();
      }
    } catch (error: any) {
      console.error('Error saving customer:', error);
      Alert.alert('Error', error.response?.data?.message || 'No se pudo guardar el cliente');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (isCreateMode) {
      navigation.goBack();
    } else {
      setIsEditing(false);
      loadCustomer();
    }
  };

  const renderConsultButton = () => {
    if (!isEditing) return null;

    const isPersona = formData.customerType === CustomerType.PERSONA;
    const isDni = formData.documentType === DocumentType.DNI;
    const isRuc = formData.documentType === DocumentType.RUC;

    if (isPersona && isDni) {
      return (
        <TouchableOpacity
          style={[styles.consultButton, consultingApi && styles.consultButtonDisabled]}
          onPress={handleConsultarDni}
          disabled={consultingApi || !formData.documentNumber}
        >
          {consultingApi ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.consultButtonText}>🔍 Consultar DNI</Text>
          )}
        </TouchableOpacity>
      );
    }

    if (!isPersona && isRuc) {
      return (
        <TouchableOpacity
          style={[styles.consultButton, consultingApi && styles.consultButtonDisabled]}
          onPress={handleConsultarRuc}
          disabled={consultingApi || !formData.documentNumber}
        >
          {consultingApi ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.consultButtonText}>🔍 Consultar RUC</Text>
          )}
        </TouchableOpacity>
      );
    }

    return null;
  };

  const renderSelectModal = (
    visible: boolean,
    onClose: () => void,
    title: string,
    options: { value: string; label: string }[],
    onSelect: (value: string) => void,
    currentValue: string
  ) => {
    return (
      <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
        <Pressable style={styles.modalOverlay} onPress={onClose}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
              <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {options.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.modalOption,
                    currentValue === option.value && styles.modalOptionSelected,
                  ]}
                  onPress={() => {
                    onSelect(option.value);
                    onClose();
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      currentValue === option.value && styles.modalOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {currentValue === option.value && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Cargando cliente...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Atrás</Text>
        </TouchableOpacity>
        <Text style={styles.title}>
          {isCreateMode ? 'Nuevo Cliente' : isEditing ? 'Editar Cliente' : 'Detalle de Cliente'}
        </Text>
        <View style={styles.headerRight}>
          {!isCreateMode && !isEditing && (
            <TouchableOpacity onPress={handleEdit} style={styles.editButton}>
              <Text style={styles.editButtonText}>✏️ Editar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Tipo de Cliente */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tipo de Cliente</Text>
          {isEditing ? (
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  formData.customerType === CustomerType.PERSONA && styles.typeButtonActive,
                ]}
                onPress={() =>
                  setFormData({
                    ...formData,
                    customerType: CustomerType.PERSONA,
                    documentType: DocumentType.DNI,
                  })
                }
                disabled={!isCreateMode}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    formData.customerType === CustomerType.PERSONA && styles.typeButtonTextActive,
                  ]}
                >
                  👤 Persona Natural
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  formData.customerType === CustomerType.EMPRESA && styles.typeButtonActive,
                ]}
                onPress={() =>
                  setFormData({
                    ...formData,
                    customerType: CustomerType.EMPRESA,
                    documentType: DocumentType.RUC,
                  })
                }
                disabled={!isCreateMode}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    formData.customerType === CustomerType.EMPRESA && styles.typeButtonTextActive,
                  ]}
                >
                  🏢 Empresa
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.valueText}>
              {formData.customerType === CustomerType.PERSONA
                ? '👤 Persona Natural'
                : '🏢 Empresa'}
            </Text>
          )}
        </View>

        {/* Tipo de Documento */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tipo de Documento</Text>
          {isEditing ? (
            <View style={styles.documentTypeSelector}>
              {formData.customerType === CustomerType.PERSONA ? (
                <>
                  <TouchableOpacity
                    style={[
                      styles.docTypeButton,
                      formData.documentType === DocumentType.DNI && styles.docTypeButtonActive,
                    ]}
                    onPress={() => setFormData({ ...formData, documentType: DocumentType.DNI })}
                    disabled={!isCreateMode}
                  >
                    <Text
                      style={[
                        styles.docTypeButtonText,
                        formData.documentType === DocumentType.DNI &&
                          styles.docTypeButtonTextActive,
                      ]}
                    >
                      DNI
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.docTypeButton,
                      formData.documentType === DocumentType.CE && styles.docTypeButtonActive,
                    ]}
                    onPress={() => setFormData({ ...formData, documentType: DocumentType.CE })}
                    disabled={!isCreateMode}
                  >
                    <Text
                      style={[
                        styles.docTypeButtonText,
                        formData.documentType === DocumentType.CE && styles.docTypeButtonTextActive,
                      ]}
                    >
                      CE
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.docTypeButton,
                      formData.documentType === DocumentType.PASSPORT &&
                        styles.docTypeButtonActive,
                    ]}
                    onPress={() =>
                      setFormData({ ...formData, documentType: DocumentType.PASSPORT })
                    }
                    disabled={!isCreateMode}
                  >
                    <Text
                      style={[
                        styles.docTypeButtonText,
                        formData.documentType === DocumentType.PASSPORT &&
                          styles.docTypeButtonTextActive,
                      ]}
                    >
                      Pasaporte
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={[styles.docTypeButton, styles.docTypeButtonActive]}>
                  <Text style={[styles.docTypeButtonText, styles.docTypeButtonTextActive]}>
                    RUC
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.valueText}>{formData.documentType}</Text>
          )}
        </View>

        {/* Número de Documento */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Número de Documento <Text style={styles.required}>*</Text>
          </Text>
          {isEditing ? (
            <View style={styles.documentInputContainer}>
              <TextInput
                style={[styles.input, styles.documentInput]}
                value={formData.documentNumber}
                onChangeText={(text) => setFormData({ ...formData, documentNumber: text })}
                placeholder={
                  formData.documentType === DocumentType.DNI
                    ? '12345678'
                    : formData.documentType === DocumentType.RUC
                    ? '20100443688'
                    : 'Número de documento'
                }
                keyboardType="numeric"
                editable={isCreateMode}
              />
              {renderConsultButton()}
            </View>
          ) : (
            <Text style={styles.valueText}>{formData.documentNumber}</Text>
          )}
        </View>

        {/* Campos para Persona Natural */}
        {formData.customerType === CustomerType.PERSONA && (
          <>
            <View style={styles.section}>
              <Text style={styles.label}>
                Nombres <Text style={styles.required}>*</Text>
              </Text>
              {isEditing ? (
                <TextInput
                  style={styles.input}
                  value={formData.nombres}
                  onChangeText={(text) => setFormData({ ...formData, nombres: text })}
                  placeholder="Juan Carlos"
                />
              ) : (
                <Text style={styles.valueText}>{formData.nombres || '-'}</Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>
                Apellido Paterno <Text style={styles.required}>*</Text>
              </Text>
              {isEditing ? (
                <TextInput
                  style={styles.input}
                  value={formData.apellidoPaterno}
                  onChangeText={(text) => setFormData({ ...formData, apellidoPaterno: text })}
                  placeholder="Pérez"
                />
              ) : (
                <Text style={styles.valueText}>{formData.apellidoPaterno || '-'}</Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>
                Apellido Materno <Text style={styles.required}>*</Text>
              </Text>
              {isEditing ? (
                <TextInput
                  style={styles.input}
                  value={formData.apellidoMaterno}
                  onChangeText={(text) => setFormData({ ...formData, apellidoMaterno: text })}
                  placeholder="García"
                />
              ) : (
                <Text style={styles.valueText}>{formData.apellidoMaterno || '-'}</Text>
              )}
            </View>
          </>
        )}

        {/* Campos para Empresa */}
        {formData.customerType === CustomerType.EMPRESA && (
          <>
            <View style={styles.section}>
              <Text style={styles.label}>
                Razón Social <Text style={styles.required}>*</Text>
              </Text>
              {isEditing ? (
                <TextInput
                  style={styles.input}
                  value={formData.razonSocial}
                  onChangeText={(text) => setFormData({ ...formData, razonSocial: text })}
                  placeholder="EMPRESA DEMO SAC"
                />
              ) : (
                <Text style={styles.valueText}>{formData.razonSocial || '-'}</Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Nombre Comercial</Text>
              {isEditing ? (
                <TextInput
                  style={styles.input}
                  value={formData.nombreComercial}
                  onChangeText={(text) => setFormData({ ...formData, nombreComercial: text })}
                  placeholder="Demo Store"
                />
              ) : (
                <Text style={styles.valueText}>{formData.nombreComercial || '-'}</Text>
              )}
            </View>
          </>
        )}

        {/* Campos Comunes */}
        <View style={styles.section}>
          <Text style={styles.label}>Email</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              placeholder="cliente@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          ) : (
            <Text style={styles.valueText}>{formData.email || '-'}</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Teléfono</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
              placeholder="01-1234567"
              keyboardType="phone-pad"
            />
          ) : (
            <Text style={styles.valueText}>{formData.phone || '-'}</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Móvil</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={formData.mobile}
              onChangeText={(text) => setFormData({ ...formData, mobile: text })}
              placeholder="987654321"
              keyboardType="phone-pad"
            />
          ) : (
            <Text style={styles.valueText}>{formData.mobile || '-'}</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Dirección</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={formData.direccion}
              onChangeText={(text) => setFormData({ ...formData, direccion: text })}
              placeholder="Av. Principal 123"
            />
          ) : (
            <Text style={styles.valueText}>{formData.direccion || '-'}</Text>
          )}
        </View>

        {/* Departamento */}
        <View style={styles.section}>
          <Text style={styles.label}>Departamento</Text>
          {isEditing ? (
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setShowDepartamentoModal(true)}
            >
              <Text style={styles.selectButtonText}>
                {formData.departamento || 'Seleccionar departamento'}
              </Text>
              <Text style={styles.selectArrow}>›</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.valueText}>{formData.departamento || '-'}</Text>
          )}
        </View>

        {/* Provincia */}
        <View style={styles.section}>
          <Text style={styles.label}>Provincia</Text>
          {isEditing ? (
            <TouchableOpacity
              style={[styles.selectButton, !formData.departamento && styles.selectButtonDisabled]}
              onPress={() => setShowProvinciaModal(true)}
              disabled={!formData.departamento}
            >
              <Text
                style={[
                  styles.selectButtonText,
                  !formData.departamento && styles.selectButtonTextDisabled,
                ]}
              >
                {formData.provincia || 'Seleccionar provincia'}
              </Text>
              <Text style={styles.selectArrow}>›</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.valueText}>{formData.provincia || '-'}</Text>
          )}
        </View>

        {/* Distrito */}
        <View style={styles.section}>
          <Text style={styles.label}>Distrito</Text>
          {isEditing ? (
            <TouchableOpacity
              style={[styles.selectButton, !formData.provincia && styles.selectButtonDisabled]}
              onPress={() => setShowDistritoModal(true)}
              disabled={!formData.provincia}
            >
              <Text
                style={[
                  styles.selectButtonText,
                  !formData.provincia && styles.selectButtonTextDisabled,
                ]}
              >
                {formData.distrito || 'Seleccionar distrito'}
              </Text>
              <Text style={styles.selectArrow}>›</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.valueText}>{formData.distrito || '-'}</Text>
          )}
        </View>

        {/* Acepta Publicidad */}
        <View style={styles.section}>
          <View style={styles.switchContainer}>
            <Text style={styles.label}>Acepta Publicidad</Text>
            {isEditing ? (
              <Switch
                value={formData.aceptaPublicidad}
                onValueChange={(value) => setFormData({ ...formData, aceptaPublicidad: value })}
              />
            ) : (
              <Text style={styles.valueText}>{formData.aceptaPublicidad ? 'Sí' : 'No'}</Text>
            )}
          </View>
        </View>

        {/* Estado (solo en edición de cliente existente) */}
        {!isCreateMode && (
          <View style={styles.section}>
            <Text style={styles.label}>Estado</Text>
            {isEditing ? (
              <View style={styles.statusSelector}>
                <TouchableOpacity
                  style={[
                    styles.statusButton,
                    formData.status === CustomerStatus.ACTIVE && styles.statusButtonActive,
                  ]}
                  onPress={() => setFormData({ ...formData, status: CustomerStatus.ACTIVE })}
                >
                  <Text
                    style={[
                      styles.statusButtonText,
                      formData.status === CustomerStatus.ACTIVE && styles.statusButtonTextActive,
                    ]}
                  >
                    Activo
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.statusButton,
                    formData.status === CustomerStatus.INACTIVE && styles.statusButtonActive,
                  ]}
                  onPress={() => setFormData({ ...formData, status: CustomerStatus.INACTIVE })}
                >
                  <Text
                    style={[
                      styles.statusButtonText,
                      formData.status === CustomerStatus.INACTIVE && styles.statusButtonTextActive,
                    ]}
                  >
                    Inactivo
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.statusButton,
                    formData.status === CustomerStatus.BLOCKED && styles.statusButtonActive,
                  ]}
                  onPress={() => setFormData({ ...formData, status: CustomerStatus.BLOCKED })}
                >
                  <Text
                    style={[
                      styles.statusButtonText,
                      formData.status === CustomerStatus.BLOCKED && styles.statusButtonTextActive,
                    ]}
                  >
                    Bloqueado
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.valueText}>
                {formData.status === CustomerStatus.ACTIVE
                  ? 'Activo'
                  : formData.status === CustomerStatus.INACTIVE
                  ? 'Inactivo'
                  : 'Bloqueado'}
              </Text>
            )}
          </View>
        )}

        {/* Notas */}
        <View style={styles.section}>
          <Text style={styles.label}>Notas</Text>
          {isEditing ? (
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.notes}
              onChangeText={(text) => setFormData({ ...formData, notes: text })}
              placeholder="Notas adicionales..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          ) : (
            <Text style={styles.valueText}>{formData.notes || '-'}</Text>
          )}
        </View>

        {/* Action Buttons */}
        {isEditing && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelEdit}
              disabled={saving}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {isCreateMode ? '➕ Crear Cliente' : '💾 Guardar Cambios'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Modals */}
      {renderSelectModal(
        showDepartamentoModal,
        () => setShowDepartamentoModal(false),
        'Seleccionar Departamento',
        departamentos,
        (value) => setFormData({ ...formData, departamento: value, provincia: '', distrito: '' }),
        formData.departamento
      )}

      {renderSelectModal(
        showProvinciaModal,
        () => setShowProvinciaModal(false),
        'Seleccionar Provincia',
        provincias,
        (value) => setFormData({ ...formData, provincia: value, distrito: '' }),
        formData.provincia
      )}

      {renderSelectModal(
        showDistritoModal,
        () => setShowDistritoModal(false),
        'Seleccionar Distrito',
        distritos,
        (value) => setFormData({ ...formData, distrito: value }),
        formData.distrito
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerRight: {
    minWidth: 80,
    alignItems: 'flex-end',
  },
  editButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  required: {
    color: '#D32F2F',
  },
  valueText: {
    fontSize: 15,
    color: '#666',
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textArea: {
    minHeight: 100,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#E3F2FD',
    borderColor: '#007AFF',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  typeButtonTextActive: {
    color: '#007AFF',
  },
  documentTypeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  docTypeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  docTypeButtonActive: {
    backgroundColor: '#E3F2FD',
    borderColor: '#007AFF',
  },
  docTypeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  docTypeButtonTextActive: {
    color: '#007AFF',
  },
  documentInputContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  documentInput: {
    flex: 1,
  },
  consultButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 140,
    alignItems: 'center',
  },
  consultButtonDisabled: {
    backgroundColor: '#ccc',
  },
  consultButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectButtonDisabled: {
    backgroundColor: '#f9f9f9',
    opacity: 0.6,
  },
  selectButtonText: {
    fontSize: 16,
    color: '#333',
  },
  selectButtonTextDisabled: {
    color: '#999',
  },
  selectArrow: {
    fontSize: 24,
    color: '#666',
    fontWeight: '600',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  statusButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  statusButtonActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  statusButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  statusButtonTextActive: {
    color: '#4CAF50',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  bottomPadding: {
    height: 40,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalCloseText: {
    fontSize: 24,
    color: '#666',
  },
  modalList: {
    maxHeight: 400,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalOptionSelected: {
    backgroundColor: '#E3F2FD',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#333',
  },
  modalOptionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 20,
    color: '#007AFF',
    fontWeight: '600',
  },
});
