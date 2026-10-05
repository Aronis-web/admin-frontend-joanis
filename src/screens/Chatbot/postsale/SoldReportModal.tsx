/**
 * Reporte Excel de stock vendido por redes sociales (Consolidado + Detalle) en un
 * rango de fechas de Lima. Web/Electron: descarga directa; Android/iOS: se guarda
 * en caché y se abre el menú para compartir.
 */
import React, { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { DatePicker, DatePickerButton } from '@/components/DatePicker';
import { Button, Caption, ChipGroup, Title, useTheme, useThemedStyles } from '@/design-system';
import { chatbotPostsaleApi } from '@/services/api/chatbot-postsale';
import Alert from '@/utils/alert';
import { saveAndShareExcel } from '@/utils/fileDownload';
import { logger } from '@/utils/logger';
import { createPostsaleStyles } from './shared';

/** Fecha de Lima (UTC-5, sin horario de verano) como YYYY-MM-DD. */
const limaDate = (offsetDays = 0): string =>
  new Date(Date.now() - 5 * 3600 * 1000 + offsetDays * 86400 * 1000).toISOString().slice(0, 10);

const toYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const fromYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
};

/**
 * downloadWithAuth lanza "HTTP error! status: 400, message: {json}": extrae el
 * `message` en español del backend; si no hay, un texto genérico.
 */
const downloadErrorMessage = (err: unknown): string => {
  const fallback = 'No se pudo generar el reporte de stock vendido. Inténtalo otra vez.';
  const raw = err instanceof Error ? err.message : '';
  const status = /status:\s*(\d{3})/.exec(raw)?.[1];
  const jsonStart = raw.indexOf('{');
  if (jsonStart >= 0) {
    try {
      const body = JSON.parse(raw.slice(jsonStart)) as { message?: unknown };
      if (Array.isArray(body.message)) return body.message.join('\n');
      if (typeof body.message === 'string' && body.message.trim()) return body.message;
    } catch {
      /* cuerpo no JSON */
    }
  }
  if (status === '403') return 'No tienes permiso para descargar este reporte.';
  return fallback;
};

type Quick = 'today' | 'week' | 'month' | 'custom';

const QUICK_OPTIONS: { label: string; value: Quick }[] = [
  { label: 'Hoy', value: 'today' },
  { label: 'Últimos 7 días', value: 'week' },
  { label: 'Este mes', value: 'month' },
];

const rangeFor = (q: Quick): { from: string; to: string } | null => {
  const today = limaDate();
  if (q === 'today') return { from: today, to: today };
  if (q === 'week') return { from: limaDate(-6), to: today };
  if (q === 'month') return { from: `${today.slice(0, 7)}-01`, to: today };
  return null;
};

export const SoldReportModal: React.FC<{ visible: boolean; onClose: () => void }> = ({
  visible,
  onClose,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createPostsaleStyles);
  const [quick, setQuick] = useState<Quick>('week');
  const [from, setFrom] = useState(() => limaDate(-6));
  const [to, setTo] = useState(() => limaDate());
  const [picker, setPicker] = useState<'from' | 'to' | null>(null);
  const [downloading, setDownloading] = useState(false);

  const applyQuick = (q: Quick) => {
    setQuick(q);
    const r = rangeFor(q);
    if (r) {
      setFrom(r.from);
      setTo(r.to);
    }
  };

  const download = async () => {
    if (from > to) {
      Alert.alert('Fechas', 'La fecha inicial no puede ser posterior a la final.');
      return;
    }
    setDownloading(true);
    try {
      const blob = await chatbotPostsaleApi.soldReport(from, to);
      await saveAndShareExcel(
        blob,
        `stock-vendido-redes_${from}_${to}.xlsx`,
        'Reporte de stock vendido'
      );
    } catch (err) {
      logger.error('Error descargando reporte de stock vendido', err);
      Alert.alert('No se pudo descargar', downloadErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
          <Title>📊 Reporte de stock vendido</Title>
          <Caption color={theme.color.text.muted}>
            Excel con el consolidado por producto, variante, presentación y almacén, y el detalle
            por pedido. Se toma la fecha (Lima) en que se validó el pago.
          </Caption>
          <ChipGroup
            options={QUICK_OPTIONS}
            selected={quick === 'custom' ? [] : [quick]}
            onChange={(sel) => sel[0] && applyQuick(sel[0] as Quick)}
            size="small"
          />
          <View style={styles.inlineRow}>
            <View style={{ flex: 1 }}>
              <DatePickerButton label="Desde" value={from} onPress={() => setPicker('from')} />
            </View>
            <View style={{ flex: 1 }}>
              <DatePickerButton label="Hasta" value={to} onPress={() => setPicker('to')} />
            </View>
          </View>
          <View style={styles.actionsRow}>
            <Button title="Cerrar" variant="ghost" size="small" onPress={onClose} />
            <Button
              title="Descargar Excel"
              leftIcon="download-outline"
              size="small"
              onPress={() => download()}
              disabled={downloading}
              loading={downloading}
            />
          </View>

          <DatePicker
            visible={picker !== null}
            date={fromYmd(picker === 'to' ? to : from)}
            title={picker === 'to' ? 'Hasta' : 'Desde'}
            onConfirm={(d) => {
              const v = toYmd(d);
              if (picker === 'to') setTo(v);
              else setFrom(v);
              setQuick('custom');
              setPicker(null);
            }}
            onCancel={() => setPicker(null)}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
};
