# ScreenLayout Component

## Descripción
Componente wrapper que proporciona la barra de navegación inferior y el menú principal de forma consistente en todas las pantallas de la aplicación.

## Características
- ✅ Barra de navegación inferior con botones de Chat, Notificaciones y Menú
- ✅ Menú principal lateral
- ✅ Gestión automática de estados (menú visible/oculto)
- ✅ Badges para notificaciones y chat
- ✅ Opción para ocultar la barra en pantallas específicas

## Uso

### Importar el componente
```typescript
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
```

### Uso básico
```typescript
export const MyScreen: React.FC<MyScreenProps> = ({ navigation }) => {
  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container}>
        {/* Tu contenido aquí */}
      </SafeAreaView>
    </ScreenLayout>
  );
};
```

### Ocultar la barra de navegación (opcional)
```typescript
export const MyScreen: React.FC<MyScreenProps> = ({ navigation }) => {
  return (
    <ScreenLayout navigation={navigation} showBottomNav={false}>
      <SafeAreaView style={styles.container}>
        {/* Tu contenido aquí */}
      </SafeAreaView>
    </ScreenLayout>
  );
};
```

## Props

| Prop | Tipo | Requerido | Default | Descripción |
|------|------|-----------|---------|-------------|
| `children` | `React.ReactNode` | Sí | - | Contenido de la pantalla |
| `navigation` | `any` | Sí | - | Objeto de navegación de React Navigation |
| `showBottomNav` | `boolean` | No | `true` | Mostrar u ocultar la barra de navegación inferior |

## Ejemplo Completo

```typescript
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';

interface MyScreenProps {
  navigation: any;
}

export const MyScreen: React.FC<MyScreenProps> = ({ navigation }) => {
  const [data, setData] = useState([]);

  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Mi Pantalla</Text>
        </View>

        <ScrollView style={styles.content}>
          {/* Tu contenido aquí */}
        </ScrollView>
      </SafeAreaView>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
});
```

## Pantallas que ya usan ScreenLayout

- ✅ PurchasesScreen
- ✅ SuppliersScreen (ya tenía su propia implementación)

## Migración de Pantallas Existentes

Para migrar una pantalla existente que ya tiene `BottomNavigation` y `MainMenu`:

### Antes:
```typescript
import { BottomNavigation } from '@/components/Navigation/BottomNavigation';
import { MainMenu } from '@/components/Menu/MainMenu';

export const MyScreen = ({ navigation }) => {
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [chatBadge] = useState(0);
  const [notificationsBadge] = useState(0);

  return (
    <SafeAreaView style={styles.container}>
      {/* Contenido */}

      <BottomNavigation
        onChatPress={() => Alert.alert('Chat', 'Función en desarrollo')}
        onNotificationsPress={() => Alert.alert('Notificaciones', 'Función en desarrollo')}
        onMenuPress={() => setIsMenuVisible(true)}
        chatBadge={chatBadge}
        notificationsBadge={notificationsBadge}
      />

      <MainMenu
        isVisible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        navigation={navigation}
      />
    </SafeAreaView>
  );
};
```

### Después:
```typescript
import { ScreenLayout } from '@/components/Layout/ScreenLayout';

export const MyScreen = ({ navigation }) => {
  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container}>
        {/* Contenido */}
      </SafeAreaView>
    </ScreenLayout>
  );
};
```

## Notas

- El componente maneja automáticamente los estados del menú y badges
- La barra de navegación siempre se muestra en la parte inferior
- El menú se abre desde el lado derecho
- Los botones de Chat y Notificaciones muestran alertas por defecto (puedes personalizar esto en el futuro)

## Personalización Futura

Si necesitas personalizar el comportamiento de los botones de la barra inferior, puedes:

1. Modificar `ScreenLayout.tsx` para aceptar props adicionales
2. Pasar callbacks personalizados para `onChatPress` y `onNotificationsPress`
3. Controlar los badges desde la pantalla padre

Ejemplo:
```typescript
<ScreenLayout
  navigation={navigation}
  chatBadge={5}
  notificationsBadge={3}
  onChatPress={handleChatPress}
  onNotificationsPress={handleNotificationsPress}
>
  {/* Contenido */}
</ScreenLayout>
```
