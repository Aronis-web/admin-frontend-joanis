/**
 * Formulario para autorizar un número en el WhatsApp de consultas: usuario,
 * teléfono y sedes. Al guardar, el backend envía un código de 6 dígitos.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Body, Button, Caption, Input, Label } from '@/design-system';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { borderRadius, spacing } from '@/design-system/tokens';
import { useCreateConsultaWaContact } from '@/hooks/api/useConsultasWa';
import { useSingleFlight } from '@/hooks/useSingleFlight';
import type { ConsultaWaSiteOption, ConsultaWaUserOption } from '@/types/consultas-wa';
import Alert from '@/utils/alert';
import { normalizeSearchText } from '@/utils/normalizeText';

import { SiteMultiSelect } from './SiteMultiSelect';
import { formatPhone, getErrorMessage, normalizePhoneInput } from './waFormat';

const MAX_RESULTS = 8;

export interface ConsultaAddContactFormProps {
  users: ConsultaWaUserOption[];
  sites: ConsultaWaSiteOption[];
  /** Usuarios que ya tienen un número registrado (se ocultan del buscador). */
  registeredUserIds: Set<string>;
}

export const ConsultaAddContactForm: React.FC<ConsultaAddContactFormProps> = ({
  users,
  sites,
  registeredUserIds,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const createMutation = useCreateConsultaWaContact();
  const runCreate = useSingleFlight();

  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<ConsultaWaUserOption | null>(null);
  const [phone, setPhone] = useState('');
  const [siteIds, setSiteIds] = useState<string[]>([]);

  const results = useMemo(() => {
    const q = normalizeSearchText(search);
    const available = users.filter((u) => !registeredUserIds.has(u.id));
    const filtered = q
      ? available.filter((u) =>
          normalizeSearchText(`${u.name} ${u.email ?? ''} ${u.phone ?? ''}`).includes(q)
        )
      : available;
    return filtered.slice(0, MAX_RESULTS);
  }, [users, registeredUserIds, search]);

  const pending = createMutation.isPending;
  const normalizedPhone = normalizePhoneInput(phone);
  const canSubmit = !!selectedUser && !!normalizedPhone && !pending;

  const chooseUser = (user: ConsultaWaUserOption) => {
    setSelectedUser(user);
    setPhone(user.phone ? user.phone.replace(/\D/g, '') : '');
    setSearch('');
  };

  const reset = () => {
    setSelectedUser(null);
    setPhone('');
    setSiteIds([]);
    setSearch('');
  };

  const handleSubmit = () => {
    if (createMutation.isPending || !selectedUser) return;
    const finalPhone = normalizePhoneInput(phone);
    if (!finalPhone) {
      Alert.alert('Teléfono inválido', 'Ingresa 9 dígitos (Perú) o el número con código de país.');
      return;
    }
    void runCreate(async () => {
      try {
        await createMutation.mutateAsync({ userId: selectedUser.id, phone: finalPhone, siteIds });
        Alert.alert(
          'Código enviado',
          `Se envió el código a ${formatPhone(finalPhone)}. Quedará activo cuando lo responda desde ese celular.`
        );
        reset();
      } catch (err) {
        Alert.alert('Error', getErrorMessage(err, 'No se pudo agregar el número'));
      }
    });
  };

  return (
    <View style={styles.container}>
      <Label>Agregar número autorizado</Label>

      {selectedUser ? (
        <View style={styles.selectedUser}>
          <Ionicons name="person-circle-outline" size={22} color={theme.color.icon.accent} />
          <View style={styles.flex}>
            <Body>{selectedUser.name}</Body>
            {selectedUser.email ? (
              <Caption color={theme.color.text.muted}>{selectedUser.email}</Caption>
            ) : null}
          </View>
          <Button
            title="Cambiar"
            variant="ghost"
            size="small"
            onPress={() => setSelectedUser(null)}
            disabled={pending}
          />
        </View>
      ) : (
        <View style={styles.picker}>
          <Input
            placeholder="Buscar usuario por nombre, correo o teléfono"
            value={search}
            onChangeText={setSearch}
            leftIcon="search-outline"
            size="small"
          />
          {results.length === 0 ? (
            <Caption color={theme.color.text.muted}>Sin usuarios disponibles.</Caption>
          ) : (
            results.map((u) => (
              <Pressable key={u.id} style={styles.userItem} onPress={() => chooseUser(u)}>
                <Body numberOfLines={1} style={styles.flex}>
                  {u.name}
                </Body>
                <Caption color={theme.color.text.muted} numberOfLines={1}>
                  {u.phone ? formatPhone(u.phone) : (u.email ?? '')}
                </Caption>
              </Pressable>
            ))
          )}
        </View>
      )}

      <Input
        label="Teléfono"
        placeholder="999888777"
        value={phone}
        onChangeText={(t) => setPhone(t.replace(/[^\d+\s]/g, ''))}
        keyboardType="phone-pad"
        leftIcon="call-outline"
        size="small"
        helperText={
          normalizedPhone
            ? `Se registrará como ${formatPhone(normalizedPhone)}`
            : '9 dígitos para Perú, o con código de país.'
        }
        editable={!pending}
      />

      <View style={styles.sites}>
        <Caption color={theme.color.text.muted}>Sedes que puede consultar</Caption>
        <SiteMultiSelect sites={sites} value={siteIds} onChange={setSiteIds} disabled={pending} />
      </View>

      <Caption color={theme.color.text.muted}>
        Le llegará un código de 6 dígitos desde el número de consultas; cuando lo responda desde ese
        celular quedará activo.
      </Caption>

      <View style={styles.actions}>
        <Button
          title="Agregar y enviar código"
          onPress={handleSubmit}
          loading={pending}
          disabled={!canSubmit}
          leftIcon="send-outline"
        />
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      gap: spacing[3],
      paddingTop: spacing[3],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
    },
    flex: {
      flex: 1,
    },
    picker: {
      gap: spacing[1],
    },
    userItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      paddingVertical: spacing[2],
      paddingHorizontal: spacing[3],
      borderRadius: borderRadius.md,
      backgroundColor: theme.color.surface.subtle,
    },
    selectedUser: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      padding: spacing[3],
      borderRadius: borderRadius.md,
      backgroundColor: theme.color.surface.subtle,
    },
    sites: {
      gap: spacing[2],
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
  });

export default ConsultaAddContactForm;
