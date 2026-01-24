import { purchasesService } from '@/services/api';
import { useOcrScannerStore, ScanJob, OcrScannedProduct } from '@/store/ocrScanner';
import logger from '@/utils/logger';
import { Alert } from 'react-native';

/**
 * Servicio para procesar la cola de trabajos de escaneo OCR en segundo plano
 * Permite múltiples escaneos simultáneos en diferentes compras
 */
class OcrScanQueueService {
  private isProcessing = false;
  private maxConcurrentJobs = 3; // Máximo de trabajos simultáneos

  /**
   * Inicia el procesamiento de la cola de trabajos
   */
  async startProcessing() {
    if (this.isProcessing) {
      logger.debug('⚙️ Queue processor already running');
      return;
    }

    this.isProcessing = true;
    logger.debug('🚀 Starting OCR scan queue processor');

    // Limpiar trabajos huérfanos (que quedaron en 'scanning' por cierre abrupto)
    const store = useOcrScannerStore.getState();
    const orphanedJobs = store.scanJobs.filter(
      (job) => job.status === 'scanning' && (!job.startedAt || Date.now() - job.startedAt > 300000) // 5 minutos
    );
    orphanedJobs.forEach((job) => {
      logger.debug(`🧹 Cleaning orphaned job ${job.id}`);
      store.updateScanJob(job.id, {
        status: 'failed',
        error: 'Job was interrupted',
        completedAt: Date.now(),
      });
    });

    while (this.isProcessing) {
      const store = useOcrScannerStore.getState();
      const pendingJobs = store.scanJobs.filter((job) => job.status === 'pending');
      const scanningJobs = store.scanJobs.filter((job) => job.status === 'scanning');

      // Si hay espacio para más trabajos, procesar los pendientes
      if (scanningJobs.length < this.maxConcurrentJobs && pendingJobs.length > 0) {
        const jobsToProcess = pendingJobs.slice(0, this.maxConcurrentJobs - scanningJobs.length);

        // Procesar trabajos en paralelo sin esperar (fire and forget)
        jobsToProcess.forEach((job) => {
          this.processJob(job).catch((error) => {
            logger.error(`❌ Unhandled error in job ${job.id}:`, error);
          });
        });
      }

      // Si no hay trabajos activos, detener el procesador
      const activeJobs = store.getActiveScanJobs();
      if (activeJobs.length === 0) {
        logger.debug('✅ No active jobs, stopping queue processor');
        this.isProcessing = false;
        break;
      }

      // Esperar un poco antes de verificar nuevamente
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  /**
   * Detiene el procesamiento de la cola
   */
  stopProcessing() {
    this.isProcessing = false;
    logger.debug('⏹️ Stopping OCR scan queue processor');
  }

  /**
   * Procesa un trabajo de escaneo individual
   */
  private async processJob(job: ScanJob): Promise<void> {
    const store = useOcrScannerStore.getState();

    try {
      logger.debug(`📄 Processing scan job ${job.id} for purchase ${job.purchaseId}`);

      // Marcar como en proceso
      store.updateScanJob(job.id, {
        status: 'scanning',
        startedAt: Date.now(),
      });

      // Preparar archivos para el escaneo
      const files = job.files.map((file) => ({
        uri: file.uri,
        filename: file.name,
        mimeType: file.mimeType,
      }));

      logger.debug(`📤 Sending ${files.length} files to OCR service (batch mode)`);

      let data: any;
      let usedFallback = false;

      try {
        // Intentar procesamiento por lotes primero (más rápido)
        data = await purchasesService.scanDocuments(files, job.observaciones || undefined);
      } catch (batchError: any) {
        logger.error('❌ Batch processing failed:', {
          error: batchError.message,
          isTimeout: batchError.isTimeout,
          status: batchError.status,
        });

        // Si hay timeout, usar procesamiento secuencial
        if (batchError.isTimeout || batchError.status === 524) {
          logger.debug('🔄 Falling back to sequential processing...');
          usedFallback = true;

          // Procesar archivos uno por uno con progreso
          data = await purchasesService.scanDocumentsSequentially(
            files,
            job.observaciones || undefined,
            (current, total, filename) => {
              store.updateScanJob(job.id, {
                progress: { current, total, filename },
              });
            }
          );
        } else {
          throw batchError;
        }
      }

      logger.debug('📥 OCR Response received:', {
        jobId: job.id,
        itemsCount: data?.items?.length || 0,
        archivos_procesados: data?.archivos_procesados,
        total_estimado: data?.total_estimado,
        usedFallback,
      });

      // Validar respuesta
      if (!data || !data.items || !Array.isArray(data.items)) {
        throw new Error('Respuesta inválida del servidor');
      }

      // Normalizar productos
      const editableProducts = data.items.map((raw: any, index: number) => ({
        id: `temp-${Date.now()}-${index}`,
        sku: raw?.sku?.trim() || '',
        nombre: raw?.nombre?.trim() || '',
        cajas: Math.max(0, Number(raw?.cajas) || 0),
        unidades_por_caja: Math.max(1, Number(raw?.unidades_por_caja) || 1),
        cantidad_total: 0,
        precio_unitario: Math.max(0, Number(raw?.precio_unitario) || 0),
        subtotal_fila: 0,
      }));

      // Calcular cantidad_total y subtotal
      editableProducts.forEach((p: any) => {
        p.cantidad_total = p.cajas * p.unidades_por_caja;
        p.subtotal_fila = p.cantidad_total * p.precio_unitario;
      });

      // Guardar productos en el store
      const productsToSave: OcrScannedProduct[] = editableProducts.map((p: any) => ({
        ...p,
        purchaseId: job.purchaseId,
        scannedAt: Date.now(),
      }));

      store.addScannedProducts(productsToSave, job.purchaseId);

      // Marcar trabajo como completado
      store.updateScanJob(job.id, {
        status: 'completed',
        completedAt: Date.now(),
        result: data,
        progress: null,
      });

      logger.debug(
        `✅ Job ${job.id} completed successfully. Detected ${editableProducts.length} products`
      );

      // Mostrar notificación de éxito
      const processingMethod = usedFallback
        ? 'procesamiento secuencial'
        : 'procesamiento por lotes';
      Alert.alert(
        '✅ Escaneo Completado',
        `Compra: ${job.purchaseId}\n\nSe detectaron ${editableProducts.length} productos de ${data.archivos_procesados} archivo(s) usando ${processingMethod}.\n\nTotal estimado: S/ ${data.total_estimado?.toFixed(2) || '0.00'}\n\nLos productos están listos para revisar.`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Limpiar el trabajo después de 2 segundos de cerrar la alerta
              setTimeout(() => {
                store.removeScanJob(job.id);
                logger.debug(`🧹 Removed completed job ${job.id} from queue`);
              }, 2000);
            },
          },
        ]
      );
    } catch (error: any) {
      logger.error(`❌ Error processing job ${job.id}:`, {
        error: error.message,
        errorStack: error.stack,
        purchaseId: job.purchaseId,
      });

      // Marcar trabajo como fallido
      store.updateScanJob(job.id, {
        status: 'failed',
        completedAt: Date.now(),
        error: error.message || 'Error desconocido',
        progress: null,
      });

      // Mostrar notificación de error
      Alert.alert(
        '❌ Error en Escaneo',
        `Compra: ${job.purchaseId}\n\nNo se pudo completar el escaneo: ${error.message || 'Error desconocido'}`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Limpiar el trabajo fallido después de 2 segundos de cerrar la alerta
              setTimeout(() => {
                store.removeScanJob(job.id);
                logger.debug(`🧹 Removed failed job ${job.id} from queue`);
              }, 2000);
            },
          },
        ]
      );
    }
  }

  /**
   * Agrega un nuevo trabajo a la cola y comienza el procesamiento
   */
  async addJob(job: ScanJob) {
    const store = useOcrScannerStore.getState();
    store.addScanJob(job);

    logger.debug(`➕ Added scan job ${job.id} to queue for purchase ${job.purchaseId}`);

    // Iniciar procesamiento si no está corriendo
    if (!this.isProcessing) {
      this.startProcessing();
    }
  }

  /**
   * Obtiene el estado de un trabajo
   */
  getJobStatus(jobId: string): ScanJob | undefined {
    const store = useOcrScannerStore.getState();
    return store.scanJobs.find((job) => job.id === jobId);
  }

  /**
   * Limpia trabajos completados o fallidos
   */
  clearCompletedJobs() {
    const store = useOcrScannerStore.getState();
    store.clearCompletedJobs();
    logger.debug('🧹 Cleared completed and failed jobs');
  }
}

// Exportar instancia singleton
export const ocrScanQueue = new OcrScanQueueService();
