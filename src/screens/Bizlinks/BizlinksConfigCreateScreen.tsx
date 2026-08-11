import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BizlinksConfigForm } from '../../components/Bizlinks';
import { useAuthStore } from '../../store/auth';
import { useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

type Props = NativeStackScreenProps<any, 'BizlinksConfigCreate'>;

export const BizlinksConfigCreateScreen: React.FC<Props> = ({ navigation }) => {
  const { currentCompany, currentSite } = useAuthStore();
  const styles = useThemedStyles(createStyles);

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

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background.subtle,
  },
  content: {
    flex: 1,
  },
});
