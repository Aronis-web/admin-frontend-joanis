/**
 * Promociones · Packs
 *
 * Un pack agrupa varios productos (cada uno con su cantidad) que se venden
 * juntos a un precio de pack, en caja (POS) y/o por el chatbot.
 */

export interface PackComponent {
  productId: string;
  sku: string | null;
  name: string;
  quantity: number;
  /** Precio normal por unidad (nivel Público), en centavos. */
  referenceUnitPriceCents: number;
}

export interface AdminPackView {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  /** Suma de precios normales de un pack (nivel Público), en centavos. */
  referenceTotalCents: number;
  imageUrl: string | null;
  validFrom: string | null;
  validTo: string | null;
  components: PackComponent[];
  isActive: boolean;
  availablePos: boolean;
  availableChatbot: boolean;
  hideUnitsChatbot: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PackPreviewLine {
  productId: string;
  sku: string | null;
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  referenceUnitPriceCents: number;
}

export interface PackPreview {
  pack: Partial<AdminPackView> & { id: string; name: string; priceCents: number };
  priceProfileId: string | null;
  lines: PackPreviewLine[];
}

export interface PackItemInput {
  productId: string;
  quantity: number;
}

export interface CreatePackBody {
  name: string;
  description?: string | null;
  priceCents: number;
  availablePos: boolean;
  availableChatbot: boolean;
  hideUnitsChatbot?: boolean;
  isActive?: boolean;
  validFrom?: string | null;
  validTo?: string | null;
  imageUrl?: string | null;
  items: PackItemInput[];
}

export type UpdatePackBody = Partial<CreatePackBody>;
