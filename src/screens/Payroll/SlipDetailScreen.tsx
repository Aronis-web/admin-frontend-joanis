import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/types/navigation';
import { PayrollPlaceholderScreen } from './_PayrollPlaceholderScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'PayrollSlipDetail'>;

export const PayrollSlipDetailScreen: React.FC<Props> = ({ navigation }) => (
  <PayrollPlaceholderScreen
    navigation={navigation as any}
    title="Boleta de pago"
    icon="document-text-outline"
    description="Detalle por concepto (ingresos, descuentos, aportes) con snapshot del trabajador."
  />
);
