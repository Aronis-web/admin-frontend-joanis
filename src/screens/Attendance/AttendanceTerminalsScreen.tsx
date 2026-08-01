import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/design-system/themes';
import { useThemedStyles } from '@/design-system/themes/useThemedStyles';
import type { Theme } from '@/design-system/themes/defaultLight';
import Alert from '@/utils/alert';
import logger from '@/utils/logger';
import { sitesApi } from '@/services/api/sites';
import type { Site } from '@/types/sites';
import {
  AttendanceTerminal,
  TerminalStatus,
  CreateTerminalRequest,
  UpdateTerminalRequest,
} from '@/types/attendance';
import {
  useAttendanceTerminals,
  useCreateAttendanceTerminal,
  useUpdateAttendanceTerminal,
  useDeleteAttendanceTerminal,
  useGenerateTerminalToken,
  useRevokeTerminalToken,
} from '@/hooks/api/useAttendanceTerminals';

interface AttendanceTerminalsScreenProps {
  navigation: any;
}

interface TerminalFormState {
  code: string;
  name: string;
  description: string;
  siteId: string;
  status: TerminalStatus;
  ipRestriction: string;
}

const EMPTY_FORM: TerminalFormState = {
  code: '',
  name: '',
  description: '',
  siteId: '',
  status: 'active',
  ipRestriction: '',
};

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (Platform.OS === 'web') {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    }
    await Clipboard.setStringAsync(text);
    return true;
  } catch (error) {
    logger.error('Error copiando al portapapeles:', error);
    return false;
  }
};

const STATUS_LABEL: Record<TerminalStatus, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  maintenance: 'Mantenimiento',
  blocked: 'Bloqueado',
};

export const AttendanceTerminalsScreen: React.FC<AttendanceTerminalsScreenProps> = ({
  navigation,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const { currentCompany } = useAuthStore();

  const {
    data: terminals = [],
    isLoading,
    isRefetching,
    refetch,
    error,
  } = useAttendanceTerminals(currentCompany?.id ? { companyId: currentCompany.id } : undefined);

  const createMutation = useCreateAttendanceTerminal();
  const updateMutation = useUpdateAttendanceTerminal();
  const deleteMutation = useDeleteAttendanceTerminal();
  const generateTokenMutation = useGenerateTerminalToken();
  const revokeTokenMutation = useRevokeTerminalToken();

  // Sitios para el selector del formulario
  const [sites, setSites] = useState<Site[]>([]);
  const [sitesLoading, setSitesLoading] = useState(false);

  // Estado del modal de formulario (crear / editar)
  const [formVisible, setFormVisible] = useState(false);
  const [editingTerminal, setEditingTerminal] = useState<AttendanceTerminal | null>(null);
  const [form, setForm] = useState<TerminalFormState>(EMPTY_FORM);

  // Estado del modal de token
  const [tokenModalVisible, setTokenModalVisible] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [tokenTerminalCode, setTokenTerminalCode] = useState<string>('');

  const loadSites = useCallback(async () => {
    if (!currentCompany?.id) return;
    try {
      setSitesLoading(true);
      const activeSites = await sitesApi.getActiveSites(currentCompany.id);
      setSites(activeSites);
    } catch (err) {
      logger.error('Error cargando sedes:', err);
    } finally {
      setSitesLoading(false);
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  const updateForm = (patch: Partial<TerminalFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const openCreateForm = () => {
    setEditingTerminal(null);
    setForm({ ...EMPTY_FORM, siteId: sites[0]?.id ?? '' });
    setFormVisible(true);
  };

  const openEditForm = (terminal: AttendanceTerminal) => {
    setEditingTerminal(terminal);
    setForm({
      code: terminal.code,
      name: terminal.name,
      description: terminal.description ?? '',
      siteId: terminal.siteId,
      status: terminal.status,
      ipRestriction: (terminal.ipRestriction ?? []).join(', '),
    });
    setFormVisible(true);
  };

  const closeForm = () => {
    setFormVisible(false);
    setEditingTerminal(null);
    setForm(EMPTY_FORM);
  };

  const parseIps = (raw: string): string[] =>
    raw
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean);

  const handleSubmitForm = async () => {
    if (!form.name.trim()) {
      Alert.alert('Validación', 'El nombre es obligatorio.');
      return;
    }

    const ips = parseIps(form.ipRestriction);

    try {
      if (editingTerminal) {
        const payload: UpdateTerminalRequest = {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          siteId: form.siteId || undefined,
          status: form.status,
          ipRestriction: ips.length > 0 ? ips : undefined,
        };
        await updateMutation.mutateAsync({ id: editingTerminal.id, data: payload });
        Alert.alert('Éxito', 'Terminal actualizado correctamente.');
      } else {
        if (!form.code.trim()) {
          Alert.alert('Validación', 'El código es obligatorio.');
          return;
        }
        if (!currentCompany?.id) {
          Alert.alert('Error', 'No hay empresa seleccionada.');
          return;
        }
        if (!form.siteId) {
          Alert.alert('Validación', 'Selecciona una sede.');
          return;
        }
        const payload: CreateTerminalRequest = {
          code: form.code.trim(),
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          companyId: currentCompany.id,
          siteId: form.siteId,
          ipRestriction: ips.length > 0 ? ips : undefined,
        };
        await createMutation.mutateAsync(payload);
        Alert.alert('Éxito', 'Terminal creado correctamente.');
      }
      closeForm();
    } catch (err: any) {
      logger.error('Error guardando terminal:', err);
      Alert.alert('Error', err?.response?.data?.message || 'No se pudo guardar el terminal.');
    }
  };

  const handleDelete = (terminal: AttendanceTerminal) => {
    Alert.alert(
      'Eliminar terminal',
      `¿Seguro que deseas eliminar el terminal "${terminal.name}" (${terminal.code})?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync(terminal.id);
              Alert.alert('Éxito', 'Terminal eliminado correctamente.');
            } catch (err: any) {
              logger.error('Error eliminando terminal:', err);
              Alert.alert('Error', 'No se pudo eliminar el terminal.');
            }
          },
        },
      ]
    );
  };

  const handleGenerateToken = (terminal: AttendanceTerminal) => {
    Alert.alert(
      'Generar token',
      `Se generará un nuevo token para "${terminal.code}". El token anterior dejará de funcionar y el nuevo se mostrará una única vez.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Generar',
          onPress: async () => {
            try {
              const result = await generateTokenMutation.mutateAsync({ id: terminal.id });
              setGeneratedToken(result.deviceToken);
              setTokenTerminalCode(result.terminalCode || terminal.code);
              setTokenModalVisible(true);
            } catch (err: any) {
              logger.error('Error generando token:', err);
              Alert.alert('Error', 'No se pudo generar el token.');
            }
          },
        },
      ]
    );
  };

  const handleRevokeToken = (terminal: AttendanceTerminal) => {
    Alert.alert(
      'Revocar token',
      `¿Revocar el token de "${terminal.code}"? El terminal dejará de poder marcar hasta generar uno nuevo.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Revocar',
          style: 'destructive',
          onPress: async () => {
            try {
              await revokeTokenMutation.mutateAsync(terminal.id);
              Alert.alert('Éxito', 'Token revocado correctamente.');
            } catch (err: any) {
              logger.error('Error revocando token:', err);
              Alert.alert('Error', 'No se pudo revocar el token.');
            }
          },
        },
      ]
    );
  };

  const handleCopyToken = async () => {
    if (!generatedToken) return;
    const ok = await copyToClipboard(generatedToken);
    Alert.alert(
      ok ? 'Copiado' : 'Error',
      ok ? 'Token copiado al portapapeles.' : 'No se pudo copiar.'
    );
  };

  const closeTokenModal = () => {
    setTokenModalVisible(false);
    setGeneratedToken(null);
    setTokenTerminalCode('');
  };

  const getStatusColor = (status: TerminalStatus): string => {
    switch (status) {
      case 'active':
        return theme.color.icon.success;
      case 'inactive':
        return theme.color.text.muted;
      case 'maintenance':
        return theme.color.icon.warning;
      case 'blocked':
        return theme.color.icon.danger;
      default:
        return theme.color.text.muted;
    }
  };

  const siteName = useCallback(
    (siteId: string) => {
      const site = sites.find((s) => s.id === siteId);
      return site ? `${site.name} (${site.code})` : siteId;
    },
    [sites]
  );

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const renderTerminalCard = (terminal: AttendanceTerminal) => (
    <View key={terminal.id} style={[styles.card, isTablet && styles.cardTablet]}>
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <Ionicons name="hardware-chip-outline" size={28} color={theme.color.brand.accent} />
          <View style={styles.headerTexts}>
            <Text style={styles.terminalCode}>{terminal.code}</Text>
            <Text style={styles.terminalName}>{terminal.name}</Text>
          </View>
        </View>
        <View
          style={[styles.statusBadge, { backgroundColor: `${getStatusColor(terminal.status)}20` }]}
        >
          <Text style={[styles.statusText, { color: getStatusColor(terminal.status) }]}>
            {STATUS_LABEL[terminal.status] ?? terminal.status}
          </Text>
        </View>
      </View>

      <View style={styles.infoContainer}>
        {!!terminal.description && (
          <View style={styles.infoRow}>
            <Ionicons name="information-circle-outline" size={16} color={theme.color.text.muted} />
            <Text style={styles.infoValue}>{terminal.description}</Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <Ionicons name="business-outline" size={16} color={theme.color.text.muted} />
          <Text style={styles.infoValue}>{siteName(terminal.siteId)}</Text>
        </View>
        {!!terminal.ipRestriction?.length && (
          <View style={styles.infoRow}>
            <Ionicons name="shield-outline" size={16} color={theme.color.text.muted} />
            <Text style={styles.infoValue}>{terminal.ipRestriction.join(', ')}</Text>
          </View>
        )}
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryButton]}
          onPress={() => openEditForm(terminal)}
        >
          <Ionicons name="create-outline" size={16} color={theme.color.text.onAction} />
          <Text style={styles.primaryButtonText}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={() => handleGenerateToken(terminal)}
        >
          <Ionicons name="key-outline" size={16} color={theme.color.text.body} />
          <Text style={styles.secondaryButtonText}>Token</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={() => handleRevokeToken(terminal)}
        >
          <Ionicons name="lock-closed-outline" size={16} color={theme.color.text.body} />
          <Text style={styles.secondaryButtonText}>Revocar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.dangerButton]}
          onPress={() => handleDelete(terminal)}
        >
          <Ionicons name="trash-outline" size={16} color={theme.color.icon.danger} />
          <Text style={styles.dangerButtonText}>Eliminar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <View style={styles.headerFlex}>
            <Text style={[styles.headerTitle, isTablet && styles.headerTitleTablet]}>
              Terminales de Asistencia
            </Text>
            <Text style={styles.headerSubtitle}>
              Gestiona los dispositivos de marcación y sus tokens
            </Text>
          </View>
          <TouchableOpacity style={styles.createButton} onPress={openCreateForm}>
            <Ionicons name="add" size={20} color={theme.color.text.onAction} />
            <Text style={styles.createButtonText}>Nuevo</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.color.brand.accent} />
            <Text style={styles.loadingText}>Cargando terminales...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          >
            {error ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="alert-circle-outline" size={56} color={theme.color.icon.danger} />
                <Text style={styles.emptyTitle}>Error al cargar</Text>
                <Text style={styles.emptyText}>No se pudieron cargar los terminales.</Text>
                <TouchableOpacity style={styles.emptyButton} onPress={() => refetch()}>
                  <Text style={styles.emptyButtonText}>Reintentar</Text>
                </TouchableOpacity>
              </View>
            ) : terminals.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="hardware-chip-outline" size={56} color={theme.color.text.muted} />
                <Text style={styles.emptyTitle}>No hay terminales</Text>
                <Text style={styles.emptyText}>
                  Crea tu primer terminal de asistencia para empezar a registrar marcaciones.
                </Text>
                <TouchableOpacity style={styles.emptyButton} onPress={openCreateForm}>
                  <Text style={styles.emptyButtonText}>+ Crear terminal</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.cardsContainer}>{terminals.map(renderTerminalCard)}</View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Modal de formulario (crear / editar) */}
      <Modal visible={formVisible} transparent animationType="slide" onRequestClose={closeForm}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isTablet && styles.modalContentTablet]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingTerminal ? 'Editar terminal' : 'Nuevo terminal'}
              </Text>
              <TouchableOpacity
                onPress={closeForm}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color={theme.color.text.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Código {editingTerminal ? '' : '*'}</Text>
              <TextInput
                style={[styles.input, !!editingTerminal && styles.inputDisabled]}
                value={form.code}
                editable={!editingTerminal}
                onChangeText={(code) => updateForm({ code })}
                placeholder="REC-01"
                placeholderTextColor={theme.color.text.muted}
                autoCapitalize="characters"
              />

              <Text style={styles.fieldLabel}>Nombre *</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(name) => updateForm({ name })}
                placeholder="Terminal Recepción"
                placeholderTextColor={theme.color.text.muted}
              />

              <Text style={styles.fieldLabel}>Descripción</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={form.description}
                onChangeText={(description) => updateForm({ description })}
                placeholder="Descripción opcional"
                placeholderTextColor={theme.color.text.muted}
                multiline
              />

              <Text style={styles.fieldLabel}>Sede {editingTerminal ? '' : '*'}</Text>
              {sitesLoading ? (
                <ActivityIndicator color={theme.color.brand.accent} style={{ marginVertical: 8 }} />
              ) : (
                <View style={styles.chipsRow}>
                  {sites.map((site) => {
                    const selected = form.siteId === site.id;
                    return (
                      <TouchableOpacity
                        key={site.id}
                        style={[styles.chip, selected && styles.chipSelected]}
                        onPress={() => updateForm({ siteId: site.id })}
                      >
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                          {site.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  {sites.length === 0 && (
                    <Text style={styles.infoValue}>No hay sedes disponibles.</Text>
                  )}
                </View>
              )}

              {!!editingTerminal && (
                <>
                  <Text style={styles.fieldLabel}>Estado</Text>
                  <View style={styles.chipsRow}>
                    {(['active', 'inactive', 'maintenance', 'blocked'] as TerminalStatus[]).map(
                      (status) => {
                        const selected = form.status === status;
                        return (
                          <TouchableOpacity
                            key={status}
                            style={[styles.chip, selected && styles.chipSelected]}
                            onPress={() => updateForm({ status })}
                          >
                            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                              {STATUS_LABEL[status]}
                            </Text>
                          </TouchableOpacity>
                        );
                      }
                    )}
                  </View>
                </>
              )}

              <Text style={styles.fieldLabel}>IPs permitidas (separadas por coma)</Text>
              <TextInput
                style={styles.input}
                value={form.ipRestriction}
                onChangeText={(ipRestriction) => updateForm({ ipRestriction })}
                placeholder="192.168.1.50, 192.168.1.51"
                placeholderTextColor={theme.color.text.muted}
                autoCapitalize="none"
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton]}
                onPress={closeForm}
                disabled={isSaving}
              >
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryButton]}
                onPress={handleSubmitForm}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={theme.color.text.onAction} />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {editingTerminal ? 'Guardar' : 'Crear'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de token generado */}
      <Modal
        visible={tokenModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeTokenModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isTablet && styles.modalContentTablet]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Token generado</Text>
              <TouchableOpacity
                onPress={closeTokenModal}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color={theme.color.text.muted} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.warningBanner}>
                <Ionicons name="warning-outline" size={18} color={theme.color.icon.warning} />
                <Text style={styles.warningText}>
                  Copia este token ahora. No se volverá a mostrar. Terminal: {tokenTerminalCode}
                </Text>
              </View>

              <View style={styles.tokenBox}>
                <Text style={styles.tokenText} selectable>
                  {generatedToken}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.actionButton, styles.primaryButton, styles.copyButton]}
                onPress={handleCopyToken}
              >
                <Ionicons name="copy-outline" size={18} color={theme.color.text.onAction} />
                <Text style={styles.primaryButtonText}>Copiar token</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton]}
                onPress={closeTokenModal}
              >
                <Text style={styles.secondaryButtonText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenLayout>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: theme.color.text.muted,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      backgroundColor: theme.color.surface.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      gap: 12,
    },
    headerTablet: {
      padding: 24,
    },
    headerFlex: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: theme.color.text.heading,
    },
    headerTitleTablet: {
      fontSize: 30,
    },
    headerSubtitle: {
      fontSize: 13,
      color: theme.color.text.muted,
      marginTop: 4,
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.color.brand.accent,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
    },
    createButtonText: {
      color: theme.color.text.onAction,
      fontSize: 14,
      fontWeight: '600',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
    },
    cardsContainer: {
      gap: 16,
    },
    card: {
      backgroundColor: theme.color.surface.base,
      borderRadius: 12,
      padding: 16,
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    cardTablet: {
      padding: 20,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    headerTexts: {
      flex: 1,
    },
    terminalCode: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.color.text.heading,
    },
    terminalName: {
      fontSize: 14,
      color: theme.color.text.muted,
      marginTop: 2,
    },
    statusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
    },
    infoContainer: {
      gap: 8,
      marginBottom: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    infoValue: {
      fontSize: 13,
      color: theme.color.text.body,
      flex: 1,
    },
    cardActions: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minWidth: 96,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
    },
    primaryButton: {
      backgroundColor: theme.color.brand.accent,
    },
    primaryButtonText: {
      color: theme.color.text.onAction,
      fontSize: 13,
      fontWeight: '600',
    },
    secondaryButton: {
      backgroundColor: theme.color.surface.muted,
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    secondaryButtonText: {
      color: theme.color.text.body,
      fontSize: 13,
      fontWeight: '600',
    },
    dangerButton: {
      backgroundColor: `${theme.color.icon.danger}15`,
      borderWidth: 1,
      borderColor: `${theme.color.icon.danger}40`,
    },
    dangerButtonText: {
      color: theme.color.icon.danger,
      fontSize: 13,
      fontWeight: '600',
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.color.text.heading,
      marginTop: 16,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 14,
      color: theme.color.text.muted,
      textAlign: 'center',
      marginBottom: 24,
      paddingHorizontal: 32,
    },
    emptyButton: {
      backgroundColor: theme.color.brand.accent,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    emptyButtonText: {
      color: theme.color.text.onAction,
      fontSize: 16,
      fontWeight: '600',
    },
    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    modalContent: {
      width: '100%',
      maxWidth: 520,
      maxHeight: '90%',
      backgroundColor: theme.color.surface.base,
      borderRadius: 16,
      overflow: 'hidden',
    },
    modalContentTablet: {
      maxWidth: 560,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.color.text.heading,
    },
    modalBody: {
      padding: 16,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.body,
      marginBottom: 6,
      marginTop: 12,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: theme.color.text.heading,
      backgroundColor: theme.color.surface.base,
    },
    inputDisabled: {
      backgroundColor: theme.color.surface.muted,
      color: theme.color.text.muted,
    },
    inputMultiline: {
      minHeight: 64,
      textAlignVertical: 'top',
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.surface.muted,
    },
    chipSelected: {
      backgroundColor: theme.color.brand.accent,
      borderColor: theme.color.brand.accent,
    },
    chipText: {
      fontSize: 13,
      color: theme.color.text.body,
    },
    chipTextSelected: {
      color: theme.color.text.onAction,
      fontWeight: '600',
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
    },
    warningBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.color.state.warning.background,
      padding: 12,
      borderRadius: 8,
      marginBottom: 16,
    },
    warningText: {
      flex: 1,
      fontSize: 13,
      color: theme.color.state.warning.text,
    },
    tokenBox: {
      backgroundColor: theme.color.surface.muted,
      borderRadius: 8,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      marginBottom: 16,
    },
    tokenText: {
      fontSize: 13,
      color: theme.color.text.heading,
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    copyButton: {
      alignSelf: 'stretch',
    },
  });

export default AttendanceTerminalsScreen;
