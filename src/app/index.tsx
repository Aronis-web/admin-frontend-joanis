// IMPORTANT: This must be imported FIRST before any other imports that use crypto/uuid
import 'react-native-get-random-values';

import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import {
  useFonts,
  Baloo2_700Bold,
  Baloo2_600SemiBold,
  Baloo2_500Medium,
} from '@expo-google-fonts/baloo-2';
import { Navigation } from '@/navigation';
import { useAuthStore } from '@/store/auth';
import { Loader } from '@/components/common/Loader';

export const App = () => {
  const [fontsLoaded] = useFonts({
    Baloo2_700Bold,
    Baloo2_600SemiBold,
    Baloo2_500Medium,
  });

  const { initAuth, isLoading: authLoading } = useAuthStore();

  useEffect(() => {
    const initialize = async () => {
      await initAuth();
    };

    initialize();
  }, []);

  if (!fontsLoaded || authLoading) {
    return <Loader fullScreen text="Iniciando aplicación..." />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <Navigation />
    </SafeAreaProvider>
  );
};

export default App;
