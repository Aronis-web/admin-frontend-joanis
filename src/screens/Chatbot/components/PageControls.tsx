/** Controles de página: anterior / siguiente + "X–Y de N". */
import React from 'react';
import { View } from 'react-native';
import { Button, Caption, useTheme } from '@/design-system';
import { spacing } from '@/design-system/tokens';

export const PageControls: React.FC<{
  total: number;
  page: number;
  pageSize: number;
  /** Elementos de la página actual. */
  count: number;
  busy?: boolean;
  onPage: (page: number) => void;
}> = ({ total, page, pageSize, count, busy, onPage }) => {
  const theme = useTheme();
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = (page - 1) * pageSize + count;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing[2],
      }}
    >
      <Button
        title="Anterior"
        leftIcon="chevron-back"
        variant="outline"
        size="small"
        onPress={() => onPage(Math.max(1, page - 1))}
        disabled={page <= 1 || busy}
      />
      <Caption color={theme.color.text.muted}>{`${from}–${to} de ${total}`}</Caption>
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
