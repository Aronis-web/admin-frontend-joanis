// Participant Totals Types

/**
 * Product detail in participant totals
 */
export interface ParticipantTotalsProduct {
  productId: string;
  sku: string;
  productName: string;
  totalQuantityBase: number;
  costCents: number;
  purchaseTotalCents: number;
  salePriceCents: number;
  saleTotalCents: number;
  isPreliminary: boolean;
}

/**
 * Participant summary with totals
 */
export interface ParticipantTotalsDetail {
  participantId: string;
  participantType: 'EXTERNAL_COMPANY' | 'INTERNAL_SITE';
  participantName: string;
  priceProfileId: string | null;
  priceProfileName: string | null;
  totalPurchaseCents: number;
  totalSaleCents: number;
  marginCents: number;
  marginPercentage: number;
  products: ParticipantTotalsProduct[];
}

/**
 * Campaign participant totals response
 */
export interface ParticipantTotalsResponse {
  campaignId: string;
  campaignCode: string;
  campaignName: string;
  totalPurchaseCents: number;
  totalSaleCents: number;
  totalMarginCents: number;
  totalMarginPercentage: number;
  participants: ParticipantTotalsDetail[];
}
