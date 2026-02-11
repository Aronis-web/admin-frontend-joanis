import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BizlinksConfigForm } from '../../components/Bizlinks';
import { useBizlinksConfig } from '../../hooks/useBizlinks';
import { BizlinksConfig } from '../../types/bizlinks';

type Props = NativeStackScreenProps<any, 'BizlinksConfigEdit'>;

export const BizlinksConfigEditScreen: React.FC<Props> = ({ navigation, route }) => {
  const { configId } = route.params as { configId: string };
  const { getConfigById, loading } = useBizlinksConfig();
  const [config, setConfig] = useState<BizlinksConfig | null>(null);

  useEffect(() => {
    loadConfig();
  }, [configId]);

  const loadConfig = async () => {
    try {
      const data = await getConfigById(configId);
      setConfig(data);
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const handleSuccess = () => {
    navigation.goBack();
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  if (loading || !config) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Cargando configuración...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.content}>
        <BizlinksConfigForm
          config={config}
          companyId={config.companyId}
          siteId={config.siteId}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
});
