import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/types/navigation';
import { PayrollPlaceholderScreen } from './_PayrollPlaceholderScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'PayrollPeriodDetail'>;

export const PayrollPeriodDetailScreen: React.FC<Props> = ({ navigation }) => (
  <PayrollPlaceholderScreen
    navigation={navigation as any}
    title="Detalle del periodo"
    icon="grid-outline"
    description="Agregar asistencia, revisar/ajustar inputs (dias, HHEE), calcular, revisar boletas y cerrar."
  />
);
