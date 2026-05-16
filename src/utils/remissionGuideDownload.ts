import { Alert } from 'react-native';
import { RemissionGuide } from '@/types/transfers';
import { transfersApi } from '@/services/api/transfers';
import { saveAndSharePdf } from '@/utils/fileDownload';

const sanitizeFileName = (value: string) => value.replace(/[\\/:*?"<>|]/g, '-').trim();

export const downloadRemissionGuidePdf = async (params: {
  transferId: string;
  guide?: RemissionGuide | null;
}) => {
  const { transferId, guide } = params;
  const fileName = `${sanitizeFileName(
    guide?.number || guide?.serieNumero || `guia-remision-${transferId}`
  )}.pdf`;

  try {
    const blob = await transfersApi.downloadRemissionGuidePdf(transferId);
    await saveAndSharePdf(blob, fileName, `Guía de Remisión ${guide?.number || guide?.serieNumero || ''}`.trim());
  } catch (error: any) {
    console.error('Error downloading remission guide:', error);
    Alert.alert(
      'No se pudo descargar',
      error?.message || 'No se pudo descargar la guía de remisión.'
    );
  }
};
