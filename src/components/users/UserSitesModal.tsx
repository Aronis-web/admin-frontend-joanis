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
} from 'react-native';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { companiesApi } from '@/services/api/companies';
import { sitesApi } from '@/services/api/sites';
import { Company } from '@/types/companies';
import { Site } from '@/types/sites';

interface UserSitesModalProps {
  visible: boolean;
  userId: string;
  onClose: () => void;
}

export const UserSitesModal: React.FC<UserSitesModalProps> = ({ visible, userId, onClose }) => {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadSites();
    }
  }, [visible, userId]);

  const loadSites = async () => {
    try {
      setLoading(true);
      // Get all companies for the user
      const userCompanies = await companiesApi.getUserCompanies(userId);

      // Get all sites from user's companies
      const allSites: Site[] = [];
      for (const company of userCompanies) {
        try {
          const response = await companiesApi.getCompanySites(company.id, {
            limit: 100,
          });
          allSites.push(...response.data);
        } catch (error) {
          console.error(`Error loading sites for company ${company.id}:`, error);
        }
      }
      setSites(allSites);
    } catch (error: any) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'No se pudieron cargar las sedes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Sedes Disponibles</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.accent[500]} />
              <Text style={styles.loadingText}>Cargando sedes...</Text>
            </View>
          ) : (
            <ScrollView style={styles.scrollContent}>
              {sites.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No hay sedes disponibles</Text>
                </View>
              ) : (
                sites.map((site) => (
                  <View key={site.id} style={styles.siteItem}>
                    <View style={styles.siteInfo}>
                      <Text style={styles.siteName}>{site.name}</Text>
                      <Text style={styles.siteCode}>Código: {site.code}</Text>
                      {site.fullAddress && (
                        <Text style={styles.siteAddress}>{site.fullAddress}</Text>
                      )}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          )}

          {/* Actions */}
          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.button, styles.closeButton]} onPress={onClose}>
              <Text style={styles.closeButtonText}>Cerrar</Text>
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
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: borderRadius.full,
    borderTopRightRadius: borderRadius.full,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 28,
    color: colors.neutral[500],
    fontWeight: '300',
  },
  scrollContent: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: spacing[3],
    fontSize: 16,
    color: colors.neutral[500],
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.neutral[500],
  },
  siteItem: {
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
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
    marginBottom: 2,
  },
  siteAddress: {
    fontSize: 13,
    color: colors.neutral[400],
  },
  modalActions: {
    padding: spacing[5],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  button: {
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    backgroundColor: colors.accent[500],
  },
});
