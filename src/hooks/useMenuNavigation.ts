import { useCallback } from 'react';
import { NavigationProp } from '@react-navigation/native';
import { MENU_TO_ROUTE, MAIN_ROUTES } from '@/constants/routes';

/**
 * Hook to handle menu navigation consistently across all screens
 * Uses the centralized MENU_TO_ROUTE mapping to navigate to the correct screen
 *
 * @param navigation - React Navigation navigation prop
 * @returns A callback function that handles menu item selection
 *
 * @example
 * ```tsx
 * const handleMenuSelect = useMenuNavigation(navigation);
 *
 * <MainMenu
 *   visible={isMenuVisible}
 *   onClose={() => setIsMenuVisible(false)}
 *   onMenuSelect={handleMenuSelect}
 * />
 * ```
 */
export const useMenuNavigation = (navigation: NavigationProp<any>) => {
  return useCallback((menuId: string) => {
    console.log('🔄 Menu navigation:', menuId);

    // Get the route key from the menu ID
    const routeKey = MENU_TO_ROUTE[menuId];

    if (!routeKey) {
      console.warn('⚠️ No route mapping found for menu ID:', menuId);
      return;
    }

    // Get the actual route name from MAIN_ROUTES
    const routeName = MAIN_ROUTES[routeKey];

    if (!routeName) {
      console.warn('⚠️ No route name found for route key:', routeKey);
      return;
    }

    console.log('✅ Navigating to:', routeName);

    // Navigate to the screen
    try {
      navigation.navigate(routeName as any);
    } catch (error) {
      console.error('❌ Navigation error:', error);
    }
  }, [navigation]);
};
