import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '@/store/auth';

// Auth Screens
import LoginScreen from '@/screens/Auth/LoginScreen';
import RegisterScreen from '@/screens/Auth/RegisterScreen';

// Main Screens
import HomeScreen from '@/screens/Home/HomeScreen';
import { RolesPermissionsScreen } from '@/screens/Roles/RolesPermissionsScreen';
import { UsersScreen } from '@/screens/Users/UsersScreen';
import { AppsScreen } from '@/screens/Apps/AppsScreen';
import { SitesScreen } from '@/screens/Sites/SitesScreen';
import { PermissionsDebugScreen } from '@/screens/Debug/PermissionsDebugScreen';

// RBAC Components
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

const Stack = createNativeStackNavigator();

const AuthStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
};

const MainStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen
        name="RolesPermissions"
        component={RolesPermissionsScreen}
        options={{
          title: 'Roles y Permisos'
        }}
      />
      <Stack.Screen
        name="Users"
        component={UsersScreen}
        options={{
          title: 'Gestión de Usuarios'
        }}
      />
      <Stack.Screen
        name="Apps"
        component={AppsScreen}
        options={{
          title: 'Gestión de Apps'
        }}
      />
      <Stack.Screen
        name="Sites"
        component={SitesScreen}
        options={{
          title: 'Gestión de Sedes'
        }}
      />
      <Stack.Screen
        name="PermissionsDebug"
        component={PermissionsDebugScreen}
        options={{
          title: 'Debug de Permisos'
        }}
      />
    </Stack.Navigator>
  );
};

export const Navigation = () => {
  const { isAuthenticated } = useAuthStore();

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainStack /> : <AuthStack />}
    </NavigationContainer>
  );
};

export default Navigation;
