import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { EmitirFacturaForm } from '../../components/Bizlinks';
import { useAuthStore } from '../../store/auth';
import { useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { GradientHeader, ContentContainer } from '@/design-system/components';
import { useGoBack } from '@/hooks/useGoBack';

const SCREEN_TITLES: Record<string, string> = {
  BizlinksEmitirBoleta: 'Emitir Boleta',
  BizlinksEmitirNotaCredito: 'Emitir Nota de Crédito',
  BizlinksEmitirNotaDebito: 'Emitir Nota de Débito',
  BizlinksEmitirGuiaRemision: 'Emitir Guía de Remisión',
};

type Props = NativeStackScreenProps<any, any>;

export const BizlinksEmitirFacturaScreen: React.FC<Props> = ({ navigation, route }) => {
  const { currentCompany, currentSite } = useAuthStore();
  const { seriesId, series, documentType } = route.params || {};
  const styles = useThemedStyles(createStyles);
  const goBack = useGoBack();
  const title = SCREEN_TITLES[route.name] || 'Emitir Factura';

  const handleSuccess = (documentId: string) => {
    navigation.navigate('BizlinksDocumentDetail', { documentId });
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <GradientHeader title={title} onBack={goBack} />
      <ContentContainer variant="form" style={styles.body}>
        <EmitirFacturaForm
          companyId={currentCompany?.id || ''}
          siteId={currentSite?.id}
          seriesId={seriesId}
          series={series}
          documentType={documentType}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </ContentContainer>
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background.subtle,
  },
  body: {
    flex: 1,
  },
});
