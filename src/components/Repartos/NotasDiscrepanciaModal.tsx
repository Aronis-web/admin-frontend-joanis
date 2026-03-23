import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
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
      <View key={note.id} style={[styles.noteCard, isTablet && styles.noteCardTablet]}>
        {/* Header */}
        <View style={styles.noteHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.noteTitle, isTablet && styles.noteTitleTablet]}>
              {note.title}
            </Text>
            <View style={styles.noteMetaRow}>
              <View
                style={[
                  styles.typeBadge,
                  { backgroundColor: NoteSeverityColors[note.severity] + '20' },
                ]}
              >
                <Text
                  style={[
                    styles.typeBadgeText,
                    { color: NoteSeverityColors[note.severity] },
                  ]}
                >
                  {NoteTypeLabels[note.noteType]}
                </Text>
              </View>
              <View
                style={[
                  styles.severityBadge,
                  { backgroundColor: NoteSeverityColors[note.severity] + '20' },
                ]}
              >
                <Text
                  style={[
                    styles.severityBadgeText,
                    { color: NoteSeverityColors[note.severity] },
                  ]}
                >
                  {NoteSeverityLabels[note.severity]}
                </Text>
              </View>
              {!isOpen && (
                <View style={styles.closedBadge}>
                  <Text style={styles.closedBadgeText}>Cerrada</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Description */}
        <Text style={[styles.noteDescription, isTablet && styles.noteDescriptionTablet]}>
          {note.description}
        </Text>

        {/* Action Taken */}
        {note.actionTaken && (
          <View style={styles.actionTakenContainer}>
            <Text style={[styles.actionTakenLabel, isTablet && styles.actionTakenLabelTablet]}>
              Acción tomada:
            </Text>
            <Text style={[styles.actionTakenText, isTablet && styles.actionTakenTextTablet]}>
              {note.actionTaken}
            </Text>
          </View>
        )}

        {/* Requires Action */}
        {note.requiresAction && (
          <View style={styles.requiresActionContainer}>
            <Text style={styles.requiresActionText}>⚠️ Requiere acción</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.noteFooter}>
          <Text style={[styles.noteAuthor, isTablet && styles.noteAuthorTablet]}>
            Por: {note.createdByName}
          </Text>
          <Text style={[styles.noteDate, isTablet && styles.noteDateTablet]}>
            {new Date(note.createdAt).toLocaleDateString('es-PE')}
          </Text>
        </View>

        {/* Actions */}
        {isOpen && (
          <View style={styles.noteActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={() => handleEditNote(note)}
            >
              <Text style={styles.actionButtonText}>✏️ Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.closeNoteButton]}
              onPress={() => handleCloseNote(note)}
            >
              <Text style={styles.actionButtonText}>✓ Cerrar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => handleDeleteNote(note)}
            >
              <Text style={styles.actionButtonText}>🗑️ Eliminar</Text>
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
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, isTablet && styles.titleTablet]}>
              Notas de Discrepancia
            </Text>
            {discrepancy && (
              <Text style={[styles.subtitle, isTablet && styles.subtitleTablet]}>
                {discrepancy.productName}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={[styles.closeButtonText, isTablet && styles.closeButtonTextTablet]}>
              ✕
            </Text>
          </TouchableOpacity>
        </View>

        {loading && !showCreateForm ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={[styles.loadingText, isTablet && styles.loadingTextTablet]}>
              Cargando notas...
            </Text>
          </View>
        ) : showCreateForm ? (
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            <Text style={[styles.formTitle, isTablet && styles.formTitleTablet]}>
              {editingNote ? 'Editar Nota' : 'Nueva Nota Explicativa'}
            </Text>

            {!editingNote && (
              <>
                {/* Note Type */}
                <View style={styles.formGroup}>
                  <Text style={[styles.label, isTablet && styles.labelTablet]}>
                    Tipo de Nota *
                  </Text>
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
                  <Text style={[styles.label, isTablet && styles.labelTablet]}>Título *</Text>
                  <TextInput
                    style={[styles.input, isTablet && styles.inputTablet]}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Ej: Productos dañados por lluvia"
                    placeholderTextColor="#94A3B8"
                    keyboardType="default"
                  />
                </View>

                {/* Severity */}
                <View style={styles.formGroup}>
                  <Text style={[styles.label, isTablet && styles.labelTablet]}>Severidad *</Text>
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
              <Text style={[styles.label, isTablet && styles.labelTablet]}>Descripción *</Text>
              <TextInput
                style={[styles.textArea, isTablet && styles.textAreaTablet]}
                value={description}
                onChangeText={setDescription}
                placeholder="Describe detalladamente qué sucedió..."
                placeholderTextColor="#94A3B8"
                keyboardType="default"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Action Taken (only for editing) */}
            {editingNote && (
              <View style={styles.formGroup}>
                <Text style={[styles.label, isTablet && styles.labelTablet]}>
                  Acción Tomada
                </Text>
                <TextInput
                  style={[styles.textArea, isTablet && styles.textAreaTablet]}
                  value={actionTaken}
                  onChangeText={setActionTaken}
                  placeholder="Describe qué acción se tomó..."
                  placeholderTextColor="#94A3B8"
                  keyboardType="default"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            )}

            {/* Requires Action */}
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setRequiresAction(!requiresAction)}
            >
              <View style={[styles.checkbox, requiresAction && styles.checkboxChecked]}>
                {requiresAction && <Text style={styles.checkboxCheck}>✓</Text>}
              </View>
              <Text style={[styles.checkboxLabel, isTablet && styles.checkboxLabelTablet]}>
                Requiere acción
              </Text>
            </TouchableOpacity>

            {/* Buttons */}
            <View style={styles.formButtons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  resetForm();
                  setShowCreateForm(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={editingNote ? handleUpdateNote : handleCreateNote}
                disabled={loading}
              >
                <Text style={styles.saveButtonText}>
                  {loading ? 'Guardando...' : editingNote ? 'Actualizar' : 'Crear Nota'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          <>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
              {notes.length > 0 ? (
                notes.map((note) => renderNoteCard(note))
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
                    No hay notas explicativas
                  </Text>
                  <Text style={[styles.emptySubtext, isTablet && styles.emptySubtextTablet]}>
                    Agrega una nota para explicar esta discrepancia
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Add Note Button */}
            <View style={styles.addButtonContainer}>
              <TouchableOpacity
                style={[styles.addButton, isTablet && styles.addButtonTablet]}
                onPress={() => setShowCreateForm(true)}
              >
                <Text style={[styles.addButtonText, isTablet && styles.addButtonTextTablet]}>
                  ➕ Agregar Nota Explicativa
                </Text>
              </TouchableOpacity>
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
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTablet: {
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  titleTablet: {
    fontSize: 26,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  subtitleTablet: {
    fontSize: 16,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#64748B',
    fontWeight: '600',
  },
  closeButtonTextTablet: {
    fontSize: 28,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748B',
  },
  loadingTextTablet: {
    fontSize: 18,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  noteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  noteCardTablet: {
    padding: 24,
    marginBottom: 16,
  },
  noteHeader: {
    marginBottom: 12,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  noteTitleTablet: {
    fontSize: 20,
  },
  noteMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  severityBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  closedBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  closedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  noteDescription: {
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 20,
    marginBottom: 12,
  },
  noteDescriptionTablet: {
    fontSize: 16,
    lineHeight: 24,
  },
  actionTakenContainer: {
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  actionTakenLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#065F46',
    marginBottom: 4,
  },
  actionTakenLabelTablet: {
    fontSize: 15,
  },
  actionTakenText: {
    fontSize: 13,
    color: '#064E3B',
  },
  actionTakenTextTablet: {
    fontSize: 15,
  },
  requiresActionContainer: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
  },
  requiresActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  noteAuthor: {
    fontSize: 13,
    color: '#64748B',
  },
  noteAuthorTablet: {
    fontSize: 15,
  },
  noteDate: {
    fontSize: 13,
    color: '#94A3B8',
  },
  noteDateTablet: {
    fontSize: 15,
  },
  noteActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#EEF2FF',
  },
  closeNoteButton: {
    backgroundColor: '#D1FAE5',
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyTextTablet: {
    fontSize: 18,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  emptySubtextTablet: {
    fontSize: 16,
  },
  addButtonContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  addButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonTablet: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  addButtonTextTablet: {
    fontSize: 17,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 20,
  },
  formTitleTablet: {
    fontSize: 22,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  labelTablet: {
    fontSize: 16,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1E293B',
  },
  inputTablet: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1E293B',
    minHeight: 100,
  },
  textAreaTablet: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 120,
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    color: '#1F2937',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  checkboxCheck: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#1E293B',
  },
  checkboxLabelTablet: {
    fontSize: 16,
  },
  formButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F1F5F9',
  },
  cancelButtonText: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#6366F1',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
