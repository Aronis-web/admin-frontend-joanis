/**
 * Barra de paginación fija al pie: "Anterior · X–Y de N · Siguiente".
 *
 * Se debe renderizar FUERA del ScrollView (debajo), así queda pegada abajo y la
 * lista no pasa por detrás. Se registra como footer flotante
 * (`useMeasuredFloatingFooter`), con lo que los botones flotantes globales
 * (recargar y menú) se elevan por encima de la barra y no la tapan. Incluye el
 * margen inferior del área segura.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Caption, useTheme } from '@/design-system';
import { spacing } from '@/design-system/tokens';
import { useMeasuredFloatingFooter } from '@/design-system/layout/FloatingFooterProvider';

interface PageControlsProps {
  total: number;
  page: number;
  pageSize: number;
  /** Elementos de la página actual. */
  count: number;
  busy?: boolean;
  onPage: (page: number) => void;
}

export const PageControls: React.FC<PageControlsProps> = (props) =>
  // Solo se monta (y registra el footer) cuando hay resultados.
  props.total > 0 ? <PageBar {...props} /> : null;

const PageBar: React.FC<PageControlsProps> = ({ total, page, pageSize, count, busy, onPage }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { onLayout } = useMeasuredFloatingFooter(56);
  const from = (page - 1) * pageSize + 1;
  const to = (page - 1) * pageSize + count;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  return (
    <View
      onLayout={onLayout}
      style={[
        styles.bar,
        {
          backgroundColor: theme.color.surface.base,
          borderTopColor: theme.color.border.subtle,
          paddingBottom: spacing[2] + insets.bottom,
        },
      ]}
    >
      <Button
        title="Anterior"
        leftIcon="chevron-back"
        variant="outline"
        size="small"
        onPress={() => onPage(Math.max(1, page - 1))}
        disabled={page <= 1 || busy}
      />
      <Caption color={theme.color.text.muted} style={styles.info} numberOfLines={1}>
        {count > 0 ? `${from}–${to} de ${total}` : `${total}`}
      </Caption>
      <Button
        title="Siguiente"
        variant="outline"
        size="small"
        onPress={() => onPage(Math.min(lastPage, page + 1))}
        disabled={page >= lastPage || busy}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    borderTopWidth: 1,
  },
  info: { flexShrink: 1, textAlign: 'center' },
});
