import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/types/navigation';
import { PayrollPlaceholderScreen } from './_PayrollPlaceholderScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'PayrollAbsences'>;

export const PayrollAbsencesScreen: React.FC<Props> = ({ navigation }) => (
  <PayrollPlaceholderScreen
    navigation={navigation as any}
    title="Faltas / Descanso medico"
    icon="medkit-outline"
    description="Alta de faltas con evidencia adjunta (multipart) para descanso medico."
  />
);
