/**
 * NotasDiscrepanciaModal - Modal de notas de discrepancia
 * Migrado al Design System unificado
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { repartosService } from '@/services/api';
import {
  TransferReportDiscrepancy,
  DiscrepancyNote,
  NoteType,
  NoteSeverity,
  NoteTypeLabels,
  NoteSeverityLabels,
  NoteSeverityColors,
  NoteStatus,
} from '@/types/consolidated-reports';
import { useAuthStore } from '@/store/auth';
import logger from '@/utils/logger';
import {
  colors,
  spacing,
  borderRadius,
  shadows,
  Title,
  Body,
  Label,
  Caption,
  Card,
  Button,
  Input,
  IconButton,
  EmptyState,
} from '@/design-system';

interface NotasDiscrepanciaModalProps {
  visible: boolean;
  reportId: string | null;
  discrepancy: TransferReportDiscrepancy | null;
  onClose: () => void;
  onNotesUpdated?: () => void;
}

export const NotasDiscrepanciaModal: React.FC<NotasDiscrepanciaModalProps> = ({
  visible,
  reportId,
  discrepancy,
  onClose,
  onNotesUpdated,
}) => {
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<DiscrepancyNote[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingNote, setEditingNote] = useState<DiscrepancyNote | null>(null);

  // Form fields
  const [noteType, setNoteType] = useState<NoteType>(NoteType.OTHER);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<NoteSeverity>(NoteSeverity.LOW);
  const [requiresAction, setRequiresAction] = useState(false);
  const [actionTaken, setActionTaken] = useState('');

  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;
  const { user } = useAuthStore();

  useEffect(() => {
    if (visible && reportId && discrepancy) {
      loadNotes();
    }
  }, [visible, reportId, discrepancy]);

  const loadNotes = async () => {
    if (!reportId || !discrepancy) return;

    try {
      setLoading(true);
      logger.info('📝 Cargando notas de discrepancia:', discrepancy.id);
      const data = await repartosService.getDiscrepancyNotes(reportId, discrepancy.id);
      setNotes(data);
      logger.info('✅ Notas cargadas:', data.length);
    } catch (error: any) {
      logger.error('Error cargando notas:', error);
      Alert.alert('Error', 'No se pudieron cargar las notas');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setNoteType(NoteType.OTHER);
    setTitle('');
    setDescription('');
    setSeverity(NoteSeverity.LOW);
    setRequiresAction(false);
    setActionTaken('');
    setEditingNote(null);
  };

  const handleCreateNote = async () => {
    if (!reportId || !discrepancy) return;

    if (!title.trim() || !description.trim()) {
      Alert.alert('Error', 'El título y la descripción son obligatorios');
      return;
    }

    try {
      setLoading(true);
      const userName = user?.name || user?.email || 'Usuario';

      await repartosService.createDiscrepancyNote(reportId, discrepancy.id, {
        noteType,
        title: title.trim(),
        description: description.trim(),
        severity,
        requiresAction,
        createdByName: userName,
      });

      Alert.alert('Éxito', 'Nota creada exitosamente');
      resetForm();
      setShowCreateForm(false);
      loadNotes();
      if (onNotesUpdated) onNotesUpdated();
    } catch (error: any) {
      logger.error('Error creando nota:', error);
      Alert.alert('Error', error.response?.data?.message || 'No se pudo crear la nota');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateNote = async () => {
    if (!reportId || !discrepancy || !editingNote) return;

    if (!description.trim()) {
      Alert.alert('Error', 'La descripción es obligatoria');
      return;
    }

    try {
      setLoading(true);
      const userName = user?.name || user?.email || 'Usuario';

      await repartosService.updateDiscrepancyNote(
        reportId,
        discrepancy.id,
        editingNote.id,
        {
          description: description.trim(),
          actionTaken: actionTaken.trim() || undefined,
          requiresAction,
          updatedByName: userName,
        }
      );

      Alert.alert('Éxito', 'Nota actualizada exitosamente');
      resetForm();
      loadNotes();
      if (onNotesUpdated) onNotesUpdated();
    } catch (error: any) {
      logger.error('Error actualizando nota:', error);
      Alert.alert('Error', error.response?.data?.message || 'No se pudo actualizar la nota');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseNote = async (note: DiscrepancyNote) => {
    if (!reportId || !discrepancy) return;

    Alert.alert(
      'Cerrar Nota',
      '¿Estás seguro de que deseas cerrar esta nota?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const userName = user?.name || user?.email || 'Usuario';

              await repartosService.closeDiscrepancyNote(reportId, discrepancy.id, note.id, {
                closedByName: userName,
              });

              Alert.alert('Éxito', 'Nota cerrada exitosamente');
              loadNotes();
              if (onNotesUpdated) onNotesUpdated();
            } catch (error: any) {
              logger.error('Error cerrando nota:', error);
              Alert.alert('Error', error.response?.data?.message || 'No se pudo cerrar la nota');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteNote = async (note: DiscrepancyNote) => {
    if (!reportId || !discrepancy) return;

    Alert.alert(
      'Eliminar Nota',
      '¿Estás seguro de que deseas eliminar esta nota? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await repartosService.deleteDiscrepancyNote(reportId, discrepancy.id, note.id);
              Alert.alert('Éxito', 'Nota eliminada exitosamente');
              loadNotes();
              if (onNotesUpdated) onNotesUpdated();
            } catch (error: any) {
              logger.error('Error eliminando nota:', error);
              Alert.alert('Error', error.response?.data?.message || 'No se pudo eliminar la nota');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleEditNote = (note: DiscrepancyNote) => {
    setEditingNote(note);
    setDescription(note.description);
    setActionTaken(note.actionTaken || '');
    setRequiresAction(note.requiresAction);
    setShowCreateForm(true);
  };

  const renderNoteCard = (note: DiscrepancyNote) => {
    const isOpen = note.status === NoteStatus.OPEN;

    return (
      <View key={note.id} style={isTablet ? { ...styles.noteCard, ...styles.noteCardTablet } : styles.noteCard}>
        {/* Header */}
        <View style={styles.noteHeader}>
          <View style={{ flex: 1 }}>
            <Title size="small" style={{ marginBottom: spacing[2] }}>
              {note.title}
            </Title>
            <View style={styles.noteMetaRow}>
              <View
                style={[
                  styles.typeBadge,
                  { backgroundColor: NoteSeverityColors[note.severity] + '20' },
                ]}
              >
                <Caption style={{ fontWeight: '600', color: NoteSeverityColors[note.severity] }}>
                  {NoteTypeLabels[note.noteType]}
                </Caption>
              </View>
              <View
                style={[
                  styles.severityBadge,
                  { backgroundColor: NoteSeverityColors[note.severity] + '20' },
                ]}
              >
                <Caption style={{ fontWeight: '600', color: NoteSeverityColors[note.severity] }}>
                  {NoteSeverityLabels[note.severity]}
                </Caption>
              </View>
              {!isOpen && (
                <View style={styles.closedBadge}>
                  <Caption color="secondary" style={{ fontWeight: '600' }}>Cerrada</Caption>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Description */}
        <Body style={{ marginBottom: spacing[3] }}>
          {note.description}
        </Body>

        {/* Action Taken */}
        {note.actionTaken && (
          <View style={styles.actionTakenContainer}>
            <Label style={{ color: colors.success[700], marginBottom: spacing[1] }}>
              Acción tomada:
            </Label>
            <Caption style={{ color: colors.success[700] }}>
              {note.actionTaken}
            </Caption>
          </View>
        )}

        {/* Requires Action */}
        {note.requiresAction && (
          <View style={styles.requiresActionContainer}>
            <Caption style={{ fontWeight: '600', color: colors.warning[700] }}>
              ⚠️ Requiere acción
            </Caption>
          </View>
        )}

        {/* Footer */}
        <View style={styles.noteFooter}>
          <Caption color="secondary">
            Por: {note.createdByName}
          </Caption>
          <Caption color="tertiary">
            {new Date(note.createdAt).toLocaleDateString('es-PE')}
          </Caption>
        </View>

        {/* Actions */}
        {isOpen && (
          <View style={styles.noteActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={() => handleEditNote(note)}
            >
              <Caption style={{ fontWeight: '600' }}>✏️ Editar</Caption>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.closeNoteButton]}
              onPress={() => handleCloseNote(note)}
            >
              <Caption style={{ fontWeight: '600' }}>✓ Cerrar</Caption>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => handleDeleteNote(note)}
            >
              <Caption style={{ fontWeight: '600' }}>🗑️ Eliminar</Caption>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, isTablet ? styles.headerTablet : undefined]}>
          <View style={{ flex: 1 }}>
            <Title>Notas de Discrepancia</Title>
            {discrepancy && (
              <Caption color="secondary" style={{ marginTop: spacing[1] }}>
                {discrepancy.productName}
              </Caption>
            )}
          </View>
          <IconButton
            icon="close"
            variant="ghost"
            size="small"
            onPress={onClose}
          />
        </View>

        {loading && !showCreateForm ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent[500]} />
            <Body color="secondary" style={{ marginTop: spacing[3] }}>
              Cargando notas...
            </Body>
          </View>
        ) : showCreateForm ? (
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            <Label style={{ marginBottom: spacing[5] }}>
              {editingNote ? 'Editar Nota' : 'Nueva Nota Explicativa'}
            </Label>

            {!editingNote && (
              <>
                {/* Note Type */}
                <View style={styles.formGroup}>
                  <Label style={{ marginBottom: spacing[2] }}>
                    Tipo de Nota *
                  </Label>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={noteType}
                      onValueChange={(value) => setNoteType(value)}
                      style={styles.picker}
                    >
                      {Object.values(NoteType).map((type) => (
                        <Picker.Item
                          key={type}
                          label={NoteTypeLabels[type]}
                          value={type}
                        />
                      ))}
                    </Picker>
                  </View>
                </View>

                {/* Title */}
                <View style={styles.formGroup}>
                  <Label style={{ marginBottom: spacing[2] }}>Título *</Label>
                  <Input
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Ej: Productos dañados por lluvia"
                  />
                </View>

                {/* Severity */}
                <View style={styles.formGroup}>
                  <Label style={{ marginBottom: spacing[2] }}>Severidad *</Label>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={severity}
                      onValueChange={(value) => setSeverity(value)}
                      style={styles.picker}
                    >
                      {Object.values(NoteSeverity).map((sev) => (
                        <Picker.Item
                          key={sev}
                          label={NoteSeverityLabels[sev]}
                          value={sev}
                        />
                      ))}
                    </Picker>
                  </View>
                </View>
              </>
            )}

            {/* Description */}
            <View style={styles.formGroup}>
              <Label style={{ marginBottom: spacing[2] }}>Descripción *</Label>
              <Input
                value={description}
                onChangeText={setDescription}
                placeholder="Describe detalladamente qué sucedió..."
                multiline
                numberOfLines={4}
              />
            </View>

            {/* Action Taken (only for editing) */}
            {editingNote && (
              <View style={styles.formGroup}>
                <Label style={{ marginBottom: spacing[2] }}>
                  Acción Tomada
                </Label>
                <Input
                  value={actionTaken}
                  onChangeText={setActionTaken}
                  placeholder="Describe qué acción se tomó..."
                  multiline
                  numberOfLines={3}
                />
              </View>
            )}

            {/* Requires Action */}
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setRequiresAction(!requiresAction)}
            >
              <View style={[styles.checkbox, requiresAction ? styles.checkboxChecked : undefined]}>
                {requiresAction && <Body style={styles.checkboxCheck}>✓</Body>}
              </View>
              <Body>Requiere acción</Body>
            </TouchableOpacity>

            {/* Buttons */}
            <View style={styles.formButtons}>
              <Button
                title="Cancelar"
                variant="outline"
                onPress={() => {
                  resetForm();
                  setShowCreateForm(false);
                }}
                style={{ flex: 1 }}
              />
              <Button
                title={loading ? 'Guardando...' : editingNote ? 'Actualizar' : 'Crear Nota'}
                variant="primary"
                onPress={editingNote ? handleUpdateNote : handleCreateNote}
                disabled={loading}
                loading={loading}
                style={{ flex: 1 }}
              />
            </View>
          </ScrollView>
        ) : (
          <>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
              {notes.length > 0 ? (
                notes.map((note) => renderNoteCard(note))
              ) : (
                <EmptyState
                  icon="document-text-outline"
                  title="No hay notas explicativas"
                  description="Agrega una nota para explicar esta discrepancia"
                />
              )}
            </ScrollView>

            {/* Add Note Button */}
            <View style={styles.addButtonContainer}>
              <Button
                title="➕ Agregar Nota Explicativa"
                variant="primary"
                onPress={() => setShowCreateForm(true)}
                fullWidth
              />
            </View>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerTablet: {
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[6],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[4],
  },
  noteCard: {
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[3],
    ...shadows.md,
  },
  noteCardTablet: {
    padding: spacing[6],
    marginBottom: spacing[4],
  },
  noteHeader: {
    marginBottom: spacing[3],
  },
  noteMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  typeBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.lg,
  },
  severityBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.lg,
  },
  closedBadge: {
    backgroundColor: colors.border.light,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.lg,
  },
  actionTakenContainer: {
    backgroundColor: colors.status.active + '15',
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  requiresActionContainer: {
    backgroundColor: colors.status.pending + '20',
    borderRadius: borderRadius.lg,
    padding: spacing[2],
    marginBottom: spacing[3],
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  noteActions: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[3],
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: colors.primary.lighter,
  },
  closeNoteButton: {
    backgroundColor: colors.status.active + '20',
  },
  deleteButton: {
    backgroundColor: colors.status.cancelled + '20',
  },
  addButtonContainer: {
    padding: spacing[4],
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  formGroup: {
    marginBottom: spacing[4],
  },
  textArea: {
    minHeight: 100,
  },
  textAreaTablet: {
    minHeight: 120,
  },
  pickerContainer: {
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    color: colors.text.primary,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[5],
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    marginRight: spacing[3],
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  checkboxCheck: {
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: 'bold',
  },
  formButtons: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[2],
  },
});
