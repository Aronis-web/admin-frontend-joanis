import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

export const BizlinksGenerateDocumentsScreen: React.FC = () => {
  const navigation = useNavigation();

  const menuOptions = [
    {
      id: 'factura',
      title: 'Emitir Factura',
      description: 'Generar factura electrónica (01)',
      icon: '📝',
      color: '#10B981',
      screen: 'BizlinksEmitirFactura',
      available: true,
    },
    {
      id: 'boleta',
      title: 'Emitir Boleta',
      description: 'Generar boleta de venta electrónica (03)',
      icon: '🧾',
      color: '#3B82F6',
      screen: 'BizlinksEmitirBoleta',
      available: false,
    },
    {
      id: 'nota-credito',
      title: 'Nota de Crédito',
      description: 'Generar nota de crédito electrónica (07)',
      icon: '↩️',
      color: '#F59E0B',
      screen: 'BizlinksEmitirNotaCredito',
      available: false,
    },
    {
      id: 'nota-debito',
      title: 'Nota de Débito',
      description: 'Generar nota de débito electrónica (08)',
      icon: '↪️',
      color: '#EF4444',
      screen: 'BizlinksEmitirNotaDebito',
      available: false,
    },
    {
      id: 'guia-remision',
      title: 'Guía de Remisión',
      description: 'Generar guía de remisión electrónica (09)',
      icon: '📦',
      color: '#8B5CF6',
      screen: 'BizlinksEmitirGuiaRemision',
      available: false,
    },
    {
      id: 'documentos',
      title: 'Ver Documentos',
      description: 'Consultar documentos emitidos',
      icon: '📄',
      color: '#6366F1',
      screen: 'BizlinksDocuments',
      available: true,
    },
    {
      id: 'vehicles',
      title: 'Gestionar Vehículos',
      description: 'Administrar vehículos para guías de remisión',
      icon: '🚗',
      color: '#06B6D4',
      screen: 'Vehicles',
      available: true,
    },
    {
      id: 'drivers',
      title: 'Gestionar Conductores',
      description: 'Administrar conductores para guías de remisión',
      icon: '👤',
      color: '#14B8A6',
      screen: 'Drivers',
      available: true,
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Generar Documentos</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.introSection}>
          <Text style={styles.introIcon}>📝</Text>
          <Text style={styles.introTitle}>Emisión de Documentos Electrónicos</Text>
          <Text style={styles.introDescription}>
            Genera comprobantes electrónicos según la normativa SUNAT
          </Text>
        </View>

        <View style={styles.menuContainer}>
          {menuOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.menuCard,
                !option.available && styles.menuCardDisabled,
              ]}
              onPress={() => option.available && navigation.navigate(option.screen as never)}
              activeOpacity={option.available ? 0.7 : 1}
              disabled={!option.available}
            >
              <View style={[styles.iconContainer, { backgroundColor: option.color + '20' }]}>
                <Text style={styles.cardIcon}>{option.icon}</Text>
              </View>
              <View style={styles.menuContent}>
                <View style={styles.titleRow}>
                  <Text style={styles.menuTitle}>{option.title}</Text>
                  {!option.available && (
                    <View style={styles.comingSoonBadge}>
                      <Text style={styles.comingSoonText}>Próximamente</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.menuDescription}>{option.description}</Text>
              </View>
              {option.available && <Text style={styles.arrow}>›</Text>}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>📚 Información</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              • <Text style={styles.infoBold}>Facturas:</Text> Comprobantes para ventas con RUC
            </Text>
            <Text style={styles.infoText}>
              • <Text style={styles.infoBold}>Boletas:</Text> Comprobantes para ventas con DNI
            </Text>
            <Text style={styles.infoText}>
              • <Text style={styles.infoBold}>Notas de Crédito/Débito:</Text> Modifican comprobantes emitidos
            </Text>
            <Text style={styles.infoText}>
              • <Text style={styles.infoBold}>Guías de Remisión:</Text> Documentos de traslado de mercancías
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 24,
    color: '#6366F1',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  introSection: {
    alignItems: 'center',
    marginBottom: 32,
    paddingVertical: 20,
  },
  introIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  introTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  introDescription: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  menuContainer: {
    gap: 16,
    marginBottom: 32,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  menuCardDisabled: {
    opacity: 0.6,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardIcon: {
    fontSize: 28,
  },
  menuContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginRight: 8,
  },
  comingSoonBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  comingSoonText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#92400E',
  },
  menuDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  arrow: {
    fontSize: 28,
    color: '#D1D5DB',
    marginLeft: 8,
  },
  infoSection: {
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#6366F1',
  },
  infoText: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 12,
    lineHeight: 20,
  },
  infoBold: {
    fontWeight: '600',
    color: '#1F2937',
  },
});
