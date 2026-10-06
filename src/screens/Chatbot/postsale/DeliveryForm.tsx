/**
 * Formulario de entrega: código de 6 dígitos que dicta el cliente + firma + foto.
 * El código solo vive en el estado de este componente mientras dura la entrega.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { PhotoCapture, SignatureCapture } from '@/components/Repartos';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  Text,
  Title,
  useTheme,
  useThemedStyles,
} from '@/design-system';
import { useDeliverPostsale } from '@/hooks/api/useChatbotPostsale';
import {
  chatbotPostsaleApi,
  postsaleErrorMessage,
  type PostsaleOrder,
} from '@/services/api/chatbot-postsale';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';
import {
  ROUTE_LABEL,
  STATUS_VARIANT,
  createPostsaleStyles,
  formatOrderNo,
  photoToDataUrl,
  statusLabel,
  uriToDataUrl,
} from './shared';
import { QrInput } from './scanner';
import { OLD_STICKER_MESSAGE, isOldSticker } from './paging';

export const DeliveryForm: React.FC<{
  order: PostsaleOrder;
  /** Bulto ya escaneado al abrir el pedido (se marca de inicio). */
  initialPackage?: number | null;
  onChangeOrder: () => void;
  onDelivered: () => void;
}> = ({ order, initialPackage, onChangeOrder, onDelivered }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createPostsaleStyles);
  const deliver = useDeliverPostsale();
  const [code, setCode] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'signature' | 'photo'>('form');
  const [converting, setConverting] = useState(false);
  const packages = Math.max(1, order.packages ?? 1);
  const [ticked, setTicked] = useState<number[]>([]);
  const [pkgMsg, setPkgMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Al cambiar de pedido se descarta todo lo capturado.
  useEffect(() => {
    setCode('');
    setSignature(null);
    setPhoto(null);
    setStep('form');
    setPkgMsg(null);
    setTicked(initialPackage && initialPackage >= 1 ? [initialPackage] : []);
  }, [order.id, initialPackage]);

  const togglePackage = (n: number) =>
    setTicked((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));

  /**
   * Escaneo de un sticker de bulto: el QR es un token cifrado, el backend dice
   * de qué pedido y bulto es (`/resolve`); si es de este pedido, marca el bulto.
   */
  const onPackageScan = async (raw: string) => {
    if (isOldSticker(raw)) {
      setPkgMsg({ ok: false, text: OLD_STICKER_MESSAGE });
      return;
    }
    let resolved;
    try {
      resolved = await chatbotPostsaleApi.resolve(raw);
    } catch (err) {
      setPkgMsg({
        ok: false,
        text: postsaleErrorMessage(err, 'Ese código no es un sticker de pedido.'),
      });
      return;
    }
    if (resolved.orderId !== order.id) {
      setPkgMsg({
        ok: false,
        text: `Ese bulto es de otro pedido (${formatOrderNo(resolved.orderNo)}).`,
      });
      return;
    }
    const n = resolved.packageNo ?? 1;
    if (n < 1 || n > packages) {
      setPkgMsg({ ok: false, text: `El bulto ${n} no existe en este pedido (tiene ${packages}).` });
      return;
    }
    setTicked((prev) => (prev.includes(n) ? prev : [...prev, n]));
    setPkgMsg({ ok: true, text: `Bulto ${n} confirmado.` });
  };

  const allPackages = packages === 1 || ticked.length >= packages;

  const onSignature = async (uri: string) => {
    setStep('form');
    setConverting(true);
    try {
      setSignature(await uriToDataUrl(uri, 'image/png'));
    } catch (err) {
      logger.error('Error convirtiendo firma', err);
      Alert.alert('Error', 'No se pudo procesar la firma. Inténtalo otra vez.');
    } finally {
      setConverting(false);
    }
  };

  const onPhoto = async (uri: string) => {
    setStep('form');
    setConverting(true);
    try {
      setPhoto(await photoToDataUrl(uri));
    } catch (err) {
      logger.error('Error convirtiendo foto', err);
      Alert.alert('Error', 'No se pudo procesar la foto. Inténtalo otra vez.');
    } finally {
      setConverting(false);
    }
  };

  const codeOk = /^\d{6}$/.test(code);
  const canSubmit =
    codeOk && !!signature && !!photo && allPackages && !deliver.isPending && !converting;

  const submit = () => {
    if (!signature || !photo) return;
    if (!codeOk) {
      Alert.alert('Código', 'Ingresa el código de 6 dígitos que te dicta el cliente.');
      return;
    }
    if (!allPackages) {
      Alert.alert('Bultos', 'Confirma todos los bultos antes de entregar.');
      return;
    }
    const confirmed = packages === 1 ? [1] : [...ticked].sort((a, b) => a - b);
    deliver.mutate(
      { id: order.id, payload: { code, signature, photo, packages: confirmed } },
      {
        onSuccess: (res) => {
          setCode('');
          setSignature(null);
          setPhoto(null);
          Alert.alert('Entregado', `Pedido ${formatOrderNo(res.orderNo)} entregado.`);
          onDelivered();
        },
        onError: (err) => {
          setCode('');
          Alert.alert('No se pudo entregar', postsaleErrorMessage(err));
        },
      }
    );
  };

  return (
    <>
      <Card style={StyleSheet.flatten([styles.card, styles.highlightCard])}>
        <View style={styles.rowBetween}>
          <Text style={styles.bigOrderNo}>{formatOrderNo(order.orderNo)}</Text>
          <Badge
            variant={STATUS_VARIANT[order.postsaleStatus] ?? 'default'}
            label={statusLabel(order.postsaleStatus, order.statusLabel)}
          />
        </View>
        <Body>{order.customerName || 'Sin nombre'}</Body>
        <Caption color={theme.color.text.muted}>{ROUTE_LABEL[order.route] ?? order.route}</Caption>
        <View style={styles.actionsRow}>
          <Button
            guardDoubleTap
            title="Cambiar pedido"
            variant="ghost"
            size="small"
            onPress={onChangeOrder}
          />
        </View>
      </Card>

      {packages > 1 ? (
        <Card style={styles.card}>
          <View style={styles.rowBetween}>
            <Title>📦 Bultos</Title>
            <Caption
              color={allPackages ? theme.color.state.success.text : theme.color.state.warning.text}
            >
              {ticked.length} de {packages} confirmados
            </Caption>
          </View>
          <Caption color={theme.color.text.muted}>
            Escanea el sticker de cada bulto (o márcalo a mano) antes de entregar.
          </Caption>
          <QrInput onCode={onPackageScan} placeholder="Código del sticker" buttonTitle="Marcar" />
          {pkgMsg ? (
            <Caption
              style={{
                fontWeight: '600',
                color: pkgMsg.ok ? theme.color.state.success.text : theme.color.state.danger.text,
              }}
            >
              {pkgMsg.text}
            </Caption>
          ) : null}
          <View style={styles.metaRow}>
            {Array.from({ length: packages }, (_, i) => i + 1).map((n) => {
              const on = ticked.includes(n);
              return (
                <Pressable
                  key={n}
                  onPress={() => togglePackage(n)}
                  style={[styles.orderRow, on && styles.orderRowOn, { paddingVertical: 8 }]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                >
                  <Ionicons
                    name={on ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={on ? theme.color.brand.accent : theme.color.text.muted}
                  />
                  <Body style={{ fontWeight: '700' }}>Bulto {n}</Body>
                </Pressable>
              );
            })}
          </View>
        </Card>
      ) : null}

      <Card style={styles.card}>
        <Title>1. Código de entrega</Title>
        <Caption color={theme.color.text.muted}>
          El cliente recibió un código de 6 dígitos por WhatsApp. Pídeselo y escríbelo aquí.
        </Caption>
        <TextInput
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
          placeholder="••••••"
          placeholderTextColor={theme.color.text.muted}
          keyboardType="number-pad"
          maxLength={6}
          autoComplete="off"
          autoCorrect={false}
          importantForAutofill="no"
          style={[styles.input, styles.codeInput]}
        />
      </Card>

      <Card style={styles.card}>
        <View style={styles.rowBetween}>
          <Title>2. Firma del cliente</Title>
          {signature ? (
            <Ionicons name="checkmark-circle" size={22} color={theme.color.icon.success} />
          ) : null}
        </View>
        {signature ? (
          <Image source={{ uri: signature }} style={styles.signaturePreview} resizeMode="contain" />
        ) : null}
        <Button
          guardDoubleTap
          title={signature ? 'Volver a firmar' : 'Capturar firma'}
          variant={signature ? 'outline' : 'primary'}
          leftIcon="create-outline"
          size="small"
          onPress={() => setStep('signature')}
          disabled={converting}
        />
      </Card>

      <Card style={styles.card}>
        <View style={styles.rowBetween}>
          <Title>3. Foto de la entrega</Title>
          {photo ? (
            <Ionicons name="checkmark-circle" size={22} color={theme.color.icon.success} />
          ) : null}
        </View>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.photoPreview} resizeMode="contain" />
        ) : null}
        <Button
          guardDoubleTap
          title={photo ? 'Tomar otra foto' : 'Tomar foto'}
          variant={photo ? 'outline' : 'primary'}
          leftIcon="camera-outline"
          size="small"
          onPress={() => setStep('photo')}
          disabled={converting}
        />
      </Card>

      {converting ? <ActivityIndicator color={theme.color.brand.accent} /> : null}
      <Button
        guardDoubleTap
        title="Confirmar entrega"
        leftIcon="checkmark-done-outline"
        variant="success"
        onPress={submit}
        disabled={!canSubmit}
        loading={deliver.isPending}
        fullWidth
      />

      <Modal
        visible={step === 'signature'}
        animationType="slide"
        onRequestClose={() => setStep('form')}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <SignatureCapture
            title="Firma del cliente"
            subtitle="Pide al cliente que firme en el recuadro"
            onSignatureCapture={(uri) => onSignature(uri)}
            onCancel={() => setStep('form')}
          />
        </SafeAreaView>
      </Modal>
      <Modal
        visible={step === 'photo'}
        animationType="slide"
        onRequestClose={() => setStep('form')}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <PhotoCapture onPhotoCapture={(uri) => onPhoto(uri)} onCancel={() => setStep('form')} />
        </SafeAreaView>
      </Modal>
    </>
  );
};
