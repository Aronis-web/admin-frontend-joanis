import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { GradientHeader, contentWidthStyle } from '@/design-system/components';
import { useGoBack } from '@/hooks/useGoBack';

export const BizlinksGenerateDocumentsScreen: React.FC = () => {
  const navigation = useNavigation();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const goBack = useGoBack();

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
      color: theme.color.icon.accent,
      screen: 'BizlinksEmitirBoleta',
      available: false,
    },
    {
      id: 'nota-credito',
      title: 'Nota de Crédito',
      description: 'Generar nota de crédito electrónica (07)',
      icon: '↩️',
      color: theme.color.icon.warning,
      screen: 'BizlinksEmitirNotaCredito',
      available: false,
    },
    {
      id: 'nota-debito',
      title: 'Nota de Débito',
      description: 'Generar nota de débito electrónica (08)',
      icon: '↪️',
      color: theme.color.icon.danger,
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
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <GradientHeader title="Generar Documentos" onBack={goBack} />

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, contentWidthStyle]}
      >
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

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background.subtle,
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
    color: theme.color.text.heading,
    marginBottom: 8,
    textAlign: 'center',
  },
  introDescription: {
    fontSize: 16,
    color: theme.color.text.muted,
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
    backgroundColor: theme.color.surface.base,
    borderRadius: 16,
    padding: 20,
    shadowColor: theme.color.shadow,
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
    color: theme.color.text.heading,
    marginRight: 8,
  },
  comingSoonBadge: {
    backgroundColor: theme.color.state.warning.background,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  comingSoonText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.color.state.warning.text,
  },
  menuDescription: {
    fontSize: 14,
    color: theme.color.text.muted,
    lineHeight: 20,
  },
  arrow: {
    fontSize: 28,
    color: theme.color.text.disabled,
    marginLeft: 8,
  },
  infoSection: {
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.color.text.heading,
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: theme.color.state.info.background,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: theme.color.state.info.border,
  },
  infoText: {
    fontSize: 14,
    color: theme.color.text.body,
    marginBottom: 12,
    lineHeight: 20,
  },
  infoBold: {
    fontWeight: '600',
    color: theme.color.text.heading,
  },
});
