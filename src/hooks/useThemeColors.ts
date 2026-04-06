/**
 * useThemeColors - Hook para obtener colores según el tema actual
 *
 * Proporciona acceso a los colores del tema actual (claro/oscuro).
 */

import { useMemo } from 'react';
import { useThemeStore } from '@/store/theme';
import { colors as lightColors } from '@/design-system/tokens/colors';
import { darkColors } from '@/design-system/tokens/darkColors';

export const useThemeColors = () => {
  const isDarkMode = useThemeStore((state) => state.isDarkMode);

  const colors = useMemo(() => {
    return isDarkMode ? darkColors : lightColors;
  }, [isDarkMode]);

  return {
    colors,
    isDarkMode,
  };
};

export default useThemeColors;
