/**
 * SmartPurchaseFamiliesScreen — WIP
 *
 * Lista de familias del grupo con filtros y acciones de bloqueo/edición.
 * Se implementará en su iteración correspondiente. Placeholder funcional
 * para que la navegación no rompa.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { EmptyState, useThemedStyles } from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { spacing } from '@/design-system/tokens';
import type { MainStackParamList } from '@/types/navigation';

type Props = NativeStackScreenProps<MainStackParamList, 'SmartPurchaseFamilies'>;

export const SmartPurchaseFamiliesScreen: React.FC<Props> = ({ navigation }) => {
  const styles = useThemedStyles(createStyles);
  return (
    <ScreenLayout navigation={navigation as any}>
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centered}>
          <EmptyState
            icon="albums-outline"
            title="Familias del grupo"
            description="La gestión de familias (bloquear, editar canónico, mover miembros) llega en la siguiente iteración."
            actionLabel="Volver"
            onAction={() => navigation.goBack()}
          />
        </View>
      </SafeAreaView>
    </ScreenLayout>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.background.canvas,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing[6],
    },
  });
