import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { photoCampaignsApi } from '@/services/api';
import {
  CampaignVideoAspectRatio,
  CampaignVideoSectionKind,
  CampaignVideoSectionStatus,
  CampaignVideoStatus,
  PhotoCampaignProductItem,
  PhotoType,
  ProductPhotoAsset,
} from '@/types/photo-campaigns';
import {
  useCampaignVideoDetail,
  useCampaignVideos,
  useCreateCampaignVideo,
  useDeleteCampaignVideo,
  useReassembleCampaignVideo,
  useRegenerateVideoSection,
} from '@/hooks/api/useCampaignVideos';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/constants/permissions';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';

interface CampaignVideoModalProps {
  visible: boolean;
  photoCampaignId: string;
  photoCampaignName?: string;
  onClose: () => void;
}

/** Foto seleccionable enriquecida con datos de su producto. */
interface SelectableAsset {
  id: string;
  fileUrl: string;
  photoType: PhotoType;
  productId: string;
  productTitle: string;
}

const ASPECT_RATIOS: CampaignVideoAspectRatio[] = ['9:16', '1:1', '4:5', '16:9'];
const SECTION_DURATIONS = [3, 4, 5, 6, 7, 8, 9, 10];

const PHOTO_TYPE_LABELS: Record<PhotoType, string> = {
  reference: 'Referencia',
  design: 'Diseño',
  price: 'Con precio',
};

const VIDEO_STATUS_LABELS: Record<CampaignVideoStatus, string> = {
  pending: 'Pendiente',
  generating: 'Generando',
  assembling: 'Ensamblando',
  done: 'Listo',
  error: 'Error',
};

const SECTION_STATUS_LABELS: Record<CampaignVideoSectionStatus, string> = {
  pending: 'En cola',
  processing: 'Procesando',
  done: 'Listo',
  error: 'Error',
};

const SECTION_KIND_LABELS: Record<CampaignVideoSectionKind, string> = {
  intro: 'Intro',
  product: 'Producto',
  outro: 'Cierre',
};

const isBusyVideoStatus = (status: CampaignVideoStatus): boolean =>
  status === 'pending' || status === 'generating' || status === 'assembling';

const formatDuration = (seconds?: number | null): string => {
  if (!seconds || seconds <= 0) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
};

const formatBytes = (bytes?: number | null): string => {
  if (!bytes || bytes <= 0) return '—';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
};

const formatDate = (iso?: string): string => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

/**
 * Modal del pipeline de video publicitario IA a partir de una campaña de fotos.
 *
 * Dos vistas:
 * - Lista + creación: elige y ordena fotos (ese orden = prioridad de aparición),
 *   configura aspecto/tono/duración y dispara la generación.
 * - Detalle: hace polling del video, muestra progreso por sección y permite
 *   regenerar secciones, re-armar, descargar/reproducir y eliminar.
 */
export const CampaignVideoModal: React.FC<CampaignVideoModalProps> = ({
  visible,
  photoCampaignId,
  photoCampaignName,
  onClose,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { hasAnyPermission } = usePermissions();

  const canGenerate = hasAnyPermission([PERMISSIONS.PHOTO_CAMPAIGNS.VIDEO.GENERATE]);
  const canDownload = hasAnyPermission([PERMISSIONS.PHOTO_CAMPAIGNS.VIDEO.DOWNLOAD]);

  // ----- Vista activa -----
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  // ----- Carga de fotos de la campaña -----
  const [products, setProducts] = useState<PhotoCampaignProductItem[]>([]);
  const [photosByProduct, setPhotosByProduct] = useState<Record<string, ProductPhotoAsset[]>>({});
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  // ----- Selección ordenada + configuración -----
  const [orderedSelection, setOrderedSelection] = useState<SelectableAsset[]>([]);
  const [aspectRatio, setAspectRatio] = useState<CampaignVideoAspectRatio>('9:16');
  const [tone, setTone] = useState('');
  const [sectionDurationSec, setSectionDurationSec] = useState(5);

  // ----- Hooks de datos -----
  const videosQ = useCampaignVideos(photoCampaignId, visible);
  const detailQ = useCampaignVideoDetail(
    selectedVideoId || undefined,
    visible && !!selectedVideoId
  );
  const createMut = useCreateCampaignVideo(photoCampaignId);
  const regenMut = useRegenerateVideoSection(selectedVideoId || undefined);
  const reassembleMut = useReassembleCampaignVideo(selectedVideoId || undefined);
  const deleteMut = useDeleteCampaignVideo(photoCampaignId);

  const resetCreateForm = useCallback(() => {
    setOrderedSelection([]);
    setAspectRatio('9:16');
    setTone('');
    setSectionDurationSec(5);
  }, []);

  // Al abrir: reset de la vista y carga de productos + fotos.
  useEffect(() => {
    if (!visible || !photoCampaignId) {
      return;
    }

    setSelectedVideoId(null);
    resetCreateForm();

    let cancelled = false;

    const load = async () => {
      try {
        setLoadingPhotos(true);
        const productsResp = await photoCampaignsApi
          .getCampaignProducts(photoCampaignId)
          .catch(() => [] as PhotoCampaignProductItem[]);
        if (cancelled) return;
        setProducts(productsResp);

        const entries = await Promise.all(
          productsResp.map(async (item) => {
            const assets = await photoCampaignsApi
              .getProductPhotos(item.productId)
              .catch(() => [] as ProductPhotoAsset[]);
            return [item.productId, assets.filter((a) => a.isActive)] as const;
          })
        );
        if (cancelled) return;
        const map: Record<string, ProductPhotoAsset[]> = {};
        entries.forEach(([productId, assets]) => {
          map[productId] = assets;
        });
        setPhotosByProduct(map);
      } catch (error) {
        logger.error('[CAMPAIGN_VIDEO] Error cargando fotos de la campaña', error);
      } finally {
        if (!cancelled) setLoadingPhotos(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [visible, photoCampaignId, resetCreateForm]);

  const productTitleById = useMemo(() => {
    const map: Record<string, string> = {};
    products.forEach((item) => {
      map[item.productId] = item.product?.title || item.productId;
    });
    return map;
  }, [products]);

  const selectedIds = useMemo(() => new Set(orderedSelection.map((a) => a.id)), [orderedSelection]);

  const toggleAsset = useCallback(
    (asset: ProductPhotoAsset) => {
      setOrderedSelection((prev) => {
        if (prev.some((a) => a.id === asset.id)) {
          return prev.filter((a) => a.id !== asset.id);
        }
        return [
          ...prev,
          {
            id: asset.id,
            fileUrl: asset.fileUrl,
            photoType: asset.photoType,
            productId: asset.productId,
            productTitle: productTitleById[asset.productId] || asset.productId,
          },
        ];
      });
    },
    [productTitleById]
  );

  const moveAsset = useCallback((index: number, direction: -1 | 1) => {
    setOrderedSelection((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }, []);

  const removeAsset = useCallback((id: string) => {
    setOrderedSelection((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleCreate = useCallback(() => {
    if (orderedSelection.length === 0) {
      Alert.alert('Validación', 'Selecciona al menos una foto para generar el video.');
      return;
    }
    createMut.mutate(
      {
        photoAssetIds: orderedSelection.map((a) => a.id),
        aspectRatio,
        tone: tone.trim() || undefined,
        sectionDurationSec,
      },
      {
        onSuccess: (video) => {
          setSelectedVideoId(video.id);
        },
        onError: (error: any) => {
          Alert.alert(
            'No se pudo crear el video',
            error?.response?.data?.message || error?.message || 'Intenta nuevamente.'
          );
        },
      }
    );
  }, [orderedSelection, aspectRatio, tone, sectionDurationSec, createMut]);

  const handleOpenDownload = useCallback((url?: string | null) => {
    if (!url) return;
    Linking.openURL(url).catch((error) => {
      logger.error('[CAMPAIGN_VIDEO] Error abriendo el video', error);
      Alert.alert('Error', 'No se pudo abrir el video.');
    });
  }, []);

  const handleRegenerate = useCallback(
    (sectionId: string) => {
      regenMut.mutate(sectionId, {
        onError: (error: any) => {
          Alert.alert('Error', error?.message || 'No se pudo regenerar la sección.');
        },
      });
    },
    [regenMut]
  );

  const handleReassemble = useCallback(() => {
    reassembleMut.mutate(undefined, {
      onError: (error: any) => {
        Alert.alert(
          'No se puede re-armar',
          error?.response?.data?.message ||
            'Todas las secciones deben estar listas antes de re-armar el video.'
        );
      },
    });
  }, [reassembleMut]);

  const handleDelete = useCallback(
    (videoId: string) => {
      Alert.alert('Eliminar video', '¿Seguro que deseas eliminar este video?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            deleteMut.mutate(videoId, {
              onSuccess: () => {
                if (selectedVideoId === videoId) setSelectedVideoId(null);
              },
              onError: (error: any) => {
                Alert.alert('Error', error?.message || 'No se pudo eliminar el video.');
              },
            });
          },
        },
      ]);
    },
    [deleteMut, selectedVideoId]
  );

  const renderStatusBadge = (label: string, variant: 'success' | 'warning' | 'danger' | 'info') => {
    const palette = theme.color.state[variant];
    return (
      <View style={[styles.badge, { backgroundColor: palette.background }]}>
        <Text style={[styles.badgeText, { color: palette.text }]}>{label}</Text>
      </View>
    );
  };

  const videoStatusVariant = (
    status: CampaignVideoStatus
  ): 'success' | 'warning' | 'danger' | 'info' => {
    if (status === 'done') return 'success';
    if (status === 'error') return 'danger';
    if (status === 'pending') return 'warning';
    return 'info';
  };

  const sectionStatusVariant = (
    status: CampaignVideoSectionStatus
  ): 'success' | 'warning' | 'danger' | 'info' => {
    if (status === 'done') return 'success';
    if (status === 'error') return 'danger';
    if (status === 'pending') return 'warning';
    return 'info';
  };

  // ============================================
  // Render: vista de DETALLE (polling del video)
  // ============================================
  const renderDetail = () => {
    const video = detailQ.data;

    if (detailQ.isLoading && !video) {
      return (
        <View style={styles.centerBox}>
          <ActivityIndicator size="small" color={theme.color.brand.accent} />
          <Text style={styles.mutedText}>Cargando video...</Text>
        </View>
      );
    }

    if (!video) {
      return (
        <View style={styles.centerBox}>
          <Text style={styles.mutedText}>No se pudo cargar el video.</Text>
        </View>
      );
    }

    const allSectionsDone =
      video.sections.length > 0 && video.sections.every((s) => s.status === 'done');
    const busy = isBusyVideoStatus(video.status);

    return (
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity style={styles.backRow} onPress={() => setSelectedVideoId(null)}>
          <Ionicons name="chevron-back" size={16} color={theme.color.brand.accent} />
          <Text style={styles.linkText}>Volver a la lista</Text>
        </TouchableOpacity>

        <View style={styles.detailHeader}>
          {renderStatusBadge(VIDEO_STATUS_LABELS[video.status], videoStatusVariant(video.status))}
          {busy && <ActivityIndicator size="small" color={theme.color.brand.accent} />}
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>Aspecto: {video.aspectRatio}</Text>
          <Text style={styles.metaText}>Duración: {formatDuration(video.durationSeconds)}</Text>
          <Text style={styles.metaText}>Tamaño: {formatBytes(video.finalFileSize)}</Text>
        </View>

        {!!video.error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{video.error}</Text>
          </View>
        )}

        {busy && (
          <Text style={styles.hintText}>
            La generación puede tardar varios minutos. Puedes cerrar el modal; el progreso continúa
            en segundo plano.
          </Text>
        )}

        {/* Descargar / reproducir */}
        {video.status === 'done' && !!video.downloadUrl && canDownload && (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => handleOpenDownload(video.downloadUrl)}
          >
            <Ionicons name="play-circle" size={18} color={theme.color.action.primary.text} />
            <Text style={styles.primaryButtonText}>Reproducir / Descargar</Text>
          </TouchableOpacity>
        )}

        {/* Secciones */}
        <Text style={styles.sectionLabel}>Secciones</Text>
        {[...video.sections]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((section) => {
            const kindLabel = SECTION_KIND_LABELS[section.kind];
            const productTitle = section.productId
              ? productTitleById[section.productId]
              : undefined;
            return (
              <View key={section.id} style={styles.sectionCard}>
                <View style={styles.sectionCardHeader}>
                  <View style={styles.sectionCardTitleWrap}>
                    <Text style={styles.sectionCardTitle}>
                      {section.sortOrder + 1}. {kindLabel}
                      {productTitle ? ` · ${productTitle}` : ''}
                    </Text>
                    {!!section.priceLabel && (
                      <Text style={styles.sectionPrice}>{section.priceLabel}</Text>
                    )}
                  </View>
                  {renderStatusBadge(
                    SECTION_STATUS_LABELS[section.status],
                    sectionStatusVariant(section.status)
                  )}
                </View>

                {!!section.scriptText && (
                  <Text style={styles.sectionScript} numberOfLines={3}>
                    “{section.scriptText}”
                  </Text>
                )}

                {!!section.error && <Text style={styles.errorText}>{section.error}</Text>}

                {canGenerate && (
                  <TouchableOpacity
                    style={styles.ghostButton}
                    onPress={() => handleRegenerate(section.id)}
                    disabled={regenMut.isPending || section.status === 'processing'}
                  >
                    <Ionicons name="refresh" size={14} color={theme.color.brand.accent} />
                    <Text style={styles.ghostButtonText}>Regenerar</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}

        {/* Acciones globales */}
        <View style={styles.detailActions}>
          {canGenerate && (
            <TouchableOpacity
              style={[styles.secondaryButton, !allSectionsDone && styles.disabledButton]}
              onPress={handleReassemble}
              disabled={!allSectionsDone || reassembleMut.isPending}
            >
              {reassembleMut.isPending ? (
                <ActivityIndicator size="small" color={theme.color.text.heading} />
              ) : (
                <Text style={styles.secondaryButtonText}>Re-armar video</Text>
              )}
            </TouchableOpacity>
          )}
          {canGenerate && (
            <TouchableOpacity
              style={styles.dangerButton}
              onPress={() => handleDelete(video.id)}
              disabled={deleteMut.isPending}
            >
              <Text style={styles.dangerButtonText}>Eliminar</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    );
  };

  // ============================================
  // Render: vista de LISTA + CREACIÓN
  // ============================================
  const renderList = () => {
    const videos = videosQ.data || [];

    return (
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Videos generados */}
        <Text style={styles.sectionLabel}>Videos generados</Text>
        {videosQ.isLoading ? (
          <View style={styles.inlineLoadingRow}>
            <ActivityIndicator size="small" color={theme.color.brand.accent} />
            <Text style={styles.mutedText}>Cargando videos...</Text>
          </View>
        ) : videos.length === 0 ? (
          <Text style={styles.mutedText}>Aún no hay videos para esta campaña.</Text>
        ) : (
          videos.map((video) => (
            <TouchableOpacity
              key={video.id}
              style={styles.videoRow}
              onPress={() => setSelectedVideoId(video.id)}
            >
              <View style={styles.videoRowInfo}>
                {renderStatusBadge(
                  VIDEO_STATUS_LABELS[video.status],
                  videoStatusVariant(video.status)
                )}
                <Text style={styles.videoRowMeta}>
                  {video.aspectRatio} · {formatDuration(video.durationSeconds)}
                </Text>
                <Text style={styles.videoRowDate}>{formatDate(video.createdAt)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.color.text.muted} />
            </TouchableOpacity>
          ))
        )}

        {!canGenerate ? (
          <Text style={styles.hintText}>No tienes permiso para generar videos.</Text>
        ) : (
          <>
            {/* Configuración */}
            <Text style={styles.sectionLabel}>Nuevo video</Text>

            <Text style={styles.fieldLabel}>Relación de aspecto</Text>
            <View style={styles.chipRow}>
              {ASPECT_RATIOS.map((ratio) => {
                const selected = aspectRatio === ratio;
                return (
                  <TouchableOpacity
                    key={ratio}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => setAspectRatio(ratio)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {ratio}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Duración por clip de producto (s)</Text>
            <View style={styles.chipRow}>
              {SECTION_DURATIONS.map((dur) => {
                const selected = sectionDurationSec === dur;
                return (
                  <TouchableOpacity
                    key={dur}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => setSectionDurationSec(dur)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {dur}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Tono del guion (opcional)</Text>
            <TextInput
              style={styles.input}
              value={tone}
              onChangeText={setTone}
              placeholder="Ej: energico y cercano"
              placeholderTextColor={theme.color.text.placeholder}
            />

            {/* Orden de aparición */}
            <Text style={styles.fieldLabel}>Orden de aparición ({orderedSelection.length})</Text>
            {orderedSelection.length === 0 ? (
              <Text style={styles.mutedText}>
                Toca las fotos de abajo para agregarlas en el orden deseado.
              </Text>
            ) : (
              orderedSelection.map((asset, index) => (
                <View key={asset.id} style={styles.orderRow}>
                  <Text style={styles.orderNumber}>{index + 1}</Text>
                  <Image source={{ uri: asset.fileUrl }} style={styles.orderThumb} />
                  <View style={styles.orderInfo}>
                    <Text style={styles.orderTitle} numberOfLines={1}>
                      {asset.productTitle}
                    </Text>
                    <Text style={styles.orderType}>{PHOTO_TYPE_LABELS[asset.photoType]}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.orderIconBtn}
                    onPress={() => moveAsset(index, -1)}
                    disabled={index === 0}
                  >
                    <Ionicons
                      name="arrow-up"
                      size={16}
                      color={index === 0 ? theme.color.text.disabled : theme.color.brand.accent}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.orderIconBtn}
                    onPress={() => moveAsset(index, 1)}
                    disabled={index === orderedSelection.length - 1}
                  >
                    <Ionicons
                      name="arrow-down"
                      size={16}
                      color={
                        index === orderedSelection.length - 1
                          ? theme.color.text.disabled
                          : theme.color.brand.accent
                      }
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.orderIconBtn}
                    onPress={() => removeAsset(asset.id)}
                  >
                    <Ionicons name="close" size={16} color={theme.color.state.danger.text} />
                  </TouchableOpacity>
                </View>
              ))
            )}

            {/* Galería por producto */}
            <Text style={styles.fieldLabel}>Fotos de la campaña</Text>
            {loadingPhotos ? (
              <View style={styles.inlineLoadingRow}>
                <ActivityIndicator size="small" color={theme.color.brand.accent} />
                <Text style={styles.mutedText}>Cargando fotos...</Text>
              </View>
            ) : products.length === 0 ? (
              <Text style={styles.mutedText}>La campaña no tiene productos.</Text>
            ) : (
              products.map((item) => {
                const assets = photosByProduct[item.productId] || [];
                if (assets.length === 0) return null;
                return (
                  <View key={item.id} style={styles.productBlock}>
                    <Text style={styles.productBlockTitle} numberOfLines={1}>
                      {item.product?.title || item.productId}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {assets.map((asset) => {
                        const selected = selectedIds.has(asset.id);
                        const order = orderedSelection.findIndex((a) => a.id === asset.id);
                        return (
                          <TouchableOpacity
                            key={asset.id}
                            style={[styles.thumbWrap, selected && styles.thumbWrapSelected]}
                            onPress={() => toggleAsset(asset)}
                          >
                            <Image source={{ uri: asset.fileUrl }} style={styles.thumb} />
                            {selected && (
                              <View style={styles.thumbBadge}>
                                <Text style={styles.thumbBadgeText}>{order + 1}</Text>
                              </View>
                            )}
                            <Text style={styles.thumbType}>
                              {PHOTO_TYPE_LABELS[asset.photoType]}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>Video publicitario IA</Text>
              {!!photoCampaignName && (
                <Text style={styles.subtitle}>Campaña: {photoCampaignName}</Text>
              )}
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={20} color={theme.color.text.heading} />
            </TouchableOpacity>
          </View>

          {selectedVideoId ? renderDetail() : renderList()}

          {/* Footer: solo en vista de creación */}
          {!selectedVideoId && canGenerate && (
            <View style={styles.footer}>
              <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
                <Text style={styles.secondaryButtonText}>Cerrar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (orderedSelection.length === 0 || createMut.isPending) && styles.disabledButton,
                ]}
                onPress={handleCreate}
                disabled={orderedSelection.length === 0 || createMut.isPending}
              >
                {createMut.isPending ? (
                  <ActivityIndicator size="small" color={theme.color.action.primary.text} />
                ) : (
                  <>
                    <Ionicons name="videocam" size={18} color={theme.color.action.primary.text} />
                    <Text style={styles.primaryButtonText}>Generar video</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.space[4],
    },
    card: {
      width: '100%',
      maxWidth: 640,
      maxHeight: '90%',
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.surface.base,
      padding: theme.space[3.5],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      ...theme.shadow.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: theme.space[2],
      gap: theme.space[2],
    },
    headerText: {
      flex: 1,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    subtitle: {
      marginTop: theme.space[0.5],
      fontSize: 12,
      color: theme.color.text.muted,
    },
    closeButton: {
      padding: theme.space[1],
    },
    body: {
      flexGrow: 0,
    },
    bodyContent: {
      paddingBottom: theme.space[2],
    },
    centerBox: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space[2],
      paddingVertical: theme.space[6],
    },
    mutedText: {
      color: theme.color.text.muted,
      fontSize: 12,
      paddingVertical: theme.space[1],
    },
    hintText: {
      color: theme.color.text.muted,
      fontSize: 12,
      fontStyle: 'italic',
      marginTop: theme.space[2],
    },
    sectionLabel: {
      marginTop: theme.space[3],
      marginBottom: theme.space[2],
      fontSize: 13,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    fieldLabel: {
      marginTop: theme.space[3],
      marginBottom: theme.space[1.5],
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.body,
    },
    inlineLoadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      paddingVertical: theme.space[2],
    },
    // ----- Badge -----
    badge: {
      alignSelf: 'flex-start',
      paddingHorizontal: theme.space[2],
      paddingVertical: theme.space[0.5],
      borderRadius: theme.radii.full,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '700',
    },
    // ----- Chips -----
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[2],
    },
    chip: {
      paddingVertical: theme.space[1.5],
      paddingHorizontal: theme.space[3],
      borderRadius: theme.radii.full,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.background.subtle,
    },
    chipSelected: {
      borderColor: theme.color.brand.accent,
      backgroundColor: theme.color.brand.accentSoft,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    chipTextSelected: {
      color: theme.color.brand.accent,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.background.subtle,
      color: theme.color.text.body,
      paddingHorizontal: theme.space[2.5],
      paddingVertical: theme.space[2],
    },
    // ----- Orden -----
    orderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      paddingVertical: theme.space[1.5],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    orderNumber: {
      width: 20,
      textAlign: 'center',
      fontSize: 13,
      fontWeight: '700',
      color: theme.color.brand.accent,
    },
    orderThumb: {
      width: 40,
      height: 40,
      borderRadius: theme.radii.sm,
      backgroundColor: theme.color.background.subtle,
    },
    orderInfo: {
      flex: 1,
    },
    orderTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    orderType: {
      fontSize: 11,
      color: theme.color.text.muted,
    },
    orderIconBtn: {
      padding: theme.space[1.5],
    },
    // ----- Galería -----
    productBlock: {
      marginBottom: theme.space[2],
    },
    productBlockTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    thumbWrap: {
      width: 72,
      marginRight: theme.space[2],
      borderRadius: theme.radii.md,
      borderWidth: 2,
      borderColor: 'transparent',
      padding: 2,
    },
    thumbWrapSelected: {
      borderColor: theme.color.brand.accent,
    },
    thumb: {
      width: '100%',
      height: 72,
      borderRadius: theme.radii.sm,
      backgroundColor: theme.color.background.subtle,
    },
    thumbBadge: {
      position: 'absolute',
      top: 4,
      right: 4,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 9,
      backgroundColor: theme.color.brand.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    thumbBadgeText: {
      color: theme.color.text.inverse,
      fontSize: 10,
      fontWeight: '700',
    },
    thumbType: {
      fontSize: 10,
      color: theme.color.text.muted,
      textAlign: 'center',
      marginTop: 2,
    },
    // ----- Detalle -----
    backRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[1],
      paddingVertical: theme.space[1],
    },
    linkText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.color.brand.accent,
    },
    detailHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      marginTop: theme.space[2],
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[3],
      marginTop: theme.space[2],
    },
    metaText: {
      fontSize: 12,
      color: theme.color.text.muted,
    },
    errorBox: {
      marginTop: theme.space[2],
      padding: theme.space[2],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.state.danger.background,
    },
    errorText: {
      fontSize: 12,
      color: theme.color.state.danger.text,
      marginTop: theme.space[1],
    },
    sectionCard: {
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      borderRadius: theme.radii.md,
      padding: theme.space[2.5],
      marginBottom: theme.space[2],
      backgroundColor: theme.color.background.subtle,
    },
    sectionCardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: theme.space[2],
    },
    sectionCardTitleWrap: {
      flex: 1,
    },
    sectionCardTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    sectionPrice: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.color.brand.accent,
      marginTop: theme.space[0.5],
    },
    sectionScript: {
      fontSize: 12,
      color: theme.color.text.body,
      fontStyle: 'italic',
      marginTop: theme.space[1.5],
    },
    ghostButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[1],
      alignSelf: 'flex-start',
      marginTop: theme.space[2],
      paddingVertical: theme.space[1],
      paddingHorizontal: theme.space[2],
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    ghostButtonText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.color.brand.accent,
    },
    detailActions: {
      flexDirection: 'row',
      gap: theme.space[2],
      marginTop: theme.space[3],
    },
    // ----- Lista de videos -----
    videoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[2.5],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      borderRadius: theme.radii.md,
      marginBottom: theme.space[2],
      backgroundColor: theme.color.background.subtle,
    },
    videoRowInfo: {
      flex: 1,
      gap: theme.space[1],
    },
    videoRowMeta: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.body,
    },
    videoRowDate: {
      fontSize: 11,
      color: theme.color.text.muted,
    },
    // ----- Botones -----
    footer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: theme.space[2],
      marginTop: theme.space[2],
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space[1.5],
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[3],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.action.primary.background,
      marginTop: theme.space[2],
      minWidth: 150,
    },
    primaryButtonText: {
      color: theme.color.action.primary.text,
      fontWeight: '700',
      fontSize: 13,
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
      fontSize: 13,
    },
    dangerButton: {
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[3],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.state.danger.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dangerButtonText: {
      color: theme.color.state.danger.text,
      fontWeight: '700',
      fontSize: 13,
    },
    disabledButton: {
      opacity: 0.5,
    },
  });

export default CampaignVideoModal;
