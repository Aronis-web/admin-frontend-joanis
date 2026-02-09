import { Platform } from 'react-native';

/**
 * Platform detection utilities for cross-platform development
 */

// Check if running in Electron
export const isElectron = (): boolean => {
  if (typeof window !== 'undefined') {
    return !!(window as any).isElectron;
  }
  return false;
};

// Check if running on web (browser or Electron)
export const isWeb = (): boolean => {
  return Platform.OS === 'web';
};

// Check if running on mobile (Android or iOS)
export const isMobile = (): boolean => {
  return Platform.OS === 'android' || Platform.OS === 'ios';
};

// Check if running on Android
export const isAndroid = (): boolean => {
  return Platform.OS === 'android';
};

// Check if running on iOS
export const isIOS = (): boolean => {
  return Platform.OS === 'ios';
};

// Check if running on desktop (Electron)
export const isDesktop = (): boolean => {
  return isWeb() && isElectron();
};

// Get platform name
export const getPlatformName = (): string => {
  if (isElectron()) return 'desktop';
  return Platform.OS;
};

// Platform-specific configuration
export const platformConfig = {
  isElectron: isElectron(),
  isWeb: isWeb(),
  isMobile: isMobile(),
  isAndroid: isAndroid(),
  isIOS: isIOS(),
  isDesktop: isDesktop(),
  platform: getPlatformName(),
};

export default platformConfig;
