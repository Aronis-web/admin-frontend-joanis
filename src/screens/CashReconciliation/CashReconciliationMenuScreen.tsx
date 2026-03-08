import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<any, 'CashReconciliationMenu'>;

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

  const menuOptions: MenuOption[] = [
    {
      id: 'upload-files',
      title: 'Subir Archivos',
      description: 'Cargar archivos Excel para análisis de cuadre de caja (Ventas, Izipay, Prosegur)',
      icon: '📤',
      route: 'UploadCashReconciliationFiles',
      color: '#10B981',
    },
    {
      id: 'review-documents',
      title: 'Revisar Documentos',
      description: 'Consultar y filtrar ventas, transacciones Izipay y depósitos Prosegur',
      icon: '📋',
      route: 'ReviewDocumentsMenu',
      color: '#3B82F6',
    },
    {
      id: 'cuadre',
      title: 'Cuadre',
      description: 'Generar reportes de cuadre de caja por rango de fechas y sede',
      icon: '📊',
      route: 'Cuadre',
      color: '#8B5CF6',
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#374151',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
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
    color: '#1F2937',
    marginBottom: 4,
  },
  menuDescription: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  arrow: {
    fontSize: 28,
    color: '#D1D5DB',
    fontWeight: '300',
  },
});
