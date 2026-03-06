// Site Contacts Types and Interfaces

export enum SiteNotificationType {
  TRASLADOS = 'TRASLADOS',
  MARCADORES = 'MARCADORES',
  FALTANTES = 'FALTANTES',
  INVENTARIO = 'INVENTARIO',
  REPARTOS = 'REPARTOS',
  ALERTAS_GENERALES = 'ALERTAS_GENERALES',
}

export interface SiteContact {
  id: string;
  siteId: string;
  contactName: string;
  phoneNumber: string;
  email?: string;
  notificationTypes: SiteNotificationType[];
  receiveWhatsApp: boolean;
  receiveEmail: boolean;
  isActive: boolean;
  position?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSiteContactRequest {
  contactName: string;
  phoneNumber: string;
  email?: string;
  notificationTypes: SiteNotificationType[];
  receiveWhatsApp?: boolean;
  receiveEmail?: boolean;
  position?: string;
  notes?: string;
}

export interface UpdateSiteContactRequest {
  contactName?: string;
  phoneNumber?: string;
  email?: string;
  notificationTypes?: SiteNotificationType[];
  receiveWhatsApp?: boolean;
  receiveEmail?: boolean;
  isActive?: boolean;
  position?: string;
  notes?: string;
}

export interface GetSiteContactsParams {
  siteId?: string;
  isActive?: boolean;
  notificationType?: SiteNotificationType;
  q?: string;
}

export interface SiteContactsSummary {
  totalContacts: number;
  activeContacts: number;
  contactsByType: Record<SiteNotificationType, number>;
}
