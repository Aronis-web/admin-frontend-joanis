import React from 'react';
import { PermissionDenied } from '@/components/common/PermissionDenied';

interface PermissionDeniedScreenProps {
  navigation: any;
  route?: {
    params?: {
      message?: string;
      requiredPermissions?: string[];
    };
  };
}

export const PermissionDeniedScreen: React.FC<PermissionDeniedScreenProps> = ({
  navigation,
  route,
}) => {
  const message = route?.params?.message;
  const requiredPermissions = route?.params?.requiredPermissions || [];

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Dashboard');
    }
  };

  const handleContactAdmin = () => {
    // You can implement this to open email, show contact info, etc.
    // For now, just show an alert
    alert(
      'Contactar Administrador',
      'Por favor, contacta al administrador del sistema para solicitar los permisos necesarios.'
    );
  };

  return (
    <PermissionDenied
      message={message}
      requiredPermissions={requiredPermissions}
      onGoBack={handleGoBack}
      onContactAdmin={handleContactAdmin}
    />
  );
};

export default PermissionDeniedScreen;
