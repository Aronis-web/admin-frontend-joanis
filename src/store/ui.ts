import { create } from 'zustand';
import type { Ionicons } from '@expo/vector-icons';

export interface RegisteredFabAction {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}

interface UIState {
  // Drawer global
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;

  // Acciones de la pantalla focusada para el FAB global
  fabActions: RegisteredFabAction[];
  setFabActions: (actions: RegisteredFabAction[]) => void;
  clearFabActions: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isDrawerOpen: false,
  openDrawer: () => set({ isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false }),
  toggleDrawer: () => set((s) => ({ isDrawerOpen: !s.isDrawerOpen })),

  fabActions: [],
  setFabActions: (actions) => set({ fabActions: actions }),
  clearFabActions: () => set({ fabActions: [] }),
}));
