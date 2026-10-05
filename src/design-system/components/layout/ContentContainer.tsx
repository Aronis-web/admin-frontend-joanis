/**
 * ContentContainer
 *
 * Centra el cuerpo de una pantalla con un ancho máximo. En celular no cambia
 * nada; en escritorio (web/Electron) evita que tarjetas y formularios se
 * estiren a todo el ancho del monitor.
 *
 * Uso típico: `contentContainerStyle={[styles.scrollContent, contentWidthStyle]}`
 * en un ScrollView/FlatList, o envolver el cuerpo con `<ContentContainer>`.
 */
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

/** Ancho máximo del contenido en pantallas de lista y detalle. */
export const CONTENT_MAX_WIDTH = 1200;
/** Ancho máximo recomendado para formularios. */
export const FORM_MAX_WIDTH = 760;

/** Estilo para `contentContainerStyle` de ScrollView/FlatList. */
export const contentWidthStyle: ViewStyle = {
  width: '100%',
  maxWidth: CONTENT_MAX_WIDTH,
  alignSelf: 'center',
};

export const formWidthStyle: ViewStyle = {
  width: '100%',
  maxWidth: FORM_MAX_WIDTH,
  alignSelf: 'center',
};

export interface ContentContainerProps {
  children: React.ReactNode;
  /** `form` usa un ancho menor, pensado para formularios. */
  variant?: 'content' | 'form';
  style?: StyleProp<ViewStyle>;
}

export const ContentContainer: React.FC<ContentContainerProps> = ({
  children,
  variant = 'content',
  style,
}) => (
  <View style={[variant === 'form' ? formWidthStyle : contentWidthStyle, style]}>{children}</View>
);

export default ContentContainer;
