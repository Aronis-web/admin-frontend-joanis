import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '@/utils/config';

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  variant?: string;
}

interface CartState {
  items: CartItem[];
  isLoading: boolean;
  error: string | null;

  // Computed
  totalItems: number;
  totalPrice: number;

  // Actions
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  loadCart: () => Promise<void>;
  setError: (error: string | null) => void;
}

const calculateTotals = (items: CartItem[]) => {
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return { totalItems, totalPrice };
};

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  isLoading: false,
  error: null,
  totalItems: 0,
  totalPrice: 0,

  addItem: async (item) => {
    try {
      const { items } = get();
      const existingItemIndex = items.findIndex((i) => i.id === item.id);

      let newItems: CartItem[];
      if (existingItemIndex >= 0) {
        // Update quantity if item exists
        newItems = [...items];
        newItems[existingItemIndex].quantity += item.quantity || 1;
      } else {
        // Add new item
        newItems = [...items, { ...item, quantity: item.quantity || 1 }];
      }

      const totals = calculateTotals(newItems);
      await AsyncStorage.setItem(config.STORAGE_KEYS.CART, JSON.stringify(newItems));
      set({ items: newItems, ...totals, error: null });
    } catch (error) {
      console.error('Error adding item to cart:', error);
      set({ error: 'Failed to add item to cart' });
    }
  },

  removeItem: async (itemId) => {
    try {
      const { items } = get();
      const newItems = items.filter((item) => item.id !== itemId);
      const totals = calculateTotals(newItems);
      await AsyncStorage.setItem(config.STORAGE_KEYS.CART, JSON.stringify(newItems));
      set({ items: newItems, ...totals, error: null });
    } catch (error) {
      console.error('Error removing item from cart:', error);
      set({ error: 'Failed to remove item from cart' });
    }
  },

  updateQuantity: async (itemId, quantity) => {
    try {
      if (quantity <= 0) {
        await get().removeItem(itemId);
        return;
      }

      const { items } = get();
      const newItems = items.map((item) =>
        item.id === itemId ? { ...item, quantity } : item
      );
      const totals = calculateTotals(newItems);
      await AsyncStorage.setItem(config.STORAGE_KEYS.CART, JSON.stringify(newItems));
      set({ items: newItems, ...totals, error: null });
    } catch (error) {
      console.error('Error updating item quantity:', error);
      set({ error: 'Failed to update item quantity' });
    }
  },

  clearCart: async () => {
    try {
      await AsyncStorage.removeItem(config.STORAGE_KEYS.CART);
      set({ items: [], totalItems: 0, totalPrice: 0, error: null });
    } catch (error) {
      console.error('Error clearing cart:', error);
      set({ error: 'Failed to clear cart' });
    }
  },

  loadCart: async () => {
    try {
      set({ isLoading: true });
      const cartJson = await AsyncStorage.getItem(config.STORAGE_KEYS.CART);
      if (cartJson) {
        const items = JSON.parse(cartJson);
        const totals = calculateTotals(items);
        set({ items, ...totals });
      }
    } catch (error) {
      console.error('Error loading cart:', error);
      set({ error: 'Failed to load cart' });
    } finally {
      set({ isLoading: false });
    }
  },

  setError: (error) => set({ error }),
}));
