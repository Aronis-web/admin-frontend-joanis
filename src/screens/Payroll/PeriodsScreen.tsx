import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/types/navigation';
import { PayrollPlaceholderScreen } from './_PayrollPlaceholderScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'PayrollPeriods'>;

export const PayrollPeriodsScreen: React.FC<Props> = ({ navigation }) => (
  <PayrollPlaceholderScreen
    navigation={navigation as any}
    title="Periodos de planilla"
    icon="calendar-outline"
    description="Crear periodos quincenales/mensuales y controlar el flujo BORRADOR -> CALCULADO -> CERRADO."
  />
);
