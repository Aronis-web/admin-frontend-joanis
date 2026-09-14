import React from 'react';
import { Badge } from '@/design-system';
import type { BadgeVariant } from '@/design-system';
import type { ApprovalStatus } from '@/types/payroll';

const TONE: Record<ApprovalStatus, BadgeVariant> = {
  PENDIENTE: 'warning',
  APROBADO: 'success',
  APLICADO: 'success',
  RECHAZADO: 'danger',
};

const LABEL: Record<ApprovalStatus, string> = {
  PENDIENTE: 'Pendiente',
  APROBADO: 'Aprobado',
  APLICADO: 'Aplicado',
  RECHAZADO: 'Rechazado',
};

export const ApprovalStatusChip: React.FC<{ status: ApprovalStatus }> = ({ status }) => (
  <Badge variant={TONE[status]} size="small" label={LABEL[status]} />
);
