import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/types/navigation';
import { PayrollPlaceholderScreen } from './_PayrollPlaceholderScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'PayrollApprovals'>;

export const PayrollApprovalsInboxScreen: React.FC<Props> = ({ navigation }) => (
  <PayrollPlaceholderScreen
    navigation={navigation as any}
    title="Bandeja de aprobaciones"
    icon="checkmark-done-outline"
    description="Vacaciones, faltas, HH.EE. y cambios de beneficio pendientes (regla maker-checker)."
  />
);
