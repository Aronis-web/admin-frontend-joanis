import { apiClient } from './client';

/**
 * Cash Reconciliation API Service
 * Handles all cash reconciliation related API calls
 */

// ==================== Types ====================

export interface CuadreVentas {
  efectivo: number;
  tarjeta: number;
  total: number;
  cantidad_operaciones: number;
}

export interface CuadreIzipay {
  bruto: number;
  comisiones: number;
  neto: number;
  cantidad_operaciones: number;
  transacciones_matcheadas: number;
  porcentaje_comision_promedio: number;
}

export interface CuadreProsegur {
  depositos: number;
  balances: number;
  cantidad_operaciones: number;
  cantidad_depositos: number;
  cantidad_recogidas: number;
}

export interface CuadreInfo {
  diferencia_efectivo: number;
  diferencia_tarjeta_bruto: number;
  porcentaje_diferencia_efectivo: number;
  porcentaje_diferencia_tarjeta: number;
  tiene_discrepancias: boolean;
  severidad: 'ninguna' | 'baja' | 'media' | 'alta' | 'critica';
}

export interface CuadreTotales {
  total_ventas: number;
  total_a_pagar: number;
  total_comisiones: number;
  total_ingresos_neto: number;
  diferencia_total: number;
}

export interface CuadreOperaciones {
  ventas: number;
  izipay: number;
  prosegur: number;
  coinciden: boolean;
  diferencia_operaciones: number;
}

export interface SedeInfo {
  id: string;
  code: string;
  name: string;
}

export interface CuadreCajaResponse {
  fecha_inicio: string;
  fecha_fin: string;
  sedes: SedeInfo[];
  ventas: CuadreVentas;
  izipay: CuadreIzipay;
  prosegur: CuadreProsegur;
  cuadre: CuadreInfo;
  totales: CuadreTotales;
  operaciones: CuadreOperaciones;
  generado_en: string;
}

export interface CuadrePorSede {
  sede: SedeInfo;
  ventas: CuadreVentas;
  izipay: CuadreIzipay;
  prosegur: CuadreProsegur;
  cuadre: CuadreInfo;
  totales: CuadreTotales;
  operaciones: CuadreOperaciones;
}

export interface CuadreAgrupadoResponse {
  fecha_inicio: string;
  fecha_fin: string;
  totales_consolidados: {
    ventas: CuadreVentas;
    izipay: CuadreIzipay;
    prosegur: CuadreProsegur;
    cuadre: CuadreInfo;
    totales: CuadreTotales;
    operaciones: CuadreOperaciones;
  };
  detalle_por_sede: CuadrePorSede[];
  generado_en: string;
}

export interface CuadreCajaParams {
  fecha_inicio: string;
  fecha_fin: string;
  sede_id?: string;
  sede_code?: string;
  agrupar_por_sede?: boolean;
}

// ==================== API Service ====================

class CashReconciliationApi {
  private basePath = '/cash-reconciliation';

  /**
   * Get cash reconciliation report (cuadre de caja)
   * @param params - Query parameters for the report
   * @returns Cash reconciliation report
   */
  async getCuadreCaja(
    params: CuadreCajaParams
  ): Promise<CuadreCajaResponse | CuadreAgrupadoResponse> {
    const queryParams: Record<string, string> = {
      fecha_inicio: params.fecha_inicio,
      fecha_fin: params.fecha_fin,
    };

    if (params.sede_id) {
      queryParams.sede_id = params.sede_id;
    }

    if (params.sede_code) {
      queryParams.sede_code = params.sede_code;
    }

    if (params.agrupar_por_sede !== undefined) {
      queryParams.agrupar_por_sede = params.agrupar_por_sede.toString();
    }

    return apiClient.get<CuadreCajaResponse | CuadreAgrupadoResponse>(
      `${this.basePath}/cuadre-caja`,
      { params: queryParams }
    );
  }
}

export const cashReconciliationApi = new CashReconciliationApi();
