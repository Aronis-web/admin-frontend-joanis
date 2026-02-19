# Módulo de Fotos de Productos

## Descripción

El módulo de **Fotos** permite gestionar las imágenes de los productos de manera centralizada. Incluye funcionalidades avanzadas como:

- 📸 **Gestión de Galería**: Ver, subir y eliminar imágenes de productos
- 🔍 **Sugerencias con Google Lens**: Buscar imágenes similares de alta calidad
- 🎨 **Edición con IA (Gemini)**: Editar imágenes usando instrucciones en lenguaje natural

## Características Principales

### 1. Galería de Fotos
- Lista de productos con vista previa de imágenes
- Búsqueda por nombre, SKU o número correlativo
- Filtros por estado (Activo, Preliminar, Borrador, Archivado)
- Paginación de resultados
- Estadísticas: Total de productos, con fotos, sin fotos

### 2. Gestión de Imágenes
- **Ver imágenes**: Visualizar todas las imágenes del producto
- **Subir imágenes**: Desde galería o cámara
- **Eliminar imágenes**: Eliminar imágenes del servidor
- **Imagen principal**: La primera imagen se marca como principal

### 3. Sugerencias con Google Lens
- Buscar productos similares por URL o subiendo una imagen
- Ver resultados con precios y fuentes
- Seleccionar imágenes de alta calidad para agregar al producto

### 4. Editor con IA (Gemini)
- Editar imágenes usando instrucciones en lenguaje natural
- Ejemplos de prompts:
  - "Cambia el fondo a blanco"
  - "Mejora los colores y el brillo"
  - "Elimina el fondo"
  - "Agrega un fondo de montañas"
- Vista previa del resultado
- Opción de regenerar o agregar al producto

## Endpoints Utilizados

### Gemini Image Editor API

#### POST /gemini-image-editor/edit
Edita una imagen usando instrucciones en lenguaje natural.

**Request:**
```bash
curl -X POST http://localhost:8081/gemini-image-editor/edit \
  -F "file=@imagen.jpg" \
  -F "prompt=Cambia el fondo a un paisaje de montañas y mejora los colores"
```

**Response:**
```json
{
  "success": true,
  "editedImageBase64": "iVBORw0KGgoAAAANSUhEUgAA...",
  "mimeType": "image/png",
  "prompt": "Cambia el fondo a un paisaje de montañas y mejora los colores"
}
```

**Uso en el frontend:**
```typescript
const imageUrl = `data:${response.mimeType};base64,${response.editedImageBase64}`;
```

## Estructura de Archivos

```
src/
├── screens/Photos/
│   ├── PhotosScreen.tsx          # Pantalla principal del módulo
│   ├── index.ts                  # Exportaciones
│   └── README.md                 # Esta documentación
├── components/Photos/
│   ├── ProductPhotosModal.tsx    # Modal de gestión de fotos
│   └── index.ts                  # Exportaciones
└── services/api/
    └── gemini-image-editor.ts    # Servicio API de Gemini
```

## Navegación

### Ruta
- **Nombre**: `Photos`
- **Path**: `/photos`
- **Permiso requerido**: `products.read`

### Acceso desde el menú
El módulo se puede acceder desde el menú principal con el ID `fotos`.

## Permisos

El módulo utiliza los permisos existentes de productos:
- `products.read` - Ver productos y fotos
- `products.update` - Editar productos (implícito para gestión de fotos)

## Flujo de Uso

### 1. Gestionar Fotos de un Producto
1. Navegar a la pantalla de Fotos
2. Buscar el producto deseado
3. Hacer clic en "📸 Gestionar Fotos"
4. Se abre el modal con 3 pestañas:
   - **Galería**: Ver y gestionar imágenes existentes
   - **Sugerencias**: Buscar imágenes con Google Lens
   - **Editar IA**: Editar imágenes con Gemini

### 2. Subir Nuevas Imágenes
1. En la pestaña "Galería"
2. Hacer clic en "📁 Galería" o "📷 Cámara"
3. Seleccionar imágenes
4. Las imágenes aparecen en "Nuevas Imágenes"
5. Hacer clic en "☁️ Subir Todo"

### 3. Buscar Sugerencias con Google Lens
1. En la pestaña "Sugerencias"
2. Opción A: Ingresar URL de imagen y hacer clic en "Buscar por URL"
3. Opción B: Hacer clic en "📁 Buscar desde Galería"
4. Ver resultados con precios y fuentes
5. Hacer clic en "✓ Usar" para agregar la imagen

### 4. Editar con Gemini
1. En la pestaña "Editar IA"
2. Seleccionar una imagen del producto
3. Escribir instrucciones de edición (prompt)
4. Hacer clic en "🎨 Editar con Gemini"
5. Ver resultado
6. Opciones:
   - "🔄 Regenerar": Volver a editar con el mismo prompt
   - "✓ Agregar al Producto": Guardar la imagen editada

## Ejemplos de Prompts para Gemini

### Fondos
- "Cambia el fondo a blanco puro"
- "Agrega un fondo degradado azul"
- "Elimina el fondo completamente"
- "Pon un fondo de estudio profesional"

### Mejoras
- "Mejora el brillo y contraste"
- "Aumenta la saturación de colores"
- "Haz la imagen más nítida"
- "Corrige el balance de blancos"

### Transformaciones
- "Recorta la imagen al producto principal"
- "Centra el producto en la imagen"
- "Agrega sombra al producto"
- "Refleja la imagen horizontalmente"

## Tecnologías Utilizadas

- **React Native**: Framework principal
- **TypeScript**: Tipado estático
- **Expo Image Picker**: Selección de imágenes
- **Expo File System**: Manejo de archivos
- **Google Lens API**: Búsqueda de imágenes similares
- **Gemini API**: Edición de imágenes con IA

## Notas Importantes

1. **Formato de imágenes**: Se aceptan JPG, PNG, WEBP
2. **Tamaño máximo**: Depende de la configuración del servidor
3. **Orden de imágenes**: La primera imagen es la principal
4. **Caché**: Las imágenes se cachean localmente para mejor rendimiento
5. **Permisos**: Se requieren permisos de cámara y galería en el dispositivo

## Mantenimiento

### Agregar nuevas funcionalidades
1. Editar `ProductPhotosModal.tsx` para agregar nuevas pestañas
2. Crear nuevos servicios en `services/api/` si se necesitan
3. Actualizar esta documentación

### Debugging
- Los logs se prefijan con emojis para fácil identificación:
  - 📸 - Operaciones de imágenes
  - 🎨 - Edición con Gemini
  - 🔍 - Búsqueda con Google Lens
  - ✅ - Operaciones exitosas
  - ❌ - Errores

## Soporte

Para problemas o preguntas sobre este módulo, contactar al equipo de desarrollo.
