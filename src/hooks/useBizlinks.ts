import { useState, useCallback } from 'react';
import { bizlinksApi } from '../services/api';
import {
  BizlinksConfig,
  BizlinksDocument,
  CreateBizlinksConfigDto,
  UpdateBizlinksConfigDto,
  EmitirFacturaDto,
  GetBizlinksConfigsParams,
  GetBizlinksDocumentsParams,
  BizlinksDocumentType,
} from '../types/bizlinks';

// ============================================
// BIZLINKS HOOKS
// ============================================

// Hook for Bizlinks Configuration
export const useBizlinksConfig = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getConfigs = useCallback(async (params?: GetBizlinksConfigsParams) => {
    setLoading(true);
    setError(null);
    try {
      const configs = await bizlinksApi.getConfigs(params);
      return configs;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Error al obtener configuraciones';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getConfigById = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const config = await bizlinksApi.getConfigById(id);
      return config;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Error al obtener configuración';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getConfigsByCompany = useCallback(async (companyId: string) => {
    setLoading(true);
    setError(null);
    try {
      const configs = await bizlinksApi.getConfigsByCompany(companyId);
      return configs;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Error al obtener configuraciones';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getActiveConfig = useCallback(async (companyId: string, siteId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const config = await bizlinksApi.getActiveConfig(companyId, siteId);
      return config;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Error al obtener configuración activa';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createConfig = useCallback(async (data: CreateBizlinksConfigDto) => {
    setLoading(true);
    setError(null);
    try {
      const config = await bizlinksApi.createConfig(data);
      return config;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Error al crear configuración';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateConfig = useCallback(async (id: string, data: UpdateBizlinksConfigDto) => {
    setLoading(true);
    setError(null);
    try {
      const config = await bizlinksApi.updateConfig(id, data);
      return config;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Error al actualizar configuración';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteConfig = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await bizlinksApi.deleteConfig(id);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Error al eliminar configuración';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const testConnection = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await bizlinksApi.testConnection(id);
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Error al probar conexión';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getConfigs,
    getConfigById,
    getConfigsByCompany,
    getActiveConfig,
    createConfig,
    updateConfig,
    deleteConfig,
    testConnection,
  };
};

// Hook for Bizlinks Documents
export const useBizlinksDocuments = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getDocuments = useCallback(async (params?: GetBizlinksDocumentsParams) => {
    setLoading(true);
    setError(null);
    try {
      const documents = await bizlinksApi.getDocuments(params);
      return documents;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Error al obtener documentos';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getDocumentById = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const document = await bizlinksApi.getDocumentById(id);
      return document;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Error al obtener documento';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getDocumentBySerieNumero = useCallback(async (serieNumero: string) => {
    setLoading(true);
    setError(null);
    try {
      const document = await bizlinksApi.getDocumentBySerieNumero(serieNumero);
      return document;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Error al obtener documento';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const emitirFactura = useCallback(async (data: EmitirFacturaDto) => {
    setLoading(true);
    setError(null);
    try {
      const document = await bizlinksApi.emitirFactura(data);
      return document;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Error al emitir factura';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Método genérico para emitir cualquier tipo de comprobante
  const emitirComprobante = useCallback(async (data: EmitirFacturaDto, documentType: string) => {
    setLoading(true);
    setError(null);
    try {
      let document: BizlinksDocument;

      switch (documentType) {
        case BizlinksDocumentType.FACTURA:
          document = await bizlinksApi.emitirFactura(data);
          break;
        case BizlinksDocumentType.BOLETA:
          document = await bizlinksApi.emitirBoleta(data);
          break;
        case BizlinksDocumentType.NOTA_CREDITO:
          document = await bizlinksApi.emitirNotaCredito(data);
          break;
        case BizlinksDocumentType.NOTA_DEBITO:
          document = await bizlinksApi.emitirNotaDebito(data);
          break;
        case BizlinksDocumentType.GUIA_REMISION_REMITENTE:
          document = await bizlinksApi.emitirGuiaRemision(data);
          break;
        default:
          throw new Error(`Tipo de documento no soportado: ${documentType}`);
      }

      return document;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Error al emitir comprobante';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshDocumentStatus = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const document = await bizlinksApi.refreshDocumentStatus(id);
      return document;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Error al actualizar estado';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const downloadArtifacts = useCallback(async (id: string, options?: { downloadPdf?: boolean; downloadXml?: boolean; downloadCdr?: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      const document = await bizlinksApi.downloadArtifacts(id, options);
      return document;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Error al descargar archivos';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const sendToSunat = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const document = await bizlinksApi.sendToSunat(id);
      return document;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Error al enviar a SUNAT';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const voidDocument = useCallback(async (id: string, reason: string) => {
    setLoading(true);
    setError(null);
    try {
      const document = await bizlinksApi.voidDocument(id, reason);
      return document;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Error al anular documento';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getDocumentLogs = useCallback(async (documentId: string) => {
    setLoading(true);
    setError(null);
    try {
      const logs = await bizlinksApi.getDocumentLogs(documentId);
      return logs;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Error al obtener logs';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getDocuments,
    getDocumentById,
    getDocumentBySerieNumero,
    emitirFactura,
    emitirComprobante,
    refreshDocumentStatus,
    downloadArtifacts,
    sendToSunat,
    voidDocument,
    getDocumentLogs,
  };
};

// Hook for Bizlinks Utilities
export const useBizlinksUtils = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateRuc = useCallback(async (ruc: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await bizlinksApi.validateRuc(ruc);
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Error al validar RUC';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getUbigeoInfo = useCallback(async (code: string) => {
    setLoading(true);
    setError(null);
    try {
      const info = await bizlinksApi.getUbigeoInfo(code);
      return info;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Error al obtener información de ubigeo';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    validateRuc,
    getUbigeoInfo,
  };
};
