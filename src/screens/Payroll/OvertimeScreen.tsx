import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/types/navigation';
import { PayrollPlaceholderScreen } from './_PayrollPlaceholderScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'PayrollOvertime'>;

export const PayrollOvertimeScreen: React.FC<Props> = ({ navigation }) => (
  <PayrollPlaceholderScreen
    navigation={navigation as any}
    title="Horas extra"
    icon="time-outline"
    description="Registro de HH.EE. 25/35/100/200/300 (factores x1.25 a x4)."
  />
);
