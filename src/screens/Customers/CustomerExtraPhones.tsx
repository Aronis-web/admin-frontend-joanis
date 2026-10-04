import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { customersService, type CustomerExtraPhone } from '@/services/api/customers';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import Alert from '@/utils/alert';

interface Props {
  customerId: string;
}

/**
 * Otros numeros del cliente (ademas de Telefono/Movil). El bot de WhatsApp
 * anexa aqui los numeros desde los que el cliente escribe al identificarse con
 * su DNI/RUC; desde el admin se pueden agregar o quitar.
 */
export const CustomerExtraPhones: React.FC<Props> = ({ customerId }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [phones, setPhones] = useState<CustomerExtraPhone[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newPhone, setNewPhone] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setPhones(await customersService.getExtraPhones(customerId));
    } catch {
      setPhones([]);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    const digits = newPhone.replace(/\D/g, '');
    if (digits.length < 9) {
      Alert.alert('Número inválido', 'Ingresa un celular de 9 dígitos.');
      return;
    }
    try {
      setBusy(true);
      setPhones(await customersService.addExtraPhone(customerId, digits));
      setNewPhone('');
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'No se pudo agregar el número');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = (p: CustomerExtraPhone) =>
    Alert.alert('Quitar número', `¿Quitar ${p.phone} de este cliente?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: async () => {
          try {
            await customersService.removeExtraPhone(customerId, p.id);
            setPhones((prev) => prev.filter((x) => x.id !== p.id));
          } catch (err: any) {
            Alert.alert('Error', err?.message ?? 'No se pudo quitar el número');
          }
        },
      },
    ]);

  return (
    <View style={styles.box}>
      <Text style={styles.label}>Otros números (WhatsApp)</Text>
      <Text style={styles.hint}>
        El bot anexa aquí los números desde los que el cliente escribe al identificarse con su
        DNI/RUC. Con cualquiera de ellos compra con su nivel.
      </Text>
      {loading ? (
        <ActivityIndicator color={theme.color.text.muted} />
      ) : phones.length === 0 ? (
        <Text style={styles.hint}>Sin números adicionales.</Text>
      ) : (
        phones.map((p) => (
          <View key={p.id} style={styles.row}>
            <Ionicons
              name={p.source === 'WHATSAPP' ? 'logo-whatsapp' : 'call-outline'}
              size={16}
              color={theme.color.text.muted}
            />
            <Text style={styles.phone}>{p.phone}</Text>
            <Text style={styles.hint}>{p.source === 'WHATSAPP' ? 'del bot' : 'manual'}</Text>
            <TouchableOpacity onPress={() => handleRemove(p)} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={theme.color.text.muted} />
            </TouchableOpacity>
          </View>
        ))
      )}
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={newPhone}
          onChangeText={setNewPhone}
          placeholder="987654321"
          placeholderTextColor={theme.color.text.muted}
          keyboardType="phone-pad"
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAdd} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.addText}>Agregar</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    box: {
      gap: 8,
      marginBottom: 16,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    hint: {
      fontSize: 12,
      color: theme.color.text.muted,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    phone: {
      flex: 1,
      fontSize: 15,
      color: theme.color.text.body,
    },
    input: {
      flex: 1,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border.default,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      color: theme.color.text.body,
      backgroundColor: theme.color.surface.base,
    },
    addButton: {
      backgroundColor: theme.color.brand.accent,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    addText: {
      color: '#fff',
      fontWeight: '600',
    },
  });
