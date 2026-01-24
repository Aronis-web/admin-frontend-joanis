import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { logger } from '@/utils/logger';

// Configuración del QueryClient con opciones optimizadas
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Tiempo que los datos se consideran "frescos" (no se refrescan automáticamente)
      staleTime: 5 * 60 * 1000, // 5 minutos

      // Tiempo que los datos permanecen en caché
      gcTime: 10 * 60 * 1000, // 10 minutos (antes era cacheTime)

      // Reintentos en caso de error
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Refetch automático
      refetchOnWindowFocus: false, // No refetch al volver a la app (React Native)
      refetchOnReconnect: true, // Refetch al reconectar internet
      refetchOnMount: true, // Refetch al montar componente si los datos están stale

      // Network mode
      networkMode: 'online', // Solo hacer queries cuando hay conexión
    },
    mutations: {
      // Reintentos para mutations
      retry: 1,
      networkMode: 'online',

      // Callbacks globales para mutations
      onError: (error: any) => {
        logger.error('Mutation error:', error);
      },
    },
  },
});

// Event listeners para debugging y logging
queryClient.getQueryCache().subscribe((event) => {
  if (event?.type === 'updated' && event?.action?.type === 'error') {
    logger.error('Query error:', {
      queryKey: event.query.queryKey,
      error: event.action.error,
    });
  }
});

interface QueryProviderProps {
  children: React.ReactNode;
}

export const QueryProvider: React.FC<QueryProviderProps> = ({ children }) => {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

// Exportar queryClient para uso en invalidaciones manuales
export { queryClient };
