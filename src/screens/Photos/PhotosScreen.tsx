import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { activeOpacity, borderRadius, colors, shadows, spacing } from '@/design-system/tokens';
import { MAIN_ROUTES } from '@/constants/routes';
import { photoCampaignsApi } from '@/services/api';
import { PhotoCampaign, PhotoCampaignStatus } from '@/types/photo-campaigns';

interface PhotosScreenProps {
  navigation: any;
}

const statusLabel: Record<PhotoCampaignStatus, string> = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activa',
  CLOSED: 'Cerrada',
};

export const PhotosScreen: React.FC<PhotosScreenProps> = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [campaigns, setCampaigns] = useState<PhotoCampaign[]>([]);
  const [search, setSearch] = useState('');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignDescription, setNewCampaignDescription] = useState('');

  const loadCampaigns = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      }

      const response = await photoCampaignsApi.getCampaigns();
      setCampaigns(response);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudieron cargar las campañas de fotos');
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await loadCampaigns(false);
    } finally {
      setRefreshing(false);
    }
  };

  const filteredCampaigns = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return campaigns;
    }

    return campaigns.filter((campaign) => {
      const text = `${campaign.code} ${campaign.name} ${campaign.description || ''}`.toLowerCase();
      return text.includes(query);
    });
  }, [campaigns, search]);

  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim()) {
      Alert.alert('Validación', 'El nombre de campaña es obligatorio');
      return;
    }

    try {
      setSubmitting(true);
      await photoCampaignsApi.createCampaign({
        name: newCampaignName.trim(),
        description: newCampaignDescription.trim() || undefined,
      });

      setCreateModalVisible(false);
      setNewCampaignName('');
      setNewCampaignDescription('');
      await loadCampaigns(false);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudo crear la campaña');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loaderText}>Cargando campañas de fotos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={activeOpacity.medium}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Campañas de Fotos</Text>
      </View>

      <View style={styles.content}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por código, nombre o descripción..."
          placeholderTextColor="#94A3B8"
        />

        <ScrollView
          style={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          {filteredCampaigns.map((campaign) => (
            <View key={campaign.id} style={styles.card}>
              <View style={styles.cardTopRow}>
                <Text style={styles.code}>{campaign.code}</Text>
                <Text style={styles.status}>{statusLabel[campaign.status]}</Text>
              </View>

              <Text style={styles.name}>{campaign.name}</Text>
              {!!campaign.description && (
                <Text style={styles.description} numberOfLines={2}>
                  {campaign.description}
                </Text>
              )}

              <TouchableOpacity
                style={styles.manageButton}
                onPress={() =>
                  navigation.navigate(MAIN_ROUTES.PHOTO_CAMPAIGN_MANAGEMENT, {
                    campaignId: campaign.id,
                  })
                }
              >
                <Text style={styles.manageButtonText}>Gestionar campaña</Text>
              </TouchableOpacity>
            </View>
          ))}

          {filteredCampaigns.length === 0 && (
            <Text style={styles.emptyText}>No hay campañas de fotos para mostrar</Text>
          )}
        </ScrollView>
      </View>

      <View style={styles.floatingActionsContainer} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.floatingCreateButton}
          onPress={() => setCreateModalVisible(true)}
          activeOpacity={activeOpacity.medium}
        >
          <Text style={styles.floatingCreateButtonText}>+ Campaña</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={createModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nueva campaña</Text>

            <Text style={styles.inputLabel}>Nombre *</Text>
            <TextInput
              style={styles.input}
              value={newCampaignName}
              onChangeText={setNewCampaignName}
              placeholder="Nombre *"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>Descripción</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              multiline
              value={newCampaignDescription}
              onChangeText={setNewCampaignDescription}
              placeholder="Descripción"
              placeholderTextColor="#94A3B8"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  setCreateModalVisible(false);
                  setNewCampaignName('');
                  setNewCampaignDescription('');
                }}
                disabled={submitting}
              >
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => void handleCreateCampaign()}
                disabled={submitting}
              >
                <Text style={styles.primaryButtonText}>
                  {submitting ? 'Guardando...' : 'Guardar'}
                </Text>
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
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[2],
  },
  backText: {
    fontSize: 22,
    color: colors.text.primary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  content: {
    flex: 1,
    padding: spacing[3],
  },
  floatingActionsContainer: {
    position: 'absolute',
    right: 20,
    bottom: 130,
    zIndex: 999,
    alignItems: 'flex-end',
  },
  floatingCreateButton: {
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[3.5],
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[900],
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  floatingCreateButtonText: {
    color: colors.text.inverse,
    fontWeight: '700',
    fontSize: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border.medium,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface.primary,
    color: colors.text.primary,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
    marginBottom: spacing[3],
  },
  inputLabel: {
    marginTop: spacing[0.5],
    marginBottom: spacing[1.5],
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border.medium,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface.primary,
    color: colors.text.primary,
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[2],
    marginBottom: spacing[2],
  },
  multiline: {
    minHeight: 74,
    textAlignVertical: 'top',
  },
  list: {
    flex: 1,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface.primary,
    padding: spacing[3],
    marginBottom: spacing[2.5],
    ...shadows.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[1.5],
  },
  code: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '700',
  },
  status: {
    fontSize: 12,
    color: colors.primary[900],
    fontWeight: '700',
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  description: {
    marginTop: spacing[1],
    fontSize: 12,
    color: colors.text.secondary,
  },
  manageButton: {
    marginTop: spacing[3],
    backgroundColor: colors.primary[900],
    borderRadius: borderRadius.md,
    paddingVertical: spacing[2.25],
    alignItems: 'center',
  },
  manageButtonText: {
    color: colors.text.inverse,
    fontWeight: '700',
    fontSize: 12,
  },
  emptyText: {
    marginTop: spacing[6],
    textAlign: 'center',
    color: colors.text.tertiary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
  },
  modalCard: {
    width: '100%',
    maxWidth: 560,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface.primary,
    padding: spacing[3.5],
    borderWidth: 1,
    borderColor: colors.border.light,
    ...shadows.md,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing[2.5],
  },
  modalActions: {
    marginTop: spacing[2],
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing[2],
  },
  primaryButton: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[900],
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: colors.text.inverse,
    fontWeight: '700',
    fontSize: 12,
  },
  secondaryButton: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    marginTop: spacing[3],
    color: colors.text.secondary,
  },
});
