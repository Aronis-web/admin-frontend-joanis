import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  ChipGroup,
  EmptyState,
  Text,
  Title,
  useTheme,
  useThemedStyles,
} from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { spacing, borderRadius } from '@/design-system/tokens';
import {
  useBroadcastPreview,
  useBroadcastProducts,
  useBroadcasts,
  useCreateBroadcast,
} from '@/hooks/api/useChatbotBroadcasts';
import type { BroadcastProduct } from '@/services/api/chatbot-broadcasts';
import Alert from '@/utils/alert';
import { formatDateTime, formatSolesFromCents } from './utils';

type Props = NativeStackScreenProps<any, 'ChatbotBroadcasts'>;

const AUDIENCE_OPTIONS = [
  { label: '🔥 Quieren promociones', value: 'promos' },
  { label: '📣 Quieren transmisiones', value: 'live' },
];
const MAX_PRODUCTS = 10;

/** Promociones masivas por Messenger a quienes aceptaron recibirlas. */
export const ChatbotBroadcastsScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [audience, setAudience] = useState<string[]>(['promos']);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [picked, setPicked] = useState<BroadcastProduct[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const aud = { promos: audience.includes('promos'), live: audience.includes('live') };
  const preview = useBroadcastPreview(aud);
  const products = useBroadcastProducts(debounced);
  const history = useBroadcasts();
  const create = useCreateBroadcast();

  const toggleProduct = (p: BroadcastProduct) => {
    setPicked((prev) =>
      prev.some((x) => x.id === p.id)
        ? prev.filter((x) => x.id !== p.id)
        : prev.length >= MAX_PRODUCTS
          ? prev
          : [...prev, p]
    );
  };

  const send = () => {
    if (!aud.promos && !aud.live) {
      Alert.alert('Público', 'Elige a quién enviar la promoción.');
      return;
    }
    if (!title.trim() || !body.trim()) {
      Alert.alert('Promoción', 'Escribe el título y el mensaje.');
      return;
    }
    const reach = preview.data?.reachable ?? 0;
    if (!reach) {
      Alert.alert(
        'Sin destinatarios',
        'Nadie de este público escribió en las últimas 24 h. Meta solo permite escribirles dentro de ese plazo.'
      );
      return;
    }
    Alert.alert(
      'Enviar promoción',
      `Se enviará por Messenger a ${reach} cliente${reach === 1 ? '' : 's'}${
        picked.length ? ` con ${picked.length} producto${picked.length === 1 ? '' : 's'}` : ''
      }. ¿Continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          onPress: () =>
            create.mutate(
              {
                title: title.trim(),
                body: body.trim(),
                productIds: picked.map((p) => p.id),
                ...aud,
              },
              {
                onSuccess: () => {
                  setTitle('');
                  setBody('');
                  setPicked([]);
                  Alert.alert('Enviando', 'La promoción se está enviando. Mira el avance abajo.');
                },
                onError: (err: any) =>
                  Alert.alert('Error', err?.message ?? 'No se pudo enviar la promoción'),
              }
            ),
        },
      ]
    );
  };

  return (
    <ScreenLayout navigation={navigation as any}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <LinearGradient
          colors={[theme.color.brand.headerFrom, theme.color.brand.headerTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerIconRow}>
            <View style={styles.headerIconContainer}>
              <Ionicons name="megaphone-outline" size={22} color={theme.color.brand.onHeader} />
            </View>
            <Text style={styles.headerTitle}>Promociones</Text>
          </View>
          <Text style={styles.headerSubtitle}>
            Por Messenger · a quienes aceptaron y escribieron en las últimas 24 h
          </Text>
        </LinearGradient>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={history.isFetching && !history.isLoading}
              onRefresh={() => {
                history.refetch();
                preview.refetch();
              }}
            />
          }
        >
          <Card style={styles.card}>
            <Title>Nueva promoción</Title>
            <Caption color={theme.color.text.muted}>Público</Caption>
            <ChipGroup
              options={AUDIENCE_OPTIONS}
              selected={audience}
              onChange={(sel) => setAudience(sel as string[])}
              multiple
            />
            <View style={styles.block}>
              {preview.isFetching ? (
                <ActivityIndicator color={theme.color.brand.accent} />
              ) : preview.data ? (
                <Body>
                  <Text style={{ fontWeight: '700' }}>{preview.data.reachable}</Text> lo recibirán
                  hoy · {preview.data.optedIn} aceptaron en total
                </Body>
              ) : (
                <Caption color={theme.color.text.muted}>Elige al menos un público.</Caption>
              )}
              <Caption color={theme.color.text.muted}>
                Meta solo deja escribir por Messenger hasta 24 h después del último mensaje del
                cliente.
              </Caption>
            </View>

            <Caption color={theme.color.text.muted}>Título (interno)</Caption>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Ej. Ofertas de fin de semana"
              placeholderTextColor={theme.color.text.muted}
              maxLength={120}
              style={styles.input}
            />
            <Caption color={theme.color.text.muted}>Mensaje</Caption>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="¡Hola! 🔥 Este fin de semana tenemos…"
              placeholderTextColor={theme.color.text.muted}
              multiline
              maxLength={1800}
              style={[styles.input, styles.inputMultiline]}
            />
            <Caption color={theme.color.text.muted}>
              Va con el botón "🛍️ Ver catálogo". {body.length}/1800
            </Caption>

            <Caption color={theme.color.text.muted}>
              Productos destacados (opcional, hasta {MAX_PRODUCTS}) · salen en carrusel con "🛒 Lo
              quiero"
            </Caption>
            {picked.length ? (
              <View style={styles.pickedRow}>
                {picked.map((p) => (
                  <Pressable key={p.id} onPress={() => toggleProduct(p)} style={styles.pickedChip}>
                    <Caption numberOfLines={1} style={{ maxWidth: 160 }}>
                      {p.name}
                    </Caption>
                    <Ionicons name="close" size={14} color={theme.color.text.muted} />
                  </Pressable>
                ))}
              </View>
            ) : null}
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar producto"
              placeholderTextColor={theme.color.text.muted}
              style={styles.input}
            />
            {products.isLoading ? (
              <ActivityIndicator color={theme.color.brand.accent} />
            ) : (
              (products.data ?? []).slice(0, 8).map((p) => {
                const on = picked.some((x) => x.id === p.id);
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => toggleProduct(p)}
                    style={[styles.productRow, on && styles.productRowOn]}
                  >
                    {p.imageUrl ? (
                      <Image source={{ uri: p.imageUrl }} style={styles.thumb} />
                    ) : (
                      <View style={[styles.thumb, styles.thumbEmpty]}>
                        <Ionicons name="image-outline" size={18} color={theme.color.text.muted} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Body numberOfLines={2}>{p.name}</Body>
                      <Caption color={theme.color.text.muted}>
                        {formatSolesFromCents(String(p.priceCents))}
                      </Caption>
                    </View>
                    <Ionicons
                      name={on ? 'checkmark-circle' : 'add-circle-outline'}
                      size={22}
                      color={on ? theme.color.brand.accent : theme.color.text.muted}
                    />
                  </Pressable>
                );
              })
            )}

            <View style={styles.actionsRow}>
              <Button
                title="Enviar promoción"
                leftIcon="send-outline"
                onPress={send}
                disabled={create.isPending}
              />
            </View>
          </Card>

          <Title>Enviadas</Title>
          {history.isLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={theme.color.brand.accent} />
            </View>
          ) : (history.data ?? []).length === 0 ? (
            <EmptyState
              icon="megaphone-outline"
              title="Sin promociones"
              description="Las promociones enviadas aparecerán aquí."
            />
          ) : (
            (history.data ?? []).map((b) => (
              <Card key={b.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Body style={{ fontWeight: '700' }}>{b.title}</Body>
                    <Caption color={theme.color.text.muted}>
                      {formatDateTime(b.createdAt)} ·{' '}
                      {[b.audiencePromos && 'Promociones', b.audienceLive && 'Transmisiones']
                        .filter(Boolean)
                        .join(' + ')}
                      {b.productIds.length ? ` · ${b.productIds.length} productos` : ''}
                    </Caption>
                  </View>
                  <Badge
                    variant={
                      b.status === 'SENT' ? 'success' : b.status === 'FAILED' ? 'danger' : 'warning'
                    }
                    label={
                      b.status === 'SENT' ? 'Enviada' : b.status === 'FAILED' ? 'Falló' : 'Enviando'
                    }
                  />
                </View>
                <Body numberOfLines={3}>{b.body}</Body>
                <Caption color={theme.color.text.muted}>
                  {b.sentCount} de {b.targetCount} enviados
                  {b.failedCount ? ` · ${b.failedCount} con error` : ''}
                  {b.error ? ` · ${b.error}` : ''}
                </Caption>
              </Card>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </ScreenLayout>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.color.brand.headerFrom },
    headerGradient: {
      paddingHorizontal: spacing[5],
      paddingTop: spacing[4],
      paddingBottom: spacing[5],
    },
    headerIconRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing[1] },
    headerIconContainer: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.lg,
      backgroundColor: theme.color.brand.headerBadge,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing[3],
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.color.brand.onHeader,
      letterSpacing: 0.3,
    },
    headerSubtitle: {
      fontSize: 13,
      color: theme.color.brand.onHeaderMuted,
      fontWeight: '500',
      marginLeft: 48,
    },
    scrollView: { flex: 1, backgroundColor: theme.color.background.subtle },
    scrollContent: { padding: spacing[4], paddingBottom: spacing[8], gap: spacing[3] },
    centerBox: { padding: spacing[5], alignItems: 'center' },
    card: { padding: spacing[3], gap: spacing[2] },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
    block: {
      gap: spacing[1],
      padding: spacing[2],
      backgroundColor: theme.color.background.subtle,
      borderRadius: borderRadius.md,
    },
    actionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: spacing[2],
    },
    input: {
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: borderRadius.md,
      padding: spacing[3],
      color: theme.color.text.body,
    },
    inputMultiline: { minHeight: 120, textAlignVertical: 'top' },
    pickedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
    pickedChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
      paddingHorizontal: spacing[2],
      paddingVertical: spacing[1],
      borderRadius: borderRadius.full,
      backgroundColor: theme.color.background.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    productRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      padding: spacing[2],
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    productRowOn: { borderColor: theme.color.brand.accent },
    thumb: { width: 44, height: 44, borderRadius: borderRadius.md },
    thumbEmpty: {
      backgroundColor: theme.color.background.subtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
