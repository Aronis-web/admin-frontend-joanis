import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { photoCampaignsApi } from '@/services/api';
import { PhotoCampaign, PhotoCampaignStatus } from '@/types/photo-campaigns';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import Alert from '@/utils/alert';
import { SendPhotoCampaignWhatsAppModal } from './SendPhotoCampaignWhatsAppModal';

interface LinkPhotoCampaignModalProps {
  visible: boolean;
  onClose: () => void;
  /** ID de la campaña regular que se quiere anexar. */
  campaignId: string;
  /** Nombre de la campaña regular (para autocompletar al crear una nueva). */
  campaignName?: string;
  /** Se llama tras anexar/desvincular con éxito. */
  onChanged?: () => void;
}

const statusLabel: Record<PhotoCampaignStatus, string> = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activa',
  CLOSED: 'Cerrada',
};

// Cantidad máxima de campañas de fotos que se muestran en "Anexar a existente".
const MAX_AVAILABLE_CAMPAIGNS = 5;

export const LinkPhotoCampaignModal: React.FC<LinkPhotoCampaignModalProps> = ({
  visible,
  onClose,
  campaignId,
  campaignName,
  onChanged,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { hasPermission } = usePermissions();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Candado síncrono anti doble-submit: `submitting` es asíncrono y en web un
  // doble clic rápido puede disparar dos linkCampaign antes del re-render,
  // creando vínculos duplicados que rompen la subida de fotos (uuid inválido).
  const submitLockRef = useRef(false);
  const [linkedCampaigns, setLinkedCampaigns] = useState<PhotoCampaign[]>([]);
  const [allCampaigns, setAllCampaigns] = useState<PhotoCampaign[]>([]);
  const [search, setSearch] = useState('');
  const [createMode, setCreateMode] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');

  // WhatsApp: envío de fotos de una campaña anexada (mismo modal que el
  // módulo de campaña de fotos, con selección opcional de productos).
  const [whatsappTarget, setWhatsappTarget] = useState<PhotoCampaign | null>(null);

  const canCreate = hasPermission(PERMISSIONS.PHOTO_CAMPAIGNS.CREATE);
  const canLink = hasPermission(PERMISSIONS.PHOTO_CAMPAIGNS.PRODUCTS.CREATE);
  const canUnlink = hasPermission(PERMISSIONS.PHOTO_CAMPAIGNS.PRODUCTS.DELETE);
  const canSendWhatsapp = hasPermission(PERMISSIONS.PHOTO_CAMPAIGNS.UPDATE);

  const loadData = useCallback(async () => {
    if (!campaignId) {
      return;
    }
    try {
      setLoading(true);
      const [linked, all] = await Promise.all([
        photoCampaignsApi.getPhotoCampaignsByCampaign(campaignId),
        photoCampaignsApi.getCampaigns(),
      ]);
      setLinkedCampaigns(linked);
      setAllCampaigns(all);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudieron cargar las campañas de fotos');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    if (visible) {
      setCreateMode(false);
      setNewCampaignName(campaignName ? `Fotos - ${campaignName}` : '');
      setSearch('');
      void loadData();
    }
  }, [visible, campaignName, loadData]);

  // De-duplicamos por id: si el backend arrastra vínculos duplicados, aquí se
  // muestra una sola fila y "Desvincular" elimina el par (limpia el duplicado).
  const uniqueLinkedCampaigns = useMemo(() => {
    const seen = new Set<string>();
    return linkedCampaigns.filter((c) => {
      if (seen.has(c.id)) {
        return false;
      }
      seen.add(c.id);
      return true;
    });
  }, [linkedCampaigns]);

  const linkedIds = useMemo(
    () => new Set(uniqueLinkedCampaigns.map((c) => c.id)),
    [uniqueLinkedCampaigns]
  );

  // Solo las últimas 5 campañas de fotos (por fecha de creación desc). Al
  // buscar, se muestran las 5 coincidencias más recientes.
  const availableCampaigns = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allCampaigns
      .filter((c) => !linkedIds.has(c.id) && c.status !== 'CLOSED')
      .filter((c) => {
        if (!query) {
          return true;
        }
        return `${c.code} ${c.name}`.toLowerCase().includes(query);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, MAX_AVAILABLE_CAMPAIGNS);
  }, [allCampaigns, linkedIds, search]);

  const handleLink = useCallback(
    async (photoCampaignId: string) => {
      if (submitLockRef.current) {
        return;
      }
      // Idempotencia: no re-anexar algo ya vinculado (evita filas duplicadas).
      if (linkedIds.has(photoCampaignId)) {
        return;
      }
      submitLockRef.current = true;
      try {
        setSubmitting(true);
        const result = await photoCampaignsApi.linkCampaign(photoCampaignId, campaignId);
        Alert.alert(
          'Campaña anexada',
          `Se sincronizaron ${result.totalSynced} producto(s) (${result.added} agregado(s)).`
        );
        await loadData();
        onChanged?.();
      } catch (error: any) {
        Alert.alert('Error', error?.message || 'No se pudo anexar la campaña de fotos');
      } finally {
        setSubmitting(false);
        submitLockRef.current = false;
      }
    },
    [campaignId, linkedIds, loadData, onChanged]
  );

  const handleUnlink = useCallback(
    (photoCampaign: PhotoCampaign) => {
      Alert.alert(
        'Desvincular campaña',
        `¿Quitar el vínculo con "${photoCampaign.name}"? Los productos sincronizados se retirarán.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Desvincular',
            style: 'destructive',
            onPress: async () => {
              if (submitLockRef.current) {
                return;
              }
              submitLockRef.current = true;
              try {
                setSubmitting(true);
                // Purga total: si hay filas de vínculo duplicadas (mismo par
                // campaña↔campaña-de-fotos), desvinculamos en bucle hasta que
                // el backend deje de devolver este par. Tope de seguridad para
                // no quedar en bucle infinito ante un backend inconsistente.
                const MAX_UNLINK_ATTEMPTS = 5;
                for (let attempt = 0; attempt < MAX_UNLINK_ATTEMPTS; attempt += 1) {
                  await photoCampaignsApi.unlinkCampaign(photoCampaign.id, campaignId);
                  const stillLinked =
                    await photoCampaignsApi.getPhotoCampaignsByCampaign(campaignId);
                  if (!stillLinked.some((c) => c.id === photoCampaign.id)) {
                    break;
                  }
                }
                await loadData();
                onChanged?.();
              } catch (error: any) {
                Alert.alert('Error', error?.message || 'No se pudo desvincular la campaña');
              } finally {
                setSubmitting(false);
                submitLockRef.current = false;
              }
            },
          },
        ]
      );
    },
    [campaignId, loadData, onChanged]
  );

  const handleCreateAndLink = useCallback(async () => {
    if (!newCampaignName.trim()) {
      Alert.alert('Validación', 'El nombre de la campaña de fotos es obligatorio');
      return;
    }
    if (submitLockRef.current) {
      return;
    }
    submitLockRef.current = true;
    try {
      setSubmitting(true);
      const created = await photoCampaignsApi.createCampaign({ name: newCampaignName.trim() });
      const result = await photoCampaignsApi.linkCampaign(created.id, campaignId);
      Alert.alert(
        'Campaña creada y anexada',
        `"${created.name}" quedó vinculada con ${result.totalSynced} producto(s).`
      );
      setCreateMode(false);
      await loadData();
      onChanged?.();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudo crear y anexar la campaña de fotos');
    } finally {
      setSubmitting(false);
      submitLockRef.current = false;
    }
  }, [newCampaignName, campaignId, loadData, onChanged]);

  const closeWhatsapp = useCallback(() => {
    setWhatsappTarget(null);
  }, []);

  const openWhatsapp = useCallback((photoCampaign: PhotoCampaign) => {
    setWhatsappTarget(photoCampaign);
  }, []);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Campañas de fotos</Text>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={styles.secondaryButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator size="large" color={theme.color.brand.accent} />
              <Text style={styles.loaderText}>Cargando...</Text>
            </View>
          ) : (
            <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
              {/* Anexadas */}
              <Text style={styles.sectionLabel}>Anexadas a esta campaña</Text>
              {uniqueLinkedCampaigns.length === 0 ? (
                <Text style={styles.emptyText}>
                  Aún no está anexada a ninguna campaña de fotos.
                </Text>
              ) : (
                uniqueLinkedCampaigns.map((c) => (
                  <View key={c.id} style={styles.linkedRow}>
                    <View style={styles.linkedInfo}>
                      <Text style={styles.linkedCode}>{c.code}</Text>
                      <Text style={styles.linkedName}>{c.name}</Text>
                      <Text style={styles.linkedStatus}>{statusLabel[c.status]}</Text>
                    </View>
                    <View style={styles.linkedActions}>
                      {canSendWhatsapp && (
                        <TouchableOpacity
                          style={styles.whatsappButton}
                          onPress={() => openWhatsapp(c)}
                          disabled={submitting}
                        >
                          <Text style={styles.whatsappButtonText}>WhatsApp</Text>
                        </TouchableOpacity>
                      )}
                      {canUnlink && (
                        <TouchableOpacity
                          style={styles.dangerButton}
                          onPress={() => handleUnlink(c)}
                          disabled={submitting}
                        >
                          <Text style={styles.dangerButtonText}>Desvincular</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))
              )}

              {/* Crear y anexar */}
              {canCreate && (
                <View style={styles.createBlock}>
                  {createMode ? (
                    <>
                      <Text style={styles.sectionLabel}>Nueva campaña de fotos</Text>
                      <TextInput
                        style={styles.input}
                        value={newCampaignName}
                        onChangeText={setNewCampaignName}
                        placeholder="Nombre de la campaña de fotos"
                        placeholderTextColor={theme.color.text.placeholder}
                      />
                      <View style={styles.createActions}>
                        <TouchableOpacity
                          style={styles.secondaryButton}
                          onPress={() => setCreateMode(false)}
                          disabled={submitting}
                        >
                          <Text style={styles.secondaryButtonText}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.primaryButton}
                          onPress={() => void handleCreateAndLink()}
                          disabled={submitting}
                        >
                          <Text style={styles.primaryButtonText}>
                            {submitting ? 'Creando...' : 'Crear y anexar'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={styles.createButton}
                      onPress={() => setCreateMode(true)}
                      disabled={submitting}
                    >
                      <Text style={styles.createButtonText}>+ Crear campaña de fotos y anexar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Anexar a existente */}
              {canLink && (
                <>
                  <Text style={styles.sectionLabel}>Anexar a una existente</Text>
                  <TextInput
                    style={styles.input}
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Buscar por código o nombre..."
                    placeholderTextColor={theme.color.text.placeholder}
                  />
                  {availableCampaigns.length === 0 ? (
                    <Text style={styles.emptyText}>No hay campañas de fotos disponibles.</Text>
                  ) : (
                    availableCampaigns.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        style={styles.availableRow}
                        onPress={() => void handleLink(c.id)}
                        disabled={submitting}
                      >
                        <View style={styles.linkedInfo}>
                          <Text style={styles.linkedCode}>{c.code}</Text>
                          <Text style={styles.linkedName}>{c.name}</Text>
                        </View>
                        <Text style={styles.linkAction}>Anexar</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </>
              )}
            </ScrollView>
          )}
        </View>
      </View>

      {/* Sub-modal reutilizable: enviar fotos por WhatsApp con selección
          opcional de productos y tipos. */}
      {whatsappTarget && (
        <SendPhotoCampaignWhatsAppModal
          visible={!!whatsappTarget}
          photoCampaignId={whatsappTarget.id}
          photoCampaignName={whatsappTarget.name}
          onClose={closeWhatsapp}
        />
      )}
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.space[4],
    },
    card: {
      width: '100%',
      maxWidth: 600,
      maxHeight: '85%',
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.surface.base,
      padding: theme.space[3.5],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      ...theme.shadow.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.space[3],
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    body: {
      flexGrow: 0,
    },
    loaderWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.space[6],
    },
    loaderText: {
      marginTop: theme.space[3],
      color: theme.color.text.muted,
    },
    sectionLabel: {
      marginTop: theme.space[3],
      marginBottom: theme.space[2],
      fontSize: 13,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    emptyText: {
      color: theme.color.text.muted,
      fontSize: 12,
      paddingVertical: theme.space[1],
    },
    input: {
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.background.subtle,
      color: theme.color.text.body,
      paddingHorizontal: theme.space[2.5],
      paddingVertical: theme.space[2],
      marginBottom: theme.space[2],
    },
    linkedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      borderRadius: theme.radii.md,
      padding: theme.space[2.5],
      marginBottom: theme.space[2],
      backgroundColor: theme.color.background.subtle,
    },
    availableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      borderRadius: theme.radii.md,
      padding: theme.space[2.5],
      marginBottom: theme.space[2],
      backgroundColor: theme.color.surface.base,
    },
    linkedInfo: {
      flex: 1,
      marginRight: theme.space[2],
    },
    linkedCode: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.color.text.muted,
    },
    linkedName: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    linkedStatus: {
      marginTop: theme.space[0.5],
      fontSize: 11,
      color: theme.color.brand.accent,
      fontWeight: '700',
    },
    linkAction: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.color.brand.accent,
    },
    createBlock: {
      marginTop: theme.space[3],
    },
    createButton: {
      paddingVertical: theme.space[2.5],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.brand.accentSoft,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.color.brand.accent,
    },
    createButtonText: {
      color: theme.color.brand.accent,
      fontWeight: '700',
      fontSize: 12,
    },
    createActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: theme.space[2],
    },
    primaryButton: {
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[3],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.brand.accent,
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
    dangerButton: {
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[3],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.state.danger.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dangerButtonText: {
      color: theme.color.icon.danger,
      fontWeight: '700',
      fontSize: 12,
    },
    linkedActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
    },
    whatsappButton: {
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[3],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.state.success.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    whatsappButtonText: {
      color: theme.color.text.success,
      fontWeight: '700',
      fontSize: 12,
    },
    whatsappSubtitle: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginBottom: theme.space[2],
    },
    inlineLoadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      paddingVertical: theme.space[2],
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[2],
      marginBottom: theme.space[2],
    },
    chip: {
      paddingVertical: theme.space[1.5],
      paddingHorizontal: theme.space[3],
      borderRadius: theme.radii.full,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.background.subtle,
    },
    chipSelected: {
      borderColor: theme.color.brand.accent,
      backgroundColor: theme.color.brand.accentSoft,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    chipTextSelected: {
      color: theme.color.brand.accent,
    },
    multilineInput: {
      minHeight: 72,
      textAlignVertical: 'top',
    },
  });

export default LinkPhotoCampaignModal;
