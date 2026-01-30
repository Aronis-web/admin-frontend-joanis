// IMPORTANT: This must be imported FIRST before any other imports that use crypto/uuid
import 'react-native-get-random-values';

import React, { useEffect, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, AppState, AppStateStatus } from 'react-native';
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
import { QueryProvider } from '@/providers/QueryProvider';
import { initSentry } from '@/config/sentry';
import { useTokenRefresh } from '@/hooks/useTokenRefresh';

export const App = () => {
  const [fontsLoaded] = useFonts({
    Baloo2_700Bold,
    Baloo2_600SemiBold,
    Baloo2_500Medium,
  });

  const { initAuth, isLoading: authLoading } = useAuthStore();
  const { initTenantContext } = useTenantStore();
  const appState = useRef(AppState.currentState);

  // Activar el sistema de refresh automático de tokens
  useTokenRefresh();

  useEffect(() => {
    const initialize = async () => {
      try {
        // Initialize Sentry first for error tracking
        initSentry();

        // Set a timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
          console.error('⏰ App initialization timeout - forcing loading to false');
          // Force loading to false after 10 seconds
          const { setLoading } = useAuthStore.getState();
          setLoading(false);
        }, 10000);

        await Promise.all([initAuth(), initTenantContext()]);

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

  // Handle app state changes (background/foreground)
  // NOTA: El refresh automático de tokens ahora se maneja en useTokenRefresh hook
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('📱 App has come to the foreground!');
      } else if (nextAppState.match(/inactive|background/)) {
        console.log('📱 App has gone to the background');
        // App is going to background - state is already persisted by navigation
      }

      appState.current = nextAppState;
      console.log('AppState:', appState.current);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  if (!fontsLoaded || authLoading) {
    return <Loader fullScreen text="Iniciando aplicación..." />;
  }

  return (
    <GlobalErrorBoundary>
      <QueryProvider>
        <SafeAreaProvider>
          <StatusBar barStyle="dark-content" />
          <Navigation />
        </SafeAreaProvider>
      </QueryProvider>
    </GlobalErrorBoundary>
  );
};

export default App;
