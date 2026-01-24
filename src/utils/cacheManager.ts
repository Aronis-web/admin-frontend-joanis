import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from './config';

/**
 * Utility to manage AsyncStorage cache
 */
export class CacheManager {
  /**
   * Clear all app data cache (cart, selections, etc.) but keep auth tokens
   */
  static async clearAppDataCache(): Promise<void> {
    try {
      console.log('🧹 Clearing app data cache...');

      // Remove cart data
      await AsyncStorage.removeItem(config.STORAGE_KEYS.CART);

      // Get all keys and remove any that might be cached data
      const allKeys = await AsyncStorage.getAllKeys();
      const keysToRemove = allKeys.filter(
        (key) =>
          // Remove any keys that might contain cached data
          key.includes('cache') ||
          key.includes('products') ||
          key.includes('stock') ||
          key.includes('purchases') ||
          key.includes('transfers') ||
          // But keep auth and user data
          (!key.includes(config.STORAGE_KEYS.AUTH_TOKEN) &&
            !key.includes(config.STORAGE_KEYS.REFRESH_TOKEN) &&
            !key.includes(config.STORAGE_KEYS.USER) &&
            !key.includes(config.STORAGE_KEYS.TOKEN_EXPIRES_AT))
      );

      if (keysToRemove.length > 0) {
        console.log('🗑️ Removing cached keys:', keysToRemove);
        await AsyncStorage.multiRemove(keysToRemove);
      }

      console.log('✅ App data cache cleared successfully');
    } catch (error) {
      console.error('❌ Error clearing app data cache:', error);
      throw error;
    }
  }

  /**
   * Clear ALL AsyncStorage data including auth tokens (full reset)
   */
  static async clearAllCache(): Promise<void> {
    try {
      console.log('🧹 Clearing ALL cache...');
      await AsyncStorage.clear();
      console.log('✅ All cache cleared successfully');
    } catch (error) {
      console.error('❌ Error clearing all cache:', error);
      throw error;
    }
  }

  /**
   * Clear specific storage keys
   */
  static async clearSpecificKeys(keys: string[]): Promise<void> {
    try {
      console.log('🧹 Clearing specific keys:', keys);
      await AsyncStorage.multiRemove(keys);
      console.log('✅ Specific keys cleared successfully');
    } catch (error) {
      console.error('❌ Error clearing specific keys:', error);
      throw error;
    }
  }

  /**
   * Get all stored keys (for debugging)
   */
  static async getAllKeys(): Promise<readonly string[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      console.log('📋 All stored keys:', keys);
      return keys;
    } catch (error) {
      console.error('❌ Error getting all keys:', error);
      throw error;
    }
  }

  /**
   * Get storage info (for debugging)
   */
  static async getStorageInfo(): Promise<{ [key: string]: string | null }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const items = await AsyncStorage.multiGet(keys);
      const info: { [key: string]: string | null } = {};

      items.forEach(([key, value]) => {
        info[key] = value;
      });

      return info;
    } catch (error) {
      console.error('❌ Error getting storage info:', error);
      throw error;
    }
  }
}

export default CacheManager;
