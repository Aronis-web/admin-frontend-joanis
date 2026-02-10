import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useBizlinksDocuments } from '../../hooks/useBizlinks';
import { BizlinksDocument, BizlinksDocumentType } from '../../types/bizlinks';
import { BizlinksDocumentCard } from '../../components/Bizlinks';
import { useAuth } from '../../hooks/useAuth';

type Props = NativeStackScreenProps<any, 'BizlinksDocuments'>;

export const BizlinksDocumentsScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const {
    getDocuments,
    refreshDocumentStatus,
    downloadArtifacts,
    loading,
  } = useBizlinksDocuments();

  const [documents, setDocuments] = useState<BizlinksDocument[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingDocId, setRefreshingDocId] = useState<string | null>(null);

  const loadDocuments = async () => {
    try {
      const data = await getDocuments({
        companyId: user?.companyId,
      });
      setDocuments(data);
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDocuments();
    setRefreshing(false);
  };

  const handleRefreshDocument = async (document: BizlinksDocument) => {
    setRefreshingDocId(document.id);
    try {
      const updated = await refreshDocumentStatus(document.id);
      Alert.alert(
        'Estado actualizado',
        `Estado SUNAT: ${updated.statusSunat}\n${updated.messageSunat?.mensaje || ''}`
      );
      loadDocuments();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setRefreshingDocId(null);
    }
  };

  const handleDownloadArtifacts = async (document: BizlinksDocument) => {
    try {
      await downloadArtifacts(document.id, {
        downloadPdf: true,
        downloadXml: true,
        downloadCdr: true,
      });
      Alert.alert('Éxito', 'Archivos descargados correctamente');
      loadDocuments();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleDocumentPress = (document: BizlinksDocument) => {
    navigation.navigate('BizlinksDocumentDetail', { documentId: document.id });
  };

  const renderDocument = ({ item }: { item: BizlinksDocument }) => (
    <BizlinksDocumentCard
      document={item}
      onPress={handleDocumentPress}
      onRefresh={handleRefreshDocument}
      onDownload={handleDownloadArtifacts}
      refreshing={refreshingDocId === item.id}
    />
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Documentos Electrónicos</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('BizlinksEmitirFactura')}
        >
          <Text style={styles.addButtonText}>+ Emitir Factura</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={documents}
        renderItem={renderDocument}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay documentos emitidos</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => navigation.navigate('BizlinksEmitirFactura')}
            >
              <Text style={styles.emptyButtonText}>Emitir primera factura</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  list: {
    paddingVertical: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  emptyButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
