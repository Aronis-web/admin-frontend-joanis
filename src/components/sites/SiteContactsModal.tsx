import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert as RNAlert,
  ActivityIndicator,
} from 'react-native';
import Alert from '@/utils/alert';
import { Site } from '@/types/sites';
import {
  SiteContact,
  SiteNotificationType,
  CreateSiteContactRequest,
  UpdateSiteContactRequest,
} from '@/types/site-contacts';
import { siteContactsApi } from '@/services/api/site-contacts';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';

interface SiteContactsModalProps {
  visible: boolean;
  site: Site | null;
  onClose: () => void;
}

export const SiteContactsModal: React.FC<SiteContactsModalProps> = ({
  visible,
  site,
  onClose,
}) => {
  const [contacts, setContacts] = useState<SiteContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingContact, setEditingContact] = useState<SiteContact | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [formData, setFormData] = useState<CreateSiteContactRequest>({
    contactName: '',
    phoneNumber: '',
    email: '',
    notificationTypes: [],
    receiveWhatsApp: true,
    receiveEmail: true,
    position: '',
    notes: '',
  });

  useEffect(() => {
    if (visible && site) {
      loadContacts();
    }
  }, [visible, site]);

  const loadContacts = async () => {
    if (!site) return;

    try {
      setLoading(true);
      const data = await siteContactsApi.getSiteContacts(site.id);
      setContacts(data);
    } catch (error: any) {
      console.error('Error loading contacts:', error);
      Alert.alert('Error', 'No se pudieron cargar los contactos');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateContact = async () => {
    if (!site) return;

    if (!formData.contactName || !formData.phoneNumber) {
      Alert.alert('Error', 'El nombre y teléfono son requeridos');
      return;
    }

    if (formData.notificationTypes.length === 0) {
      Alert.alert('Error', 'Debe seleccionar al menos un tipo de notificación');
      return;
    }

    try {
      await siteContactsApi.createContact(site.id, formData);
      Alert.alert('Éxito', 'Contacto creado correctamente');
      resetForm();
      setShowCreateForm(false);
      loadContacts();
    } catch (error: any) {
      console.error('Error creating contact:', error);
      Alert.alert('Error', error.message || 'No se pudo crear el contacto');
    }
  };

  const handleUpdateContact = async () => {
    if (!editingContact) return;

    try {
      const updateData: UpdateSiteContactRequest = {
        contactName: formData.contactName,
        phoneNumber: formData.phoneNumber,
        email: formData.email || undefined,
        notificationTypes: formData.notificationTypes,
        receiveWhatsApp: formData.receiveWhatsApp,
        receiveEmail: formData.receiveEmail,
        position: formData.position || undefined,
        notes: formData.notes || undefined,
      };

      await siteContactsApi.updateContact(editingContact.id, updateData);
      Alert.alert('Éxito', 'Contacto actualizado correctamente');
      resetForm();
      setEditingContact(null);
      loadContacts();
    } catch (error: any) {
      console.error('Error updating contact:', error);
      Alert.alert('Error', error.message || 'No se pudo actualizar el contacto');
    }
  };

  const handleDeleteContact = (contact: SiteContact) => {
    Alert.alert(
      'Confirmar Eliminación',
      `¿Estás seguro de eliminar el contacto "${contact.contactName}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await siteContactsApi.deactivateContact(contact.id);
              Alert.alert('Éxito', 'Contacto eliminado correctamente');
              loadContacts();
            } catch (error: any) {
              console.error('Error deleting contact:', error);
              Alert.alert('Error', error.message || 'No se pudo eliminar el contacto');
            }
          },
        },
      ]
    );
  };

  const handleEditContact = (contact: SiteContact) => {
    setEditingContact(contact);
    setFormData({
      contactName: contact.contactName,
      phoneNumber: contact.phoneNumber,
      email: contact.email || '',
      notificationTypes: contact.notificationTypes,
      receiveWhatsApp: contact.receiveWhatsApp,
      receiveEmail: contact.receiveEmail,
      position: contact.position || '',
      notes: contact.notes || '',
    });
    setShowCreateForm(true);
  };

  const resetForm = () => {
    setFormData({
      contactName: '',
      phoneNumber: '',
      email: '',
      notificationTypes: [],
      receiveWhatsApp: true,
      receiveEmail: true,
      position: '',
      notes: '',
    });
  };

  const toggleNotificationType = (type: SiteNotificationType) => {
    setFormData((prev) => ({
      ...prev,
      notificationTypes: prev.notificationTypes.includes(type)
        ? prev.notificationTypes.filter((t) => t !== type)
        : [...prev.notificationTypes, type],
    }));
  };

  const getNotificationTypeLabel = (type: SiteNotificationType): string => {
    const labels: Record<SiteNotificationType, string> = {
      [SiteNotificationType.TRASLADOS]: 'Traslados',
      [SiteNotificationType.MARCADORES]: 'Marcadores',
      [SiteNotificationType.FALTANTES]: 'Faltantes',
      [SiteNotificationType.INVENTARIO]: 'Inventario',
      [SiteNotificationType.REPARTOS]: 'Repartos',
      [SiteNotificationType.ALERTAS_GENERALES]: 'Alertas Generales',
    };
    return labels[type];
  };

  const getNotificationTypeIcon = (type: SiteNotificationType): string => {
    const icons: Record<SiteNotificationType, string> = {
      [SiteNotificationType.TRASLADOS]: '🚚',
      [SiteNotificationType.MARCADORES]: '📍',
      [SiteNotificationType.FALTANTES]: '⚠️',
      [SiteNotificationType.INVENTARIO]: '📦',
      [SiteNotificationType.REPARTOS]: '🛵',
      [SiteNotificationType.ALERTAS_GENERALES]: '🔔',
    };
    return icons[type];
  };

  const filteredContacts = contacts.filter((contact) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      contact.contactName.toLowerCase().includes(query) ||
      contact.phoneNumber.includes(query) ||
      contact.email?.toLowerCase().includes(query) ||
      contact.position?.toLowerCase().includes(query)
    );
  });

  if (!site) return null;

  const renderContactItem = (contact: SiteContact) => (
    <View key={contact.id} style={styles.contactCard}>
      <View style={styles.contactHeader}>
        <View style={styles.contactAvatar}>
          <Text style={styles.contactAvatarText}>
            {contact.contactName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{contact.contactName}</Text>
          {contact.position && <Text style={styles.contactPosition}>{contact.position}</Text>}
        </View>
        <View
          style={[
            styles.statusBadge,
            contact.isActive ? styles.statusActive : styles.statusInactive,
          ]}
        >
          <Text style={styles.statusText}>{contact.isActive ? 'Activo' : 'Inactivo'}</Text>
        </View>
      </View>

      <View style={styles.contactDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailIcon}>📞</Text>
          <Text style={styles.detailText}>{contact.phoneNumber}</Text>
        </View>
        {contact.email && (
          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>📧</Text>
            <Text style={styles.detailText}>{contact.email}</Text>
          </View>
        )}
      </View>

      <View style={styles.channelsContainer}>
        <Text style={styles.channelsLabel}>Canales:</Text>
        <View style={styles.channelsList}>
          {contact.receiveWhatsApp && (
            <View style={styles.channelBadge}>
              <Text style={styles.channelText}>WhatsApp</Text>
            </View>
          )}
          {contact.receiveEmail && (
            <View style={styles.channelBadge}>
              <Text style={styles.channelText}>Email</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.notificationsContainer}>
        <Text style={styles.notificationsLabel}>Notificaciones:</Text>
        <View style={styles.notificationsList}>
          {contact.notificationTypes.map((type) => (
            <View key={type} style={styles.notificationBadge}>
              <Text style={styles.notificationIcon}>{getNotificationTypeIcon(type)}</Text>
              <Text style={styles.notificationText}>{getNotificationTypeLabel(type)}</Text>
            </View>
          ))}
        </View>
      </View>

      {contact.notes && (
        <View style={styles.notesContainer}>
          <Text style={styles.notesLabel}>Notas:</Text>
          <Text style={styles.notesText}>{contact.notes}</Text>
        </View>
      )}

      <ProtectedElement
        requiredPermissions={['sites.contacts.update', 'sites.contacts.delete']}
        fallback={null}
      >
        <View style={styles.contactActions}>
          <TouchableOpacity
            style={styles.editContactButton}
            onPress={() => handleEditContact(contact)}
          >
            <Text style={styles.editContactButtonText}>✏️ Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteContactButton}
            onPress={() => handleDeleteContact(contact)}
          >
            <Text style={styles.deleteContactButtonText}>🗑️ Eliminar</Text>
          </TouchableOpacity>
        </View>
      </ProtectedElement>
    </View>
  );

  const renderForm = () => (
    <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.formTitle}>
        {editingContact ? 'Editar Contacto' : 'Nuevo Contacto'}
      </Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Nombre Completo *</Text>
        <TextInput
          style={styles.input}
          value={formData.contactName}
          onChangeText={(text) => setFormData({ ...formData, contactName: text })}
          placeholder="Juan Pérez"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Teléfono *</Text>
        <TextInput
          style={styles.input}
          value={formData.phoneNumber}
          onChangeText={(text) => setFormData({ ...formData, phoneNumber: text })}
          placeholder="+51999888777"
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={formData.email}
          onChangeText={(text) => setFormData({ ...formData, email: text })}
          placeholder="juan.perez@empresa.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Cargo/Posición</Text>
        <TextInput
          style={styles.input}
          value={formData.position}
          onChangeText={(text) => setFormData({ ...formData, position: text })}
          placeholder="Jefe de Almacén"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Tipos de Notificaciones *</Text>
        <View style={styles.checkboxGroup}>
          {Object.values(SiteNotificationType).map((type) => (
            <TouchableOpacity
              key={type}
              style={styles.checkboxItem}
              onPress={() => toggleNotificationType(type)}
            >
              <View
                style={[
                  styles.checkbox,
                  formData.notificationTypes.includes(type) && styles.checkboxChecked,
                ]}
              >
                {formData.notificationTypes.includes(type) && (
                  <Text style={styles.checkboxIcon}>✓</Text>
                )}
              </View>
              <Text style={styles.checkboxLabel}>
                {getNotificationTypeIcon(type)} {getNotificationTypeLabel(type)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Canales de Notificación</Text>
        <TouchableOpacity
          style={styles.checkboxItem}
          onPress={() =>
            setFormData({ ...formData, receiveWhatsApp: !formData.receiveWhatsApp })
          }
        >
          <View style={[styles.checkbox, formData.receiveWhatsApp && styles.checkboxChecked]}>
            {formData.receiveWhatsApp && <Text style={styles.checkboxIcon}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>Recibir por WhatsApp</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.checkboxItem}
          onPress={() => setFormData({ ...formData, receiveEmail: !formData.receiveEmail })}
        >
          <View style={[styles.checkbox, formData.receiveEmail && styles.checkboxChecked]}>
            {formData.receiveEmail && <Text style={styles.checkboxIcon}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>Recibir por Email</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Notas</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.notes}
          onChangeText={(text) => setFormData({ ...formData, notes: text })}
          placeholder="Disponible de 8am a 6pm"
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={styles.formActions}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => {
            setShowCreateForm(false);
            setEditingContact(null);
            resetForm();
          }}
        >
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={editingContact ? handleUpdateContact : handleCreateContact}
        >
          <Text style={styles.saveButtonText}>
            {editingContact ? 'Actualizar' : 'Crear'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <Text style={styles.modalIcon}>📞</Text>
              <View>
                <Text style={styles.modalTitle}>Contactos de Sede</Text>
                <Text style={styles.modalSubtitle}>{site.name}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          {showCreateForm ? (
            renderForm()
          ) : (
            <>
              {/* Search Bar */}
              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Buscar contactos..."
                  placeholderTextColor="#94A3B8"
                />
              </View>

              {/* Contacts List */}
              <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text style={styles.loadingText}>Cargando contactos...</Text>
                  </View>
                ) : filteredContacts.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyIcon}>📞</Text>
                    <Text style={styles.emptyText}>
                      {searchQuery ? 'No se encontraron contactos' : 'No hay contactos registrados'}
                    </Text>
                    <Text style={styles.emptyHint}>
                      Agrega contactos para recibir notificaciones
                    </Text>
                  </View>
                ) : (
                  filteredContacts.map(renderContactItem)
                )}
              </ScrollView>

              {/* Stats Footer */}
              <View style={styles.statsFooter}>
                <Text style={styles.statsText}>
                  Total: {filteredContacts.length} contacto{filteredContacts.length !== 1 ? 's' : ''}
                </Text>
              </View>

              {/* Add Button */}
              <ProtectedElement requiredPermissions={['sites.contacts.create']} fallback={null}>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => {
                    resetForm();
                    setShowCreateForm(true);
                  }}
                >
                  <Text style={styles.addButtonText}>+ Nuevo Contacto</Text>
                </TouchableOpacity>
              </ProtectedElement>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1E293B',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    maxHeight: 400,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: '#94A3B8',
  },
  contactCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactAvatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  contactPosition: {
    fontSize: 13,
    color: '#64748B',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusActive: {
    backgroundColor: '#D1FAE5',
  },
  statusInactive: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  contactDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#1E293B',
  },
  channelsContainer: {
    marginBottom: 12,
  },
  channelsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  channelsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  channelBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  channelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E40AF',
  },
  notificationsContainer: {
    marginBottom: 12,
  },
  notificationsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  notificationsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  notificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  notificationIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  notificationText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
  },
  notesContainer: {
    marginBottom: 12,
  },
  notesLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 13,
    color: '#1E293B',
    fontStyle: 'italic',
  },
  contactActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  editContactButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  editContactButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  deleteContactButton: {
    flex: 1,
    backgroundColor: '#EF4444',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteContactButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statsFooter: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  statsText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '500',
  },
  addButton: {
    marginHorizontal: 24,
    marginTop: 12,
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  formContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    maxHeight: 500,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1E293B',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  checkboxGroup: {
    gap: 12,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  checkboxIcon: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#1E293B',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 20,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default SiteContactsModal;
