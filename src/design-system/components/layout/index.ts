/**
 * Layout Components - Exports
 */

// Screen Header
export { ScreenHeader, LargeHeader } from './ScreenHeader';
export type { ScreenHeaderProps, ScreenHeaderAction, LargeHeaderProps } from './ScreenHeader';

// Screen Container
export { ScreenContainer, Section, Row, Spacer } from './ScreenContainer';
export type { ScreenContainerProps, SectionProps, RowProps, SpacerProps } from './ScreenContainer';

// Cabecera con degradado (diseño estándar de pantallas)
export { GradientHeader } from './GradientHeader';
export type { GradientHeaderProps } from './GradientHeader';

// Ancho máximo del contenido en escritorio
export {
  ContentContainer,
  CONTENT_MAX_WIDTH,
  FORM_MAX_WIDTH,
  contentWidthStyle,
  formWidthStyle,
} from './ContentContainer';
export type { ContentContainerProps } from './ContentContainer';
