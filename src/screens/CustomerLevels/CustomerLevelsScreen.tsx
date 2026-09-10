import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
  Switch,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { AddButton } from '@/components/Navigation/AddButton';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';
import {
  useCustomerLevels,
  useCreateCustomerLevel,
  useUpdateCustomerLevel,
  useDeleteCustomerLevel,
} from '@/hooks/api/useCustomerLevels';
import type { CustomerLevel, CreateCustomerLevelRequest } from '@/types/customer-levels';
import { priceProfilesApi } from '@/services/api/price-profiles';
import type { PriceProfile } from '@/types/price-profiles';

interface FormState {
  code: string;
  name: string;
  priceProfileId: string | null;
  discountPct: string;
  whatsappEnabled: boolean;
  isDefault: boolean;
  sortOrder: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  code: '',
  name: '',
  priceProfileId: null,
  discountPct: '0',
  whatsappEnabled: false,
  isDefault: false,
  sortOrder: '0',
  isActive: true,
};

interface Props {
  navigation: any;
}

export const CustomerLevelsScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const { data: levels = [], isLoading, isRefetching, isError, refetch } = useCustomerLevels();
  const createMutation = useCreateCustomerLevel();
  const updateMutation = useUpdateCustomerLevel();
  const deleteMutation = useDeleteCustomerLevel();

  const [showFormModal, setShowFormModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editing, setEditing] = useState<CustomerLevel | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [profiles, setProfiles] = useState<PriceProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);

  const sortedLevels = useMemo(
    () =>
      [...levels].sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.name.localeCompare(b.name);
      }),
    [levels]
  );

  const loadProfilesIfNeeded = async () => {
    if (profiles.length > 0) return;
    try {
      setLoadingProfiles(true);
      const active = await priceProfilesApi.getActivePriceProfiles();
      setProfiles(active);
    } catch (error) {
      logger.error('Error cargando perfiles de precio', error);
      Alert.alert('Error', 'No se pudieron cargar los perfiles de precio');
    } finally {
      setLoadingProfiles(false);
    }
  };

  const openCreate = async () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowFormModal(true);
    await loadProfilesIfNeeded();
  };

  const openEdit = async (level: CustomerLevel) => {
    setEditing(level);
    setForm({
      code: level.code,
      name: level.name,
      priceProfileId: level.priceProfileId,
      discountPct: String(level.discountPct ?? 0),
      whatsappEnabled: level.whatsappEnabled,
      isDefault: level.isDefault,
      sortOrder: String(level.sortOrder ?? 0),
      isActive: level.isActive,
    });
    setShowFormModal(true);
    await loadProfilesIfNeeded();
  };

  const handleSave = async () => {
    const code = form.code.trim().toUpperCase();
    const name = form.name.trim();
    if (!code || !name) {
      Alert.alert('Validación', 'Código y nombre son obligatorios');
      return;
    }
    const discountPct = Number(form.discountPct);
    if (Number.isNaN(discountPct) || discountPct < 0 || discountPct > 100) {
      Alert.alert('Validación', 'El descuento debe estar entre 0 y 100');
      return;
    }
    const sortOrder = Number(form.sortOrder);
    if (Number.isNaN(sortOrder)) {
      Alert.alert('Validación', 'El orden debe ser un número');
      return;
    }

    const payload: CreateCustomerLevelRequest = {
      code,
      name,
      priceProfileId: form.priceProfileId,
      discountPct,
      whatsappEnabled: form.whatsappEnabled,
      isDefault: form.isDefault,
      sortOrder,
      isActive: form.isActive,
    };

    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, data: payload });
        Alert.alert('Éxito', 'Nivel actualizado');
      } else {
        await createMutation.mutateAsync(payload);
        Alert.alert('Éxito', 'Nivel creado');
      }
      setShowFormModal(false);
      setEditing(null);
      setForm(EMPTY_FORM);
    } catch (error: any) {
      const message =
        error?.response?.data?.message || error?.message || 'No se pudo guardar el nivel';
      Alert.alert('Error', String(message));
    }
  };

  const handleDelete = (level: CustomerLevel) => {
    if (level.isDefault) {
      Alert.alert('No permitido', 'No se puede eliminar el nivel por defecto');
      return;
    }
    Alert.alert('Confirmar eliminación', `¿Eliminar el nivel "${level.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMutation.mutateAsync(level.id);
            Alert.alert('Éxito', 'Nivel eliminado');
          } catch (error: any) {
            const message =
              error?.response?.data?.message || error?.message || 'No se pudo eliminar el nivel';
            Alert.alert('Error', String(message));
          }
        },
      },
    ]);
  };

  const selectedProfileName = useMemo(() => {
    if (!form.priceProfileId) return 'Usa el perfil del canal';
    const p = profiles.find((x) => x.id === form.priceProfileId);
    return p ? `${p.name} (${p.code})` : 'Perfil seleccionado';
  }, [form.priceProfileId, profiles]);

  const renderItem = ({ item }: { item: CustomerLevel }) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <View style={styles.codeBadge}>
              <Text style={styles.codeText}>{item.code}</Text>
            </View>
          </View>
          <View
            style={[
              styles.statusBadge,
              item.isActive ? styles.statusActive : styles.statusInactive,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                {
                  color: item.isActive
                    ? theme.color.state.success.text
                    : theme.color.state.danger.text,
                },
              ]}
            >
              {item.isActive ? 'Activo' : 'Inactivo'}
            </Text>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Descuento</Text>
            <Text style={styles.metricValue}>{Number(item.discountPct).toFixed(2)}%</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>WhatsApp</Text>
            <Text
              style={[
                styles.metricValue,
                {
                  color: item.whatsappEnabled
                    ? theme.color.state.success.text
                    : theme.color.text.muted,
                },
              ]}
            >
              {item.whatsappEnabled ? 'Habilitado' : 'Deshabilitado'}
            </Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Orden</Text>
            <Text style={styles.metricValue}>{item.sortOrder}</Text>
          </View>
        </View>

        {item.isDefault && (
          <View style={styles.defaultBadge}>
            <Text style={styles.defaultBadgeText}>⭐ Nivel por defecto</Text>
          </View>
        )}

        <View style={styles.actionsRow}>
          <ProtectedElement requiredPermissions={['customer_levels.update']}>
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={() => openEdit(item)}
            >
              <Text style={styles.actionButtonText}>✏️ Editar</Text>
            </TouchableOpacity>
          </ProtectedElement>
          {!item.isDefault && (
            <ProtectedElement requiredPermissions={['customer_levels.delete']}>
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => handleDelete(item)}
              >
                <Text style={styles.actionButtonText}>🗑️ Eliminar</Text>
              </TouchableOpacity>
            </ProtectedElement>
          )}
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top']}>
        <ActivityIndicator size="large" color={theme.color.brand.accent} />
        <Text style={styles.loadingText}>Cargando niveles...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Niveles de Socia</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerIcon}>💡</Text>
        <Text style={styles.infoBannerText}>
          Los niveles definen el trato comercial: perfil de precio, descuento y si el cliente puede
          comprar por el bot de WhatsApp.
        </Text>
      </View>

      {isError ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No se pudieron cargar los niveles</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={sortedLevels}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🎖️</Text>
              <Text style={styles.emptyText}>No hay niveles registrados</Text>
              <Text style={styles.emptySubtext}>Presiona el botón + para crear uno</Text>
            </View>
          }
        />
      )}

      <ProtectedElement requiredPermissions={['customer_levels.create']}>
        <AddButton onPress={openCreate} icon="🎖️" />
      </ProtectedElement>

      {/* Form Modal */}
      <Modal visible={showFormModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{editing ? 'Editar Nivel' : 'Nuevo Nivel'}</Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Código *</Text>
                <TextInput
                  style={[styles.input, editing && styles.inputDisabled]}
                  value={form.code}
                  onChangeText={(t) => setForm({ ...form, code: t.toUpperCase() })}
                  placeholder="Ej: SOCIA_GOLD"
                  editable={!editing}
                  autoCapitalize="characters"
                  placeholderTextColor={theme.color.text.placeholder}
                />
                {editing && <Text style={styles.helperText}>El código no se puede modificar</Text>}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Nombre *</Text>
                <TextInput
                  style={styles.input}
                  value={form.name}
                  onChangeText={(t) => setForm({ ...form, name: t })}
                  placeholder="Ej: Socia Gold"
                  placeholderTextColor={theme.color.text.placeholder}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Perfil de precio</Text>
                <TouchableOpacity
                  style={styles.selectInput}
                  onPress={async () => {
                    await loadProfilesIfNeeded();
                    setShowProfileModal(true);
                  }}
                >
                  <Text
                    style={[
                      styles.selectInputText,
                      !form.priceProfileId && { color: theme.color.text.placeholder },
                    ]}
                  >
                    {selectedProfileName}
                  </Text>
                  <Text style={styles.selectInputArrow}>▾</Text>
                </TouchableOpacity>
                <Text style={styles.helperText}>Si se deja vacío se usa el perfil del canal.</Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Descuento adicional (%)</Text>
                <TextInput
                  style={styles.input}
                  value={form.discountPct}
                  onChangeText={(t) => setForm({ ...form, discountPct: t })}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={theme.color.text.placeholder}
                />
                <Text style={styles.helperText}>Entre 0 y 100. Se aplica sobre el perfil.</Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Orden de presentación</Text>
                <TextInput
                  style={styles.input}
                  value={form.sortOrder}
                  onChangeText={(t) => setForm({ ...form, sortOrder: t })}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={theme.color.text.placeholder}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchLabelWrap}>
                  <Text style={styles.switchLabel}>WhatsApp habilitado</Text>
                  <Text style={styles.helperText}>
                    Permite comprar por el bot a clientes de este nivel.
                  </Text>
                </View>
                <Switch
                  value={form.whatsappEnabled}
                  onValueChange={(v) => setForm({ ...form, whatsappEnabled: v })}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchLabelWrap}>
                  <Text style={styles.switchLabel}>Nivel por defecto</Text>
                  <Text style={styles.helperText}>
                    Solo puede haber uno. El backend desmarca al anterior.
                  </Text>
                </View>
                <Switch
                  value={form.isDefault}
                  onValueChange={(v) => setForm({ ...form, isDefault: v })}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchLabelWrap}>
                  <Text style={styles.switchLabel}>Activo</Text>
                </View>
                <Switch
                  value={form.isActive}
                  onValueChange={(v) => setForm({ ...form, isActive: v })}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowFormModal(false);
                    setEditing(null);
                    setForm(EMPTY_FORM);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSave}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <ActivityIndicator color={theme.color.text.inverse} />
                  ) : (
                    <Text style={styles.saveButtonText}>Guardar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Price Profile Picker Modal */}
      <Modal visible={showProfileModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '70%' }]}>
            <Text style={styles.modalTitle}>Seleccionar perfil</Text>
            {loadingProfiles ? (
              <ActivityIndicator color={theme.color.brand.accent} style={{ marginVertical: 24 }} />
            ) : (
              <ScrollView>
                <TouchableOpacity
                  style={styles.profileOption}
                  onPress={() => {
                    setForm({ ...form, priceProfileId: null });
                    setShowProfileModal(false);
                  }}
                >
                  <Text style={styles.profileOptionName}>Sin perfil (usa el del canal)</Text>
                </TouchableOpacity>
                {profiles.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.profileOption}
                    onPress={() => {
                      setForm({ ...form, priceProfileId: p.id });
                      setShowProfileModal(false);
                    }}
                  >
                    <Text style={styles.profileOptionName}>{p.name}</Text>
                    <Text style={styles.profileOptionCode}>{p.code}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity
              style={[styles.cancelButton, { marginTop: 12 }]}
              onPress={() => setShowProfileModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.color.background.subtle },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.color.background.subtle,
    },
    loadingText: {
      marginTop: theme.space[4],
      fontSize: 16,
      color: theme.color.text.muted,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.space[5],
      paddingVertical: theme.space[4],
      backgroundColor: theme.color.surface.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    backButtonText: { fontSize: 24, color: theme.color.text.heading },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.color.text.heading,
      flex: 1,
      textAlign: 'center',
    },
    headerSpacer: { width: 40 },
    infoBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.brand.primarySoft,
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
      marginHorizontal: theme.space[4],
      marginTop: theme.space[4],
      borderRadius: theme.radii.xl,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    infoBannerIcon: { fontSize: 20, marginRight: theme.space[3] },
    infoBannerText: {
      flex: 1,
      fontSize: 13,
      color: theme.color.brand.primary,
      lineHeight: 18,
    },
    listContainer: { padding: theme.space[4], paddingBottom: 120 },
    card: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii['2xl'],
      padding: theme.space[4],
      marginBottom: theme.space[4],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      ...theme.shadow.sm,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: theme.space[3],
    },
    cardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      flex: 1,
      marginRight: theme.space[2],
    },
    cardTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.color.text.heading,
      flexShrink: 1,
    },
    codeBadge: {
      backgroundColor: theme.color.surface.muted,
      paddingHorizontal: theme.space[2.5],
      paddingVertical: theme.space[1],
      borderRadius: theme.radii.sm,
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    codeText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.color.text.body,
      letterSpacing: 0.5,
    },
    statusBadge: {
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[1.5],
      borderRadius: theme.radii.xl,
    },
    statusActive: { backgroundColor: theme.color.state.success.background },
    statusInactive: { backgroundColor: theme.color.state.danger.background },
    statusText: { fontSize: 12, fontWeight: '600' },
    metricsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
      paddingVertical: theme.space[3],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      marginBottom: theme.space[3],
    },
    metricItem: { flex: 1, alignItems: 'center' },
    metricLabel: {
      fontSize: 11,
      color: theme.color.text.muted,
      fontWeight: '500',
      marginBottom: 4,
    },
    metricValue: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    metricDivider: {
      width: 1,
      height: 30,
      backgroundColor: theme.color.border.subtle,
    },
    defaultBadge: {
      alignSelf: 'flex-start',
      backgroundColor: theme.color.state.warning.background,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[1.5],
      borderRadius: theme.radii.xl,
      marginBottom: theme.space[3],
    },
    defaultBadgeText: {
      fontSize: 12,
      color: theme.color.state.warning.text,
      fontWeight: '600',
    },
    actionsRow: {
      flexDirection: 'row',
      gap: theme.space[2],
    },
    actionButton: {
      flex: 1,
      paddingVertical: theme.space[2.5],
      borderRadius: theme.radii.md,
      alignItems: 'center',
    },
    editButton: { backgroundColor: theme.color.state.info.border },
    deleteButton: { backgroundColor: theme.color.state.danger.border },
    actionButtonText: {
      color: theme.color.text.inverse,
      fontSize: 13,
      fontWeight: '600',
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
    },
    emptyIcon: { fontSize: 64, marginBottom: theme.space[4] },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.color.text.muted,
      marginBottom: theme.space[2],
    },
    emptySubtext: { fontSize: 14, color: theme.color.text.placeholder },
    retryButton: {
      marginTop: theme.space[3],
      backgroundColor: theme.color.brand.accent,
      paddingHorizontal: theme.space[6],
      paddingVertical: theme.space[3],
      borderRadius: theme.radii.xl,
    },
    retryButtonText: {
      color: theme.color.text.onAction,
      fontWeight: '600',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.space[4],
    },
    modalContent: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii['2xl'],
      padding: theme.space[6],
      width: '100%',
      maxWidth: 520,
      maxHeight: '90%',
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: theme.space[5],
      textAlign: 'center',
    },
    formGroup: { marginBottom: theme.space[4] },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.body,
      marginBottom: theme.space[2],
    },
    input: {
      backgroundColor: theme.color.background.subtle,
      borderRadius: theme.radii.xl,
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
      fontSize: 15,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      color: theme.color.text.body,
    },
    inputDisabled: {
      backgroundColor: theme.color.surface.muted,
      color: theme.color.text.placeholder,
    },
    selectInput: {
      backgroundColor: theme.color.background.subtle,
      borderRadius: theme.radii.xl,
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    selectInputText: {
      fontSize: 15,
      color: theme.color.text.body,
      flex: 1,
    },
    selectInputArrow: {
      fontSize: 14,
      color: theme.color.text.muted,
      marginLeft: theme.space[2],
    },
    helperText: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginTop: 6,
      fontStyle: 'italic',
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.space[3],
      paddingVertical: theme.space[3],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
    },
    switchLabelWrap: { flex: 1 },
    switchLabel: {
      fontSize: 15,
      color: theme.color.text.heading,
      fontWeight: '500',
    },
    modalActions: {
      flexDirection: 'row',
      gap: theme.space[3],
      marginTop: theme.space[4],
    },
    cancelButton: {
      flex: 1,
      backgroundColor: theme.color.surface.muted,
      paddingVertical: theme.space[3.5],
      borderRadius: theme.radii.xl,
      alignItems: 'center',
    },
    cancelButtonText: {
      color: theme.color.text.body,
      fontSize: 16,
      fontWeight: '600',
    },
    saveButton: {
      flex: 1,
      backgroundColor: theme.color.state.success.border,
      paddingVertical: theme.space[3.5],
      borderRadius: theme.radii.xl,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveButtonText: {
      color: theme.color.text.inverse,
      fontSize: 16,
      fontWeight: '600',
    },
    profileOption: {
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[4],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    profileOptionName: {
      fontSize: 15,
      color: theme.color.text.body,
      fontWeight: '500',
      flex: 1,
    },
    profileOptionCode: {
      fontSize: 12,
      color: theme.color.text.muted,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
  });

export default CustomerLevelsScreen;
