/**
 * Formulario de entrega: código de 6 dígitos que dicta el cliente + firma + foto.
 * El código solo vive en el estado de este componente mientras dura la entrega.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, StyleSheet, TextInput, View } from 'react-native';
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
import { postsaleErrorMessage, type PostsaleOrder } from '@/services/api/chatbot-postsale';
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

export const DeliveryForm: React.FC<{
  order: PostsaleOrder;
  onChangeOrder: () => void;
  onDelivered: () => void;
}> = ({ order, onChangeOrder, onDelivered }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createPostsaleStyles);
  const deliver = useDeliverPostsale();
  const [code, setCode] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'signature' | 'photo'>('form');
  const [converting, setConverting] = useState(false);

  // Al cambiar de pedido se descarta todo lo capturado.
  useEffect(() => {
    setCode('');
    setSignature(null);
    setPhoto(null);
    setStep('form');
  }, [order.id]);

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
  const canSubmit = codeOk && !!signature && !!photo && !deliver.isPending && !converting;

  const submit = () => {
    if (!signature || !photo) return;
    if (!codeOk) {
      Alert.alert('Código', 'Ingresa el código de 6 dígitos que te dicta el cliente.');
      return;
    }
    deliver.mutate(
      { id: order.id, payload: { code, signature, photo } },
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
          <Button title="Cambiar pedido" variant="ghost" size="small" onPress={onChangeOrder} />
        </View>
      </Card>

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
