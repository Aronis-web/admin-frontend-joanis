import React, { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BizlinksConfigForm } from '../../components/Bizlinks';
import { BizlinksConfig } from '../../types/bizlinks';
import { useBizlinksConfig } from '../../hooks/useBizlinks';

type Props = NativeStackScreenProps<any, 'BizlinksConfigEdit'>;

export const BizlinksConfigEditScreen: React.FC<Props> = ({ navigation, route }) => {
  const params = route.params as { config?: BizlinksConfig; configId?: string };
  const { getConfigById } = useBizlinksConfig();
  const [config, setConfig] = useState<BizlinksConfig | null>(params.config || null);
  const [loading, setLoading] = useState(!params.config && !!params.configId);

  useEffect(() => {
    const loadConfig = async () => {
      if (!params.config && params.configId) {
        try {
          setLoading(true);
          const loadedConfig = await getConfigById(params.configId);
          setConfig(loadedConfig);
        } catch (error) {
          console.error('Error loading config:', error);
          navigation.goBack();
        } finally {
          setLoading(false);
        }
      }
    };

    loadConfig();
  }, [params.config, params.configId]);

  const handleSuccess = () => {
    navigation.goBack();
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Cargando configuración...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!config) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>No se encontró la configuración</Text>
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
