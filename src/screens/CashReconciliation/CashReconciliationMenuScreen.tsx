import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design-system/themes';
import { useThemedStyles } from '@/design-system/themes/useThemedStyles';
import type { Theme } from '@/design-system/themes/defaultLight';

type Props = NativeStackScreenProps<any, 'CashReconciliationMenu'>;

// Vendor brand color (no equivalente semantico en theme)
const PROSEGUR_BRAND = '#8B5CF6';

interface MenuOption {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  color: string;
}

export const CashReconciliationMenuScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const menuOptions: MenuOption[] = [
    {
      id: 'upload-files',
      title: 'Subir Archivos',
      description: 'Cargar archivos Excel para análisis de cuadre de caja (Ventas, Izipay, Prosegur)',
      icon: '📤',
      route: 'UploadCashReconciliationFiles',
      color: theme.color.state.success.border,
    },
    {
      id: 'review-documents',
      title: 'Revisar Documentos',
      description: 'Consultar y filtrar ventas, transacciones Izipay y depósitos Prosegur',
      icon: '📋',
      route: 'ReviewDocumentsMenu',
      color: theme.color.brand.accent,
    },
    {
      id: 'cuadre',
      title: 'Cuadre',
      description: 'Generar reportes de cuadre de caja por rango de fechas y sede',
      icon: '📊',
      route: 'Cuadre',
      color: PROSEGUR_BRAND,
    },

  ];

  const renderOption = (option: MenuOption) => (
    <TouchableOpacity
      key={option.id}
      style={styles.menuCard}
      onPress={() => navigation.navigate(option.route)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: option.color }]}>
        <Text style={styles.icon}>{option.icon}</Text>
      </View>
      <View style={styles.menuContent}>
        <Text style={styles.menuTitle}>{option.title}</Text>
        <Text style={styles.menuDescription}>{option.description}</Text>
      </View>
      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cuadre de Caja</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Menu Options */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.menuContainer}>
          {menuOptions.map(renderOption)}
        </View>
      </ScrollView>
    </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.color.surface.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: theme.color.text.body,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  menuContainer: {
    padding: 16,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.surface.base,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: theme.color.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  icon: {
    fontSize: 24,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.text.heading,
    marginBottom: 4,
  },
  menuDescription: {
    fontSize: 13,
    color: theme.color.text.muted,
    lineHeight: 18,
  },
  arrow: {
    fontSize: 28,
    color: theme.color.border.default,
    fontWeight: '300',
  },
});
