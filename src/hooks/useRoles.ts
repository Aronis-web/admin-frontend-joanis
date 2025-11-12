import { useMemo } from 'react';
import { useAuthStore } from '@/store/auth';
import { Role } from '@/store/auth';

export const useRoles = () => {
  const { user } = useAuthStore();

  const roles = useMemo(() => {
    return user?.roles || [];
  }, [user?.roles]);

  const hasRole = (roleCode: string): boolean => {
    return roles.some(role => role.code === roleCode);
  };

  const hasAnyRole = (roleCodes: string[]): boolean => {
    if (roleCodes.length === 0) return true;
    return roleCodes.some(code => hasRole(code));
  };

  const hasAllRoles = (roleCodes: string[]): boolean => {
    if (roleCodes.length === 0) return true;
    return roleCodes.every(code => hasRole(code));
  };

  const getRoleCodes = (): string[] => {
    return roles.map(role => role.code);
  };

  const getRoleNames = (): string[] => {
    return roles.map(role => role.name);
  };

  const getRoleDescriptions = (): string[] => {
    return roles.map(role => role.description);
  };

  // Common role checks
  const isAdmin = hasRole('ADMIN');
  const isManager = hasRole('MANAGER');
  const isOperator = hasRole('OPERATOR');
  const isCustomer = hasRole('CUSTOMER');
  const isIamAdmin = hasRole('IAM_ADMIN');

  // Role hierarchy checks
  const isAtLeastManager = isAdmin || isManager || isIamAdmin;
  const isAtLeastOperator = isAdmin || isManager || isOperator || isIamAdmin;
  const hasAdminAccess = isAdmin || isIamAdmin;

  return {
    roles,
    hasRole,
    hasAnyRole,
    hasAllRoles,
    getRoleCodes,
    getRoleNames,
    getRoleDescriptions,
    isAdmin,
    isManager,
    isOperator,
    isCustomer,
    isIamAdmin,
    isAtLeastManager,
    isAtLeastOperator,
    hasAdminAccess,
  };
};

export default useRoles;