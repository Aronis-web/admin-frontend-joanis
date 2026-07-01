import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  useWindowDimensions,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { salesApi } from '@/services/api/sales';
import {
  Sale,
  SaleItem,
  SaleStatus,
  PaymentStatus,
  SaleStatusLabels,
  PaymentStatusLabels,
  SaleTypeLabels,
  ProcessingStatusLabels,
  DocumentType,
  CreateCreditNoteRequest,
  CreateDebitNoteRequest,
} from '@/types/sales';
import { useAuthStore } from '@/store/auth';
import { config } from '@/utils/config';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import logger from '@/utils/logger';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Alert from '@/utils/alert';

interface SaleDetailScreenProps {
  route: {
    params: {
      saleId: string;
    };
  };
}

export const SaleDetailScreen: React.FC<SaleDetailScreenProps> = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { saleId } = route.params as { saleId: string };
  const { token, currentCompany, currentSite } = useAuthStore();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  // State
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saleDocuments, setSaleDocuments] = useState<any>(null);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [creditNotes, setCreditNotes] = useState<any[]>([]);
  const [debitNotes, setDebitNotes] = useState<any[]>([]);
  const [showCreditNoteModal, setShowCreditNoteModal] = useState(false);
  const [showDebitNoteModal, setShowDebitNoteModal] = useState(false);
  const [creatingCreditNote, setCreatingCreditNote] = useState(false);
  const creatingCreditNoteRef = useRef(false);

  // Credit Note - partial return state
  const [creditNoteMode, setCreditNoteMode] = useState<'total' | 'partial'>('partial');
  const [creditNoteSustento, setCreditNoteSustento] = useState<string>('');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [itemQuantities, setItemQuantities] = useState<Record<string, string>>({});

  // Load sale
  const loadSale = async (isRefresh: boolean = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await salesApi.getSaleById(saleId, {
        includeItems: true,
        includeDocuments: true,
        includePayments: true,
      });

      setSale(data);
      logger.info('📊 Venta cargada:', data);

      if (data.documents && Array.isArray(data.documents)) {
        const creditNotesList = data.documents.filter(
          (doc: any) =>
            doc.documentType?.code === '07' ||
            doc.documentType?.name?.toLowerCase().includes('crédito')
        );
        const debitNotesList = data.documents.filter(
          (doc: any) =>
            doc.documentType?.code === '08' ||
            doc.documentType?.name?.toLowerCase().includes('débito')
        );

        setCreditNotes(creditNotesList);
        setDebitNotes(debitNotesList);

        setSaleDocuments({
          documents: data.documents,
          allDocuments: data.documents,
        });
      } else {
        setCreditNotes([]);
        setDebitNotes([]);
      }

      loadSaleDocuments();
    } catch (error) {
      logger.error('Error cargando venta:', error);
      Alert.alert('Error', 'No se pudo cargar la venta');
      navigation.goBack();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadSaleDocuments = async () => {
    setLoadingDocuments(true);
    try {
      const [docsResult, creditNotesResult] = await Promise.allSettled([
        salesApi.getSaleDocuments(saleId),
        salesApi.getSaleCreditNotes(saleId),
      ]);

      const docs = docsResult.status === 'fulfilled' ? docsResult.value : null;
      const creditNotesResponse =
        creditNotesResult.status === 'fulfilled' ? creditNotesResult.value : null;
      const allDocs = docs?.allDocuments || docs?.documents || [];
      const adminCreditNotes = Array.isArray(creditNotesResponse?.creditNotes)
        ? creditNotesResponse.creditNotes
        : [];

      if (creditNotesResult.status === 'rejected') {
        logger.error('❌ Error cargando notas de crédito admin:', creditNotesResult.reason);
      }

      setCreditNotes(adminCreditNotes);

      if (allDocs.length > 0) {
        setSaleDocuments((prev: any) => ({
          ...prev,
          ...docs,
          documents: allDocs,
          allDocuments: allDocs,
        }));

        if (docs?.debitNotes && Array.isArray(docs.debitNotes) && docs.debitNotes.length > 0) {
          setDebitNotes((prev) => (prev.length === 0 ? docs.debitNotes : prev));
        }
      }
    } catch (error: any) {
      logger.error('❌ Error cargando documentos:', error);
    } finally {
      setLoadingDocuments(false);
    }
  };

  useEffect(() => {
    loadSale();
  }, [saleId]);

  const handleRefresh = () => {
    loadSale(true);
  };

  const handleRegisterPayment = () => {
    if (sale?.id) {
      (navigation as any).navigate('RegisterSalePayment', { saleId: sale.id });
    }
  };

  const handleDownloadDocument = async () => {
    if (!saleDocuments || !saleDocuments.documents || saleDocuments.documents.length === 0) {
      Alert.alert('Error', 'No hay documentos disponibles para descargar');
      return;
    }

    const document = saleDocuments.documents[0];
    setLoadingDocuments(true);

    try {
      if (Platform.OS === 'web') {
        const pdfBlob = await salesApi.downloadDocumentPDF(saleId, document.id);
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, '_blank');
        setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
      } else {
        const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8081';
        const pdfUrl = `${apiUrl}/admin/sales/${saleId}/documents/${document.id}/pdf`;

        const fileName = `${document.documentNumber}.pdf`;
        const fileUri = FileSystem.cacheDirectory + fileName;

        const headers: Record<string, string> = {
          'X-App-Id': config.APP_ID,
        };

        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (currentCompany?.id) headers['X-Company-Id'] = currentCompany.id;
        if (currentSite?.id) headers['X-Site-Id'] = currentSite.id;

        const downloadResult = await FileSystem.downloadAsync(pdfUrl, fileUri, { headers });

        if (downloadResult.status !== 200) {
          throw new Error(`Error del servidor: ${downloadResult.status}`);
        }

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: 'application/pdf',
            dialogTitle: `${sale?.documentType} ${document.documentNumber}`,
          });
        } else {
          Alert.alert('Éxito', `PDF guardado en: ${downloadResult.uri}`);
        }
      }
    } catch (error: any) {
      logger.error('❌ Error al descargar documento:', error);
      Alert.alert('Error', error.message || 'Error al descargar el documento');
    } finally {
      setLoadingDocuments(false);
    }
  };

  const handleDownloadNoteDocument = async (documentId: string, documentNumber: string) => {
    setLoadingDocuments(true);
    try {
      if (Platform.OS === 'web') {
        const pdfBlob = await salesApi.downloadDocumentPDF(saleId, documentId);
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, '_blank');
        setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
      } else {
        const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8081';
        const pdfUrl = `${apiUrl}/admin/sales/${saleId}/documents/${documentId}/pdf`;

        const fileName = `${documentNumber}.pdf`;
        const fileUri = FileSystem.cacheDirectory + fileName;

        const headers: Record<string, string> = { 'X-App-Id': config.APP_ID };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (currentCompany?.id) headers['X-Company-Id'] = currentCompany.id;
        if (currentSite?.id) headers['X-Site-Id'] = currentSite.id;

        const downloadResult = await FileSystem.downloadAsync(pdfUrl, fileUri, { headers });

        if (downloadResult.status !== 200) {
          throw new Error(`Error del servidor: ${downloadResult.status}`);
        }

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: 'application/pdf',
            dialogTitle: documentNumber,
          });
        }
      }
    } catch (error: any) {
      logger.error('❌ Error al descargar nota:', error);
      Alert.alert('Error', error.message || 'Error al descargar la nota');
    } finally {
      setLoadingDocuments(false);
    }
  };

  // ============ Credit Note helpers (partial returns) ============
  const normalizeQty = (value: unknown, fallback = 0): number => {
    const n = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : fallback;
  };

  const getCnItemSku = (it: any): string =>
    it?.sku || it?.productCode || it?.codigo || it?.product?.sku || it?.product?.code || '';

  const getCnItemsFromDocument = (cn: any): any[] =>
    cn?.items ||
    cn?.details ||
    cn?.creditNoteItems ||
    cn?.saleItems ||
    cn?.documentItems ||
    cn?.document?.items ||
    [];

  // Total already-returned quantity per SaleItem (matched by id or SKU)
  const returnedByItem = useMemo(() => {
    const map: Record<string, number> = {};
    const bySku: Record<string, number> = {};

    creditNotes.forEach((cn: any) => {
      const items = getCnItemsFromDocument(cn);
      items.forEach((it: any) => {
        const qty = normalizeQty(
          it?.cantidad ?? it?.quantity ?? it?.qty ?? it?.returnedQuantity,
          0
        );
        if (qty <= 0) return;
        const saleItemId = it?.saleItemId || it?.itemId || it?.saleItem?.id;
        if (saleItemId) {
          map[String(saleItemId)] = (map[String(saleItemId)] || 0) + qty;
        }
        const sku = getCnItemSku(it);
        if (sku) {
          bySku[sku] = (bySku[sku] || 0) + qty;
        }
      });
    });

    // Merge SKU-based counts for items not matched by id
    (sale?.items || []).forEach((item) => {
      if (map[item.id] != null) return;
      const sku = item.productSnapshot?.sku;
      if (sku && bySku[sku] != null) {
        map[item.id] = bySku[sku];
      }
    });

    return map;
  }, [creditNotes, sale?.items]);

  const getReturnedQty = (item: SaleItem): number => returnedByItem[item.id] || 0;
  const getAvailableQty = (item: SaleItem): number =>
    Math.max(item.quantity - getReturnedQty(item), 0);

  const totalAvailableToReturn = useMemo(
    () => (sale?.items || []).reduce((sum, it) => sum + getAvailableQty(it), 0),
    [sale?.items, returnedByItem]
  );

  const openCreditNoteModal = () => {
    if (!sale?.items || sale.items.length === 0) return;

    const availableItems = sale.items.filter((it) => getAvailableQty(it) > 0);
    if (availableItems.length === 0) {
      Alert.alert('Sin saldo disponible', 'Todos los productos de esta venta ya fueron devueltos.');
      return;
    }

    const quantities: Record<string, string> = {};
    availableItems.forEach((it) => {
      quantities[it.id] = String(getAvailableQty(it));
    });

    setCreditNoteMode('partial');
    setCreditNoteSustento('');
    setSelectedItemIds([]);
    setItemQuantities(quantities);
    setShowCreditNoteModal(true);
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const updateItemQuantity = (itemId: string, value: string, max: number) => {
    const sanitized = value.replace(/[^0-9.,]/g, '');
    const num = Number(sanitized.replace(',', '.'));
    const finalValue = Number.isFinite(num) && num > max ? String(max) : sanitized;
    setItemQuantities((prev) => ({ ...prev, [itemId]: finalValue }));
  };

  const handleSubmitCreditNote = () => {
    if (!sale?.items) return;

    if (!creditNoteSustento.trim()) {
      Alert.alert('Sustento requerido', 'Ingresa el sustento de la nota de crédito.');
      return;
    }

    if (creditNoteMode === 'partial') {
      if (selectedItemIds.length === 0) {
        Alert.alert('Selecciona productos', 'Debes seleccionar al menos un producto a devolver.');
        return;
      }

      const items: any[] = [];
      for (const item of sale.items) {
        if (!selectedItemIds.includes(item.id)) continue;
        const max = getAvailableQty(item);
        const qty = normalizeQty(itemQuantities[item.id], 0);
        if (qty <= 0 || qty > max) {
          Alert.alert(
            'Cantidad inválida',
            `La cantidad de "${item.productSnapshot.title}" debe ser mayor a 0 y no superar ${max}.`
          );
          return;
        }
        const unitPrice = item.unitPriceCents / 100;
        items.push({
          sku: item.productSnapshot.sku,
          descripcion: item.productSnapshot.title,
          cantidad: qty,
          unidadMedida: 'NIU',
          valorUnitario: unitPrice,
          precioVentaUnitario: unitPrice,
        });
      }

      createCreditNote({
        motivoNota: '07',
        sustentoNota: creditNoteSustento.trim(),
        items,
        observaciones: 'Devolución parcial generada desde Admin',
      });
    } else {
      // Total: sends all remaining items
      const items: any[] = [];
      for (const item of sale.items) {
        const remaining = getAvailableQty(item);
        if (remaining <= 0) continue;
        const unitPrice = item.unitPriceCents / 100;
        items.push({
          sku: item.productSnapshot.sku,
          descripcion: item.productSnapshot.title,
          cantidad: remaining,
          unidadMedida: 'NIU',
          valorUnitario: unitPrice,
          precioVentaUnitario: unitPrice,
        });
      }

      createCreditNote({
        motivoNota: '06',
        sustentoNota: creditNoteSustento.trim(),
        items,
        observaciones: 'Devolución total generada desde Admin',
      });
    }
  };

  const createCreditNote = async (data: CreateCreditNoteRequest) => {
    if (!sale?.id || creatingCreditNoteRef.current) return;

    creatingCreditNoteRef.current = true;
    setCreatingCreditNote(true);
    setLoadingDocuments(true);
    try {
      const result = await salesApi.createCreditNote(sale.id, data);
      setShowCreditNoteModal(false);
      Alert.alert(
        'Éxito',
        result?.message || `Nota de crédito creada: ${result?.documentNumber || ''}`,
        [{ text: 'OK', onPress: () => loadSale(true) }]
      );
    } catch (error: any) {
      logger.error('Error creando nota de crédito:', error);
      Alert.alert('Error', error?.response?.data?.message || 'No se pudo crear la nota de crédito');
    } finally {
      creatingCreditNoteRef.current = false;
      setCreatingCreditNote(false);
      setLoadingDocuments(false);
    }
  };

  const createDebitNote = async (monto: number, sustentoNota: string) => {
    if (!sale?.id) return;

    setLoadingDocuments(true);
    try {
      const valorUnitario = monto / 1.18;
      const precioVentaUnitario = monto;

      const data: CreateDebitNoteRequest = {
        motivoNota: '01',
        sustentoNota,
        items: [
          {
            sku: 'CARGO-ADICIONAL',
            descripcion: sustentoNota,
            cantidad: 1,
            unidadMedida: 'ZZ',
            valorUnitario: Math.round(valorUnitario * 100) / 100,
            precioVentaUnitario: Math.round(precioVentaUnitario * 100) / 100,
          },
        ],
        observaciones: `Cargo adicional: S/ ${monto.toFixed(2)}`,
      };

      const result = await salesApi.createDebitNote(sale.id, data);
      setShowDebitNoteModal(false);
      Alert.alert('Éxito', `Nota de débito creada: ${result.documentNumber}`, [
        { text: 'OK', onPress: () => loadSale(true) },
      ]);
    } catch (error: any) {
      logger.error('Error creando nota de débito:', error);
      Alert.alert('Error', error?.response?.data?.message || 'No se pudo crear la nota de débito');
    } finally {
      setLoadingDocuments(false);
    }
  };

  const getStatusColor = (status: SaleStatus) => {
    switch (status) {
      case SaleStatus.CONFIRMED:
        return theme.color.state.success.border;
      case SaleStatus.COMPLETED:
        return theme.color.brand.accent;
      case SaleStatus.CANCELLED:
        return theme.color.state.danger.border;
      case SaleStatus.DRAFT:
        return theme.color.state.warning.border;
      default:
        return theme.color.text.subtle;
    }
  };

  const getPaymentStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case PaymentStatus.PAID:
        return theme.color.state.success.border;
      case PaymentStatus.PARTIAL:
        return theme.color.state.warning.border;
      case PaymentStatus.PENDING:
        return theme.color.text.subtle;
      case PaymentStatus.OVERDUE:
        return theme.color.state.danger.border;
      default:
        return theme.color.text.subtle;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.color.brand.accent} />
        <Text style={styles.loadingText}>Cargando venta...</Text>
      </View>
    );
  }

  if (!sale) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={theme.color.icon.danger} />
        <Text style={styles.errorText}>No se encontró la venta</Text>
        <TouchableOpacity style={styles.backButtonError} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonErrorText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const customerName =
    sale.customerSnapshot?.fullName || sale.companySnapshot?.razonSocial || 'Sin cliente';
  const documentNumber = sale.customerSnapshot?.documentNumber || sale.companySnapshot?.ruc || '';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={[theme.color.brand.headerFrom, theme.color.brand.headerTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.color.brand.onHeader} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerCode}>{sale.code}</Text>
            <View style={styles.headerBadges}>
              <View style={[styles.headerBadge, { backgroundColor: getStatusColor(sale.status) }]}>
                <Text style={styles.headerBadgeText}>{SaleStatusLabels[sale.status]}</Text>
              </View>
              <View style={[styles.headerBadge, { backgroundColor: theme.color.brand.accent }]}>
                <Text style={styles.headerBadgeText}>{SaleTypeLabels[sale.saleType]}</Text>
              </View>
            </View>
          </View>
          <View style={styles.headerActions}>
            {sale.status !== SaleStatus.CANCELLED && saleDocuments?.documents?.length > 0 && (
              <TouchableOpacity
                style={styles.headerActionButton}
                onPress={handleDownloadDocument}
                disabled={loadingDocuments}
              >
                <Ionicons name="download-outline" size={22} color={theme.color.brand.onHeader} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Summary */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total</Text>
            <Text style={styles.summaryValue}>S/ {(sale.totalCents / 100).toFixed(2)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Pagado</Text>
            <Text style={[styles.summaryValue, { color: theme.color.brand.onHeader }]}>
              S/ {(sale.paidAmountCents / 100).toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Saldo</Text>
            <Text
              style={[
                styles.summaryValue,
                {
                  color:
                    sale.balanceCents > 0
                      ? theme.color.state.danger.background
                      : theme.color.brand.onHeader,
                },
              ]}
            >
              S/ {(sale.balanceCents / 100).toFixed(2)}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.color.brand.accent]}
          />
        }
      >
        {/* Customer Info */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-outline" size={20} color={theme.color.icon.muted} />
            <Text style={styles.sectionTitle}>Cliente</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Nombre</Text>
              <Text style={styles.infoValue}>{customerName}</Text>
            </View>
            {documentNumber && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Documento</Text>
                <Text style={styles.infoValue}>{documentNumber}</Text>
              </View>
            )}
            {sale.customerSnapshot?.email && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{sale.customerSnapshot.email}</Text>
              </View>
            )}
            {sale.customerSnapshot?.phone && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Teléfono</Text>
                <Text style={styles.infoValue}>{sale.customerSnapshot.phone}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Sale Info */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle-outline" size={20} color={theme.color.icon.muted} />
            <Text style={styles.sectionTitle}>Información de la Venta</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Fecha</Text>
              <Text style={styles.infoValue}>
                {new Date(sale.saleDate).toLocaleDateString('es-PE', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Procesamiento</Text>
              <View
                style={[
                  styles.processingBadge,
                  { backgroundColor: theme.color.state.info.background },
                ]}
              >
                <Text style={[styles.processingBadgeText, { color: theme.color.state.info.text }]}>
                  {ProcessingStatusLabels[sale.processingStatus]}
                </Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Stock Validado</Text>
              <View style={styles.checkContainer}>
                <Ionicons
                  name={sale.isStockValidated ? 'checkmark-circle' : 'close-circle'}
                  size={20}
                  color={sale.isStockValidated ? theme.color.icon.success : theme.color.icon.danger}
                />
              </View>
            </View>
            {sale.notes && (
              <View style={styles.notesContainer}>
                <Text style={styles.notesLabel}>Notas</Text>
                <Text style={styles.notesText}>{sale.notes}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Products */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cube-outline" size={20} color={theme.color.icon.muted} />
            <Text style={styles.sectionTitle}>Productos ({sale.itemCount})</Text>
          </View>
          {sale.items && sale.items.length > 0 ? (
            <View style={styles.productsContainer}>
              {sale.items.map((item) => {
                const returned = getReturnedQty(item);
                const available = getAvailableQty(item);
                const fullyReturned = returned >= item.quantity && item.quantity > 0;
                return (
                  <View key={item.id} style={styles.productCard}>
                    <View style={styles.productHeader}>
                      <Text style={styles.productName} numberOfLines={2}>
                        {item.productSnapshot.title}
                      </Text>
                      <Text style={styles.productPrice}>
                        S/ {(item.totalCents / 100).toFixed(2)}
                      </Text>
                    </View>
                    <Text style={styles.productSku}>SKU: {item.productSnapshot.sku}</Text>
                    <View style={styles.productDetails}>
                      <View style={styles.productDetailItem}>
                        <Text style={styles.productDetailLabel}>Cant.:</Text>
                        <Text style={styles.productDetailValue}>{item.quantity}</Text>
                      </View>
                      <View style={styles.productDetailItem}>
                        <Text style={styles.productDetailLabel}>P.Unit.:</Text>
                        <Text style={styles.productDetailValue}>
                          S/ {(item.unitPriceCents / 100).toFixed(2)}
                        </Text>
                      </View>
                      {item.discountCents > 0 && (
                        <View style={styles.productDetailItem}>
                          <Text
                            style={[styles.productDetailLabel, { color: theme.color.text.danger }]}
                          >
                            Desc.:
                          </Text>
                          <Text
                            style={[styles.productDetailValue, { color: theme.color.text.danger }]}
                          >
                            -S/ {(item.discountCents / 100).toFixed(2)}
                          </Text>
                        </View>
                      )}
                    </View>
                    {returned > 0 && (
                      <View
                        style={[
                          styles.returnedBadge,
                          {
                            backgroundColor: fullyReturned
                              ? theme.color.state.danger.background
                              : theme.color.state.warning.background,
                          },
                        ]}
                      >
                        <Ionicons
                          name={fullyReturned ? 'close-circle' : 'return-down-back'}
                          size={14}
                          color={
                            fullyReturned
                              ? theme.color.state.danger.text
                              : theme.color.state.warning.text
                          }
                        />
                        <Text
                          style={[
                            styles.returnedBadgeText,
                            {
                              color: fullyReturned
                                ? theme.color.state.danger.text
                                : theme.color.state.warning.text,
                            },
                          ]}
                        >
                          {fullyReturned
                            ? `Devuelto totalmente (${returned}/${item.quantity})`
                            : `Devuelto ${returned} de ${item.quantity} · Disponible ${available}`}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No hay productos</Text>
            </View>
          )}
        </View>

        {/* Totals */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calculator-outline" size={20} color={theme.color.icon.muted} />
            <Text style={styles.sectionTitle}>Totales</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>S/ {(sale.subtotalCents / 100).toFixed(2)}</Text>
            </View>
            {sale.discountCents > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Descuento</Text>
                <Text style={[styles.totalValue, { color: theme.color.text.danger }]}>
                  -S/ {(sale.discountCents / 100).toFixed(2)}
                </Text>
              </View>
            )}
            <View style={styles.totalRowFinal}>
              <Text style={styles.totalLabelFinal}>Total</Text>
              <Text style={styles.totalValueFinal}>S/ {(sale.totalCents / 100).toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Payment Status */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="wallet-outline" size={20} color={theme.color.icon.muted} />
            <Text style={styles.sectionTitle}>Estado de Pago</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Estado</Text>
              <View
                style={[
                  styles.paymentStatusBadge,
                  { backgroundColor: getPaymentStatusColor(sale.paymentStatus) + '15' },
                ]}
              >
                <View
                  style={[
                    styles.paymentStatusDot,
                    { backgroundColor: getPaymentStatusColor(sale.paymentStatus) },
                  ]}
                />
                <Text
                  style={[
                    styles.paymentStatusText,
                    { color: getPaymentStatusColor(sale.paymentStatus) },
                  ]}
                >
                  {PaymentStatusLabels[sale.paymentStatus]}
                </Text>
              </View>
            </View>
            <View style={styles.paymentSummary}>
              <View style={styles.paymentSummaryItem}>
                <Text style={styles.paymentSummaryLabel}>Total</Text>
                <Text style={styles.paymentSummaryValue}>
                  S/ {(sale.totalCents / 100).toFixed(2)}
                </Text>
              </View>
              <View style={styles.paymentSummaryItem}>
                <Text style={styles.paymentSummaryLabel}>Pagado</Text>
                <Text style={[styles.paymentSummaryValue, { color: theme.color.text.success }]}>
                  S/ {(sale.paidAmountCents / 100).toFixed(2)}
                </Text>
              </View>
              <View style={styles.paymentSummaryItem}>
                <Text style={styles.paymentSummaryLabel}>Saldo</Text>
                <Text
                  style={[
                    styles.paymentSummaryValue,
                    {
                      color:
                        sale.balanceCents > 0 ? theme.color.text.danger : theme.color.text.success,
                    },
                  ]}
                >
                  S/ {(sale.balanceCents / 100).toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Payments */}
        {sale.payments && sale.payments.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="cash-outline" size={20} color={theme.color.icon.muted} />
              <Text style={styles.sectionTitle}>Pagos ({sale.payments.length})</Text>
            </View>
            <View style={styles.paymentsContainer}>
              {sale.payments.map((payment) => (
                <View key={payment.id} style={styles.paymentCard}>
                  <View style={styles.paymentHeader}>
                    <Text style={styles.paymentAmount}>
                      S/ {(payment.amountCents / 100).toFixed(2)}
                    </Text>
                    <Text style={styles.paymentDate}>
                      {new Date(payment.createdAt).toLocaleDateString('es-PE')}
                    </Text>
                  </View>
                  {payment.paymentMethod && (
                    <View style={styles.paymentMethodContainer}>
                      <Ionicons name="card-outline" size={14} color={theme.color.icon.subtle} />
                      <Text style={styles.paymentMethod}>{payment.paymentMethod.name}</Text>
                    </View>
                  )}
                  {payment.referenceNumber && (
                    <Text style={styles.paymentReference}>Ref: {payment.referenceNumber}</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Credit Notes */}
        {creditNotes.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text-outline" size={20} color={theme.color.icon.warning} />
              <Text style={styles.sectionTitle}>Notas de Crédito ({creditNotes.length})</Text>
            </View>
            {creditNotes.map((note, index) => (
              <View key={note.id || index} style={styles.noteCard}>
                <View style={styles.noteHeader}>
                  <Text style={styles.noteNumber}>{note.documentNumber}</Text>
                  <View
                    style={[
                      styles.noteStatusBadge,
                      { backgroundColor: theme.color.state.warning.background },
                    ]}
                  >
                    <Text
                      style={[styles.noteStatusText, { color: theme.color.state.warning.text }]}
                    >
                      {note.status}
                    </Text>
                  </View>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Monto</Text>
                  <Text style={[styles.infoValue, { color: theme.color.text.warning }]}>
                    S/ {((note.totalCents ?? Math.round((note.total || 0) * 100)) / 100).toFixed(2)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.downloadNoteButton}
                  onPress={() => handleDownloadNoteDocument(note.id, note.documentNumber)}
                  disabled={loadingDocuments}
                >
                  <Ionicons name="download-outline" size={18} color={theme.color.text.inverse} />
                  <Text style={styles.downloadNoteButtonText}>Descargar PDF</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        {sale.status !== SaleStatus.CANCELLED && (
          <View style={styles.actionsSection}>
            {sale.balanceCents > 0 && (
              <TouchableOpacity style={styles.actionButton} onPress={handleRegisterPayment}>
                <Ionicons name="add-circle-outline" size={20} color={theme.color.text.inverse} />
                <Text style={styles.actionButtonText}>Registrar Pago</Text>
              </TouchableOpacity>
            )}

            {sale.status === SaleStatus.CONFIRMED &&
              (sale.documentType === DocumentType.BOLETA ||
                sale.documentType === DocumentType.FACTURA) && (
                <>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      { backgroundColor: theme.color.state.warning.border },
                      (creatingCreditNote || totalAvailableToReturn <= 0) &&
                        styles.disabledActionButton,
                    ]}
                    onPress={openCreditNoteModal}
                    disabled={creatingCreditNote || totalAvailableToReturn <= 0}
                  >
                    {creatingCreditNote ? (
                      <ActivityIndicator size="small" color={theme.color.text.inverse} />
                    ) : (
                      <Ionicons
                        name="document-text-outline"
                        size={20}
                        color={theme.color.text.inverse}
                      />
                    )}
                    <Text style={styles.actionButtonText}>
                      {creatingCreditNote
                        ? 'Generando NC...'
                        : totalAvailableToReturn <= 0
                          ? 'Todo devuelto'
                          : 'Nota de Crédito'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      { backgroundColor: theme.color.state.info.border },
                    ]}
                    onPress={() => setShowDebitNoteModal(true)}
                  >
                    <Ionicons name="add-outline" size={20} color={theme.color.text.inverse} />
                    <Text style={styles.actionButtonText}>Nota de Débito</Text>
                  </TouchableOpacity>
                </>
              )}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Credit Note Modal */}
      <Modal
        visible={showCreditNoteModal}
        transparent
        animationType="slide"
        onRequestClose={() => !creatingCreditNote && setShowCreditNoteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nueva Nota de Crédito</Text>
              <TouchableOpacity
                onPress={() => setShowCreditNoteModal(false)}
                disabled={creatingCreditNote}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={creatingCreditNote ? theme.color.border.default : theme.color.icon.subtle}
                />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: '80%' }} contentContainerStyle={styles.modalBody}>
              {/* Mode toggle */}
              <Text style={styles.cnFieldLabel}>Tipo de devolución</Text>
              <View style={styles.cnModeRow}>
                <TouchableOpacity
                  style={[
                    styles.cnModeButton,
                    creditNoteMode === 'partial' && styles.cnModeButtonActive,
                  ]}
                  onPress={() => setCreditNoteMode('partial')}
                  disabled={creatingCreditNote}
                >
                  <Text
                    style={[
                      styles.cnModeText,
                      creditNoteMode === 'partial' && styles.cnModeTextActive,
                    ]}
                  >
                    Parcial (por ítem)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.cnModeButton,
                    creditNoteMode === 'total' && styles.cnModeButtonActive,
                  ]}
                  onPress={() => setCreditNoteMode('total')}
                  disabled={creatingCreditNote}
                >
                  <Text
                    style={[
                      styles.cnModeText,
                      creditNoteMode === 'total' && styles.cnModeTextActive,
                    ]}
                  >
                    Total (saldo restante)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Sustento */}
              <Text style={styles.cnFieldLabel}>Sustento</Text>
              <TextInput
                style={styles.cnTextInput}
                value={creditNoteSustento}
                onChangeText={setCreditNoteSustento}
                placeholder="Motivo detallado de la nota de crédito"
                placeholderTextColor={theme.color.text.placeholder}
                editable={!creatingCreditNote}
                multiline
              />

              {/* Items - only in partial mode */}
              {creditNoteMode === 'partial' && sale.items && (
                <>
                  <Text style={[styles.cnFieldLabel, { marginTop: theme.space[4] }]}>
                    Productos a devolver
                  </Text>
                  {sale.items.map((item) => {
                    const available = getAvailableQty(item);
                    const returned = getReturnedQty(item);
                    const disabled = available <= 0;
                    const selected = selectedItemIds.includes(item.id);
                    const qtyStr = itemQuantities[item.id] ?? String(available);

                    return (
                      <View
                        key={item.id}
                        style={[
                          styles.cnItemCard,
                          selected && styles.cnItemCardSelected,
                          disabled && styles.cnItemCardDisabled,
                        ]}
                      >
                        <TouchableOpacity
                          style={styles.cnItemHeader}
                          onPress={() => !disabled && toggleItemSelection(item.id)}
                          disabled={disabled || creatingCreditNote}
                        >
                          <Ionicons
                            name={
                              disabled ? 'close-circle' : selected ? 'checkbox' : 'square-outline'
                            }
                            size={22}
                            color={
                              disabled
                                ? theme.color.icon.disabled
                                : selected
                                  ? theme.color.brand.accent
                                  : theme.color.icon.subtle
                            }
                          />
                          <View style={{ flex: 1, marginLeft: theme.space[3] }}>
                            <Text style={styles.cnItemName} numberOfLines={2}>
                              {item.productSnapshot.title}
                            </Text>
                            <Text style={styles.cnItemMeta}>
                              SKU: {item.productSnapshot.sku} · S/{' '}
                              {(item.unitPriceCents / 100).toFixed(2)}
                            </Text>
                            <Text style={styles.cnItemMeta}>
                              Original: {item.quantity} · Devuelto: {returned} · Disponible:{' '}
                              {available}
                            </Text>
                          </View>
                        </TouchableOpacity>

                        {selected && !disabled && (
                          <View style={styles.cnItemQtyRow}>
                            <Text style={styles.cnItemQtyLabel}>Cantidad a devolver</Text>
                            <TextInput
                              style={styles.cnItemQtyInput}
                              value={qtyStr}
                              onChangeText={(v) => updateItemQuantity(item.id, v, available)}
                              keyboardType="numeric"
                              editable={!creatingCreditNote}
                            />
                            <Text style={styles.cnItemQtyMax}>/ {available}</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </>
              )}

              {creditNoteMode === 'total' && (
                <View style={styles.cnTotalInfo}>
                  <Ionicons
                    name="information-circle-outline"
                    size={18}
                    color={theme.color.icon.warning}
                  />
                  <Text style={styles.cnTotalInfoText}>
                    Se devolverá todo el saldo disponible ({totalAvailableToReturn} unidad
                    {totalAvailableToReturn === 1 ? '' : 'es'} restante
                    {totalAvailableToReturn === 1 ? '' : 's'}).
                  </Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.cnFooter}>
              <TouchableOpacity
                style={styles.cnCancelButton}
                onPress={() => setShowCreditNoteModal(false)}
                disabled={creatingCreditNote}
              >
                <Text style={styles.cnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cnSubmitButton, creatingCreditNote && styles.disabledActionButton]}
                onPress={handleSubmitCreditNote}
                disabled={creatingCreditNote}
              >
                {creatingCreditNote ? (
                  <ActivityIndicator size="small" color={theme.color.text.inverse} />
                ) : (
                  <Ionicons
                    name="document-text-outline"
                    size={18}
                    color={theme.color.text.inverse}
                  />
                )}
                <Text style={styles.cnSubmitText}>
                  {creatingCreditNote ? 'Generando...' : 'Generar Nota de Crédito'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Debit Note Modal */}
      <Modal
        visible={showDebitNoteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDebitNoteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Crear Nota de Débito</Text>
              <TouchableOpacity onPress={() => setShowDebitNoteModal(false)}>
                <Ionicons name="close" size={24} color={theme.color.icon.subtle} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalDescription}>Selecciona el monto del cargo:</Text>
              {[50, 100, 200].map((monto) => (
                <TouchableOpacity
                  key={monto}
                  style={styles.modalOption}
                  onPress={() => createDebitNote(monto, 'Cargo adicional')}
                >
                  <View
                    style={[
                      styles.modalOptionIcon,
                      { backgroundColor: theme.color.state.info.background },
                    ]}
                  >
                    <Text
                      style={[styles.modalOptionIconText, { color: theme.color.state.info.text }]}
                    >
                      +
                    </Text>
                  </View>
                  <View style={styles.modalOptionContent}>
                    <Text style={styles.modalOptionTitle}>S/ {monto.toFixed(2)}</Text>
                    <Text style={styles.modalOptionSubtitle}>Cargo adicional</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.color.icon.disabled} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.color.background.subtle,
      gap: theme.space[4],
    },
    loadingText: {
      fontSize: 16,
      color: theme.color.text.subtle,
      fontWeight: '500',
    },
    errorText: {
      fontSize: 18,
      color: theme.color.text.danger,
      fontWeight: '600',
      marginTop: theme.space[4],
    },
    backButtonError: {
      marginTop: theme.space[4],
      paddingHorizontal: theme.space[6],
      paddingVertical: theme.space[3],
      backgroundColor: theme.color.brand.accent,
      borderRadius: theme.radii.lg,
    },
    backButtonErrorText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.color.text.inverse,
    },
    headerGradient: {
      paddingHorizontal: theme.space[4],
      paddingTop: theme.space[2],
      paddingBottom: theme.space[4],
    },
    headerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.space[4],
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.color.brand.headerBadge,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.space[3],
    },
    headerTitleContainer: {
      flex: 1,
    },
    headerCode: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.color.brand.onHeader,
      marginBottom: theme.space[2],
    },
    headerBadges: {
      flexDirection: 'row',
      gap: theme.space[2],
    },
    headerBadge: {
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[1],
      borderRadius: theme.radii.full,
    },
    headerBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.brand.onHeader,
    },
    headerActions: {
      flexDirection: 'row',
      gap: theme.space[2],
    },
    headerActionButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.color.brand.headerBadge,
      justifyContent: 'center',
      alignItems: 'center',
    },
    summaryContainer: {
      flexDirection: 'row',
      backgroundColor: theme.color.brand.headerBadge,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
    },
    summaryItem: {
      flex: 1,
      alignItems: 'center',
    },
    summaryLabel: {
      fontSize: 11,
      color: theme.color.brand.onHeaderMuted,
      fontWeight: '500',
      textTransform: 'uppercase',
      marginBottom: theme.space[1],
    },
    summaryValue: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.color.brand.onHeader,
    },
    summaryDivider: {
      width: 1,
      backgroundColor: theme.color.brand.headerBadge,
      marginHorizontal: theme.space[3],
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: theme.space[4],
    },
    section: {
      marginBottom: theme.space[5],
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      marginBottom: theme.space[3],
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.body,
    },
    card: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      ...theme.shadow.sm,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.space[2],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.background.muted,
    },
    infoLabel: {
      fontSize: 14,
      color: theme.color.text.subtle,
      fontWeight: '500',
    },
    infoValue: {
      fontSize: 14,
      color: theme.color.text.heading,
      fontWeight: '600',
      flex: 1,
      textAlign: 'right',
    },
    processingBadge: {
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[1],
      borderRadius: theme.radii.md,
    },
    processingBadgeText: {
      fontSize: 12,
      fontWeight: '600',
    },
    checkContainer: {},
    notesContainer: {
      paddingTop: theme.space[3],
      marginTop: theme.space[2],
    },
    notesLabel: {
      fontSize: 13,
      color: theme.color.text.subtle,
      fontWeight: '500',
      marginBottom: theme.space[1],
    },
    notesText: {
      fontSize: 14,
      color: theme.color.text.body,
      lineHeight: 20,
    },
    productsContainer: {
      gap: theme.space[3],
    },
    productCard: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      padding: theme.space[4],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      ...theme.shadow.sm,
    },
    productHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: theme.space[2],
    },
    productName: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.color.text.heading,
      flex: 1,
      marginRight: theme.space[3],
    },
    productPrice: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.success,
    },
    productSku: {
      fontSize: 12,
      color: theme.color.text.subtle,
      marginBottom: theme.space[3],
    },
    productDetails: {
      flexDirection: 'row',
      gap: theme.space[4],
      flexWrap: 'wrap',
    },
    productDetailItem: {
      flexDirection: 'row',
      gap: theme.space[1],
    },
    productDetailLabel: {
      fontSize: 13,
      color: theme.color.text.subtle,
    },
    productDetailValue: {
      fontSize: 13,
      color: theme.color.text.body,
      fontWeight: '600',
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: theme.space[2],
    },
    totalLabel: {
      fontSize: 14,
      color: theme.color.text.subtle,
    },
    totalValue: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.body,
    },
    totalRowFinal: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: theme.space[3],
      marginTop: theme.space[2],
      borderTopWidth: 2,
      borderTopColor: theme.color.border.subtle,
    },
    totalLabelFinal: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    totalValueFinal: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.color.text.success,
    },
    paymentStatusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[1.5],
      borderRadius: theme.radii.full,
      gap: theme.space[1.5],
    },
    paymentStatusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    paymentStatusText: {
      fontSize: 13,
      fontWeight: '600',
    },
    paymentSummary: {
      flexDirection: 'row',
      marginTop: theme.space[4],
      paddingTop: theme.space[3],
      borderTopWidth: 1,
      borderTopColor: theme.color.background.muted,
    },
    paymentSummaryItem: {
      flex: 1,
      alignItems: 'center',
    },
    paymentSummaryLabel: {
      fontSize: 11,
      color: theme.color.text.subtle,
      fontWeight: '500',
      marginBottom: theme.space[1],
    },
    paymentSummaryValue: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    paymentsContainer: {
      gap: theme.space[3],
    },
    paymentCard: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      padding: theme.space[4],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      ...theme.shadow.sm,
    },
    paymentHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[2],
    },
    paymentAmount: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.color.text.success,
    },
    paymentDate: {
      fontSize: 13,
      color: theme.color.text.subtle,
    },
    paymentMethodContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[1.5],
    },
    paymentMethod: {
      fontSize: 13,
      color: theme.color.text.muted,
    },
    paymentReference: {
      fontSize: 12,
      color: theme.color.text.placeholder,
      marginTop: theme.space[1],
    },
    emptyContainer: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      padding: theme.space[8],
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    emptyText: {
      fontSize: 14,
      color: theme.color.text.placeholder,
    },
    noteCard: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      padding: theme.space[4],
      marginBottom: theme.space[3],
      borderWidth: 1,
      borderColor: theme.color.state.warning.border,
      ...theme.shadow.sm,
    },
    noteHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[3],
      paddingBottom: theme.space[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.background.muted,
    },
    noteNumber: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    noteStatusBadge: {
      paddingHorizontal: theme.space[2.5],
      paddingVertical: theme.space[1],
      borderRadius: theme.radii.md,
    },
    noteStatusText: {
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    downloadNoteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.color.brand.accent,
      padding: theme.space[3],
      borderRadius: theme.radii.lg,
      marginTop: theme.space[3],
      gap: theme.space[2],
    },
    downloadNoteButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.inverse,
    },
    actionsSection: {
      gap: theme.space[3],
      marginTop: theme.space[4],
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.color.state.success.border,
      padding: theme.space[4],
      borderRadius: theme.radii.xl,
      gap: theme.space[2],
      ...theme.shadow.sm,
    },
    disabledActionButton: {
      opacity: 0.7,
    },
    actionButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.inverse,
    },
    bottomSpacer: {
      height: theme.space[10],
    },
    // Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: theme.color.surface.base,
      borderTopLeftRadius: theme.radii['2xl'],
      borderTopRightRadius: theme.radii['2xl'],
      maxHeight: '70%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: theme.space[5],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    modalBody: {
      padding: theme.space[5],
    },
    modalDescription: {
      fontSize: 15,
      color: theme.color.text.muted,
      marginBottom: theme.space[4],
    },
    modalOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.space[4],
      backgroundColor: theme.color.background.subtle,
      borderRadius: theme.radii.xl,
      marginBottom: theme.space[3],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    disabledModalOption: {
      opacity: 0.7,
    },
    modalOptionIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.color.state.warning.background,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.space[4],
    },
    modalOptionIconText: {
      fontSize: 24,
      fontWeight: '700',
    },
    modalOptionContent: {
      flex: 1,
    },
    modalOptionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[0.5],
    },
    modalOptionSubtitle: {
      fontSize: 13,
      color: theme.color.text.subtle,
    },
    // Returned badge on product cards
    returnedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[1.5],
      marginTop: theme.space[3],
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[1.5],
      borderRadius: theme.radii.md,
      alignSelf: 'flex-start',
    },
    returnedBadgeText: {
      fontSize: 12,
      fontWeight: '600',
    },
    // Credit note modal - partial
    cnFieldLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.subtle,
      textTransform: 'uppercase',
      marginBottom: theme.space[2],
      marginTop: theme.space[2],
    },
    cnModeRow: {
      flexDirection: 'row',
      gap: theme.space[2],
      marginBottom: theme.space[3],
    },
    cnModeButton: {
      flex: 1,
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[3],
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      backgroundColor: theme.color.background.subtle,
      alignItems: 'center',
    },
    cnModeButtonActive: {
      borderColor: theme.color.brand.accent,
      backgroundColor: theme.color.state.info.background,
    },
    cnModeText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.subtle,
    },
    cnModeTextActive: {
      color: theme.color.brand.accent,
    },
    cnMotivoRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[2],
      marginBottom: theme.space[3],
    },
    cnMotivoChip: {
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[3],
      borderRadius: theme.radii.full,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      backgroundColor: theme.color.background.subtle,
    },
    cnMotivoChipActive: {
      borderColor: theme.color.brand.accent,
      backgroundColor: theme.color.brand.accent,
    },
    cnMotivoChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.subtle,
    },
    cnMotivoChipTextActive: {
      color: theme.color.text.inverse,
    },
    cnTextInput: {
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      borderRadius: theme.radii.lg,
      padding: theme.space[3],
      fontSize: 14,
      color: theme.color.text.body,
      backgroundColor: theme.color.surface.base,
      minHeight: 60,
      textAlignVertical: 'top',
    },
    cnItemCard: {
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      borderRadius: theme.radii.lg,
      padding: theme.space[3],
      marginBottom: theme.space[2],
      backgroundColor: theme.color.surface.base,
    },
    cnItemCardSelected: {
      borderColor: theme.color.brand.accent,
      backgroundColor: theme.color.state.info.background,
    },
    cnItemCardDisabled: {
      opacity: 0.55,
      backgroundColor: theme.color.background.muted,
    },
    cnItemHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    cnItemName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    cnItemMeta: {
      fontSize: 12,
      color: theme.color.text.subtle,
      marginTop: theme.space[0.5],
    },
    cnItemQtyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      marginTop: theme.space[3],
      paddingTop: theme.space[3],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
    },
    cnItemQtyLabel: {
      fontSize: 13,
      color: theme.color.text.body,
      flex: 1,
    },
    cnItemQtyInput: {
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.md,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2],
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.body,
      backgroundColor: theme.color.surface.base,
      minWidth: 70,
      textAlign: 'center',
    },
    cnItemQtyMax: {
      fontSize: 13,
      color: theme.color.text.subtle,
      fontWeight: '600',
    },
    cnTotalInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      padding: theme.space[3],
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.state.warning.background,
      marginTop: theme.space[2],
    },
    cnTotalInfoText: {
      flex: 1,
      fontSize: 13,
      color: theme.color.state.warning.text,
    },
    cnFooter: {
      flexDirection: 'row',
      gap: theme.space[3],
      padding: theme.space[4],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.base,
    },
    cnCancelButton: {
      flex: 1,
      paddingVertical: theme.space[3],
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cnCancelText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.body,
    },
    cnSubmitButton: {
      flex: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space[2],
      paddingVertical: theme.space[3],
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.state.warning.border,
    },
    cnSubmitText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.color.text.inverse,
    },
  });
