import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { companiesApi } from '@/services/api/companies';
import { sitesApi } from '@/services/api/sites';
import { Site } from '@/types/sites';
import { UserCompanySite } from '@/types/companies';

interface UserSitesManagementModalProps {
  visible: boolean;
  userId: string;
  userName: string;
  companyId: string;
  companyName: string;
  onClose: () => void;
}

/**
 * UserSitesManagementModal
 *
 * Gestiona las sedes asignadas a un usuario dentro de una empresa específica.
 * Permite asignar/desasignar sedes y configurar si el usuario puede seleccionarlas.
 *
 * Según la documentación:
 * - POST /companies/:id/sites/assign - Asignar sedes a un usuario
 * - GET /companies/:id/users/:userId/sites - Obtener sedes del usuario
 */
export const UserSitesManagementModal: React.FC<UserSitesManagementModalProps> = ({
  visible,
  userId,
  userName,
  companyId,
  companyName,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [allSites, setAllSites] = useState<Site[]>([]);
  const [userSites, setUserSites] = useState<UserCompanySite[]>([]);
  const [selectedSites, setSelectedSites] = useState<Set<string>>(new Set());
  const [canSelect, setCanSelect] = useState(true);

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible, userId, companyId]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadAllSites(), loadUserSites()]);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'No se pudo cargar la información');
    } finally {
      setLoading(false);
    }
  };

  const loadAllSites = async () => {
    try {
      const response = await sitesApi.getSites({ limit: 100, isActive: true });
      // Filtrar solo las sedes de la empresa actual
      const companySites = response.data.filter((site) => site.companyId === companyId);
      setAllSites(companySites);
    } catch (error) {
      console.error('Error loading sites:', error);
      throw error;
    }
  };

  const loadUserSites = async () => {
    try {
      const response = await companiesApi.getUserSites(companyId, userId);
      const sitesData = Array.isArray(response) ? response : response.data || [];
      setUserSites(sitesData);

      // Pre-seleccionar las sedes ya asignadas
      const assignedSiteIds = new Set(sitesData.map((s: UserCompanySite) => s.siteId));
      setSelectedSites(assignedSiteIds);
    } catch (error) {
      console.error('Error loading user sites:', error);
      setUserSites([]);
      setSelectedSites(new Set());
    }
  };

  const toggleSiteSelection = (siteId: string) => {
    const newSelection = new Set(selectedSites);
    if (newSelection.has(siteId)) {
      newSelection.delete(siteId);
    } else {
      newSelection.add(siteId);
    }
    setSelectedSites(newSelection);
  };

  const handleSave = async () => {
    if (selectedSites.size === 0) {
      Alert.alert(
        'Advertencia',
        '¿Estás seguro de que deseas quitar todas las sedes del usuario?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Continuar', onPress: () => saveChanges() },
        ]
      );
      return;
    }

    await saveChanges();
  };

  const saveChanges = async () => {
    setLoading(true);
    try {
      await companiesApi.assignUserToSites(companyId, {
        userId,
        siteIds: Array.from(selectedSites),
        canSelect,
      });

      Alert.alert('Éxito', 'Sedes actualizadas correctamente');
      await loadUserSites();
    } catch (error: any) {
      console.error('Error saving sites:', error);
      Alert.alert('Error', error.message || 'No se pudieron actualizar las sedes');
    } finally {
      setLoading(false);
    }
  };

  const renderSiteCard = (site: Site) => {
    const isSelected = selectedSites.has(site.id);
    const userSite = userSites.find((us) => us.siteId === site.id);

    return (
      <TouchableOpacity
        key={site.id}
        style={[styles.siteCard, isSelected && styles.siteCardSelected]}
        onPress={() => toggleSiteSelection(site.id)}
        activeOpacity={0.7}
      >
        <View style={styles.siteCardContent}>
          <View style={styles.siteInfo}>
            <Text style={styles.siteName}>{site.name}</Text>
            <Text style={styles.siteCode}>Código: {site.code}</Text>
          </View>
          <View style={styles.checkboxContainer}>
            <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
              {isSelected && <Text style={styles.checkmark}>✓</Text>}
            </View>
          </View>
        </View>
        {userSite && (
          <View style={styles.siteMetadata}>
            <Text style={styles.metadataText}>
              {userSite.canSelect ? '✅ Puede seleccionar' : '⚠️ No puede seleccionar'}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>📍 Gestión de Sedes</Text>
              <Text style={styles.modalSubtitle}>Usuario: {userName}</Text>
              <Text style={styles.modalSubtitle}>Empresa: {companyName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {loading && allSites.length === 0 ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary[500]} />
                <Text style={styles.loadingText}>Cargando sedes...</Text>
              </View>
            ) : (
              <>
                {/* Info Card */}
                <View style={styles.infoCard}>
                  <Text style={styles.infoText}>
                    Selecciona las sedes a las que el usuario tendrá acceso dentro de esta empresa.
                  </Text>
                </View>

                {/* Can Select Switch */}
                <View style={styles.switchCard}>
                  <View style={styles.switchContent}>
                    <View>
                      <Text style={styles.switchLabel}>Permitir Selección de Sede</Text>
                      <Text style={styles.switchHint}>
                        El usuario podrá cambiar entre las sedes asignadas
                      </Text>
                    </View>
                    <Switch
                      value={canSelect}
                      onValueChange={setCanSelect}
                      trackColor={{ false: colors.neutral[300], true: colors.primary[500] }}
                      thumbColor={canSelect ? colors.neutral[0] : colors.neutral[400]}
                    />
                  </View>
                </View>

                {/* Stats */}
                <View style={styles.statsCard}>
                  <View style={styles.statItem}>
                    <Text style={styles.statNumber}>{allSites.length}</Text>
                    <Text style={styles.statLabel}>Sedes Disponibles</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statNumber}>{selectedSites.size}</Text>
                    <Text style={styles.statLabel}>Sedes Seleccionadas</Text>
                  </View>
                </View>

                {/* Sites List */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Sedes de la Empresa</Text>
                  {allSites.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateIcon}>🏢</Text>
                      <Text style={styles.emptyStateText}>
                        No hay sedes disponibles en esta empresa
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.sitesList}>{allSites.map(renderSiteCard)}</View>
                  )}
                </View>
              </>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={loading}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.neutral[0]} />
              ) : (
                <Text style={styles.saveButtonText}>Guardar Cambios</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius['2xl'],
    width: '90%',
    maxWidth: 600,
    height: '85%',
    shadowColor: colors.neutral[950],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.neutral[800],
    marginBottom: spacing[1],
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.neutral[500],
    marginBottom: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius['2xl'],
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: colors.neutral[500],
    fontWeight: 'bold',
  },
  scrollContent: {
    flex: 1,
    padding: spacing[5],
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing[3],
    fontSize: 16,
    color: colors.neutral[500],
  },
  infoCard: {
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[4],
    borderLeftWidth: 4,
    borderLeftColor: colors.primary[500],
  },
  infoText: {
    fontSize: 14,
    color: colors.primary[800],
    lineHeight: 20,
  },
  switchCard: {
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  switchContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: spacing[1],
  },
  switchHint: {
    fontSize: 13,
    color: colors.neutral[500],
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[5],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.neutral[200],
    marginHorizontal: spacing[4],
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary[500],
    marginBottom: spacing[1],
  },
  statLabel: {
    fontSize: 13,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing[5],
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: spacing[3],
  },
  sitesList: {
    gap: spacing[3],
  },
  siteCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    borderWidth: 2,
    borderColor: colors.neutral[200],
    marginBottom: spacing[2],
  },
  siteCardSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  siteCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  siteInfo: {
    flex: 1,
  },
  siteName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: spacing[1],
  },
  siteCode: {
    fontSize: 14,
    color: colors.neutral[500],
    marginBottom: spacing[1],
  },
  siteAddress: {
    fontSize: 13,
    color: colors.neutral[400],
  },
  checkboxContainer: {
    marginLeft: spacing[3],
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    backgroundColor: colors.neutral[0],
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  checkmark: {
    color: colors.neutral[0],
    fontSize: 18,
    fontWeight: 'bold',
  },
  siteMetadata: {
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  metadataText: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: spacing[4],
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    padding: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    gap: spacing[3],
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.neutral[500],
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    padding: 14,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: colors.neutral[400],
  },
  saveButtonText: {
    color: colors.neutral[0],
    fontSize: 16,
    fontWeight: '600',
  },
});

export default UserSitesManagementModal;
