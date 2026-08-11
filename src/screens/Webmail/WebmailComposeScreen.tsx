import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { Button, Input } from '@/design-system';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import Alert from '@/utils/alert';
import logger from '@/utils/logger';
import { useSendMail } from '@/hooks/api/useWebmail';
import type { SendAttachment } from '@/types/webmail';

interface Props {
  navigation: any;
  route: {
    params?: {
      to?: string;
      cc?: string;
      subject?: string;
      body?: string;
      inReplyTo?: string;
      references?: string[];
    };
  };
}

const MAX_ATTACHMENTS = 20;

/** Lee un archivo (uri) y devuelve su base64. Cross-platform. */
const uriToBase64 = async (uri: string): Promise<string> => {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    const blob = await res.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        resolve(dataUrl.split(',')[1] ?? '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
};

export const WebmailComposeScreen: React.FC<Props> = ({ navigation, route }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const params = route.params ?? {};

  const [to, setTo] = useState(params.to ?? '');
  const [cc, setCc] = useState(params.cc ?? '');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState(params.subject ?? '');
  const [body, setBody] = useState(params.body ?? '');
  const [attachments, setAttachments] = useState<SendAttachment[]>([]);

  const sendMail = useSendMail();

  const handlePickFile = async () => {
    if (attachments.length >= MAX_ATTACHMENTS) {
      Alert.alert('Límite alcanzado', `Máximo ${MAX_ATTACHMENTS} adjuntos por correo.`);
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const base64 = await uriToBase64(asset.uri);
      setAttachments((prev) => [
        ...prev,
        {
          filename: asset.name,
          contentBase64: base64,
          contentType: asset.mimeType || 'application/octet-stream',
        },
      ]);
    } catch (e) {
      logger.error('Error seleccionando archivo:', e);
      Alert.alert('Error', 'No se pudo adjuntar el archivo.');
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (!to.trim()) {
      Alert.alert('Falta destinatario', 'Ingresa al menos un destinatario en "Para".');
      return;
    }
    if (!subject.trim()) {
      Alert.alert('Falta asunto', 'Ingresa un asunto para el correo.');
      return;
    }
    try {
      await sendMail.mutateAsync({
        to: to.trim(),
        cc: cc.trim() || undefined,
        bcc: bcc.trim() || undefined,
        subject: subject.trim(),
        text: body,
        inReplyTo: params.inReplyTo,
        references: params.references,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      Alert.alert('Enviado', 'El correo fue enviado correctamente.');
      navigation.goBack();
    } catch (e: any) {
      logger.error('Error al enviar correo:', e);
      const msg = e?.response?.data?.message || e?.message || 'No se pudo enviar el correo.';
      Alert.alert('Error', String(msg));
    }
  };

  return (
    <ScreenLayout navigation={navigation}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="close" size={24} color={theme.color.icon.default} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Redactar correo</Text>
          <Button
            title="Enviar"
            leftIcon="send-outline"
            size="small"
            loading={sendMail.isPending}
            onPress={handleSend}
          />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Input
            label="Para"
            placeholder="destinatario@dominio.com, otro@dominio.com"
            value={to}
            onChangeText={setTo}
            autoCapitalize="none"
            keyboardType="email-address"
            required
          />
          <Input
            label="CC"
            placeholder="Opcional"
            value={cc}
            onChangeText={setCc}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Input
            label="CCO"
            placeholder="Opcional"
            value={bcc}
            onChangeText={setBcc}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Input label="Asunto" value={subject} onChangeText={setSubject} required />
          <Input
            label="Mensaje"
            value={body}
            onChangeText={setBody}
            multiline
            numberOfLines={10}
            inputStyle={styles.bodyInput}
          />

          <View style={styles.attachmentsHeader}>
            <Text style={styles.sectionTitle}>Adjuntos ({attachments.length})</Text>
            <Button
              title="Agregar"
              leftIcon="attach-outline"
              variant="secondary"
              size="small"
              onPress={handlePickFile}
              disabled={attachments.length >= MAX_ATTACHMENTS}
            />
          </View>

          {attachments.map((att, idx) => (
            <View key={`${att.filename}-${idx}`} style={styles.attachmentRow}>
              <Ionicons name="document-attach-outline" size={18} color={theme.color.icon.muted} />
              <Text style={styles.attachmentName} numberOfLines={1}>
                {att.filename}
              </Text>
              <TouchableOpacity onPress={() => removeAttachment(idx)} style={styles.removeBtn}>
                <Ionicons name="close-circle" size={20} color={theme.color.icon.danger} />
              </TouchableOpacity>
            </View>
          ))}

          {sendMail.isPending ? (
            <View style={styles.sending}>
              <ActivityIndicator size="small" color={theme.color.icon.accent} />
              <Text style={styles.sendingText}>Enviando…</Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenLayout>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.base,
      gap: 8,
    },
    backBtn: {
      padding: 4,
    },
    headerTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    content: {
      padding: 16,
      gap: 12,
    },
    bodyInput: {
      minHeight: 160,
      textAlignVertical: 'top',
    },
    attachmentsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
    },
    sectionTitle: {
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    attachmentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 8,
      backgroundColor: theme.color.surface.subtle,
      borderRadius: 8,
    },
    attachmentName: {
      flex: 1,
      color: theme.color.text.body,
    },
    removeBtn: {
      padding: 4,
    },
    sending: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 12,
    },
    sendingText: {
      color: theme.color.text.muted,
    },
  });

export default WebmailComposeScreen;
