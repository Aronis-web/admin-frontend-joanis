import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '@/design-system';
import { MAIN_ROUTES } from '@/constants/routes';

type Props = NativeStackScreenProps<any, 'ChatbotPostsale'>;

/** Ruta antigua "Post venta" (pantalla con pestañas): redirige a Seguimiento. */
export const ChatbotPostsaleRedirectScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  useEffect(() => {
    navigation.replace(MAIN_ROUTES.CHATBOT_POSTSALE_TRACKING);
  }, [navigation]);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={theme.color.brand.accent} />
    </View>
  );
};
