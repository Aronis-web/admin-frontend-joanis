import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { EmitirFacturaForm } from '../../components/Bizlinks';
import { useAuthStore } from '../../store/auth';

type Props = NativeStackScreenProps<any, 'BizlinksEmitirFactura'>;

export const BizlinksEmitirFacturaScreen: React.FC<Props> = ({ navigation }) => {
  const { currentCompany, currentSite } = useAuthStore();

  const handleSuccess = (documentId: string) => {
    navigation.navigate('BizlinksDocumentDetail', { documentId });
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <EmitirFacturaForm
        companyId={currentCompany?.id || ''}
        siteId={currentSite?.id}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
});
