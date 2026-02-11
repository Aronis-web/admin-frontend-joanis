import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'BizlinksMenu'>;

interface MenuOption {
  title: string;
  description: string;
  icon: string;
  route: string;
  color: string;
}

export const BizlinksMenuScreen: React.FC<Props> = ({ navigation }) => {
  // Redirigir automáticamente a la pantalla de documentos
  useEffect(() => {
    navigation.replace('BizlinksDocuments');
  }, [navigation]);

  // Este código ya no se ejecutará debido a la redirección inmediata
  const menuOptions: MenuOption[] = [
    {
      title: 'Comprobantes Electrónicos',
      description: 'Gestionar y emitir comprobantes electrónicos',
      icon: '📄',
      route: 'BizlinksDocuments',
      color: '#6366F1',
    },
    {
      title: 'Configuración',
      description: 'Gestionar configuraciones de Bizlinks',
      icon: '⚙️',
      route: 'BizlinksConfig',
      color: '#007bff',
    },
  ];

  const renderOption = (option: MenuOption) => (
    <TouchableOpacity
      key={option.route}
      style={[styles.card, { borderLeftColor: option.color }]}
      onPress={() => navigation.navigate(option.route)}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{option.icon}</Text>
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{option.title}</Text>
        <Text style={styles.description}>{option.description}</Text>
      </View>
      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bizlinks</Text>
        <Text style={styles.headerSubtitle}>Facturación Electrónica SUNAT</Text>
      </View>

      <View style={styles.content}>
        {menuOptions.map(renderOption)}
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>ℹ️ Información</Text>
        <Text style={styles.infoText}>
          Sistema de integración con el Componente Local Bizlinks para emisión de
          comprobantes electrónicos según normativa SUNAT (Perú).
        </Text>
        <View style={styles.infoList}>
          <Text style={styles.infoItem}>✅ Facturas Electrónicas</Text>
          <Text style={styles.infoItem}>✅ Consulta de estados SUNAT</Text>
          <Text style={styles.infoItem}>✅ Descarga de PDF, XML y CDR</Text>
          <Text style={styles.infoItem}>✅ Multi-empresa y multi-sede</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  content: {
    padding: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  icon: {
    fontSize: 24,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#666',
  },
  arrow: {
    fontSize: 24,
    color: '#ccc',
    marginLeft: 8,
  },
  infoCard: {
    backgroundColor: '#e7f3ff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#b3d9ff',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#004085',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#004085',
    marginBottom: 12,
    lineHeight: 20,
  },
  infoList: {
    marginTop: 8,
  },
  infoItem: {
    fontSize: 14,
    color: '#004085',
    marginBottom: 4,
  },
});
