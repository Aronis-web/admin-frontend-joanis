import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Caption, useTheme } from '@/design-system';
import { chatbotConversationsApi } from '@/services/api';

interface Props {
  conversationId: string;
  messageId: string;
  width?: number;
  height?: number;
  onPress?: () => void;
}

/**
 * Renderiza una imagen de mensaje autenticada.
 *
 * El endpoint `/chatbot/conversations/:id/messages/:mid/media` requiere JWT,
 * por lo que un `<Image source={{ uri }}/>` directo NO funciona en web. Este
 * componente descarga el binario con `downloadWithAuth` y crea un object URL
 * temporal que se libera al desmontar.
 */
export const AuthedImage: React.FC<Props> = ({
  conversationId,
  messageId,
  width = 240,
  height = 240,
  onPress,
}) => {
  const theme = useTheme();
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setError(false);
    setUri(null);
    chatbotConversationsApi
      .getMessageMediaObjectUrl(conversationId, messageId)
      .then((url) => {
        if (cancelled) {
          if (Platform.OS === 'web') URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setUri(url);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl && Platform.OS === 'web') {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [conversationId, messageId]);

  const content = (
    <View style={[styles.wrap, { width, height, backgroundColor: theme.color.background.subtle }]}>
      {uri ? (
        <Image source={{ uri }} style={styles.image} resizeMode="cover" />
      ) : error ? (
        <View style={styles.centerBox}>
          <Ionicons name="image-outline" size={24} color={theme.color.text.muted} />
          <Caption color={theme.color.text.muted}>Sin imagen</Caption>
        </View>
      ) : (
        <View style={styles.centerBox}>
          <ActivityIndicator size="small" color={theme.color.text.muted} />
        </View>
      )}
    </View>
  );

  if (onPress && uri) {
    return (
      <Pressable onPress={onPress} accessibilityRole="imagebutton">
        {content}
      </Pressable>
    );
  }
  return content;
};

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
});
