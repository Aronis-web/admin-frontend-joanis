import React from 'react';
import { ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { BotControlModal } from './components/BotControlModal';

type Props = NativeStackScreenProps<any, 'ChatbotSettings'>;

/**
 * Configuracion del chatbot como seccion propia del menu (Ventas WhatsApp >
 * Configuración): estado, personalidad, FAQ, entrega, medios de pago y T&C.
 */
export const ChatbotSettingsScreen: React.FC<Props> = ({ navigation }) => (
  <ScreenLayout navigation={navigation as any}>
    <ScrollView keyboardShouldPersistTaps="handled">
      <BotControlModal visible embedded />
    </ScrollView>
  </ScreenLayout>
);
