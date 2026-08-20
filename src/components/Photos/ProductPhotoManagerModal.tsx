import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { photoCampaignsApi, productsApi } from '@/services/api';
import { filesApi } from '@/services/api/files';
import priceProfilesApi from '@/services/api/price-profiles';
import { AdDesignTemplate, PhotoGroup, PhotoType } from '@/types/photo-campaigns';
import { PriceProfile, ProductSalePrice } from '@/types/price-profiles';
import {
  launchCameraAsync,
  launchImageLibraryAsync,
  requestCameraPermissionsAsync,
  requestMediaLibraryPermissionsAsync,
  MediaTypeOptions,
} from '@/utils/filePicker';
import { uploadFileFromUrl } from '@/utils/imageFile';
import { usePhotoGenerationStore } from '@/store/photoGeneration';
import Alert from '@/utils/alert';
import ImageCropModal from './ImageCropModal';

interface ProductPhotoManagerModalProps {
  visible: boolean;
  onClose: () => void;
  productId: string;
  productTitle?: string;
  productSku?: string;
  /** URL de la foto de catálogo del producto (fallback cuando no hay referencia/diseño). */
  catalogPhotoUrl?: string;
  /** Último recurso: foto que ya se muestra del producto, por si no hay catálogo resoluble. */
  fallbackImageUrl?: string;
  /**
   * Fotos de referencia que ya existen para el producto (p. ej. las fotos de
   * validación de la compra) pero que todavía NO son assets de la campaña de
   * fotos. Se muestran para que el usuario las adopte como referencia con un
   * toque. Esto evita el caso confuso en que el badge dice que hay fotos pero
   * el modal aparece vacío.
   */
  existingReferenceUrls?: string[];
  /** Optional: associate uploaded photos to a photo campaign. */
  photoCampaignId?: string;
  /** Called whenever a photo is successfully uploaded/replaced. */
  onPhotosChanged?: () => void;
}

const PHOTO_TYPE_LABELS: Record<PhotoType, string> = {
  reference: 'Referencia',
  design: 'Diseño',
  price: 'Con precio',
};

// Instrucción común: la referencia suele ser una foto de tienda/almacén con
// varias unidades, plástico, códigos de barras y manos. Hay que aislar UNA
// unidad como protagonista y conservar intacta la marca y la etiqueta.
const PRESERVE_PRODUCT_BLOCK = `IMPORTANTE — La imagen de referencia puede mostrar varias unidades del producto, empaques amontonados, envoltura plástica, códigos de barras, etiquetas de precio, manos o iluminación de tienda. Debes:

* Seleccionar UNA sola unidad del producto y convertirla en el protagonista absoluto.
* Eliminar por completo el desorden: otras unidades, envoltorios, cajas de fondo, manos, etiquetas de precio, códigos de barras, reflejos y ruido de tienda.
* Conservar EXACTAMENTE el producto: forma, proporciones, materiales, texturas y colores reales.
* Mantener la marca, logotipos y todos los textos de la etiqueta perfectamente legibles, nítidos y sin inventar ni alterar palabras (respeta el nombre de marca y la descripción del empaque tal cual).`;

// Regla de tamaño enfática. Se coloca al inicio del prompt para que el modelo la
// priorice: los resultados anteriores mostraban el producto demasiado pequeño.
const HERO_SIZE_RULE = `⚠️ REGLA DE TAMAÑO (OBLIGATORIA E INNEGOCIABLE): el producto debe estar en PRIMER PLANO y LLENAR el encuadre, ocupando entre el 60% y el 80% del área total de la imagen. Es un hero shot / plano macro: acerca la cámara al producto hasta que domine por completo la composición y casi toque los bordes (sin recortarse). NUNCA lo muestres pequeño, lejano, centrado en un espacio vacío ni perdido en la escena. Si el producto ocupa menos del 60% de la imagen, el resultado es INCORRECTO y debe rehacerse mucho más cerca.`;

const LIFESTYLE_SIZE_RULE = `⚠️ REGLA DE TAMAÑO (OBLIGATORIA): el producto debe estar en primer plano y ocupar entre el 40% y el 60% del área total de la imagen, claramente cercano y protagonista. Puede haber ambientación alrededor, pero el producto NUNCA debe verse pequeño ni lejano. Si ocupa menos del 40% de la imagen, el resultado es INCORRECTO y debe rehacerse más cerca.`;

const DEFAULT_DESIGN_PROMPT = `Genera una fotografía de producto premium de nivel comercial y publicitario a partir de la imagen de referencia.

${HERO_SIZE_RULE}

${PRESERVE_PRODUCT_BLOCK}

Composición:

* Producto en primer plano llenando el encuadre, ocupando entre el 60% y el 80% del área de la imagen, grande y protagonista, sin recortarse.
* Acércate mucho al producto (plano cerrado tipo hero shot); nunca debe verse pequeño ni lejano.
* Encuadre limpio y equilibrado, perspectiva profesional tipo e-commerce / catálogo premium.
* Enfoque extremadamente nítido en todo el producto, con la etiqueta perfectamente legible.

Iluminación:

* Luz de estudio suave y uniforme.
* Sombras sutiles y realistas que aporten volumen.
* Realces delicados que resalten el material (plástico, metal, brillo del empaque) y separen el producto del fondo.

Escenario y fondo:

* Genera un fondo ambientado cálido y rústico según la categoría del producto (no un color plano): madera natural, cerámica artesanal, terracota, arpillera, ratán, piedra rústica, cocina campestre, taller artesanal o mesa de mercado, según encaje con el producto.
* El fondo debe ser cálido, artesanal y ligeramente desenfocado, aportando calidez y contexto sin competir con el producto.
* Paleta de tierras, ocres, terracotas, mostazas suaves, cremas cálidos y dorados. NUNCA uses mármol blanco/gris ni superficies frías/clínicas por defecto.
* El producto siempre debe destacar claramente sobre el fondo rústico y cálido.

Salida final:

* Resolución 1800x1800 px, formato cuadrado.
* Máxima nitidez y calidad premium, optimizada para Instagram, e-commerce y publicidad digital.`;

const LIFESTYLE_DESIGN_PROMPT = `Genera una fotografía lifestyle de producto para redes sociales comerciales a partir de la imagen de referencia.

${LIFESTYLE_SIZE_RULE}

${PRESERVE_PRODUCT_BLOCK}

Composición:

* El producto aislado es el protagonista claro, en primer plano y bien enfocado; debe ocupar entre el 40% y el 60% del área de la imagen y notarse cercano (nunca pequeño ni perdido en la escena).
* Ambientación real de uso cotidiano cálida y rústica acorde al producto (mesa de madera, cocina campestre, taller artesanal, terraza con plantas, mesón de tablones, cesto de mimbre, superficie de barro cocido).
* Props sutiles y coherentes con la estética cálida/artesanal (madera, cerámica hecha a mano, textiles de lino/algodón crudo, hojas verdes, flores secas, ratán, cesta tejida) que acompañen sin robar protagonismo ni tapar el producto.
* Encuadre atractivo con espacio negativo para texto/overlay.

Iluminación:

* Luz natural cálida tipo luz de ventana matinal o golden hour, con tonos anaranjados/dorados sutiles.
* Sombras suaves y naturales, atmósfera acogedora, hogareña y aspiracional.

Escenario y fondo:

* Escena aspiracional acogedora tipo "cottagecore" / farmhouse / mediterráneo cálido / taller artesanal, con fondo desenfocado que resalte el producto.
* Paleta cálida armónica: tierras, ocres, terracotas, mostazas suaves, marrones, cremas cálidos, verdes olivos y dorados.
* NUNCA uses mármol blanco/gris ni estética minimalista fría por defecto.

Salida final:

* Resolución 1800x1800 px, formato cuadrado.
* Estética editorial optimizada para Instagram y Facebook, con el producto claramente resaltado.`;

const PROMO_DESIGN_PROMPT = `Genera una fotografía publicitaria de alto impacto para promociones en redes sociales a partir de la imagen de referencia.

${HERO_SIZE_RULE}

${PRESERVE_PRODUCT_BLOCK}

Composición:

* Producto centrado, en primer plano, grande y dominante, ocupando entre el 60% y el 80% del área de la imagen; que detenga el scroll y nunca se vea pequeño.
* Composición dinámica y llamativa, con espacio limpio alrededor para precios, ofertas o llamados a la acción.

Iluminación:

* Iluminación cálida tipo golden hour o luz de ventana dorada, con reflejos ambarinos y sombras suaves y naturales.
* Realces cálidos que resalten texturas, volumen y el detalle del empaque; sin brillos fríos ni acabados clínicos.
* Contraste controlado con tonalidades cálidas dominantes, manteniendo los colores reales del producto.

Escenario y fondo:

* Fondo publicitario cálido y rústico coherente con la categoría (madera natural, cerámica artesanal, terracota, cesta de mimbre, mesón de tablones, ladrillo visto o telas de lino/arpillera), con props y texturas artesanales.
* Puede ser vibrante y llamativo dentro de la paleta cálida (ocres, terracotas, mostazas, dorados), manteniendo un espacio limpio alrededor del producto para precios, ofertas o CTAs.
* Estética comercial cálida y aspiracional tipo "mercado artesanal / farm-to-table / campaña con calidez de hogar"; el producto siempre dominante sobre el fondo.
* NUNCA uses mármol blanco/gris ni fondos fríos/clínicos por defecto.

Salida final:

* Resolución 1800x1800 px, formato cuadrado.
* Máxima nitidez, look publicitario optimizado para historias, reels y anuncios, con el producto totalmente resaltado.`;

const DESIGN_PROMPT_TEMPLATES: Array<{ key: string; label: string; prompt: string }> = [
  { key: 'premium', label: 'Premium', prompt: DEFAULT_DESIGN_PROMPT },
  { key: 'lifestyle', label: 'Lifestyle', prompt: LIFESTYLE_DESIGN_PROMPT },
  { key: 'promo', label: 'Promo', prompt: PROMO_DESIGN_PROMPT },
];

// ---------- Configuración dinámica del prompt ----------
// Empaque: cómo debe aparecer el producto respecto de su caja/envoltorio.
type DesignPackaging = 'without' | 'with' | 'both';
// Presentación: cantidad de unidades (individual vs set/pack de varias).
type DesignPresentation = 'individual' | 'set';
// Ambiente / escenario de la foto.
type DesignEnvironment =
  | 'warm'
  | 'outdoor'
  | 'home'
  | 'kitchen'
  | 'bathroom'
  | 'bedroom'
  | 'school'
  | 'custom';

const ENVIRONMENT_OPTIONS: Array<{
  key: DesignEnvironment;
  label: string;
  description: string;
  /** Bloque a inyectar en el prompt cuando se elige esta opción. */
  prompt: string;
}> = [
  {
    key: 'warm',
    label: 'Cálido (default)',
    description: 'Fondo cálido y rústico: madera, cerámica, terracota.',
    prompt: `🎨 AMBIENTACIÓN: usa fondos y escenarios CÁLIDOS y RÚSTICOS. Prioriza superficies y contextos como madera natural (roble, nogal, pino envejecido), mesas de tablones, tablas de cortar, cerámica artesanal, terracota, adobe, ladrillo visto, piedra rústica, arpillera/lino natural, ratán, mimbre, cesta tejida, cuero envejecido, hojas verdes o secas, telas de algodón crudo, elementos de granja/mercado o taller artesanal. Paleta: tierras, ocres, terracotas, mostazas suaves, marrones, cremas cálidos, dorados. Iluminación cálida tipo luz de ventana matinal o golden hour, con tonos anaranjados/dorados sutiles. ❌ EVITA mármol blanco/gris, superficies frías/clínicas, fondos blancos planos, acabados brillantes tipo laboratorio, tonos azules/grises fríos, estética minimalista fría o de spa moderno.`,
  },
  {
    key: 'outdoor',
    label: 'Aire libre',
    description: 'Escena al aire libre con luz natural (jardín, terraza, campo).',
    prompt: `🎨 AMBIENTACIÓN: escena AL AIRE LIBRE con luz natural real. Escoge un exterior coherente con el producto: jardín con plantas y follaje, terraza de madera, patio con vegetación, campo/pradera, mesa de picnic sobre pasto, playa/orilla natural, huerto, mercado al aire libre o parque. Incluye elementos naturales sutiles (hojas verdes, ramas, flores, luz filtrada entre plantas, madera al exterior, piedra natural). Iluminación de sol suave, luz de tarde dorada o luz difusa de día nublado; sombras naturales y frescas. Paleta orgánica con verdes naturales, tierras, azules cielo suaves y tonos cálidos. Fondo desenfocado sin competir con el producto. ❌ EVITA fondos de estudio, mármol fr��o o estética cerrada e indoor.`,
  },
  {
    key: 'home',
    label: 'Hogar',
    description: 'Living/sala hogareña, sofá, mantas, plantas.',
    prompt: `🎨 AMBIENTACIÓN: escena HOGAREÑA acogedora tipo living/sala real. Superficies y props: mesa ratona de madera, sofá con mantas y cojines de textura, alfombra suave, plantas de interior, cuadros, lámpara cálida, libros, cerámica y objetos personales. Ambiente vivido, cálido y aspiracional (no showroom vacío). Iluminación tibia de lámpara o luz de ventana con tonos ámbar; sombras suaves y hogareñas. Paleta cálida con maderas, cremas, ocres, verdes suaves y textiles naturales. Fondo desenfocado que aporte calidez sin robar protagonismo. ❌ EVITA mármol frío, estudio blanco, estética clínica o minimalista fría.`,
  },
  {
    key: 'kitchen',
    label: 'Cocina',
    description: 'Cocina cálida: mesada de madera, utensilios, ingredientes.',
    prompt: `🎨 AMBIENTACIÓN: escena de COCINA real y cálida. Superficies y props coherentes con la cocina: mesada de madera o mesón de tablones, tabla de cortar, utensilios de madera o cobre, ollas de hierro/esmalte, cerámica artesanal, textiles de lino/algodón, ingredientes frescos (hojas, especias, frutas, panes) según encaje. Puede ser cocina campestre / farmhouse / mediterránea cálida o cocina moderna con acentos de madera; NUNCA cocina clínica de acero frío. Iluminación cálida tipo luz de ventana matinal o tarde dorada, con reflejos ambarinos. Paleta de tierras, ocres, verdes olivos, cremas cálidos, cobres y dorados. Fondo desenfocado y armónico. ❌ EVITA mármol blanco frío puro, superficies de acero clínico como protagonistas, estudio blanco.`,
  },
  {
    key: 'bathroom',
    label: 'Baño',
    description: 'Baño acogedor tipo spa cálido, madera, plantas, cerámica.',
    prompt: `🎨 AMBIENTACIÓN: escena de BAÑO real y acogedor tipo spa cálido / boutique. Superficies y props: repisa de madera, canasto de ratán, toallas de algodón crudo enrolladas, cerámica artesanal, botellas y frascos apilados con estética natural, plantas verdes, jabones/esponjas naturales, piedra pómez, luz de vela. Fondo puede ser piedra natural, azulejo terracota, madera clara o pared con textura cálida. Iluminación tibia y difusa tipo luz de ventana con vapor sutil, sombras suaves. Paleta cálida con cremas, tierras, verdes eucalipto suaves y madera. Fondo desenfocado. ❌ EVITA baño 100% blanco/gris frío, estética clínica de hospital o laboratorio.`,
  },
  {
    key: 'bedroom',
    label: 'Cuarto',
    description: 'Dormitorio cálido: cama, textiles suaves, mesita de luz.',
    prompt: `🎨 AMBIENTACIÓN: escena de DORMITORIO / CUARTO cálido y aspiracional. Superficies y props: cama con sábanas y edredón de textura, cojines, manta tejida, mesita de luz de madera, lámpara cálida, cortinas de lino, plantas suaves, libros, cuadros, tocador con espejo. Ambiente acogedor, luz de mañana o de lámpara tibia, sombras suaves. Paleta cálida con cremas, beige, ocres, terracotas suaves, verdes muted y maderas. Fondo desenfocado que aporte confort. ❌ EVITA estética clínica fría, mármol blanco puro o estudio blanco.`,
  },
  {
    key: 'school',
    label: 'Escolar',
    description: 'Escritorio, útiles escolares, cuadernos, aula cálida.',
    prompt: `🎨 AMBIENTACIÓN: escena ESCOLAR / de escritorio de estudio. Superficies y props: escritorio de madera, cuadernos, lápices y crayones, regla, tijeras, mochila, libros abiertos, globo terráqueo, pizarra con tiza, mapa, corcho con notas. Puede ser aula, pupitre o estudio en casa. Iluminación cálida tipo luz de ventana matinal, sombras suaves. Paleta cálida con maderas, ocres, mostazas suaves, verdes pizarra, terracotas y cremas; puede incluir toques de colores primarios propios de útiles escolares sin que dominen. Fondo desenfocado y ordenado. ❌ EVITA estética 100% blanca fría o de laboratorio.`,
  },
  {
    key: 'custom',
    label: 'Personalizado',
    description: 'Describe libremente el ambiente que quieres.',
    prompt: '',
  },
];

const PACKAGING_OPTIONS: Array<{
  key: DesignPackaging;
  label: string;
  description: string;
}> = [
  {
    key: 'without',
    label: 'Fuera del empaque',
    description: 'Producto sin caja/bolsa/blíster.',
  },
  {
    key: 'with',
    label: 'Dentro del empaque',
    description: 'Producto en su caja/empaque original.',
  },
  {
    key: 'both',
    label: 'Producto + caja',
    description: 'Producto fuera y la caja a su lado.',
  },
];

const PRESENTATION_OPTIONS: Array<{
  key: DesignPresentation;
  label: string;
  description: string;
}> = [
  {
    key: 'individual',
    label: 'Individual',
    description: 'Una sola unidad.',
  },
  {
    key: 'set',
    label: 'Set / Pack',
    description: 'Todas las unidades del set (ej. 3 ollas, pack de 12).',
  },
];

/**
 * Construye el bloque de "configuración específica" que se antepone al prompt
 * base. Está redactado de manera enfática para sobreescribir cualquier regla
 * general en conflicto (p. ej. la de "una sola unidad" del preserve block).
 */
const buildDesignConfigBlock = (
  packaging: DesignPackaging,
  presentation: DesignPresentation,
  environment: DesignEnvironment,
  environmentCustom: string,
  observations: string
): string => {
  const lines: string[] = [
    '🎯 CONFIGURACIÓN ESPECÍFICA (OBLIGATORIA — SOBRESCRIBE CUALQUIER REGLA GENERAL EN CONFLICTO):',
  ];

  // Ambientación / escenario
  if (environment === 'custom') {
    const custom = environmentCustom.trim();
    if (custom) {
      lines.push(
        `🎨 AMBIENTACIÓN PERSONALIZADA (obligatoria): ${custom}. Respeta este escenario y estética por encima de cualquier default.`
      );
    } else {
      // Sin texto personalizado: fallback al warm.
      const fallback = ENVIRONMENT_OPTIONS.find((o) => o.key === 'warm')!.prompt;
      lines.push(fallback);
    }
  } else {
    const found = ENVIRONMENT_OPTIONS.find((o) => o.key === environment);
    if (found && found.prompt) {
      lines.push(found.prompt);
    }
  }

  if (presentation === 'set') {
    lines.push(
      '• Presentación: SET / PACK. El producto viene en un conjunto de varias unidades (por ejemplo 3 ollas, un pack de 12 cepillos, un kit de brochas). Debes mostrar TODAS las unidades del set COMPLETO, agrupadas de forma armónica, ordenada y visible en la escena. NO muestres solo una unidad. Respeta la cantidad exacta, tamaños y variantes visibles en la imagen de referencia.'
    );
  } else {
    lines.push(
      '• Presentación: UNIDAD INDIVIDUAL. Muestra UNA sola unidad del producto como protagonista absoluto, aunque en la referencia aparezcan varias.'
    );
  }

  if (packaging === 'without') {
    lines.push(
      '• Empaque: FUERA DEL EMPAQUE. Retira por completo la caja, bolsa, blíster o cualquier envoltorio. Muestra únicamente el producto desnudo tal como se usa. La caja/empaque NO debe aparecer en la imagen.'
    );
  } else if (packaging === 'with') {
    lines.push(
      '• Empaque: DENTRO DEL EMPAQUE. Muestra el producto dentro de su caja/empaque/blíster original tal como se vende, con el empaque intacto y todos los textos, marca y diseño del empaque perfectamente legibles y nítidos. No lo saques del empaque.'
    );
  } else {
    lines.push(
      '• Empaque: PRODUCTO + CAJA. Muestra el producto FUERA del empaque como protagonista principal en primer plano, y junto a él (a su lado o ligeramente detrás con composición premium) la caja/empaque original bien visible como referencia. Ambos deben verse claramente y mantener proporciones y textos reales.'
    );
  }

  const obs = observations.trim();
  if (obs) {
    lines.push(`• Observaciones adicionales del usuario (deben cumplirse): ${obs}`);
  }

  return lines.join('\n');
};

/**
 * Devuelve el prompt final compuesto: bloque de configuración específica +
 * prompt base de la plantilla elegida.
 */
const buildDesignPrompt = ({
  templateKey,
  packaging,
  presentation,
  environment,
  environmentCustom,
  observations,
}: {
  templateKey: string;
  packaging: DesignPackaging;
  presentation: DesignPresentation;
  environment: DesignEnvironment;
  environmentCustom: string;
  observations: string;
}): string => {
  const base = (
    DESIGN_PROMPT_TEMPLATES.find((t) => t.key === templateKey) || DESIGN_PROMPT_TEMPLATES[0]
  ).prompt;
  const config = buildDesignConfigBlock(
    packaging,
    presentation,
    environment,
    environmentCustom,
    observations
  );
  return `${config}\n\n${base}`;
};

type PricePhotoFormState = {
  name: string;
  sku: string;
  price: string;
  template: AdDesignTemplate;
  profileId: string;
};

const defaultPricePhotoForm: PricePhotoFormState = {
  name: '',
  sku: '',
  price: '',
  template: 'premium',
  profileId: '',
};

/** Fotos ordenadas de un grupo para el visor (referencia → diseño → precio). */
type ViewerPhoto = { uri: string; title: string };

/**
 * Extrae la URL de la foto de catálogo de un producto. Las fotos pueden venir
 * como strings o como objetos `{ type, url }`. Prioriza el tipo `catalog`, luego
 * cualquier foto disponible, luego `imageUrl`/`imageUrls`.
 */
const extractCatalogUrl = (product: any): string | undefined => {
  if (!product) return undefined;
  const photos = product.photos;
  if (Array.isArray(photos)) {
    const catalogObj = photos.find(
      (p: any) =>
        p &&
        typeof p === 'object' &&
        typeof p.type === 'string' &&
        p.type.toLowerCase() === 'catalog' &&
        typeof p.url === 'string'
    );
    if (catalogObj?.url) return catalogObj.url;
    const firstObj = photos.find(
      (p: any) => p && typeof p === 'object' && typeof p.url === 'string'
    );
    if (firstObj?.url) return firstObj.url;
    const firstStr = photos.find((p: any) => typeof p === 'string' && p);
    if (firstStr) return firstStr;
  }
  if (typeof product.imageUrl === 'string' && product.imageUrl) return product.imageUrl;
  if (Array.isArray(product.imageUrls) && typeof product.imageUrls[0] === 'string') {
    return product.imageUrls[0];
  }
  return undefined;
};

/** Llave de subida por grupo para mostrar spinners aislados. */
const groupPhotoKey = (parentId: string | null, photoType: PhotoType): string =>
  `${parentId || 'new'}:${photoType}`;

export const ProductPhotoManagerModal: React.FC<ProductPhotoManagerModalProps> = ({
  visible,
  onClose,
  productId,
  productTitle,
  productSku,
  catalogPhotoUrl,
  fallbackImageUrl,
  existingReferenceUrls,
  photoCampaignId,
  onPhotosChanged,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [groups, setGroups] = useState<PhotoGroup[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [photoUploadingKey, setPhotoUploadingKey] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  // Foto de catálogo: la que pasa el padre o, si no, la resolvemos vía API.
  const [fetchedCatalogUrl, setFetchedCatalogUrl] = useState<string | undefined>(undefined);
  const effectiveCatalogUrl = catalogPhotoUrl || fetchedCatalogUrl || fallbackImageUrl;

  // Generación en segundo plano (store global, persiste aunque cierres el modal)
  const generateDesign = usePhotoGenerationStore((s) => s.generateDesign);
  const generatePrice = usePhotoGenerationStore((s) => s.generatePrice);
  const generatingMap = usePhotoGenerationStore((s) => s.generating);
  const completedVersion = usePhotoGenerationStore((s) => s.completedVersion[productId] || 0);

  // ¿Está generando design/price un grupo concreto? Las flags se llavean por
  // grupo (`${productId}::${parentAssetId}`) en el store.
  const isGroupGenerating = useCallback(
    (parentId: string | null | undefined, kind: 'design' | 'price') =>
      Boolean(generatingMap[`${productId}::${parentId || 'default'}`]?.[kind]),
    [generatingMap, productId]
  );

  // Grupo activo (reference.id) sobre el que actúan los modales de diseño/precio.
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  // Design (Gemini) prompt modal state
  const [designModalVisible, setDesignModalVisible] = useState(false);
  const [designTemplateKey, setDesignTemplateKey] = useState(DESIGN_PROMPT_TEMPLATES[0].key);
  const [designPackaging, setDesignPackaging] = useState<DesignPackaging>('without');
  const [designPresentation, setDesignPresentation] = useState<DesignPresentation>('individual');
  const [designEnvironment, setDesignEnvironment] = useState<DesignEnvironment>('warm');
  const [designEnvironmentCustom, setDesignEnvironmentCustom] = useState('');
  const [designObservations, setDesignObservations] = useState('');
  const [designPrompt, setDesignPrompt] = useState(() =>
    buildDesignPrompt({
      templateKey: DESIGN_PROMPT_TEMPLATES[0].key,
      packaging: 'without',
      presentation: 'individual',
      environment: 'warm',
      environmentCustom: '',
      observations: '',
    })
  );
  // Marcamos cuando el usuario edita manualmente el prompt para NO sobreescribirlo
  // en cada cambio de selector. Un botón "Regenerar" restaura el modo dinámico.
  const [designPromptDirty, setDesignPromptDirty] = useState(false);

  // Price photo (ad-design) modal state
  const [pricePhotoModalVisible, setPricePhotoModalVisible] = useState(false);
  const [pricePhotoForm, setPricePhotoForm] = useState<PricePhotoFormState>(defaultPricePhotoForm);
  const [priceProfiles, setPriceProfiles] = useState<PriceProfile[]>([]);
  const [priceSalePrices, setPriceSalePrices] = useState<ProductSalePrice[]>([]);
  const [priceProfilesLoading, setPriceProfilesLoading] = useState(false);

  // Fuente pendiente de recorte antes de subir una nueva referencia (grupo).
  const [cropState, setCropState] = useState<{
    uri: string;
    fileName: string;
    mimeType: string;
    /** Reference existente a reemplazar (se elimina antes de subir la nueva). */
    replaceRefId?: string | null;
    /** Fotos huérfanas del grupo por defecto a eliminar antes de subir. */
    cleanupAssetIds?: string[];
    /** Llave para el spinner de subida (por grupo). */
    uploadKey: string;
  } | null>(null);

  // Image viewer state (pager por grupo)
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [viewerPhotos, setViewerPhotos] = useState<ViewerPhoto[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const imageViewerScale = useSharedValue(1);
  const imageViewerSavedScale = useSharedValue(1);
  const imageViewerTranslateX = useSharedValue(0);
  const imageViewerTranslateY = useSharedValue(0);
  const imageViewerSavedTranslateX = useSharedValue(0);
  const imageViewerSavedTranslateY = useSharedValue(0);
  const imageViewerFocalX = useSharedValue(0);
  const imageViewerFocalY = useSharedValue(0);

  const loadPhotos = useCallback(async () => {
    if (!productId) {
      return;
    }
    try {
      setPhotosLoading(true);
      const result = await photoCampaignsApi.getProductPhotoGroups(productId);
      const sorted = [...result].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      setGroups(sorted);
    } catch {
      setGroups([]);
    } finally {
      setPhotosLoading(false);
    }
  }, [productId]);

  const notifyChanged = useCallback(async () => {
    await loadPhotos();
    onPhotosChanged?.();
  }, [loadPhotos, onPhotosChanged]);

  useEffect(() => {
    if (visible) {
      void loadPhotos();
    }
  }, [visible, loadPhotos]);

  // Resuelve la foto de catálogo real del producto si el padre no la proporcionó.
  useEffect(() => {
    if (!visible || !productId || catalogPhotoUrl) {
      return;
    }
    let cancelled = false;
    (async () => {
      // Fuente principal: imágenes de catálogo del producto (GET
      // /files/products/:id/images). Coincide con las fotos guardadas en
      // catalog/productos/imagenes/...
      try {
        const res = await filesApi.getProductImages(productId);
        const url = res?.images?.find((img) => !!img?.url)?.url;
        if (url) {
          if (!cancelled) setFetchedCatalogUrl(url);
          return;
        }
      } catch {
        // Ignoramos y probamos el fallback del detalle del producto.
      }
      // Fallback: detalle del producto (imageUrl / photos).
      try {
        const product = await productsApi.getProductById(productId);
        if (!cancelled) {
          setFetchedCatalogUrl(extractCatalogUrl(product));
        }
      } catch {
        if (!cancelled) {
          setFetchedCatalogUrl(undefined);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, productId, catalogPhotoUrl]);

  // Recarga las miniaturas cuando una generación en segundo plano finaliza.
  useEffect(() => {
    if (visible && completedVersion > 0) {
      void notifyChanged();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedVersion]);

  // Destino de una referencia a subir: grupo nuevo o reemplazo de uno existente.
  // El backend auto-asigna el orden, así que no enviamos sortOrder.
  type ReferenceTarget = {
    replaceRefId?: string | null;
    // Fotos huérfanas del grupo por defecto (design/price sin reference) que se
    // eliminan al subir la referencia, para que no quede un grupo fantasma.
    cleanupAssetIds?: string[];
    uploadKey: string;
  };

  // Sube una referencia (crea o reemplaza un grupo). La imagen ya viene recortada 1:1.
  const uploadReference = useCallback(
    async (
      asset: { uri: string; mimeType?: string; fileName?: string },
      target: ReferenceTarget
    ) => {
      const mimeType = asset.mimeType || 'image/jpeg';
      const fileName = asset.fileName || `reference-${Date.now()}.jpg`;

      try {
        setPhotoUploadingKey(target.uploadKey);
        // Reemplazo: eliminamos la referencia previa (y su diseño/precio en cascada).
        if (target.replaceRefId) {
          await photoCampaignsApi.deleteProductPhoto(productId, target.replaceRefId);
        }
        // Grupo por defecto: eliminamos sus fotos huérfanas para que la nueva
        // referencia sea el único grupo y no aparezca un grupo duplicado.
        if (target.cleanupAssetIds?.length) {
          for (const assetId of target.cleanupAssetIds) {
            await photoCampaignsApi.deleteProductPhoto(productId, assetId);
          }
        }
        const filePayload = await uploadFileFromUrl(asset.uri, fileName, mimeType);
        await photoCampaignsApi.uploadProductPhoto(productId, {
          photoType: 'reference',
          file: filePayload,
          photoCampaignId,
        });
        await notifyChanged();
      } catch (error: any) {
        Alert.alert('Error', error?.message || 'No se pudo subir la referencia');
      } finally {
        setPhotoUploadingKey(null);
      }
    },
    [productId, photoCampaignId, notifyChanged]
  );

  // Abre la galería / selector de archivos para una referencia.
  const pickFromLibrary = useCallback(async (target: ReferenceTarget) => {
    const permission = await requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permiso requerido', 'Se necesita permiso para acceder a las fotos');
      return;
    }
    const result = await launchImageLibraryAsync({
      mediaTypes: MediaTypeOptions.Images,
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]) {
      return;
    }
    const asset = result.assets[0];
    setCropState({
      uri: asset.uri,
      fileName: asset.fileName || `reference-${Date.now()}.jpg`,
      mimeType: asset.mimeType || 'image/jpeg',
      ...target,
    });
  }, []);

  // Abre la cámara para tomar una referencia.
  const takeFromCamera = useCallback(async (target: ReferenceTarget) => {
    const permission = await requestCameraPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permiso requerido', 'Se necesita permiso para acceder a la cámara');
      return;
    }
    const result = await launchCameraAsync({
      mediaTypes: MediaTypeOptions.Images,
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]) {
      return;
    }
    const asset = result.assets[0];
    setCropState({
      uri: asset.uri,
      fileName: asset.fileName || `reference-${Date.now()}.jpg`,
      mimeType: asset.mimeType || 'image/jpeg',
      ...target,
    });
  }, []);

  // Muestra un selector para tomar o subir una referencia hacia el destino dado.
  const openReferencePicker = useCallback(
    (target: ReferenceTarget) => {
      Alert.alert('Foto de referencia', '¿Cómo quieres agregar la foto?', [
        { text: 'Tomar foto', onPress: () => void takeFromCamera(target) },
        {
          text: Platform.OS === 'web' ? 'Subir archivo' : 'Elegir de galería',
          onPress: () => void pickFromLibrary(target),
        },
        { text: 'Cancelar', style: 'cancel' },
      ]);
    },
    [takeFromCamera, pickFromLibrary]
  );

  // Usa la foto de catálogo del producto como referencia del destino dado: abre
  // el recorte manual para que el usuario encuadre el producto (1:1).
  const useCatalogForTarget = useCallback(
    (target: ReferenceTarget) => {
      if (!effectiveCatalogUrl) {
        return;
      }
      setCropState({
        uri: effectiveCatalogUrl,
        fileName: `catalog-reference-${productId}.jpg`,
        mimeType: 'image/jpeg',
        ...target,
      });
    },
    [effectiveCatalogUrl, productId]
  );

  // Adopta una URL de referencia ya existente (típicamente una foto de
  // validación de la compra) como referencia de la campaña de fotos: abre el
  // recorte 1:1 y luego la sube como asset. Así el producto que "ya tiene
  // fotos" deja de verse vacío en el modal.
  const useUrlAsReference = useCallback(
    (url: string, target: ReferenceTarget) => {
      if (!url) {
        return;
      }
      setCropState({
        uri: url,
        fileName: `reference-${productId}-${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
        ...target,
      });
    },
    [productId]
  );

  // Al confirmar el recorte manual, subimos la referencia ya encuadrada.
  const handleCropConfirm = useCallback(
    async (croppedUri: string) => {
      const source = cropState;
      setCropState(null);
      if (!source) {
        return;
      }
      await uploadReference(
        {
          uri: croppedUri,
          mimeType: source.mimeType,
          fileName: source.fileName,
        },
        {
          replaceRefId: source.replaceRefId,
          cleanupAssetIds: source.cleanupAssetIds,
          uploadKey: source.uploadKey,
        }
      );
    },
    [cropState, uploadReference]
  );

  // Elimina un grupo completo (referencia + diseño + precio en cascada).
  const handleDeleteGroup = useCallback(
    (group: PhotoGroup) => {
      const assetId = group.reference?.id;
      if (!assetId) {
        return;
      }
      Alert.alert(
        'Eliminar grupo',
        'Se eliminará la referencia junto con su diseño y foto con precio. ¿Continuar?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: async () => {
              try {
                setDeletingGroupId(assetId);
                await photoCampaignsApi.deleteProductPhoto(productId, assetId);
                await notifyChanged();
              } catch (error: any) {
                Alert.alert('Error', error?.message || 'No se pudo eliminar el grupo');
              } finally {
                setDeletingGroupId(null);
              }
            },
          },
        ]
      );
    },
    [productId, notifyChanged]
  );

  // ============================================
  // Design (Gemini) flow — modal para prompt + generación en segundo plano
  // ============================================
  const openDesignModal = useCallback((group: PhotoGroup) => {
    if (!group.reference?.fileUrl || !group.reference.id) {
      Alert.alert('Referencia requerida', 'Este grupo no tiene una foto de referencia.');
      return;
    }
    setActiveGroupId(group.reference.id);
    setDesignTemplateKey(DESIGN_PROMPT_TEMPLATES[0].key);
    setDesignPackaging('without');
    setDesignPresentation('individual');
    setDesignEnvironment('warm');
    setDesignEnvironmentCustom('');
    setDesignObservations('');
    setDesignPrompt(
      buildDesignPrompt({
        templateKey: DESIGN_PROMPT_TEMPLATES[0].key,
        packaging: 'without',
        presentation: 'individual',
        environment: 'warm',
        environmentCustom: '',
        observations: '',
      })
    );
    setDesignPromptDirty(false);
    setDesignModalVisible(true);
  }, []);

  // Recompone el prompt cada vez que cambia la configuración, salvo que el
  // usuario haya editado manualmente el textarea (para no pisarle su edición).
  useEffect(() => {
    if (designPromptDirty) return;
    setDesignPrompt(
      buildDesignPrompt({
        templateKey: designTemplateKey,
        packaging: designPackaging,
        presentation: designPresentation,
        environment: designEnvironment,
        environmentCustom: designEnvironmentCustom,
        observations: designObservations,
      })
    );
  }, [
    designTemplateKey,
    designPackaging,
    designPresentation,
    designEnvironment,
    designEnvironmentCustom,
    designObservations,
    designPromptDirty,
  ]);

  const handleGenerateDesignInBackground = useCallback(
    (prompt: string) => {
      const group = groups.find((g) => g.reference?.id === activeGroupId);
      const referenceUrl = group?.reference?.fileUrl;
      if (!group?.reference?.id || !referenceUrl) {
        Alert.alert('Referencia requerida', 'No se encontró la referencia del grupo.');
        return;
      }

      // Se ejecuta en el store global: continúa aunque se cierre el modal.
      void generateDesign({
        productId,
        photoCampaignId,
        referenceUrl,
        prompt: prompt.trim() || DEFAULT_DESIGN_PROMPT,
        parentAssetId: group.reference.id,
      });
    },
    [groups, activeGroupId, productId, photoCampaignId, generateDesign]
  );

  // ============================================
  // Price photo (ad-design) flow
  // ============================================
  const openPricePhotoModal = useCallback(
    async (group: PhotoGroup) => {
      if (!group.reference?.id) {
        return;
      }
      if (!group.design?.fileUrl) {
        Alert.alert(
          'Diseño requerido',
          'Primero debes generar la foto de diseño de este grupo para agregarle precio.'
        );
        return;
      }

      setActiveGroupId(group.reference.id);

      try {
        setPriceProfilesLoading(true);
        const [profilesResponse, salePricesResponse] = await Promise.all([
          priceProfilesApi.getActivePriceProfiles(),
          priceProfilesApi.getProductSalePrices(productId),
        ]);

        const salePricesArray =
          (salePricesResponse as any).salePrices || (salePricesResponse as any).data || [];

        const defaultProfile =
          profilesResponse.find((p) => p.name?.toLowerCase().includes('socia')) ||
          profilesResponse[0] ||
          null;

        const defaultSalePrice = defaultProfile
          ? salePricesArray.find(
              (sp: ProductSalePrice) =>
                sp.profileId === defaultProfile.id && sp.presentationId === null
            )
          : null;

        const defaultPrice = defaultSalePrice ? (defaultSalePrice.priceCents / 100).toFixed(2) : '';

        setPriceProfiles(profilesResponse);
        setPriceSalePrices(salePricesArray);
        setPricePhotoForm({
          name: productTitle || '',
          sku: productSku || '',
          price: defaultPrice,
          template: 'premium',
          profileId: defaultProfile?.id || '',
        });
        setPricePhotoModalVisible(true);
      } catch (error: any) {
        Alert.alert(
          'Error',
          error?.message || 'No se pudo preparar la foto para diseño con precio.'
        );
      } finally {
        setPriceProfilesLoading(false);
      }
    },
    [productId, productTitle, productSku]
  );

  const resetPriceState = useCallback(() => {
    setPricePhotoModalVisible(false);
    setPricePhotoForm(defaultPricePhotoForm);
    setPriceProfiles([]);
    setPriceSalePrices([]);
  }, []);

  const handleGeneratePriceInBackground = useCallback(() => {
    const group = groups.find((g) => g.reference?.id === activeGroupId);
    const designPhoto = group?.design;
    if (!group?.reference?.id || !designPhoto?.fileUrl) {
      Alert.alert('Error', 'No se encontró la imagen base para generar el diseño.');
      return;
    }
    if (!pricePhotoForm.name.trim() || !pricePhotoForm.sku.trim() || !pricePhotoForm.price.trim()) {
      Alert.alert('Validación', 'Nombre, SKU y precio son obligatorios.');
      return;
    }

    const form = pricePhotoForm;
    // Cerramos el modal; el trabajo continúa en el store aunque se cierre.
    setPricePhotoModalVisible(false);

    void generatePrice({
      productId,
      photoCampaignId,
      designUrl: designPhoto.fileUrl,
      designMimeType: designPhoto.mimeType,
      name: form.name.trim(),
      sku: form.sku.trim(),
      price: form.price.trim(),
      template: form.template,
      parentAssetId: group.reference.id,
    });
  }, [groups, activeGroupId, pricePhotoForm, productId, photoCampaignId, generatePrice]);

  // ============================================
  // Image viewer (pager)
  // ============================================
  const resetImageViewerTransform = useCallback(() => {
    imageViewerScale.value = 1;
    imageViewerSavedScale.value = 1;
    imageViewerTranslateX.value = 0;
    imageViewerTranslateY.value = 0;
    imageViewerSavedTranslateX.value = 0;
    imageViewerSavedTranslateY.value = 0;
    imageViewerFocalX.value = 0;
    imageViewerFocalY.value = 0;
  }, [
    imageViewerScale,
    imageViewerSavedScale,
    imageViewerTranslateX,
    imageViewerTranslateY,
    imageViewerSavedTranslateX,
    imageViewerSavedTranslateY,
    imageViewerFocalX,
    imageViewerFocalY,
  ]);

  const pinchGesture = Gesture.Pinch()
    .onStart((event) => {
      imageViewerFocalX.value = event.focalX;
      imageViewerFocalY.value = event.focalY;
    })
    .onUpdate((event) => {
      imageViewerFocalX.value = event.focalX;
      imageViewerFocalY.value = event.focalY;
      const nextScale = imageViewerSavedScale.value * event.scale;
      imageViewerScale.value = Math.max(1, Math.min(nextScale, 6));
    })
    .onEnd(() => {
      imageViewerSavedScale.value = imageViewerScale.value;
      if (imageViewerScale.value <= 1) {
        imageViewerTranslateX.value = 0;
        imageViewerTranslateY.value = 0;
        imageViewerSavedTranslateX.value = 0;
        imageViewerSavedTranslateY.value = 0;
      }
    });

  const panGesture = Gesture.Pan()
    .onStart(() => {
      imageViewerSavedTranslateX.value = imageViewerTranslateX.value;
      imageViewerSavedTranslateY.value = imageViewerTranslateY.value;
    })
    .onUpdate((event) => {
      if (imageViewerScale.value <= 1) {
        return;
      }
      imageViewerTranslateX.value = imageViewerSavedTranslateX.value + event.translationX;
      imageViewerTranslateY.value = imageViewerSavedTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      imageViewerSavedTranslateX.value = imageViewerTranslateX.value;
      imageViewerSavedTranslateY.value = imageViewerTranslateY.value;
    });

  const imageViewerGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  const imageViewerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: imageViewerTranslateX.value },
      { translateY: imageViewerTranslateY.value },
      { translateX: imageViewerFocalX.value },
      { translateY: imageViewerFocalY.value },
      { scale: imageViewerScale.value },
      { translateX: -imageViewerFocalX.value },
      { translateY: -imageViewerFocalY.value },
    ],
  }));

  // Abre el visor sobre las fotos de un grupo, posicionado en la foto tocada.
  const openGroupViewer = useCallback(
    (group: PhotoGroup, startType: PhotoType) => {
      const items: ViewerPhoto[] = [];
      if (group.reference?.fileUrl) {
        items.push({ uri: group.reference.fileUrl, title: PHOTO_TYPE_LABELS.reference });
      }
      if (group.design?.fileUrl) {
        items.push({ uri: group.design.fileUrl, title: PHOTO_TYPE_LABELS.design });
      }
      if (group.price?.fileUrl) {
        items.push({ uri: group.price.fileUrl, title: PHOTO_TYPE_LABELS.price });
      }
      if (items.length === 0) {
        return;
      }
      const startTitle = PHOTO_TYPE_LABELS[startType];
      const idx = Math.max(
        0,
        items.findIndex((i) => i.title === startTitle)
      );
      resetImageViewerTransform();
      setViewerPhotos(items);
      setViewerIndex(idx);
      setImageViewerVisible(true);
    },
    [resetImageViewerTransform]
  );

  const goToViewerIndex = useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0 || nextIndex >= viewerPhotos.length) {
        return;
      }
      resetImageViewerTransform();
      setViewerIndex(nextIndex);
    },
    [viewerPhotos.length, resetImageViewerTransform]
  );

  const currentViewerPhoto = viewerPhotos[viewerIndex];

  const renderPhotoCard = (group: PhotoGroup, photoType: PhotoType) => {
    const parentId = group.reference?.id ?? null;
    const photo = group[photoType];
    const label = PHOTO_TYPE_LABELS[photoType];
    const designGenerating = isGroupGenerating(parentId, 'design');
    const priceGenerating = isGroupGenerating(parentId, 'price');

    // Destino y estado de subida para las acciones de la card de referencia.
    const referenceUploadKey = groupPhotoKey(parentId, 'reference');
    const referenceUploading = photoUploadingKey === referenceUploadKey;
    const hasDerived = !!group.design || !!group.price;
    // Grupo por defecto (sin reference): su design/price están huérfanos. Al subir
    // una referencia los limpiamos para que no quede un grupo duplicado.
    const isDefaultGroup = !parentId;
    const cleanupAssetIds = isDefaultGroup
      ? [group.design?.id, group.price?.id].filter((id): id is string => !!id)
      : undefined;
    const referenceTarget: ReferenceTarget = {
      replaceRefId: parentId,
      cleanupAssetIds,
      uploadKey: referenceUploadKey,
    };
    // Confirmamos cuando la subida vaya a eliminar diseño/precio existentes
    // (reemplazo de una referencia o limpieza del grupo por defecto).
    const willRemoveDerived = isDefaultGroup ? hasDerived : !!photo && hasDerived;
    const withReplaceWarning = (action: () => void) => {
      if (willRemoveDerived) {
        Alert.alert(
          'Reemplazar referencia',
          'Se eliminarán el diseño y la foto con precio de este grupo. ¿Continuar?',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Continuar', onPress: action },
          ]
        );
      } else {
        action();
      }
    };

    return (
      <View style={styles.photoTypeCard} key={photoType}>
        <Text style={styles.photoTypeLabel}>{label}</Text>
        {photo?.fileUrl ? (
          <TouchableOpacity
            onPress={() => openGroupViewer(group, photoType)}
            activeOpacity={0.9}
            style={styles.photoTouchArea}
          >
            <Image source={{ uri: photo.fileUrl }} style={styles.photoThumb} resizeMode="cover" />
          </TouchableOpacity>
        ) : (photoType === 'design' && designGenerating) ||
          (photoType === 'price' && priceGenerating) ? (
          <View style={styles.photoMissingBox}>
            <ActivityIndicator size="small" color={theme.color.brand.accent} />
            <Text style={styles.photoMissingText}>Generando…</Text>
          </View>
        ) : (
          <View style={styles.photoMissingBox}>
            <Text style={styles.photoMissingText}>Sin foto</Text>
          </View>
        )}

        {photoType === 'reference' && (
          <>
            <TouchableOpacity
              onPress={() => withReplaceWarning(() => openReferencePicker(referenceTarget))}
              disabled={referenceUploading}
            >
              {referenceUploading ? (
                <ActivityIndicator
                  size="small"
                  color={theme.color.brand.accent}
                  style={styles.photoActionIndicator}
                />
              ) : (
                <Text style={styles.photoActionText}>
                  {photo ? 'Reemplazar' : 'Tomar / Subir foto'}
                </Text>
              )}
            </TouchableOpacity>
            {!!effectiveCatalogUrl && !referenceUploading && (
              <TouchableOpacity
                onPress={() => withReplaceWarning(() => useCatalogForTarget(referenceTarget))}
              >
                <Text style={styles.photoActionTextSecondary}>Usar catálogo</Text>
              </TouchableOpacity>
            )}
          </>
        )}
        {photoType === 'design' &&
          (designGenerating ? (
            <View style={styles.photoActionInline}>
              <ActivityIndicator size="small" color={theme.color.brand.accent} />
              <Text style={styles.photoActionTextMuted}>Generando…</Text>
            </View>
          ) : (
            <Text style={styles.photoActionTextMuted}>Se genera desde referencia</Text>
          ))}
        {photoType === 'price' &&
          (priceGenerating ? (
            <View style={styles.photoActionInline}>
              <ActivityIndicator size="small" color={theme.color.brand.accent} />
              <Text style={styles.photoActionTextMuted}>Generando…</Text>
            </View>
          ) : (
            <Text style={styles.photoActionTextMuted}>Se llena en flujo específico</Text>
          ))}
      </View>
    );
  };

  const renderGroup = (group: PhotoGroup, index: number) => {
    const parentId = group.reference?.id ?? null;
    const designGenerating = isGroupGenerating(parentId, 'design');
    const priceGenerating = isGroupGenerating(parentId, 'price');
    const deleting = !!parentId && deletingGroupId === parentId;
    const hasReference = !!group.reference?.fileUrl;

    return (
      <View style={styles.groupCard} key={parentId || `default-${index}`}>
        <View style={styles.groupHeader}>
          <Text style={styles.groupTitle}>Grupo {index + 1}</Text>
          {hasReference &&
            (deleting ? (
              <ActivityIndicator size="small" color={theme.color.text.danger} />
            ) : (
              <TouchableOpacity onPress={() => handleDeleteGroup(group)}>
                <Text style={styles.groupDeleteText}>Eliminar</Text>
              </TouchableOpacity>
            ))}
        </View>

        <View style={styles.referenceDesignHeaderRow}>
          <TouchableOpacity
            style={[styles.geminiGenerateButton, designGenerating && styles.buttonDisabled]}
            onPress={() => openDesignModal(group)}
            disabled={designGenerating || !hasReference}
          >
            <Text style={styles.geminiGenerateButtonText}>
              {designGenerating ? 'Generando diseño…' : 'Generar diseño'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.priceDesignButton, priceGenerating && styles.buttonDisabled]}
            onPress={() => void openPricePhotoModal(group)}
            disabled={priceGenerating || !hasReference}
          >
            <Text style={styles.priceDesignButtonText}>
              {priceGenerating ? 'Generando datos…' : 'Agregar datos'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.photoTypesRow}>
          {(['reference', 'design', 'price'] as PhotoType[]).map((photoType) =>
            renderPhotoCard(group, photoType)
          )}
        </View>
      </View>
    );
  };

  const addingReference = photoUploadingKey === groupPhotoKey(null, 'reference');

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.managerCard]}>
            <View style={styles.managerHeader}>
              <View style={styles.managerHeaderMain}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {productTitle || 'Producto'}
                </Text>
                <Text style={styles.managerSubtitle}>
                  SKU: {productSku || '-'} · Grupos: {groups.length}
                </Text>
              </View>
              <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
                <Text style={styles.secondaryButtonText}>Cerrar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.managerScroll}
              contentContainerStyle={styles.managerScrollContent}
              showsVerticalScrollIndicator
            >
              {groups.length === 0 && !photosLoading && (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>
                    Aún no hay referencias. Agrega una para crear el primer grupo de fotos.
                  </Text>
                </View>
              )}

              {/* Fotos de referencia que ya existen (p. ej. de la validación de
                  la compra) pero que todavía no son assets de la campaña. Se
                  ofrecen para adoptarlas con un toque. */}
              {groups.length === 0 && !photosLoading && !!existingReferenceUrls?.length && (
                <View style={styles.suggestedBox}>
                  <Text style={styles.suggestedTitle}>
                    Este producto ya tiene {existingReferenceUrls.length}{' '}
                    {existingReferenceUrls.length === 1 ? 'foto' : 'fotos'} de la compra
                  </Text>
                  <Text style={styles.suggestedHint}>
                    Tócala para usarla como referencia y crear el grupo de fotos.
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.suggestedRow}
                  >
                    {existingReferenceUrls.map((url, idx) => {
                      const key = `${url}-${idx}`;
                      const adopting = photoUploadingKey === groupPhotoKey(null, 'reference');
                      return (
                        <TouchableOpacity
                          key={key}
                          style={styles.suggestedThumbWrap}
                          disabled={adopting}
                          onPress={() =>
                            useUrlAsReference(url, {
                              uploadKey: groupPhotoKey(null, 'reference'),
                            })
                          }
                        >
                          <Image
                            source={{ uri: url }}
                            style={styles.suggestedThumb}
                            resizeMode="cover"
                          />
                          <View style={styles.suggestedThumbBadge}>
                            <Text style={styles.suggestedThumbBadgeText}>Usar</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {groups.map((group, index) => renderGroup(group, index))}

              <TouchableOpacity
                style={[styles.addReferenceButton, addingReference && styles.buttonDisabled]}
                onPress={() =>
                  openReferencePicker({
                    uploadKey: groupPhotoKey(null, 'reference'),
                  })
                }
                disabled={addingReference}
              >
                {addingReference ? (
                  <ActivityIndicator size="small" color={theme.color.text.inverse} />
                ) : (
                  <Text style={styles.addReferenceButtonText}>+ Agregar referencia</Text>
                )}
              </TouchableOpacity>

              {!!effectiveCatalogUrl && (
                <TouchableOpacity
                  onPress={() =>
                    useCatalogForTarget({
                      uploadKey: groupPhotoKey(null, 'reference'),
                    })
                  }
                  disabled={addingReference}
                >
                  <Text style={styles.photoActionTextSecondary}>
                    Usar foto de catálogo como nueva referencia
                  </Text>
                </TouchableOpacity>
              )}

              {photosLoading && (
                <View style={styles.inlineLoadingRow}>
                  <ActivityIndicator size="small" color={theme.color.brand.accent} />
                  <Text style={styles.inlineLoadingText}>Cargando fotos...</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>

        {/* Design (Gemini) prompt modal */}
        <Modal visible={designModalVisible} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Crear foto de diseño con Gemini</Text>
                <Text style={styles.managerSubtitle}>Producto: {productTitle || productId}</Text>

                <Text style={styles.inputLabel}>Plantilla</Text>
                <View style={styles.templateRow}>
                  {DESIGN_PROMPT_TEMPLATES.map((template) => {
                    const selected = designTemplateKey === template.key;
                    return (
                      <TouchableOpacity
                        key={template.key}
                        style={[styles.templateChip, selected && styles.templateChipSelected]}
                        onPress={() => setDesignTemplateKey(template.key)}
                      >
                        <Text
                          style={[
                            styles.templateChipText,
                            selected && styles.templateChipTextSelected,
                          ]}
                        >
                          {template.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.inputLabel}>Presentación</Text>
                <View style={styles.templateRow}>
                  {PRESENTATION_OPTIONS.map((opt) => {
                    const selected = designPresentation === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[styles.templateChip, selected && styles.templateChipSelected]}
                        onPress={() => setDesignPresentation(opt.key)}
                      >
                        <Text
                          style={[
                            styles.templateChipText,
                            selected && styles.templateChipTextSelected,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.helperText}>
                  {PRESENTATION_OPTIONS.find((o) => o.key === designPresentation)?.description}
                </Text>

                <Text style={styles.inputLabel}>Empaque</Text>
                <View style={styles.templateRow}>
                  {PACKAGING_OPTIONS.map((opt) => {
                    const selected = designPackaging === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[styles.templateChip, selected && styles.templateChipSelected]}
                        onPress={() => setDesignPackaging(opt.key)}
                      >
                        <Text
                          style={[
                            styles.templateChipText,
                            selected && styles.templateChipTextSelected,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.helperText}>
                  {PACKAGING_OPTIONS.find((o) => o.key === designPackaging)?.description}
                </Text>

                <Text style={styles.inputLabel}>Ambiente</Text>
                <View style={styles.templateRow}>
                  {ENVIRONMENT_OPTIONS.map((opt) => {
                    const selected = designEnvironment === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[styles.templateChip, selected && styles.templateChipSelected]}
                        onPress={() => setDesignEnvironment(opt.key)}
                      >
                        <Text
                          style={[
                            styles.templateChipText,
                            selected && styles.templateChipTextSelected,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.helperText}>
                  {ENVIRONMENT_OPTIONS.find((o) => o.key === designEnvironment)?.description}
                </Text>
                {designEnvironment === 'custom' && (
                  <TextInput
                    style={[styles.input, styles.multilineSmall]}
                    multiline
                    value={designEnvironmentCustom}
                    onChangeText={setDesignEnvironmentCustom}
                    placeholder="Ej: taller de carpintería con virutas de madera y luz de tarde..."
                    placeholderTextColor={theme.color.text.placeholder}
                  />
                )}

                <Text style={styles.inputLabel}>Observaciones adicionales</Text>
                <TextInput
                  style={[styles.input, styles.multilineSmall]}
                  multiline
                  value={designObservations}
                  onChangeText={setDesignObservations}
                  placeholder="Ej: fondo blanco, mostrar la tapa abierta, resaltar el logo..."
                  placeholderTextColor={theme.color.text.placeholder}
                />

                <View style={styles.promptHeaderRow}>
                  <Text style={styles.inputLabel}>Prompt de diseño</Text>
                  {designPromptDirty && (
                    <TouchableOpacity
                      onPress={() => {
                        setDesignPromptDirty(false);
                        setDesignPrompt(
                          buildDesignPrompt({
                            templateKey: designTemplateKey,
                            packaging: designPackaging,
                            presentation: designPresentation,
                            environment: designEnvironment,
                            environmentCustom: designEnvironmentCustom,
                            observations: designObservations,
                          })
                        );
                      }}
                    >
                      <Text style={styles.promptResetLink}>↻ Regenerar desde configuración</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TextInput
                  style={[styles.input, styles.multiline]}
                  multiline
                  value={designPrompt}
                  onChangeText={(value) => {
                    setDesignPrompt(value);
                    setDesignPromptDirty(true);
                  }}
                  placeholder="Describe cómo quieres generar la foto de diseño..."
                  placeholderTextColor={theme.color.text.placeholder}
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => setDesignModalVisible(false)}
                  >
                    <Text style={styles.secondaryButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => {
                      const prompt = designPrompt;
                      setDesignModalVisible(false);
                      void handleGenerateDesignInBackground(prompt);
                    }}
                  >
                    <Text style={styles.primaryButtonText}>Generar diseño</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </Modal>

        {/* Price photo (ad-design) modal */}
        <Modal visible={pricePhotoModalVisible} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Diseño con precio</Text>
                <Text style={styles.managerSubtitle}>Producto: {productTitle || productId}</Text>

                <Text style={styles.inputLabel}>Nombre</Text>
                <TextInput
                  style={styles.input}
                  value={pricePhotoForm.name}
                  onChangeText={(value) => setPricePhotoForm((prev) => ({ ...prev, name: value }))}
                  placeholder="Nombre"
                  placeholderTextColor={theme.color.text.placeholder}
                />
                <Text style={styles.inputLabel}>SKU</Text>
                <TextInput
                  style={styles.input}
                  value={pricePhotoForm.sku}
                  onChangeText={(value) => setPricePhotoForm((prev) => ({ ...prev, sku: value }))}
                  placeholder="SKU"
                  placeholderTextColor={theme.color.text.placeholder}
                />

                <Text style={styles.inputLabel}>Perfil de precio</Text>
                {priceProfilesLoading ? (
                  <View style={styles.inlineLoadingRow}>
                    <ActivityIndicator size="small" color={theme.color.brand.accent} />
                    <Text style={styles.inlineLoadingText}>Cargando perfiles...</Text>
                  </View>
                ) : (
                  <View style={styles.templateRow}>
                    {priceProfiles.map((profile) => {
                      const selected = pricePhotoForm.profileId === profile.id;
                      return (
                        <TouchableOpacity
                          key={profile.id}
                          style={[styles.templateChip, selected && styles.templateChipSelected]}
                          onPress={() => {
                            const matchedPrice = priceSalePrices.find(
                              (sp) => sp.profileId === profile.id && sp.presentationId === null
                            );
                            setPricePhotoForm((prev) => ({
                              ...prev,
                              profileId: profile.id,
                              price: matchedPrice
                                ? (matchedPrice.priceCents / 100).toFixed(2)
                                : prev.price,
                            }));
                          }}
                        >
                          <Text
                            style={[
                              styles.templateChipText,
                              selected && styles.templateChipTextSelected,
                            ]}
                          >
                            {profile.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                <Text style={styles.inputLabel}>Precio</Text>
                <TextInput
                  style={styles.input}
                  value={pricePhotoForm.price}
                  keyboardType="numeric"
                  onChangeText={(value) => setPricePhotoForm((prev) => ({ ...prev, price: value }))}
                  placeholder="Precio"
                  placeholderTextColor={theme.color.text.placeholder}
                />

                <Text style={styles.inputLabel}>Template</Text>
                <View style={styles.templateRow}>
                  {(['promo', 'premium', 'minimal'] as AdDesignTemplate[]).map((templateKey) => {
                    const selected = pricePhotoForm.template === templateKey;
                    return (
                      <TouchableOpacity
                        key={templateKey}
                        style={[styles.templateChip, selected && styles.templateChipSelected]}
                        onPress={() =>
                          setPricePhotoForm((prev) => ({ ...prev, template: templateKey }))
                        }
                      >
                        <Text
                          style={[
                            styles.templateChipText,
                            selected && styles.templateChipTextSelected,
                          ]}
                        >
                          {templateKey}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.secondaryButton} onPress={resetPriceState}>
                    <Text style={styles.secondaryButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => void handleGeneratePriceInBackground()}
                  >
                    <Text style={styles.primaryButtonText}>Generar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </Modal>

        {/* Image viewer (pager) */}
        <Modal
          visible={imageViewerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => {
            resetImageViewerTransform();
            setImageViewerVisible(false);
          }}
        >
          <View style={styles.imageViewerBackdrop}>
            <View style={styles.imageViewerHeader}>
              <Text style={styles.imageViewerTitle}>
                {currentViewerPhoto?.title || ''}
                {viewerPhotos.length > 1 ? `  (${viewerIndex + 1}/${viewerPhotos.length})` : ''}
              </Text>
              <TouchableOpacity
                style={styles.imageViewerCloseButton}
                onPress={() => {
                  resetImageViewerTransform();
                  setImageViewerVisible(false);
                }}
              >
                <Text style={styles.imageViewerCloseText}>Cerrar</Text>
              </TouchableOpacity>
            </View>

            <GestureHandlerRootView style={styles.imageViewerContent}>
              <GestureDetector gesture={imageViewerGesture}>
                <Animated.View style={styles.imageViewerImageWrap}>
                  {currentViewerPhoto ? (
                    <Animated.Image
                      source={{ uri: currentViewerPhoto.uri }}
                      style={[styles.imageViewerImage, imageViewerAnimatedStyle]}
                      resizeMode="contain"
                    />
                  ) : null}
                </Animated.View>
              </GestureDetector>

              {viewerPhotos.length > 1 && (
                <>
                  <TouchableOpacity
                    style={[styles.imageViewerNav, styles.imageViewerNavLeft]}
                    onPress={() => goToViewerIndex(viewerIndex - 1)}
                    disabled={viewerIndex <= 0}
                  >
                    <Text
                      style={[
                        styles.imageViewerNavText,
                        viewerIndex <= 0 && styles.imageViewerNavTextDisabled,
                      ]}
                    >
                      ‹
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.imageViewerNav, styles.imageViewerNavRight]}
                    onPress={() => goToViewerIndex(viewerIndex + 1)}
                    disabled={viewerIndex >= viewerPhotos.length - 1}
                  >
                    <Text
                      style={[
                        styles.imageViewerNavText,
                        viewerIndex >= viewerPhotos.length - 1 && styles.imageViewerNavTextDisabled,
                      ]}
                    >
                      ›
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </GestureHandlerRootView>
          </View>
        </Modal>

        {/* Recorte manual 1:1 */}
        <ImageCropModal
          visible={!!cropState}
          imageUri={cropState?.uri ?? null}
          title="Encuadrar producto"
          onCancel={() => setCropState(null)}
          onConfirm={(uri) => void handleCropConfirm(uri)}
        />
      </Modal>
    </>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    modalBackdrop: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.space[4],
    },
    modalScroll: {
      width: '100%',
    },
    modalScrollContent: {
      alignItems: 'center',
      paddingVertical: theme.space[4],
    },
    modalCard: {
      width: '100%',
      maxWidth: 560,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.surface.base,
      padding: theme.space[3.5],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      ...theme.shadow.md,
    },
    managerCard: {
      maxWidth: 640,
      maxHeight: '90%',
    },
    managerScroll: {
      flexGrow: 0,
    },
    managerScrollContent: {
      paddingBottom: theme.space[2],
    },
    managerHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: theme.space[3],
    },
    managerHeaderMain: {
      flex: 1,
      marginRight: theme.space[2],
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    managerSubtitle: {
      marginTop: theme.space[1],
      color: theme.color.text.muted,
      fontSize: 12,
    },
    inputLabel: {
      marginTop: theme.space[0.5],
      marginBottom: theme.space[1.5],
      color: theme.color.text.muted,
      fontSize: 12,
      fontWeight: '600',
    },
    input: {
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.background.subtle,
      color: theme.color.text.body,
      paddingHorizontal: theme.space[2.5],
      paddingVertical: theme.space[2],
      marginBottom: theme.space[2],
    },
    multiline: {
      minHeight: 120,
      textAlignVertical: 'top',
    },
    multilineSmall: {
      minHeight: 60,
      textAlignVertical: 'top',
    },
    helperText: {
      fontSize: 11,
      color: theme.color.text.muted,
      marginBottom: theme.space[2],
      marginTop: -theme.space[1],
    },
    promptHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    promptResetLink: {
      fontSize: 12,
      color: theme.color.brand.accent,
      fontWeight: '600',
    },
    groupCard: {
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      borderRadius: theme.radii.md,
      padding: theme.space[2.5],
      marginBottom: theme.space[3],
      backgroundColor: theme.color.surface.base,
    },
    groupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.space[2],
    },
    groupTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    groupDeleteText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.color.text.danger,
    },
    emptyBox: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.md,
      padding: theme.space[3],
      marginBottom: theme.space[3],
    },
    emptyText: {
      fontSize: 12,
      color: theme.color.text.muted,
      textAlign: 'center',
    },
    suggestedBox: {
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.md,
      padding: theme.space[3],
      marginBottom: theme.space[3],
      backgroundColor: theme.color.surface.subtle,
    },
    suggestedTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    suggestedHint: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginTop: theme.space[1],
      marginBottom: theme.space[2],
    },
    suggestedRow: {
      gap: theme.space[2],
      paddingVertical: theme.space[1],
    },
    suggestedThumbWrap: {
      width: 96,
      height: 96,
      borderRadius: theme.radii.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.surface.base,
    },
    suggestedThumb: {
      width: '100%',
      height: '100%',
    },
    suggestedThumbBadge: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.color.brand.accent,
      alignItems: 'center',
      paddingVertical: theme.space[1],
    },
    suggestedThumbBadgeText: {
      color: theme.color.text.inverse,
      fontSize: 11,
      fontWeight: '700',
    },
    referenceDesignHeaderRow: {
      flexDirection: 'row',
      gap: theme.space[2],
      marginBottom: theme.space[3],
    },
    geminiGenerateButton: {
      flex: 1,
      paddingVertical: theme.space[2.5],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.brand.accent,
      alignItems: 'center',
    },
    geminiGenerateButtonText: {
      color: theme.color.text.inverse,
      fontWeight: '700',
      fontSize: 12,
    },
    priceDesignButton: {
      flex: 1,
      paddingVertical: theme.space[2.5],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.surface.subtle,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    priceDesignButtonText: {
      color: theme.color.text.heading,
      fontWeight: '700',
      fontSize: 12,
    },
    addReferenceButton: {
      paddingVertical: theme.space[2.5],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.brand.accent,
      alignItems: 'center',
      marginTop: theme.space[1],
    },
    addReferenceButtonText: {
      color: theme.color.text.inverse,
      fontWeight: '700',
      fontSize: 13,
    },
    photoTypesRow: {
      flexDirection: 'row',
      gap: theme.space[2],
    },
    photoTypeCard: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      borderRadius: theme.radii.md,
      padding: theme.space[2],
      alignItems: 'center',
      backgroundColor: theme.color.background.subtle,
    },
    photoTypeLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: theme.space[1.5],
    },
    photoTouchArea: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: theme.radii.sm,
      overflow: 'hidden',
    },
    photoThumb: {
      width: '100%',
      height: '100%',
    },
    photoMissingBox: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: theme.radii.sm,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: theme.color.border.default,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.space[1],
    },
    photoMissingText: {
      fontSize: 11,
      color: theme.color.text.placeholder,
      textAlign: 'center',
    },
    photoActionText: {
      marginTop: theme.space[1.5],
      fontSize: 12,
      fontWeight: '700',
      color: theme.color.brand.accent,
      textAlign: 'center',
    },
    photoActionIndicator: {
      marginTop: theme.space[1.5],
    },
    photoActionTextSecondary: {
      marginTop: theme.space[1],
      marginBottom: theme.space[1],
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.brand.accent,
      textAlign: 'center',
    },
    photoActionTextMuted: {
      marginTop: theme.space[1.5],
      fontSize: 10,
      color: theme.color.text.muted,
      textAlign: 'center',
    },
    photoActionInline: {
      marginTop: theme.space[1.5],
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[1.5],
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    inlineLoadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      marginTop: theme.space[2.5],
    },
    inlineLoadingText: {
      color: theme.color.text.muted,
      fontSize: 12,
    },
    templateRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[2],
      marginBottom: theme.space[2],
    },
    templateChip: {
      paddingVertical: theme.space[1.5],
      paddingHorizontal: theme.space[2.5],
      borderRadius: theme.radii.full,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.surface.base,
    },
    templateChipSelected: {
      borderColor: theme.color.brand.accent,
      backgroundColor: theme.color.brand.accentSoft,
    },
    templateChipText: {
      fontSize: 12,
      color: theme.color.text.body,
    },
    templateChipTextSelected: {
      color: theme.color.brand.accent,
      fontWeight: '700',
    },
    modalActions: {
      marginTop: theme.space[2],
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: theme.space[2],
    },
    primaryButton: {
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[3],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.brand.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: {
      color: theme.color.text.inverse,
      fontWeight: '700',
      fontSize: 12,
    },
    secondaryButton: {
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[3],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.surface.subtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryButtonText: {
      color: theme.color.text.heading,
      fontWeight: '700',
      fontSize: 12,
    },
    imageViewerBackdrop: {
      flex: 1,
      backgroundColor: theme.color.overlay.strong,
    },
    imageViewerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
    },
    imageViewerTitle: {
      color: theme.color.text.inverse,
      fontSize: 16,
      fontWeight: '700',
    },
    imageViewerCloseButton: {
      paddingVertical: theme.space[1.5],
      paddingHorizontal: theme.space[3],
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.surface.subtle,
    },
    imageViewerCloseText: {
      color: theme.color.text.heading,
      fontWeight: '700',
      fontSize: 12,
    },
    imageViewerContent: {
      flex: 1,
    },
    imageViewerImageWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    imageViewerImage: {
      width: '100%',
      height: '100%',
    },
    imageViewerNav: {
      position: 'absolute',
      top: '50%',
      marginTop: -24,
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.color.overlay.strong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    imageViewerNavLeft: {
      left: theme.space[3],
    },
    imageViewerNavRight: {
      right: theme.space[3],
    },
    imageViewerNavText: {
      color: theme.color.text.inverse,
      fontSize: 30,
      fontWeight: '700',
      lineHeight: 34,
    },
    imageViewerNavTextDisabled: {
      opacity: 0.3,
    },
  });

export default ProductPhotoManagerModal;
