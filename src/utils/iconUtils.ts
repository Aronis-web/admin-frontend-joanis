/**
 * Icon Utilities
 *
 * Utilities for handling icon names and providing fallbacks for invalid icons
 */

// Common Material Icons to Ionicons mapping
const MATERIAL_TO_IONICONS_MAP: Record<string, string> = {
  'account_balance': 'business-outline',
  'account_balance_wallet': 'wallet-outline',
  'shopping_cart': 'cart-outline',
  'local_shipping': 'car-outline',
  'restaurant': 'restaurant-outline',
  'local_gas_station': 'gas-pump-outline',
  'build': 'build-outline',
  'home': 'home-outline',
  'work': 'briefcase-outline',
  'school': 'school-outline',
  'local_hospital': 'medical-outline',
  'local_pharmacy': 'medical-outline',
  'directions_car': 'car-outline',
  'flight': 'airplane-outline',
  'hotel': 'bed-outline',
  'local_cafe': 'cafe-outline',
  'local_dining': 'restaurant-outline',
  'local_grocery_store': 'cart-outline',
  'local_mall': 'storefront-outline',
  'phone': 'call-outline',
  'email': 'mail-outline',
  'location_on': 'location-outline',
  'person': 'person-outline',
  'group': 'people-outline',
  'settings': 'settings-outline',
  'favorite': 'heart-outline',
  'star': 'star-outline',
  'attach_money': 'cash-outline',
  'credit_card': 'card-outline',
  'receipt': 'receipt-outline',
  'description': 'document-text-outline',
  'folder': 'folder-outline',
  'calendar_today': 'calendar-outline',
  'access_time': 'time-outline',
  'notifications': 'notifications-outline',
  'warning': 'warning-outline',
  'error': 'alert-circle-outline',
  'info': 'information-circle-outline',
  'check_circle': 'checkmark-circle-outline',
  'cancel': 'close-circle-outline',
  'campaign': 'megaphone-outline',
  'more_horiz': 'ellipsis-horizontal-outline',
  'security': 'shield-checkmark-outline',
};

/**
 * Validates if an icon name is a valid Ionicons name
 * This is a basic check - Ionicons names typically contain hyphens
 */
export function isValidIoniconsName(iconName: string): boolean {
  if (!iconName) return false;

  // Ionicons names typically:
  // - Contain hyphens (e.g., "home-outline", "person-circle")
  // - Are lowercase
  // - Don't contain underscores (Material Icons use underscores)

  // If it contains underscore, it's likely a Material Icon
  if (iconName.includes('_')) {
    return false;
  }

  // Basic validation - this is not exhaustive but catches most cases
  return true;
}

/**
 * Converts a Material Icons name to Ionicons equivalent
 */
export function convertMaterialToIonicons(iconName: string): string {
  return MATERIAL_TO_IONICONS_MAP[iconName] || 'help-circle-outline';
}

/**
 * Gets a safe icon name for Ionicons
 * If the icon name is invalid, it returns a fallback
 */
export function getSafeIconName(iconName: string | undefined | null, fallback: string = 'help-circle-outline'): string {
  if (!iconName) return fallback;

  // Check if it's a Material Icon and convert it
  if (iconName.includes('_')) {
    const converted = convertMaterialToIonicons(iconName);
    console.warn(`⚠️ Material Icon "${iconName}" converted to Ionicons "${converted}"`);
    return converted;
  }

  // If it looks like a valid Ionicons name, return it
  if (isValidIoniconsName(iconName)) {
    return iconName;
  }

  // Otherwise, return fallback
  console.warn(`⚠️ Invalid icon name "${iconName}", using fallback "${fallback}"`);
  return fallback;
}

/**
 * Gets a category-specific fallback icon
 */
export function getCategoryFallbackIcon(categoryName?: string): string {
  if (!categoryName) return 'pricetag-outline';

  const lowerName = categoryName.toLowerCase();

  // Common category patterns
  if (lowerName.includes('servicio') || lowerName.includes('service')) return 'construct-outline';
  if (lowerName.includes('transporte') || lowerName.includes('transport')) return 'car-outline';
  if (lowerName.includes('comida') || lowerName.includes('food') || lowerName.includes('alimento')) return 'restaurant-outline';
  if (lowerName.includes('oficina') || lowerName.includes('office')) return 'briefcase-outline';
  if (lowerName.includes('mantenimiento') || lowerName.includes('maintenance')) return 'build-outline';
  if (lowerName.includes('personal') || lowerName.includes('staff')) return 'people-outline';
  if (lowerName.includes('suministro') || lowerName.includes('supply')) return 'cube-outline';
  if (lowerName.includes('marketing')) return 'megaphone-outline';
  if (lowerName.includes('tecnología') || lowerName.includes('technology') || lowerName.includes('tech')) return 'laptop-outline';
  if (lowerName.includes('salud') || lowerName.includes('health')) return 'medical-outline';
  if (lowerName.includes('educación') || lowerName.includes('education')) return 'school-outline';
  if (lowerName.includes('viaje') || lowerName.includes('travel')) return 'airplane-outline';
  if (lowerName.includes('comunicación') || lowerName.includes('communication')) return 'chatbubbles-outline';
  if (lowerName.includes('seguridad') || lowerName.includes('security')) return 'shield-outline';
  if (lowerName.includes('limpieza') || lowerName.includes('cleaning')) return 'sparkles-outline';

  // Default category icon
  return 'pricetag-outline';
}
