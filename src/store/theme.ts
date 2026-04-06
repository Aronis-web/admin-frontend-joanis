/**
 * Theme Store - Gestión del tema (modo claro/oscuro)
 *
 * Usa Zustand para manejar el estado global del tema con persistencia.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  isDarkMode: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'light',
      isDarkMode: false,

      setMode: (mode: ThemeMode) => {
        set({
          mode,
          isDarkMode: mode === 'dark',
        });
      },

      toggleMode: () => {
        const currentMode = get().mode;
        const newMode = currentMode === 'light' ? 'dark' : 'light';
        set({
          mode: newMode,
          isDarkMode: newMode === 'dark',
        });
      },
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default useThemeStore;
