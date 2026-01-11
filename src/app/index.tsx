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
import { useTenantStore } from '@/store/tenant';
import { Loader } from '@/components/common/Loader';
import { GlobalErrorBoundary } from '@/components/common/GlobalErrorBoundary';

export const App = () => {
  const [fontsLoaded] = useFonts({
    Baloo2_700Bold,
    Baloo2_600SemiBold,
    Baloo2_500Medium,
  });

  const { initAuth, isLoading: authLoading } = useAuthStore();
  const { initTenantContext } = useTenantStore();

  useEffect(() => {
    const initialize = async () => {
      try {
        // Set a timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
          console.error('⏰ App initialization timeout - forcing loading to false');
          // Force loading to false after 10 seconds
          const { setLoading } = useAuthStore.getState();
          setLoading(false);
        }, 10000);

        await Promise.all([
          initAuth(),
          initTenantContext(),
        ]);

        clearTimeout(timeoutId);
      } catch (error) {
        console.error('❌ App initialization error:', error);
        // Ensure loading is set to false even if there's an error
        const { setLoading } = useAuthStore.getState();
        setLoading(false);
      }
    };

    initialize();
  }, []);

  if (!fontsLoaded || authLoading) {
    return <Loader fullScreen text="Iniciando aplicación..." />;
  }

  return (
    <GlobalErrorBoundary>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <Navigation />
      </SafeAreaProvider>
    </GlobalErrorBoundary>
  );
};

export default App;
