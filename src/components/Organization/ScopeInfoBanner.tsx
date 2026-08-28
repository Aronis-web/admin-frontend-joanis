import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

/**
 * Banner explicativo del modelo de alcance del organigrama.
 * Aclara la diferencia entre puestos de Empresa y de Sede para que el
 * modulo sea autoexplicativo. Es descartable (se oculta al tocar la X).
 */
export const ScopeInfoBanner: React.FC = () => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <View style={styles.banner}>
      <Ionicons
        name="information-circle-outline"
        size={18}
        color={theme.color.brand.accent}
        style={styles.icon}
      />
      <Text style={styles.text}>
        <Text style={styles.bold}>🏢 Empresa</Text>: puestos que aplican a toda la organización.
        {'  '}
        <Text style={styles.bold}>🏪 Sede</Text>: puestos propios de una ubicación específica.
      </Text>
      <TouchableOpacity
        onPress={() => setVisible(false)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={16} color={theme.color.text.muted} />
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.color.brand.primarySoft,
      marginHorizontal: 20,
      marginTop: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
    },
    icon: {
      marginTop: 1,
    },
    text: {
      flex: 1,
      fontSize: 12,
      lineHeight: 17,
      color: theme.color.text.body,
    },
    bold: {
      fontWeight: '700',
      color: theme.color.text.heading,
    },
  });

export default ScopeInfoBanner;
