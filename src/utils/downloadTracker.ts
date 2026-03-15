/**
 * Download Tracker - Sistema local de seguimiento de descargas
 * Almacena información de descargas en localStorage/AsyncStorage
 * Solo para control temporal durante unas horas
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORAGE_KEY = 'REPARTO_DOWNLOADS_TRACKER';

export interface DownloadRecord {
  productId: string;
  campaignId: string;
  downloadCount: number;
  lastDownloadedAt: string;
}

interface DownloadStorage {
  [key: string]: DownloadRecord; // key format: "campaignId:productId"
}

/**
 * Get storage key for a product in a campaign
 */
const getStorageKey = (campaignId: string, productId: string): string => {
  return `${campaignId}:${productId}`;
};

/**
 * Load all download records from storage
 */
const loadStorage = async (): Promise<DownloadStorage> => {
  try {
    if (Platform.OS === 'web') {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } else {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    }
  } catch (error) {
    console.error('Error loading download tracker storage:', error);
    return {};
  }
};

/**
 * Save download records to storage
 */
const saveStorage = async (storage: DownloadStorage): Promise<void> => {
  try {
    const data = JSON.stringify(storage);
    if (Platform.OS === 'web') {
      localStorage.setItem(STORAGE_KEY, data);
    } else {
      await AsyncStorage.setItem(STORAGE_KEY, data);
    }
  } catch (error) {
    console.error('Error saving download tracker storage:', error);
  }
};

/**
 * Register downloads for multiple products
 */
export const registerDownloads = async (
  campaignId: string,
  productIds: string[]
): Promise<void> => {
  const storage = await loadStorage();
  const now = new Date().toISOString();

  productIds.forEach((productId) => {
    const key = getStorageKey(campaignId, productId);
    const existing = storage[key];

    if (existing) {
      storage[key] = {
        ...existing,
        downloadCount: existing.downloadCount + 1,
        lastDownloadedAt: now,
      };
    } else {
      storage[key] = {
        productId,
        campaignId,
        downloadCount: 1,
        lastDownloadedAt: now,
      };
    }
  });

  await saveStorage(storage);
};

/**
 * Get download info for a specific product
 */
export const getDownloadInfo = async (
  campaignId: string,
  productId: string
): Promise<DownloadRecord | null> => {
  const storage = await loadStorage();
  const key = getStorageKey(campaignId, productId);
  return storage[key] || null;
};

/**
 * Get download info for all products in a campaign
 */
export const getCampaignDownloads = async (
  campaignId: string
): Promise<Map<string, DownloadRecord>> => {
  const storage = await loadStorage();
  const result = new Map<string, DownloadRecord>();

  Object.entries(storage).forEach(([key, record]) => {
    if (record.campaignId === campaignId) {
      result.set(record.productId, record);
    }
  });

  return result;
};

/**
 * Clear download records for a campaign
 */
export const clearCampaignDownloads = async (campaignId: string): Promise<void> => {
  const storage = await loadStorage();
  const newStorage: DownloadStorage = {};

  Object.entries(storage).forEach(([key, record]) => {
    if (record.campaignId !== campaignId) {
      newStorage[key] = record;
    }
  });

  await saveStorage(newStorage);
};

/**
 * Clear all download records
 */
export const clearAllDownloads = async (): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    console.error('Error clearing download tracker storage:', error);
  }
};

/**
 * Clean old records (older than specified hours)
 */
export const cleanOldRecords = async (hoursOld: number = 24): Promise<void> => {
  const storage = await loadStorage();
  const newStorage: DownloadStorage = {};
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - hoursOld);

  Object.entries(storage).forEach(([key, record]) => {
    const recordTime = new Date(record.lastDownloadedAt);
    if (recordTime > cutoffTime) {
      newStorage[key] = record;
    }
  });

  await saveStorage(newStorage);
};
