/**
 * Cabecera con degradado del módulo de traslados y recepciones.
 * Ahora es el componente común del design system (`GradientHeader`).
 */
import React from 'react';
import { GradientHeader } from '@/design-system/components/layout/GradientHeader';
import type { GradientHeaderProps } from '@/design-system/components/layout/GradientHeader';

type TransfersHeaderProps = GradientHeaderProps & {
  icon: NonNullable<GradientHeaderProps['icon']>;
};

export const TransfersHeader: React.FC<TransfersHeaderProps> = (props) => (
  <GradientHeader {...props} />
);
