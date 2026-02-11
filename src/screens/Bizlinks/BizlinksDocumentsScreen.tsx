import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useBizlinksDocuments } from '../../hooks/useBizlinks';
import { BizlinksDocument, BizlinksDocumentType } from '../../types/bizlinks';
import { BizlinksDocumentCard } from '../../components/Bizlinks';
import { useAuthStore } from '../../store/auth';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

type Props = NativeStackScreenProps<any, 'BizlinksDocuments'>;

export const BizlinksDocumentsScreen: React.FC<Props> = ({ navigation }) => {
  const { currentCompany } = useAuthStore();
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
        companyId: currentCompany?.id,
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
      // Primero, solicitar al servidor que descargue los archivos desde Bizlinks
      await downloadArtifacts(document.id, {
        downloadPdf: true,
        downloadXml: true,
        downloadCdr: true,
      });

      // Recargar el documento para obtener las URLs actualizadas
      await loadDocuments();

      // Buscar el documento actualizado
      const updatedDoc = documents.find(d => d.id === document.id);
      if (!updatedDoc) {
        Alert.alert('Error', 'No se pudo encontrar el documento actualizado');
        return;
      }

      // Descargar los archivos disponibles
      const downloadedFiles: string[] = [];

      if (updatedDoc.pdfUrl) {
        try {
          const pdfFileName = `${updatedDoc.serieNumero}.pdf`;

          const pdfFile = await File.downloadFileAsync(updatedDoc.pdfUrl, Paths.cache);

          downloadedFiles.push('PDF');

          // Compartir el archivo PDF
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(pdfFile.uri, {
              mimeType: 'application/pdf',
              dialogTitle: `Factura ${updatedDoc.serieNumero}`,
            });
          }
        } catch (error) {
          console.error('Error descargando PDF:', error);
        }
      }

      if (updatedDoc.xmlSignUrl) {
        try {
          const xmlFileName = `${updatedDoc.serieNumero}.xml`;

          await File.downloadFileAsync(updatedDoc.xmlSignUrl, Paths.cache);

          downloadedFiles.push('XML');
        } catch (error) {
          console.error('Error descargando XML:', error);
        }
      }

      if (updatedDoc.xmlSunatUrl) {
        try {
          const cdrFileName = `R-${updatedDoc.serieNumero}.xml`;

          await File.downloadFileAsync(updatedDoc.xmlSunatUrl, Paths.cache);

          downloadedFiles.push('CDR');
        } catch (error) {
          console.error('Error descargando CDR:', error);
        }
      }

      if (downloadedFiles.length > 0) {
        Alert.alert(
          'Descarga exitosa',
          `Archivos descargados: ${downloadedFiles.join(', ')}`
        );
      } else {
        Alert.alert(
          'Información',
          'No hay archivos disponibles para descargar. Intenta actualizar el estado del documento primero.'
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al descargar archivos');
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
