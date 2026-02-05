# 📸 Módulo de Reconocimiento Facial

Sistema simple de reconocimiento facial para React Native que permite agregar rostros y realizar verificaciones biométricas.

## 🎯 Características

- ✅ **Registrar Rostros**: Captura y registra rostros en el sistema
- ✅ **Verificar Rostros**: Verifica la identidad comparando con perfiles registrados
- ✅ **Captura Manual**: Control total sobre cuándo capturar cada frame
- ✅ **Cambio de Cámara**: Alterna entre cámara frontal y trasera
- ✅ **Interfaz Intuitiva**: UI simple y fácil de usar
- ✅ **Detección de Vivacidad**: Integración con backend para anti-spoofing
- ✅ **Alta Precisión**: Reconocimiento facial con embeddings de 512 dimensiones
- ✅ **Validación UUID**: Asegura que los IDs sean UUIDs válidos

## 📁 Estructura del Módulo

```
src/
├── components/
│   └── FaceRecognition/
│       └── FaceCaptureCamera.tsx       # Componente de cámara reutilizable
├── screens/
│   └── FaceRecognition/
│       ├── FaceRecognitionMenuScreen.tsx  # Menú principal
│       ├── RegisterFaceScreen.tsx         # Pantalla de registro
│       ├── VerifyFaceScreen.tsx           # Pantalla de verificación
│       └── index.ts                       # Exportaciones
└── services/
    └── api/
        └── biometric.ts                   # API de biometría
```

## 🚀 Instalación

### 1. Dependencias

La dependencia `expo-camera` ya fue instalada automáticamente:

```bash
npx expo install expo-camera
```

### 2. Configuración de Permisos

Agrega los permisos de cámara en `app.json`:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-camera",
        {
          "cameraPermission": "Permite a $(PRODUCT_NAME) acceder a tu cámara para capturar rostros."
        }
      ]
    ]
  }
}
```

### 3. Agregar Rutas de Navegación

En tu archivo de navegación (ej: `src/navigation/AppNavigator.tsx`), agrega las pantallas:

```typescript
import {
  FaceRecognitionMenuScreen,
  RegisterFaceScreen,
  VerifyFaceScreen,
} from '@/screens/FaceRecognition';

// En tu Stack Navigator:
<Stack.Screen
  name="FaceRecognitionMenu"
  component={FaceRecognitionMenuScreen}
  options={{ title: 'Reconocimiento Facial' }}
/>
<Stack.Screen
  name="RegisterFace"
  component={RegisterFaceScreen}
  options={{ title: 'Registrar Rostro' }}
/>
<Stack.Screen
  name="VerifyFace"
  component={VerifyFaceScreen}
  options={{ title: 'Verificar Rostro' }}
/>
```

## 📖 Uso

### 1. Registrar un Rostro

```typescript
import { RegisterFaceScreen } from '@/screens/FaceRecognition';

// Navegar a la pantalla de registro
navigation.navigate('RegisterFace');

// El usuario:
// 1. Selecciona el tipo de entidad (empleado, usuario, visitante)
// 2. Genera o ingresa un UUID válido
// 3. Opcionalmente ingresa un nombre
// 4. Presiona "Iniciar Captura"
// 5. Captura manualmente 6 frames presionando el botón
// 6. Puede cambiar entre cámara frontal y trasera
// 7. El sistema procesa y registra el rostro
```

### 2. Verificar un Rostro

```typescript
import { VerifyFaceScreen } from '@/screens/FaceRecognition';

// Navegar a la pantalla de verificación
navigation.navigate('VerifyFace');

// El usuario:
// 1. Selecciona el tipo de entidad
// 2. Ingresa el UUID del perfil a verificar
// 3. Presiona "Iniciar Verificación"
// 4. Captura manualmente 6 frames presionando el botón
// 5. Puede cambiar entre cámara frontal y trasera
// 6. El sistema compara con el perfil registrado
// 7. Muestra el resultado (verificado o no)
```

### 3. Usar el API Directamente

```typescript
import { biometricApi } from '@/services/api/biometric';

// Registrar rostro (entityId debe ser UUID)
const registerResult = await biometricApi.registerBiometric(
  frames, // Array de base64 images
  {
    entityType: 'employee',
    entityId: '550e8400-e29b-41d4-a716-446655440000', // UUID válido
    metadata: {
      name: 'Juan Pérez',
      registeredAt: new Date().toISOString()
    }
  }
);

// Verificar rostro (entityId debe ser UUID)
const verifyResult = await biometricApi.verifyBiometric(
  frames,
  {
    entityType: 'employee',
    entityId: '550e8400-e29b-41d4-a716-446655440000', // UUID válido
    metadata: {
      verifiedAt: new Date().toISOString()
    }
  }
);

// Identificar persona (1:N)
const identifyResult = await biometricApi.identifyBiometric(
  frames,
  {
    entityType: 'employee',
    metadata: {
      location: 'main_entrance'
    }
  }
);
```

## 🎨 Componentes

### FaceCaptureCamera

Componente reutilizable para capturar rostros con control manual:

```typescript
import { FaceCaptureCamera } from '@/components/FaceRecognition/FaceCaptureCamera';

<FaceCaptureCamera
  onCaptureComplete={(frames) => {
    console.log('Frames capturados:', frames.length);
  }}
  onCancel={() => {
    console.log('Captura cancelada');
  }}
  targetFrames={6}        // Número de frames a capturar (default: 6)
/>
```

**Características del componente:**
- ✅ Captura manual: El usuario presiona un botón para cada frame
- ✅ Cambio de cámara: Botón para alternar entre frontal y trasera
- ✅ Contador de frames: Muestra cuántos frames se han capturado
- ✅ Confirmaciones inteligentes: Previene pérdida de datos accidental
- ✅ Validación: Asegura que se capturen suficientes frames

## 🔧 Configuración

### Tipos de Entidad

Puedes usar diferentes tipos de entidad:

- `employee`: Empleados
- `user`: Usuarios del sistema
- `visitor`: Visitantes
- O cualquier otro tipo personalizado

### Ajustar Captura

En `FaceCaptureCamera.tsx`:

```typescript
// Cambiar número de frames requeridos
targetFrames={8}  // Requiere 8 frames en lugar de 6
```

### Requisitos de UUID

**IMPORTANTE**: El backend requiere que `entityId` sea un UUID válido.

```typescript
// ✅ Correcto - UUID válido
entityId: '550e8400-e29b-41d4-a716-446655440000'

// ❌ Incorrecto - No es UUID
entityId: 'EMP001'
entityId: 'CAR1'
entityId: '12345'
```

**Generar UUID en el frontend:**
```typescript
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};
```

## 📊 API Endpoints

El módulo se comunica con estos endpoints del backend:

- `POST /biometric-verification/register` - Registrar perfil
  - **Requiere**: `frames` (archivos), `entityType` (string), `entityId` (UUID), `metadata[key]` (campos individuales)
- `POST /biometric-verification/verify` - Verificar identidad (1:1)
  - **Requiere**: `frames` (archivos), `entityType` (string), `entityId` (UUID), `metadata[key]` (campos individuales)
- `POST /biometric-verification/identify` - Identificar persona (1:N)
  - **Requiere**: `frames` (archivos), `entityType` (string), `metadata[key]` (campos individuales)
- `GET /biometric-verification/profile/:type/:id` - Obtener perfil
- `GET /biometric-verification/logs/:type/:id` - Obtener logs
- `POST /biometric-verification/deactivate/:id` - Desactivar perfil
- `POST /biometric-verification/delete/:id` - Eliminar perfil
- `GET /biometric-verification/health` - Health check

**Nota sobre FormData**: Los metadatos se envían como campos individuales (`metadata[key]`) en lugar de JSON stringificado para compatibilidad con el backend.

## 🎯 Casos de Uso

### 1. Control de Acceso

```typescript
// Verificar empleado en la entrada
const result = await biometricApi.verifyBiometric(frames, {
  entityType: 'employee',
  entityId: employeeId,
  metadata: { location: 'main_entrance' }
});

if (result.verified && result.confidence > 90) {
  // Permitir acceso
  await openDoor();
}
```

### 2. Sistema de Asistencia

```typescript
// Identificar empleado para marcar asistencia
const result = await biometricApi.identifyBiometric(frames, {
  entityType: 'employee',
  metadata: { useCase: 'attendance' }
});

if (result.identified) {
  await markAttendance(result.entityId);
}
```

### 3. Autorización de Operaciones

```typescript
// Verificar identidad para operación sensible
const result = await biometricApi.verifyBiometric(frames, {
  entityType: 'user',
  entityId: userId,
  metadata: { operation: 'approve_payment', amount: 10000 }
});

if (result.verified && result.confidence > 95) {
  await approvePayment();
}
```

## 🔐 Seguridad

- ✅ **Detección de Vivacidad**: El backend verifica que sea una persona real
- ✅ **Embeddings No Reversibles**: Los embeddings no pueden convertirse de vuelta a imagen
- ✅ **Logs de Auditoría**: Todas las operaciones se registran
- ✅ **Validación de Calidad**: Solo se aceptan capturas de buena calidad

## 📝 Consejos para Buena Captura

1. **Iluminación**: Asegúrate de tener buena iluminación frontal
2. **Posición**: Mantén el rostro centrado en el marco
3. **Estabilidad**: No te muevas durante la captura
4. **Sin Obstáculos**: No uses lentes oscuros, gorras o mascarillas
5. **Distancia**: Mantén una distancia apropiada de la cámara

## 🐛 Troubleshooting

### Error: "No se otorgaron permisos de cámara"

**Solución**: Ve a Configuración > Aplicaciones > [Tu App] > Permisos y habilita la cámara.

### Error: "entityId must be a UUID"

**Causa**: El backend requiere que `entityId` sea un UUID válido en formato `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`.

**Solución**:
- Usa el botón "Generar UUID" en la pantalla de registro
- O ingresa un UUID válido manualmente
- Ejemplo válido: `550e8400-e29b-41d4-a716-446655440000`

### Error: "metadata must be an object"

**Causa**: Error en el formato de envío de metadatos.

**Solución**: Este error ya está resuelto en la versión actual. Los metadatos se envían correctamente como campos individuales en FormData.

### Error: "No se pudo registrar el rostro"

**Posibles causas**:
- Mala iluminación
- Rostro no centrado
- Movimiento durante la captura
- Backend no disponible
- UUID inválido

**Solución**:
- Intenta de nuevo con mejor iluminación
- Mantén el rostro centrado y sin moverte
- Verifica que el UUID sea válido

### Error: "Verificación fallida"

**Posibles causas**:
- No es la misma persona
- Cambios significativos en apariencia
- Mala calidad de captura
- UUID incorrecto

**Solución**:
- Asegúrate de que sea la persona correcta
- Verifica que el UUID corresponda al perfil registrado
- Mejora la calidad de la captura

## 📚 Recursos

- [Expo Camera Documentation](https://docs.expo.dev/versions/latest/sdk/camera/)
- [Backend Biometric API](../../../backend/docs/biometric-verification.md)
- [Face Recognition Best Practices](https://www.nist.gov/programs-projects/face-recognition-vendor-test-frvt)

## 🚀 Próximos Pasos

1. **Agregar al Menú Principal**: Agrega un botón en tu menú principal para acceder a `FaceRecognitionMenu`
2. **Personalizar UI**: Ajusta los estilos según tu diseño
3. **Integrar con Módulos**: Usa el reconocimiento facial en tus módulos existentes
4. **Configurar Backend**: Asegúrate de que el backend esté configurado correctamente

---

**Desarrollado para máxima simplicidad y facilidad de uso** 🎉
