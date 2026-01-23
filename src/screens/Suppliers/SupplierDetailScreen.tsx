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
  useWindowDimensions,
  Modal,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { suppliersService } from '@/services/api/suppliers';
import {
  Supplier,
  CreateSupplierRequest,
  UpdateSupplierRequest,
  LocationAccuracy,
  LocationSource,
  SupplierLegalEntity,
  SupplierContact,
  SupplierBankAccount,
  CreateSupplierLegalEntityDto,
  CreateSupplierContactDto,
} from '@/types/suppliers';
import { ScreenProps } from '@/types/navigation';

type SupplierDetailScreenProps = ScreenProps<'SupplierDetail'>;

type TabType = 'general' | 'legal' | 'contacts' | 'banks' | 'debts' | 'payments';

export const SupplierDetailScreen = ({
  navigation,
  route,
}: any) => {
  const supplierId = route?.params?.supplierId;
  const isEditMode = !!supplierId;
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('general');

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    commercialName: '',
    email: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    district: '',
    province: '',
    department: '',
    postalCode: '',
    latitude: '',
    longitude: '',
    paymentTermsDays: '',
    creditLimitCents: '',
    notes: '',
    isActive: true,
  });

  // Legal entities state
  const [legalEntities, setLegalEntities] = useState<CreateSupplierLegalEntityDto[]>([]);
  const [showLegalEntityModal, setShowLegalEntityModal] = useState(false);
  const [editingLegalEntity, setEditingLegalEntity] = useState<number | null>(null);
  const [legalEntityForm, setLegalEntityForm] = useState({
    legalName: '',
    ruc: '',
    taxAddress: '',
    isPrimary: false,
  });

  // Contacts state
  const [contacts, setContacts] = useState<CreateSupplierContactDto[]>([]);
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState<number | null>(null);
  const [contactForm, setContactForm] = useState({
    fullName: '',
    position: '',
    email: '',
    phone: '',
    isPrimary: false,
  });

  useEffect(() => {
    if (isEditMode) {
      loadSupplier();
    }
  }, [supplierId]);

  const loadSupplier = async () => {
    if (!supplierId) return;

    try {
      setLoading(true);
      const data = await suppliersService.getSupplier(supplierId);
      setSupplier(data);

      // Populate form
      setFormData({
        code: data.code || '',
        commercialName: data.commercialName || '',
        email: data.email || '',
        phone: data.phone || '',
        addressLine1: data.addressLine1 || '',
        addressLine2: data.addressLine2 || '',
        district: data.district || '',
        province: data.province || '',
        department: data.department || '',
        postalCode: data.postalCode || '',
        latitude: data.latitude?.toString() || '',
        longitude: data.longitude?.toString() || '',
        paymentTermsDays: data.paymentTermsDays?.toString() || '',
        creditLimitCents: data.creditLimitCents?.toString() || '',
        notes: data.notes || '',
        isActive: data.isActive,
      });

      // Set legal entities
      if (data.legalEntities) {
        setLegalEntities(data.legalEntities.map(le => ({
          legalName: le.legalName,
          ruc: le.ruc,
          taxAddress: le.taxAddress,
          isPrimary: le.isPrimary,
        })));
      }

      // Set contacts
      if (data.contacts) {
        setContacts(data.contacts.map(c => ({
          fullName: c.fullName,
          position: c.position || '',
          email: c.email || '',
          phone: c.phone || '',
          isPrimary: c.isPrimary,
        })));
      }
    } catch (error: any) {
      console.error('Error loading supplier:', error);
      Alert.alert('Error', 'No se pudo cargar el proveedor');
      navigation?.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!formData.code.trim()) {
      Alert.alert('Error', 'El código es requerido');
      return;
    }
    if (!formData.commercialName.trim()) {
      Alert.alert('Error', 'El nombre comercial es requerido');
      return;
    }

    if (legalEntities.length === 0) {
      Alert.alert('Error', 'Debe agregar al menos una razón social');
      return;
    }

    const primaryCount = legalEntities.filter(le => le.isPrimary).length;
    if (primaryCount === 0) {
      Alert.alert('Error', 'Debe marcar una razón social como principal');
      return;
    }
    if (primaryCount > 1) {
      Alert.alert('Error', 'Solo puede haber una razón social principal');
      return;
    }

    try {
      setSaving(true);

      if (isEditMode && supplierId) {
        // Update existing supplier
        const updateData: UpdateSupplierRequest = {
          code: formData.code.trim(),
          commercialName: formData.commercialName.trim(),
          email: formData.email.trim() || undefined,
          phone: formData.phone.trim() || undefined,
          addressLine1: formData.addressLine1.trim() || undefined,
          addressLine2: formData.addressLine2.trim() || undefined,
          district: formData.district.trim() || undefined,
          province: formData.province.trim() || undefined,
          department: formData.department.trim() || undefined,
          postalCode: formData.postalCode.trim() || undefined,
          latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
          longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
          paymentTermsDays: formData.paymentTermsDays ? parseInt(formData.paymentTermsDays) : undefined,
          creditLimitCents: formData.creditLimitCents ? parseInt(formData.creditLimitCents) : undefined,
          notes: formData.notes.trim() || undefined,
          isActive: formData.isActive,
        };

        await suppliersService.updateSupplier(supplierId, updateData);
        Alert.alert('Éxito', 'Proveedor actualizado correctamente');
      } else {
        // Create new supplier
        const createData: CreateSupplierRequest = {
          code: formData.code.trim(),
          commercialName: formData.commercialName.trim(),
          email: formData.email.trim() || undefined,
          phone: formData.phone.trim() || undefined,
          addressLine1: formData.addressLine1.trim() || undefined,
          addressLine2: formData.addressLine2.trim() || undefined,
          district: formData.district.trim() || undefined,
          province: formData.province.trim() || undefined,
          department: formData.department.trim() || undefined,
          postalCode: formData.postalCode.trim() || undefined,
          latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
          longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
          paymentTermsDays: formData.paymentTermsDays ? parseInt(formData.paymentTermsDays) : undefined,
          creditLimitCents: formData.creditLimitCents ? parseInt(formData.creditLimitCents) : undefined,
          notes: formData.notes.trim() || undefined,
          isActive: formData.isActive,
          legalEntities,
          contacts: contacts.length > 0 ? contacts : undefined,
        };

        await suppliersService.createSupplier(createData);
        Alert.alert('Éxito', 'Proveedor creado correctamente');
      }

      navigation?.goBack();
    } catch (error: any) {
      console.error('Error saving supplier:', error);
      const errorMessage = error.response?.data?.message || error.message || 'No se pudo guardar el proveedor';
      Alert.alert('Error', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleAddLegalEntity = () => {
    setEditingLegalEntity(null);
    setLegalEntityForm({
      legalName: '',
      ruc: '',
      taxAddress: '',
      isPrimary: legalEntities.length === 0, // First one is primary by default
    });
    setShowLegalEntityModal(true);
  };

  const handleEditLegalEntity = (index: number) => {
    setEditingLegalEntity(index);
    setLegalEntityForm(legalEntities[index]);
    setShowLegalEntityModal(true);
  };

  const handleSaveLegalEntity = () => {
    if (!legalEntityForm.legalName.trim()) {
      Alert.alert('Error', 'La razón social es requerida');
      return;
    }
    if (!legalEntityForm.ruc.trim() || legalEntityForm.ruc.length !== 11) {
      Alert.alert('Error', 'El RUC debe tener 11 dígitos');
      return;
    }
    if (!legalEntityForm.taxAddress.trim()) {
      Alert.alert('Error', 'La dirección fiscal es requerida');
      return;
    }

    const newEntities = [...legalEntities];

    // If setting as primary, unset others
    if (legalEntityForm.isPrimary) {
      newEntities.forEach(le => le.isPrimary = false);
    }

    if (editingLegalEntity !== null) {
      newEntities[editingLegalEntity] = legalEntityForm;
    } else {
      newEntities.push(legalEntityForm);
    }

    setLegalEntities(newEntities);
    setShowLegalEntityModal(false);
  };

  const handleDeleteLegalEntity = (index: number) => {
    Alert.alert(
      'Confirmar',
      '¿Está seguro de eliminar esta razón social?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            const newEntities = legalEntities.filter((_, i) => i !== index);
            setLegalEntities(newEntities);
          },
        },
      ]
    );
  };

  const handleAddContact = () => {
    setEditingContact(null);
    setContactForm({
      fullName: '',
      position: '',
      email: '',
      phone: '',
      isPrimary: contacts.length === 0,
    });
    setShowContactModal(true);
  };

  const handleEditContact = (index: number) => {
    setEditingContact(index);
    const contact = contacts[index];
    setContactForm({
      fullName: contact.fullName,
      position: contact.position || '',
      email: contact.email || '',
      phone: contact.phone || '',
      isPrimary: contact.isPrimary,
    });
    setShowContactModal(true);
  };

  const handleSaveContact = () => {
    if (!contactForm.fullName.trim()) {
      Alert.alert('Error', 'El nombre completo es requerido');
      return;
    }

    const newContacts = [...contacts];

    // If setting as primary, unset others
    if (contactForm.isPrimary) {
      newContacts.forEach(c => c.isPrimary = false);
    }

    if (editingContact !== null) {
      newContacts[editingContact] = contactForm;
    } else {
      newContacts.push(contactForm);
    }

    setContacts(newContacts);
    setShowContactModal(false);
  };

  const handleDeleteContact = (index: number) => {
    Alert.alert(
      'Confirmar',
      '¿Está seguro de eliminar este contacto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            const newContacts = contacts.filter((_, i) => i !== index);
            setContacts(newContacts);
          },
        },
      ]
    );
  };

  const renderGeneralTab = () => (
    <View style={styles.tabContent}>
      <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
        Información General
      </Text>

      <View style={styles.formGroup}>
        <Text style={[styles.label, isTablet && styles.labelTablet]}>
          Código <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={[styles.input, isTablet && styles.inputTablet]}
          value={formData.code}
          onChangeText={(text) => setFormData({ ...formData, code: text })}
          placeholder="SUP-00001"
          placeholderTextColor="#94A3B8"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, isTablet && styles.labelTablet]}>
          Nombre Comercial <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={[styles.input, isTablet && styles.inputTablet]}
          value={formData.commercialName}
          onChangeText={(text) => setFormData({ ...formData, commercialName: text })}
          placeholder="Distribuidora ABC"
          placeholderTextColor="#94A3B8"
        />
      </View>

      <View style={styles.formRow}>
        <View style={[styles.formGroup, styles.formGroupHalf]}>
          <Text style={[styles.label, isTablet && styles.labelTablet]}>Email</Text>
          <TextInput
            style={[styles.input, isTablet && styles.inputTablet]}
            value={formData.email}
            onChangeText={(text) => setFormData({ ...formData, email: text })}
            placeholder="ventas@abc.com"
            placeholderTextColor="#94A3B8"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={[styles.formGroup, styles.formGroupHalf]}>
          <Text style={[styles.label, isTablet && styles.labelTablet]}>Teléfono</Text>
          <TextInput
            style={[styles.input, isTablet && styles.inputTablet]}
            value={formData.phone}
            onChangeText={(text) => setFormData({ ...formData, phone: text })}
            placeholder="+51987654321"
            placeholderTextColor="#94A3B8"
            keyboardType="phone-pad"
          />
        </View>
      </View>

      <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet, { marginTop: 20 }]}>
        Dirección
      </Text>

      <View style={styles.formGroup}>
        <Text style={[styles.label, isTablet && styles.labelTablet]}>Dirección Línea 1</Text>
        <TextInput
          style={[styles.input, isTablet && styles.inputTablet]}
          value={formData.addressLine1}
          onChangeText={(text) => setFormData({ ...formData, addressLine1: text })}
          placeholder="Av. Principal 123"
          placeholderTextColor="#94A3B8"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, isTablet && styles.labelTablet]}>Dirección Línea 2</Text>
        <TextInput
          style={[styles.input, isTablet && styles.inputTablet]}
          value={formData.addressLine2}
          onChangeText={(text) => setFormData({ ...formData, addressLine2: text })}
          placeholder="Oficina 201"
          placeholderTextColor="#94A3B8"
        />
      </View>

      <View style={styles.formRow}>
        <View style={[styles.formGroup, styles.formGroupThird]}>
          <Text style={[styles.label, isTablet && styles.labelTablet]}>Distrito</Text>
          <TextInput
            style={[styles.input, isTablet && styles.inputTablet]}
            value={formData.district}
            onChangeText={(text) => setFormData({ ...formData, district: text })}
            placeholder="Miraflores"
            placeholderTextColor="#94A3B8"
          />
        </View>

        <View style={[styles.formGroup, styles.formGroupThird]}>
          <Text style={[styles.label, isTablet && styles.labelTablet]}>Provincia</Text>
          <TextInput
            style={[styles.input, isTablet && styles.inputTablet]}
            value={formData.province}
            onChangeText={(text) => setFormData({ ...formData, province: text })}
            placeholder="Lima"
            placeholderTextColor="#94A3B8"
          />
        </View>

        <View style={[styles.formGroup, styles.formGroupThird]}>
          <Text style={[styles.label, isTablet && styles.labelTablet]}>Departamento</Text>
          <TextInput
            style={[styles.input, isTablet && styles.inputTablet]}
            value={formData.department}
            onChangeText={(text) => setFormData({ ...formData, department: text })}
            placeholder="Lima"
            placeholderTextColor="#94A3B8"
          />
        </View>
      </View>

      <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet, { marginTop: 20 }]}>
        Términos Comerciales
      </Text>

      <View style={styles.formRow}>
        <View style={[styles.formGroup, styles.formGroupHalf]}>
          <Text style={[styles.label, isTablet && styles.labelTablet]}>Días de Crédito</Text>
          <TextInput
            style={[styles.input, isTablet && styles.inputTablet]}
            value={formData.paymentTermsDays}
            onChangeText={(text) => setFormData({ ...formData, paymentTermsDays: text })}
            placeholder="30"
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
          />
        </View>

        <View style={[styles.formGroup, styles.formGroupHalf]}>
          <Text style={[styles.label, isTablet && styles.labelTablet]}>
            Límite de Crédito (centavos)
          </Text>
          <TextInput
            style={[styles.input, isTablet && styles.inputTablet]}
            value={formData.creditLimitCents}
            onChangeText={(text) => setFormData({ ...formData, creditLimitCents: text })}
            placeholder="5000000"
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
          />
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, isTablet && styles.labelTablet]}>Notas</Text>
        <TextInput
          style={[styles.input, styles.textArea, isTablet && styles.inputTablet]}
          value={formData.notes}
          onChangeText={(text) => setFormData({ ...formData, notes: text })}
          placeholder="Notas adicionales..."
          placeholderTextColor="#94A3B8"
          multiline
          numberOfLines={4}
        />
      </View>

      <View style={styles.formGroup}>
        <View style={styles.switchRow}>
          <Text style={[styles.label, isTablet && styles.labelTablet]}>Activo</Text>
          <Switch
            value={formData.isActive}
            onValueChange={(value) => setFormData({ ...formData, isActive: value })}
            trackColor={{ false: '#CBD5E1', true: '#667eea' }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>
    </View>
  );

  const renderLegalEntitiesTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.tabHeader}>
        <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
          Razones Sociales
        </Text>
        <TouchableOpacity
          style={[styles.addButton, isTablet && styles.addButtonTablet]}
          onPress={handleAddLegalEntity}
        >
          <Text style={[styles.addButtonText, isTablet && styles.addButtonTextTablet]}>
            ➕ Agregar
          </Text>
        </TouchableOpacity>
      </View>

      {legalEntities.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📄</Text>
          <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
            No hay razones sociales agregadas
          </Text>
        </View>
      ) : (
        <View style={styles.itemsList}>
          {legalEntities.map((entity, index) => (
            <View key={index} style={[styles.itemCard, isTablet && styles.itemCardTablet]}>
              <View style={styles.itemHeader}>
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemTitle, isTablet && styles.itemTitleTablet]}>
                    {entity.legalName}
                    {entity.isPrimary && (
                      <Text style={styles.primaryBadge}> ⭐ Principal</Text>
                    )}
                  </Text>
                  <Text style={[styles.itemSubtitle, isTablet && styles.itemSubtitleTablet]}>
                    RUC: {entity.ruc}
                  </Text>
                  <Text style={[styles.itemDetail, isTablet && styles.itemDetailTablet]}>
                    {entity.taxAddress}
                  </Text>
                </View>
                <View style={styles.itemActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleEditLegalEntity(index)}
                  >
                    <Text style={styles.actionButtonText}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDeleteLegalEntity(index)}
                  >
                    <Text style={styles.actionButtonText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderContactsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.tabHeader}>
        <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
          Contactos
        </Text>
        <TouchableOpacity
          style={[styles.addButton, isTablet && styles.addButtonTablet]}
          onPress={handleAddContact}
        >
          <Text style={[styles.addButtonText, isTablet && styles.addButtonTextTablet]}>
            ➕ Agregar
          </Text>
        </TouchableOpacity>
      </View>

      {contacts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>👤</Text>
          <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
            No hay contactos agregados
          </Text>
        </View>
      ) : (
        <View style={styles.itemsList}>
          {contacts.map((contact, index) => (
            <View key={index} style={[styles.itemCard, isTablet && styles.itemCardTablet]}>
              <View style={styles.itemHeader}>
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemTitle, isTablet && styles.itemTitleTablet]}>
                    {contact.fullName}
                    {contact.isPrimary && (
                      <Text style={styles.primaryBadge}> ⭐ Principal</Text>
                    )}
                  </Text>
                  {contact.position && (
                    <Text style={[styles.itemSubtitle, isTablet && styles.itemSubtitleTablet]}>
                      {contact.position}
                    </Text>
                  )}
                  {contact.email && (
                    <Text style={[styles.itemDetail, isTablet && styles.itemDetailTablet]}>
                      📧 {contact.email}
                    </Text>
                  )}
                  {contact.phone && (
                    <Text style={[styles.itemDetail, isTablet && styles.itemDetailTablet]}>
                      📱 {contact.phone}
                    </Text>
                  )}
                </View>
                <View style={styles.itemActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleEditContact(index)}
                  >
                    <Text style={styles.actionButtonText}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDeleteContact(index)}
                  >
                    <Text style={styles.actionButtonText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderBanksTab = () => (
    <View style={styles.tabContent}>
      <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
        Cuentas Bancarias
      </Text>
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>🏦</Text>
        <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
          Las cuentas bancarias se gestionan después de crear el proveedor
        </Text>
      </View>
    </View>
  );

  const renderDebtsTab = () => (
    <View style={styles.tabContent}>
      <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
        Deudas y Transacciones
      </Text>
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>💰</Text>
        <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
          Las deudas se gestionan después de crear el proveedor
        </Text>
      </View>
    </View>
  );

  const renderPaymentsTab = () => (
    <View style={styles.tabContent}>
      <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
        Pagos
      </Text>
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>💳</Text>
        <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
          Los pagos se gestionan después de crear el proveedor
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={[styles.loadingText, isTablet && styles.loadingTextTablet]}>
            Cargando proveedor...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, isTablet && styles.headerTablet]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation?.goBack()}
        >
          <Text style={[styles.backButtonText, isTablet && styles.backButtonTextTablet]}>
            ← Volver
          </Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isTablet && styles.headerTitleTablet]}>
          {isEditMode ? 'Editar Proveedor' : 'Nuevo Proveedor'}
        </Text>
        <TouchableOpacity
          style={[styles.saveButton, isTablet && styles.saveButtonTablet, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={[styles.saveButtonText, isTablet && styles.saveButtonTextTablet]}>
            {saving ? 'Guardando...' : '💾 Guardar'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, isTablet && styles.tabsContainerTablet]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'general' && styles.tabActive]}
            onPress={() => setActiveTab('general')}
          >
            <Text style={[styles.tabText, activeTab === 'general' && styles.tabTextActive]}>
              General
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'legal' && styles.tabActive]}
            onPress={() => setActiveTab('legal')}
          >
            <Text style={[styles.tabText, activeTab === 'legal' && styles.tabTextActive]}>
              Razones Sociales
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'contacts' && styles.tabActive]}
            onPress={() => setActiveTab('contacts')}
          >
            <Text style={[styles.tabText, activeTab === 'contacts' && styles.tabTextActive]}>
              Contactos
            </Text>
          </TouchableOpacity>
          {isEditMode && (
            <>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'banks' && styles.tabActive]}
                onPress={() => setActiveTab('banks')}
              >
                <Text style={[styles.tabText, activeTab === 'banks' && styles.tabTextActive]}>
                  Cuentas Bancarias
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'debts' && styles.tabActive]}
                onPress={() => setActiveTab('debts')}
              >
                <Text style={[styles.tabText, activeTab === 'debts' && styles.tabTextActive]}>
                  Deudas
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'payments' && styles.tabActive]}
                onPress={() => setActiveTab('payments')}
              >
                <Text style={[styles.tabText, activeTab === 'payments' && styles.tabTextActive]}>
                  Pagos
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {activeTab === 'general' && renderGeneralTab()}
        {activeTab === 'legal' && renderLegalEntitiesTab()}
        {activeTab === 'contacts' && renderContactsTab()}
        {activeTab === 'banks' && renderBanksTab()}
        {activeTab === 'debts' && renderDebtsTab()}
        {activeTab === 'payments' && renderPaymentsTab()}
      </ScrollView>

      {/* Legal Entity Modal */}
      <Modal
        visible={showLegalEntityModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLegalEntityModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isTablet && styles.modalContentTablet]}>
            <Text style={[styles.modalTitle, isTablet && styles.modalTitleTablet]}>
              {editingLegalEntity !== null ? 'Editar' : 'Agregar'} Razón Social
            </Text>

            <View style={styles.formGroup}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>
                Razón Social <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, isTablet && styles.inputTablet]}
                value={legalEntityForm.legalName}
                onChangeText={(text) => setLegalEntityForm({ ...legalEntityForm, legalName: text })}
                placeholder="Distribuidora ABC S.A.C."
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>
                RUC <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, isTablet && styles.inputTablet]}
                value={legalEntityForm.ruc}
                onChangeText={(text) => setLegalEntityForm({ ...legalEntityForm, ruc: text })}
                placeholder="20123456789"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                maxLength={11}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>
                Dirección Fiscal <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, isTablet && styles.inputTablet]}
                value={legalEntityForm.taxAddress}
                onChangeText={(text) => setLegalEntityForm({ ...legalEntityForm, taxAddress: text })}
                placeholder="Av. Principal 123, Miraflores"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.formGroup}>
              <View style={styles.switchRow}>
                <Text style={[styles.label, isTablet && styles.labelTablet]}>Principal</Text>
                <Switch
                  value={legalEntityForm.isPrimary}
                  onValueChange={(value) => setLegalEntityForm({ ...legalEntityForm, isPrimary: value })}
                  trackColor={{ false: '#CBD5E1', true: '#667eea' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowLegalEntityModal(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSave]}
                onPress={handleSaveLegalEntity}
              >
                <Text style={styles.modalButtonTextSave}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Contact Modal */}
      <Modal
        visible={showContactModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowContactModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isTablet && styles.modalContentTablet]}>
            <Text style={[styles.modalTitle, isTablet && styles.modalTitleTablet]}>
              {editingContact !== null ? 'Editar' : 'Agregar'} Contacto
            </Text>

            <View style={styles.formGroup}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>
                Nombre Completo <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, isTablet && styles.inputTablet]}
                value={contactForm.fullName}
                onChangeText={(text) => setContactForm({ ...contactForm, fullName: text })}
                placeholder="Juan Pérez"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>Cargo</Text>
              <TextInput
                style={[styles.input, isTablet && styles.inputTablet]}
                value={contactForm.position}
                onChangeText={(text) => setContactForm({ ...contactForm, position: text })}
                placeholder="Gerente de Ventas"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>Email</Text>
              <TextInput
                style={[styles.input, isTablet && styles.inputTablet]}
                value={contactForm.email}
                onChangeText={(text) => setContactForm({ ...contactForm, email: text })}
                placeholder="jperez@abc.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>Teléfono</Text>
              <TextInput
                style={[styles.input, isTablet && styles.inputTablet]}
                value={contactForm.phone}
                onChangeText={(text) => setContactForm({ ...contactForm, phone: text })}
                placeholder="+51987654321"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <View style={styles.switchRow}>
                <Text style={[styles.label, isTablet && styles.labelTablet]}>Principal</Text>
                <Switch
                  value={contactForm.isPrimary}
                  onValueChange={(value) => setContactForm({ ...contactForm, isPrimary: value })}
                  trackColor={{ false: '#CBD5E1', true: '#667eea' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowContactModal(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSave]}
                onPress={handleSaveContact}
              >
                <Text style={styles.modalButtonTextSave}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTablet: {
    paddingHorizontal: 32,
    paddingVertical: 20,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonText: {
    fontSize: 15,
    color: '#667eea',
    fontWeight: '600',
  },
  backButtonTextTablet: {
    fontSize: 17,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
    textAlign: 'center',
  },
  headerTitleTablet: {
    fontSize: 22,
  },
  saveButton: {
    backgroundColor: '#667eea',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  saveButtonTablet: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButtonTextTablet: {
    fontSize: 16,
  },
  tabsContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 20,
  },
  tabsContainerTablet: {
    paddingHorizontal: 32,
  },
  tab: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#667eea',
  },
  tabText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#667eea',
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  tabContent: {
    padding: 20,
  },
  tabHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  sectionTitleTablet: {
    fontSize: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formGroupHalf: {
    flex: 1,
  },
  formGroupThird: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  labelTablet: {
    fontSize: 16,
  },
  required: {
    color: '#EF4444',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1E293B',
  },
  inputTablet: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addButton: {
    backgroundColor: '#667eea',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  addButtonTablet: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  addButtonTextTablet: {
    fontSize: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
  },
  emptyTextTablet: {
    fontSize: 17,
  },
  itemsList: {
    gap: 12,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemCardTablet: {
    padding: 16,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  itemTitleTablet: {
    fontSize: 17,
  },
  itemSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 2,
  },
  itemSubtitleTablet: {
    fontSize: 14,
  },
  itemDetail: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  itemDetailTablet: {
    fontSize: 13,
  },
  primaryBadge: {
    color: '#F59E0B',
    fontSize: 13,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 18,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#64748B',
  },
  loadingTextTablet: {
    fontSize: 17,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 500,
  },
  modalContentTablet: {
    padding: 32,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 20,
  },
  modalTitleTablet: {
    fontSize: 24,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F1F5F9',
  },
  modalButtonSave: {
    backgroundColor: '#667eea',
  },
  modalButtonTextCancel: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '600',
  },
  modalButtonTextSave: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});

