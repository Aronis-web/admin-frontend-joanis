import React from 'react';
import { Badge } from '@/design-system';
import type { BadgeVariant } from '@/design-system';
import type { PeriodStatus } from '@/types/payroll';

const TONE: Record<PeriodStatus, BadgeVariant> = {
  BORRADOR: 'draft',
  CALCULADO: 'info',
  CERRADO: 'completed',
  PAGADO: 'paid',
};

const LABEL: Record<PeriodStatus, string> = {
  BORRADOR: 'Borrador',
  CALCULADO: 'Calculado',
  CERRADO: 'Cerrado',
  PAGADO: 'Pagado',
};

export const PeriodStatusChip: React.FC<{ status: PeriodStatus }> = ({ status }) => (
  <Badge variant={TONE[status]} size="small" label={LABEL[status]} />
);
