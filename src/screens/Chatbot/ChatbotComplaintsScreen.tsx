import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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
  ErrorState,
  Text,
  Title,
  useTheme,
  useThemedStyles,
} from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { spacing, borderRadius } from '@/design-system/tokens';
import { useComplaints, useRespondComplaint } from '@/hooks/api/useChatbotComplaints';
import type { ComplaintSheet, ComplaintStatus } from '@/services/api/chatbot-complaints';
import Alert from '@/utils/alert';
import { formatDateTime, formatSolesFromCents } from './utils';

type Props = NativeStackScreenProps<any, 'ChatbotComplaints'>;

const STATUS_OPTIONS: Array<{ label: string; value: ComplaintStatus }> = [
  { label: 'Pendientes', value: 'PENDIENTE' },
  { label: 'Respondidas', value: 'RESPONDIDO' },
];

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('es-PE', { timeZone: 'America/Lima' });

/** Libro de Reclamaciones: hojas registradas desde el enlace de los T&C. */
export const ChatbotComplaintsScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [status, setStatus] = useState<ComplaintStatus>('PENDIENTE');
  const [answering, setAnswering] = useState<ComplaintSheet | null>(null);
  const [response, setResponse] = useState('');
  const query = useComplaints(status);
  const respond = useRespondComplaint();
  const sheets = query.data ?? [];

  const openAnswer = (s: ComplaintSheet) => {
    setResponse(s.response ?? '');
    setAnswering(s);
  };

  const send = () => {
    if (!answering) return;
    const text = response.trim();
    if (text.length < 10) {
      Alert.alert('Respuesta', 'Escribe la respuesta al consumidor.');
      return;
    }
    Alert.alert(
      'Enviar respuesta',
      `Se guardará en la hoja N° ${answering.code} y se enviará a ${answering.email}. ¿Continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          onPress: () =>
            respond.mutate(
              { id: answering.id, response: text },
              {
                onSuccess: () => setAnswering(null),
                onError: (err: any) =>
                  Alert.alert('Error', err?.message ?? 'No se pudo guardar la respuesta'),
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
              <Ionicons name="book-outline" size={22} color={theme.color.brand.onHeader} />
            </View>
            <Text style={styles.headerTitle}>Libro de Reclamaciones</Text>
          </View>
          <Text style={styles.headerSubtitle}>
            Reclamos y quejas · respuesta en máximo 15 días hábiles
          </Text>
        </LinearGradient>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={query.isFetching && !query.isLoading}
              onRefresh={() => query.refetch()}
            />
          }
        >
          <ChipGroup
            options={STATUS_OPTIONS}
            selected={[status]}
            onChange={(sel) => sel[0] && setStatus(sel[0] as ComplaintStatus)}
            multiple={false}
          />

          {query.isLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={theme.color.brand.accent} />
            </View>
          ) : query.isError ? (
            <ErrorState
              title="Error al cargar el libro"
              description="Reintenta en un momento."
              onRetry={() => query.refetch()}
            />
          ) : sheets.length === 0 ? (
            <EmptyState
              icon="checkmark-done-outline"
              title="Sin hojas"
              description="No hay reclamos ni quejas en este estado."
            />
          ) : (
            sheets.map((s) => {
              const overdue = s.status === 'PENDIENTE' && new Date(s.dueDate) < new Date();
              return (
                <Card key={s.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Body style={{ fontWeight: '700' }}>
                        N° {s.code} · {s.kind === 'QUEJA' ? 'Queja' : 'Reclamo'}
                      </Body>
                      <Caption color={theme.color.text.muted}>
                        {formatDateTime(s.createdAt)} · {s.fullName} · {s.documentType}{' '}
                        {s.documentNumber}
                      </Caption>
                    </View>
                    <Badge
                      variant={
                        s.status === 'RESPONDIDO' ? 'success' : overdue ? 'danger' : 'warning'
                      }
                      label={
                        s.status === 'RESPONDIDO'
                          ? 'Respondido'
                          : overdue
                            ? 'Vencido'
                            : `Vence ${formatDate(s.dueDate)}`
                      }
                    />
                  </View>
                  <Caption color={theme.color.text.muted}>
                    {s.email}
                    {s.phone ? ` · ${s.phone}` : ''} · {s.address}
                    {s.isMinor ? ` · Menor (apoderado: ${s.guardianName ?? '-'})` : ''}
                  </Caption>
                  <Body>
                    <Text style={{ fontWeight: '600' }}>
                      {s.goodType === 'SERVICIO' ? 'Servicio' : 'Producto'}:
                    </Text>{' '}
                    {s.goodDescription}
                    {s.amountCents != null
                      ? ` · ${formatSolesFromCents(String(s.amountCents))}`
                      : ''}
                    {s.orderRef ? ` · Pedido ${s.orderRef}` : ''}
                  </Body>
                  <View style={styles.block}>
                    <Caption color={theme.color.text.muted}>Detalle</Caption>
                    <Body>{s.detail}</Body>
                    <Caption color={theme.color.text.muted}>Pedido del consumidor</Caption>
                    <Body>{s.consumerRequest}</Body>
                  </View>
                  {s.response ? (
                    <View style={styles.block}>
                      <Caption color={theme.color.text.muted}>
                        Respuesta · {formatDateTime(s.respondedAt)}
                      </Caption>
                      <Body>{s.response}</Body>
                    </View>
                  ) : null}
                  <View style={styles.actionsRow}>
                    <Button
                      title={s.response ? 'Editar respuesta' : 'Responder'}
                      size="small"
                      variant={s.response ? 'outline' : 'primary'}
                      leftIcon="mail-outline"
                      onPress={() => openAnswer(s)}
                    />
                  </View>
                </Card>
              );
            })
          )}
        </ScrollView>

        <Modal
          visible={!!answering}
          transparent
          animationType="fade"
          onRequestClose={() => setAnswering(null)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setAnswering(null)}>
            <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
              <Title>Responder hoja N° {answering?.code}</Title>
              <Caption color={theme.color.text.muted}>
                La respuesta queda en la hoja y se envía al correo {answering?.email}.
              </Caption>
              <TextInput
                value={response}
                onChangeText={setResponse}
                placeholder="Observaciones y acciones adoptadas por el proveedor"
                placeholderTextColor={theme.color.text.muted}
                multiline
                style={[styles.input, styles.inputMultiline]}
              />
              <View style={styles.actionsRow}>
                <Button title="Cancelar" variant="ghost" onPress={() => setAnswering(null)} />
                <Button title="Enviar respuesta" onPress={send} disabled={respond.isPending} />
              </View>
            </Pressable>
          </Pressable>
        </Modal>
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
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing[4],
    },
    modalCard: {
      width: '100%',
      maxWidth: 560,
      backgroundColor: theme.color.surface.base,
      borderRadius: borderRadius.xl,
      padding: spacing[5],
      gap: spacing[3],
    },
    input: {
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: borderRadius.md,
      padding: spacing[3],
      color: theme.color.text.body,
    },
    inputMultiline: { minHeight: 140, textAlignVertical: 'top' },
  });
