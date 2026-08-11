import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import Alert from '@/utils/alert';

import { activeOpacity } from '@/design-system/tokens';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { MAIN_ROUTES } from '@/constants/routes';
import { photoCampaignsApi } from '@/services/api';
import { PhotoCampaign, PhotoCampaignStatus } from '@/types/photo-campaigns';
import { ProtectedFAB } from '@/components/ui/ProtectedFAB';
import { PERMISSIONS } from '@/constants/permissions';

interface PhotosScreenProps {
  navigation: any;
}

const statusLabel: Record<PhotoCampaignStatus, string> = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activa',
  CLOSED: 'Cerrada',
};

export const PhotosScreen: React.FC<PhotosScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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
          <ActivityIndicator size="large" color={theme.color.icon.accent} />
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
          placeholderTextColor={theme.color.text.placeholder}
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

      <ProtectedFAB
        actions={[
          {
            icon: 'camera-outline',
            label: 'Crear Campaña',
            onPress: () => setCreateModalVisible(true),
            requiredPermissions: [PERMISSIONS.PHOTO_CAMPAIGNS.CREATE],
          },
        ]}
      />

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
              placeholderTextColor={theme.color.text.placeholder}
            />

            <Text style={styles.inputLabel}>Descripción</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              multiline
              value={newCampaignDescription}
              onChangeText={setNewCampaignDescription}
              placeholder="Descripción"
              placeholderTextColor={theme.color.text.placeholder}
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

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background.subtle,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.full,
    backgroundColor: theme.color.surface.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.space[2],
  },
  backText: {
    fontSize: 22,
    color: theme.color.text.heading,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  content: {
    flex: 1,
    padding: theme.space[3],
  },
  floatingActionsContainer: {
    position: 'absolute',
    right: 20,
    bottom: 130,
    zIndex: 999,
    alignItems: 'flex-end',
  },
  floatingCreateButton: {
    paddingVertical: theme.space[2.5],
    paddingHorizontal: theme.space[3.5],
    borderRadius: theme.radii.full,
    backgroundColor: theme.color.brand.primary,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.md,
  },
  floatingCreateButtonText: {
    color: theme.color.text.inverse,
    fontWeight: '700',
    fontSize: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: theme.color.border.default,
    borderRadius: theme.radii.md,
    backgroundColor: theme.color.surface.base,
    color: theme.color.text.body,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2.5],
    marginBottom: theme.space[3],
  },
  inputLabel: {
    marginTop: theme.space[0.5],
    marginBottom: theme.space[1.5],
    color: theme.color.text.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: theme.color.border.default,
    borderRadius: theme.radii.md,
    backgroundColor: theme.color.surface.base,
    color: theme.color.text.body,
    paddingHorizontal: theme.space[2.5],
    paddingVertical: theme.space[2],
    marginBottom: theme.space[2],
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
    borderColor: theme.color.border.subtle,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.surface.base,
    padding: theme.space[3],
    marginBottom: theme.space[2.5],
    ...theme.shadow.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.space[1.5],
  },
  code: {
    fontSize: 12,
    color: theme.color.text.muted,
    fontWeight: '700',
  },
  status: {
    fontSize: 12,
    color: theme.color.brand.primary,
    fontWeight: '700',
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  description: {
    marginTop: theme.space[1],
    fontSize: 12,
    color: theme.color.text.muted,
  },
  manageButton: {
    marginTop: theme.space[3],
    backgroundColor: theme.color.brand.primary,
    borderRadius: theme.radii.md,
    paddingVertical: theme.space[2.5],
    alignItems: 'center',
  },
  manageButtonText: {
    color: theme.color.text.inverse,
    fontWeight: '700',
    fontSize: 12,
  },
  emptyText: {
    marginTop: theme.space[6],
    textAlign: 'center',
    color: theme.color.text.placeholder,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: theme.color.overlay.medium,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.space[4],
  },
  modalCard: {
    width: '100%',
    maxWidth: 560,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.surface.base,
    padding: theme.space[3.5],
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    ...theme.shadow.md,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.color.text.heading,
    marginBottom: theme.space[2.5],
  },
  modalActions: {
    marginTop: theme.space[2],
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.space[2],
  },
  primaryButton: {
    paddingVertical: theme.space[2],
    paddingHorizontal: theme.space[3],
    borderRadius: theme.radii.md,
    backgroundColor: theme.color.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: theme.color.text.inverse,
    fontWeight: '700',
    fontSize: 12,
  },
  secondaryButton: {
    paddingVertical: theme.space[2],
    paddingHorizontal: theme.space[3],
    borderRadius: theme.radii.md,
    backgroundColor: theme.color.surface.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: theme.color.text.heading,
    fontWeight: '700',
    fontSize: 12,
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    marginTop: theme.space[3],
    color: theme.color.text.muted,
  },
});
