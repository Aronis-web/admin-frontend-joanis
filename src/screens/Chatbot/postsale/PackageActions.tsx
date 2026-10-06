/**
 * Bultos de un pedido: "Bultos: N", "➕ Agregar bulto" (imprime al instante el
 * sticker del bulto nuevo) y reimpresión de todos o de un bulto puntual.
 * El resultado se muestra en línea (sirve dentro de Modals) y se informa a
 * `onResult` para refrescar datos.
 */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Body, Button, Caption, ChipGroup, useTheme, useThemedStyles } from '@/design-system';
import { createPostsaleStyles } from './shared';
import type { PostsalePrinting, PrintResult } from './usePostsalePrinting';

export const PackageActions: React.FC<{
  orderId: string;
  packages: number;
  printing: PostsalePrinting;
  /** Puede agregar bultos (print o assemble). */
  canAdd: boolean;
  /** Puede reimprimir stickers (print). */
  canReprint: boolean;
  onResult?: (res: PrintResult) => void;
  /** Si el padre ya muestra el resultado, no repetirlo aquí. */
  hideNotice?: boolean;
}> = ({ orderId, packages, printing, canAdd, canReprint, onResult, hideNotice }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createPostsaleStyles);
  const [chooser, setChooser] = useState(false);
  const [choice, setChoice] = useState<string>('ALL');
  const [notice, setNotice] = useState<PrintResult | null>(null);
  const n = Math.max(1, packages || 1);

  const report = (res: PrintResult) => {
    setNotice(res);
    onResult?.(res);
  };

  const add = async () => {
    setNotice(null);
    report(await printing.addPackage(orderId, { notify: false }));
  };

  const reprint = async () => {
    setNotice(null);
    setChooser(false);
    const packageNo = choice === 'ALL' ? undefined : Number(choice);
    report(await printing.printStickers([orderId], { notify: false, packageNo }));
  };

  if (!canAdd && !canReprint) return null;

  return (
    <View style={{ gap: 6 }}>
      <View style={styles.metaRow}>
        <Body style={{ fontWeight: '700' }}>📦 Bultos: {n}</Body>
        <View style={{ flex: 1 }} />
        {canAdd ? (
          <Button
            guardDoubleTap
            title="➕ Agregar bulto"
            variant="outline"
            size="small"
            onPress={() => add()}
            disabled={printing.addingPackage || printing.printingStickers}
            loading={printing.addingPackage}
          />
        ) : null}
        {canReprint ? (
          <Button
            guardDoubleTap
            title={n > 1 ? 'Reimprimir…' : 'Reimprimir sticker'}
            leftIcon="print-outline"
            variant="outline"
            size="small"
            onPress={() => (n > 1 ? setChooser((v) => !v) : reprint())}
            disabled={printing.printingStickers || printing.addingPackage}
            loading={printing.printingStickers}
          />
        ) : null}
      </View>

      {chooser && n > 1 ? (
        <View style={styles.block}>
          <Caption color={theme.color.text.muted}>¿Qué stickers reimprimir?</Caption>
          <ChipGroup
            options={[
              { label: 'Reimprimir todos', value: 'ALL' },
              ...Array.from({ length: n }, (_, i) => ({
                label: `Bulto ${i + 1}`,
                value: String(i + 1),
              })),
            ]}
            selected={[choice]}
            onChange={(sel) => sel[0] && setChoice(sel[0])}
            size="small"
          />
          <View style={styles.actionsRow}>
            <Button
              guardDoubleTap
              title="Cancelar"
              variant="ghost"
              size="small"
              onPress={() => setChooser(false)}
            />
            <Button
              guardDoubleTap
              title={choice === 'ALL' ? `Imprimir ${n} stickers` : `Imprimir bulto ${choice}`}
              leftIcon="print-outline"
              size="small"
              onPress={() => reprint()}
            />
          </View>
        </View>
      ) : null}

      {notice && !hideNotice ? (
        <View style={styles.metaRow}>
          <Ionicons
            name={notice.ok ? 'checkmark-circle' : 'alert-circle'}
            size={16}
            color={notice.ok ? theme.color.state.success.text : theme.color.state.danger.text}
          />
          <Caption
            style={{
              flex: 1,
              fontWeight: '600',
              color: notice.ok ? theme.color.state.success.text : theme.color.state.danger.text,
            }}
          >
            {notice.message}
          </Caption>
          <Pressable onPress={() => setNotice(null)} hitSlop={8} accessibilityLabel="Cerrar aviso">
            <Ionicons name="close" size={14} color={theme.color.text.muted} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
};
