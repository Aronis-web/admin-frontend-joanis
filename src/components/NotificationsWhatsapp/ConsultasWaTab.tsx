/**
 * Pestaña "Consultas": número interno donde el personal autorizado consulta
 * ventas por WhatsApp y recibe respuestas.
 *
 * - Sesión: `consultas_wa.sesion.gestionar`.
 * - Números autorizados y últimas consultas: `consultas_wa.contactos.gestionar`.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/design-system/tokens';
import {
  useConsultasWaQr,
  useConsultasWaStatus,
  useLogoutConsultasWaSession,
  useStartConsultasWaSession,
} from '@/hooks/api/useConsultasWa';
import type { ConsultaWaSessionState } from '@/types/consultas-wa';

import { ConsultasContactsCard } from './ConsultasContactsCard';
import { ConsultasQueriesList } from './ConsultasQueriesList';
import { WhatsappSessionCard } from './WhatsappSessionCard';

const TEXTS = {
  qrHint:
    'Abre WhatsApp en el celular del número de consultas → Dispositivos vinculados → Vincular dispositivo.',
  connected: 'La sesión está activa. Los números autorizados ya pueden consultar.',
  logoutMessage:
    'Se borrarán las credenciales del número de consultas y necesitarás escanear el QR de nuevo para reconectar.',
};

const ConsultasSession: React.FC = () => {
  const statusQuery = useConsultasWaStatus();
  const status: ConsultaWaSessionState = statusQuery.data?.status ?? 'DISCONNECTED';
  const qrQuery = useConsultasWaQr({ enabled: status === 'QR' });
  const startMutation = useStartConsultasWaSession();
  const logoutMutation = useLogoutConsultasWaSession();

  return (
    <WhatsappSessionCard
      status={status}
      me={statusQuery.data?.me ?? null}
      isFetching={statusQuery.isFetching}
      qr={qrQuery.data?.qr}
      texts={TEXTS}
      onStart={() => startMutation.mutateAsync()}
      onLogout={() => logoutMutation.mutateAsync()}
      startPending={startMutation.isPending}
      logoutPending={logoutMutation.isPending}
    />
  );
};

export interface ConsultasWaTabProps {
  canManageSession: boolean;
  canManageContacts: boolean;
}

export const ConsultasWaTab: React.FC<ConsultasWaTabProps> = ({
  canManageSession,
  canManageContacts,
}) => (
  <View style={styles.container}>
    {canManageSession ? <ConsultasSession /> : null}
    {canManageContacts ? <ConsultasContactsCard /> : null}
    {canManageContacts ? <ConsultasQueriesList /> : null}
  </View>
);

const styles = StyleSheet.create({
  container: {
    gap: spacing[4],
  },
});

export default ConsultasWaTab;
