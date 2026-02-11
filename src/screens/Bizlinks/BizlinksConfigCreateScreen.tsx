import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BizlinksConfigForm } from '../../components/Bizlinks';
import { useAuthStore } from '../../store/auth';

type Props = NativeStackScreenProps<any, 'BizlinksConfigCreate'>;

export const BizlinksConfigCreateScreen: React.FC<Props> = ({ navigation }) => {
  const { currentCompany, currentSite } = useAuthStore();

  const handleSuccess = () => {
    navigation.goBack();
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.content}>
        <BizlinksConfigForm
          companyId={currentCompany?.id || ''}
          siteId={currentSite?.id}
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
});
