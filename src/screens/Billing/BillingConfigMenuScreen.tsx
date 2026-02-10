import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

export const BillingConfigMenuScreen: React.FC = () => {
  const navigation = useNavigation();

  const menuOptions = [
    {
      id: 'document-types',
      title: 'Tipos de Documentos',
      description: 'Gestionar tipos de documentos SUNAT (Factura, Boleta, NC, ND, etc.)',
      icon: '📄',
      color: '#8B5CF6',
      screen: 'DocumentTypes',
    },
    {
      id: 'document-series',
      title: 'Series de Documentos',
      description: 'Configurar series por sede (F001, B001, NC01, etc.)',
      icon: '📋',
      color: '#EC4899',
      screen: 'DocumentSeries',
    },
    {
      id: 'document-correlatives',
      title: 'Correlativos',
      description: 'Ver y gestionar correlativos generados',
      icon: '🔢',
      color: '#F59E0B',
      screen: 'DocumentCorrelatives',
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configuración Tributaria</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.introSection}>
          <Text style={styles.introIcon}>⚙️</Text>
          <Text style={styles.introTitle}>Sistema de Documentos Tributarios</Text>
          <Text style={styles.introDescription}>
            Gestiona la configuración completa de documentos electrónicos según la normativa SUNAT
          </Text>
        </View>

        <View style={styles.menuContainer}>
          {menuOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={styles.menuCard}
              onPress={() => navigation.navigate(option.screen as never)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: option.color + '20' }]}>
                <Text style={styles.cardIcon}>{option.icon}</Text>
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{option.title}</Text>
                <Text style={styles.menuDescription}>{option.description}</Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>📚 Información</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              • <Text style={styles.infoBold}>Tipos de Documentos:</Text> Configura los tipos de comprobantes según SUNAT (01-Factura, 03-Boleta, 07-NC, etc.)
            </Text>
            <Text style={styles.infoText}>
              • <Text style={styles.infoBold}>Series:</Text> Crea series de documentos por sede (F001, B001, NC01, etc.)
            </Text>
            <Text style={styles.infoText}>
              • <Text style={styles.infoBold}>Correlativos:</Text> Visualiza y gestiona los números correlativos generados automáticamente
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
  menuTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
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
