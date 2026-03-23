import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { campaignsService, companiesApi, sitesApi } from '@/services/api';
import { ParticipantType, AddParticipantRequest } from '@/types/campaigns';
import { Company } from '@/types/companies';
import { Site } from '@/types/sites';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';

interface AddParticipantScreenProps {
  navigation: any;
  route: {
    params: {
      campaignId: string;
    };
  };
}

interface SelectedParticipant {
  id: string;
  name: string;
  type: ParticipantType;
  assignedAmount: string;
}

export const AddParticipantScreen: React.FC<AddParticipantScreenProps> = ({
  navigation,
  route,
}) => {
  const { campaignId } = route.params;
  const [participantType, setParticipantType] = useState<ParticipantType>(
    ParticipantType.INTERNAL_SITE
  );
  const [companies, setCompanies] = useState<Company[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<SelectedParticipant[]>([]);
  const [currentEntityId, setCurrentEntityId] = useState<string>('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const { width, height } = useWindowDimensions();

  const isTablet = width >= 768 || height >= 768;

  useEffect(() => {
    loadData();
  }, [participantType]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      if (participantType === ParticipantType.EXTERNAL_COMPANY) {
        const response = await companiesApi.getCompanies({
          limit: 100,
        });
        // Filter external companies on the client side
        setCompanies(response.data.filter((c) => c.companyType === 'EXTERNAL'));
      } else {
        // Load all companies first to get their types
        const companiesResponse = await companiesApi.getCompanies({ limit: 100 });

        // Create a map of companyId -> companyType for quick lookup
        const companyTypeMap = new Map<string, string>();
        companiesResponse.data.forEach((company) => {
          companyTypeMap.set(company.id, company.companyType);
        });

        console.log('📍 Companies loaded:', {
          total: companiesResponse.data.length,
          internal: companiesResponse.data.filter((c) => c.companyType === 'INTERNAL').length,
          external: companiesResponse.data.filter((c) => c.companyType === 'EXTERNAL').length,
        });

        // Load all sites
        const sitesResponse = await sitesApi.getSites({ limit: 100 });

        console.log('📍 Sites loaded from API:', {
          total: sitesResponse.data.length,
          sample: sitesResponse.data.slice(0, 3).map((s) => ({
            id: s.id,
            name: s.name,
            companyId: s.companyId,
            companyType: companyTypeMap.get(s.companyId),
          })),
        });

        // Filter sites to show only those from INTERNAL companies
        const internalSites = sitesResponse.data.filter((site) => {
          const companyType = companyTypeMap.get(site.companyId);
          if (companyType === 'INTERNAL') {
            return true;
          }
          return false;
        });

        console.log('📍 Filtered internal sites:', {
          total: sitesResponse.data.length,
          internal: internalSites.length,
          filtered: sitesResponse.data.length - internalSites.length,
        });

        setSites(internalSites);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos');
    } finally {
      setLoadingData(false);
    }
  };

  const handleAddToList = () => {
    // Validations
    if (!currentEntityId) {
      Alert.alert('Error', 'Debes seleccionar una empresa o sede');
      return;
    }

    if (!currentAmount || parseFloat(currentAmount) <= 0) {
      Alert.alert('Error', 'El monto asignado debe ser mayor a 0');
      return;
    }

    // Check if already added
    if (selectedParticipants.some((p) => p.id === currentEntityId)) {
      Alert.alert('Error', 'Este participante ya fue agregado a la lista');
      return;
    }

    // Get entity name
    let entityName = '';
    if (participantType === ParticipantType.EXTERNAL_COMPANY) {
      const company = companies.find((c) => c.id === currentEntityId);
      entityName = company?.alias || company?.name || '';
    } else {
      const site = sites.find((s) => s.id === currentEntityId);
      entityName = site?.name || '';
    }

    // Add to list
    setSelectedParticipants([
      ...selectedParticipants,
      {
        id: currentEntityId,
        name: entityName,
        type: participantType,
        assignedAmount: currentAmount,
      },
    ]);

    // Reset form
    setCurrentEntityId('');
    setCurrentAmount('');
  };

  const handleRemoveFromList = (id: string) => {
    setSelectedParticipants(selectedParticipants.filter((p) => p.id !== id));
  };

  const handleSaveAll = async () => {
    if (selectedParticipants.length === 0) {
      Alert.alert('Error', 'Debes agregar al menos un participante');
      return;
    }

    setLoading(true);

    try {
      // Add all participants
      for (const participant of selectedParticipants) {
        const data: AddParticipantRequest = {
          participantType: participant.type,
          assignedAmount: parseFloat(participant.assignedAmount),
          currency: 'PEN',
        };

        if (participant.type === ParticipantType.EXTERNAL_COMPANY) {
          data.companyId = participant.id;
        } else {
          data.siteId = participant.id;
        }

        await campaignsService.addParticipant(campaignId, data);
      }

      Alert.alert(
        'Éxito',
        `${selectedParticipants.length} participante(s) agregado(s) exitosamente`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error adding participants:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'No se pudieron agregar los participantes'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={[styles.backButtonText, isTablet && styles.backButtonTextTablet]}>
              ← Volver
            </Text>
          </TouchableOpacity>
          <Text style={[styles.title, isTablet && styles.titleTablet]}>Agregar Participante</Text>
        </View>

        {/* Form */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}
        >
          <View style={[styles.formCard, isTablet && styles.formCardTablet]}>
            {/* Participant Type */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>
                Tipo de Participante *
              </Text>
              <View style={[styles.pickerContainer, isTablet && styles.pickerContainerTablet]}>
                <Picker
                  selectedValue={participantType}
                  onValueChange={(value) => {
                    setParticipantType(value);
                    setCurrentEntityId('');
                  }}
                  style={styles.picker}
                >
                  <Picker.Item label="Sede Interna" value={ParticipantType.INTERNAL_SITE} />
                  <Picker.Item label="Empresa Externa" value={ParticipantType.EXTERNAL_COMPANY} />
                </Picker>
              </View>
            </View>

            {/* Company/Site Selection */}
            {loadingData ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#6366F1" />
                <Text style={styles.loadingText}>Cargando...</Text>
              </View>
            ) : (
              <>
                {participantType === ParticipantType.EXTERNAL_COMPANY && (
                  <View style={styles.formGroup}>
                    <Text style={[styles.label, isTablet && styles.labelTablet]}>Empresa *</Text>
                    <View
                      style={[styles.pickerContainer, isTablet && styles.pickerContainerTablet]}
                    >
                      <Picker
                        selectedValue={currentEntityId}
                        onValueChange={setCurrentEntityId}
                        style={styles.picker}
                      >
                        <Picker.Item label="Seleccionar empresa..." value="" />
                        {companies.map((company) => (
                          <Picker.Item
                            key={company.id}
                            label={company.alias || company.name}
                            value={company.id}
                          />
                        ))}
                      </Picker>
                    </View>
                  </View>
                )}

                {participantType === ParticipantType.INTERNAL_SITE && (
                  <View style={styles.formGroup}>
                    <Text style={[styles.label, isTablet && styles.labelTablet]}>Sede *</Text>
                    <View
                      style={[styles.pickerContainer, isTablet && styles.pickerContainerTablet]}
                    >
                      <Picker
                        selectedValue={currentEntityId}
                        onValueChange={setCurrentEntityId}
                        style={styles.picker}
                      >
                        <Picker.Item label="Seleccionar sede..." value="" />
                        {sites.map((site) => (
                          <Picker.Item
                            key={site.id}
                            label={`${site.code} - ${site.name}`}
                            value={site.id}
                          />
                        ))}
                      </Picker>
                    </View>
                  </View>
                )}
              </>
            )}

            {/* Assigned Amount */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>
                Monto Asignado (S/) *
              </Text>
              <TextInput
                style={[styles.input, isTablet && styles.inputTablet]}
                value={currentAmount}
                onChangeText={setCurrentAmount}
                placeholder="Ej: 10000.00"
                placeholderTextColor="#94A3B8"
                keyboardType="decimal-pad"
              />
              <Text style={[styles.hint, isTablet && styles.hintTablet]}>
                Este monto se usa para calcular la distribución proporcional de productos
              </Text>
            </View>

            {/* Add to List Button */}
            <TouchableOpacity
              style={[styles.addToListButton, isTablet && styles.addToListButtonTablet]}
              onPress={handleAddToList}
              disabled={loadingData}
            >
              <Text
                style={[styles.addToListButtonText, isTablet && styles.addToListButtonTextTablet]}
              >
                + Agregar a la Lista
              </Text>
            </TouchableOpacity>

            {/* Info Box */}
            <View style={[styles.infoBox, isTablet && styles.infoBoxTablet]}>
              <Text style={[styles.infoTitle, isTablet && styles.infoTitleTablet]}>
                ℹ️ Información
              </Text>
              <Text style={[styles.infoText, isTablet && styles.infoTextTablet]}>
                • El monto asignado determina el porcentaje de productos que recibirá este
                participante{'\n'}• No se puede duplicar una empresa o sede en la misma campaña
                {'\n'}• Solo se puede modificar en estado BORRADOR{'\n'}• Puedes agregar varios
                participantes a la vez
              </Text>
            </View>
          </View>

          {/* Selected Participants List */}
          {selectedParticipants.length > 0 && (
            <View
              style={[styles.formCard, isTablet && styles.formCardTablet, styles.selectedListCard]}
            >
              <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
                Participantes Seleccionados ({selectedParticipants.length})
              </Text>

              {selectedParticipants.map((participant) => (
                <View
                  key={participant.id}
                  style={[styles.participantItem, isTablet && styles.participantItemTablet]}
                >
                  <View style={styles.participantInfo}>
                    <Text
                      style={[styles.participantName, isTablet && styles.participantNameTablet]}
                    >
                      {participant.name}
                    </Text>
                    <Text
                      style={[styles.participantType, isTablet && styles.participantTypeTablet]}
                    >
                      {participant.type === ParticipantType.EXTERNAL_COMPANY
                        ? 'Empresa Externa'
                        : 'Sede Interna'}
                    </Text>
                    <Text
                      style={[styles.participantAmount, isTablet && styles.participantAmountTablet]}
                    >
                      S/ {parseFloat(participant.assignedAmount).toFixed(2)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.removeButton, isTablet && styles.removeButtonTablet]}
                    onPress={() => handleRemoveFromList(participant.id)}
                  >
                    <Text
                      style={[styles.removeButtonText, isTablet && styles.removeButtonTextTablet]}
                    >
                      ✕
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Footer Actions */}
        <View style={[styles.footer, isTablet && styles.footerTablet]}>
          <TouchableOpacity
            style={[styles.cancelButton, isTablet && styles.cancelButtonTablet]}
            onPress={() => navigation.goBack()}
            disabled={loading}
          >
            <Text style={[styles.cancelButtonText, isTablet && styles.cancelButtonTextTablet]}>
              Cancelar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.addButton,
              isTablet && styles.addButtonTablet,
              (loading || selectedParticipants.length === 0) && styles.addButtonDisabled,
            ]}
            onPress={handleSaveAll}
            disabled={loading || loadingData || selectedParticipants.length === 0}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={[styles.addButtonText, isTablet && styles.addButtonTextTablet]}>
                Guardar Participantes ({selectedParticipants.length})
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTablet: {
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  backButton: {
    marginBottom: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#6366F1',
    fontWeight: '600',
  },
  backButtonTextTablet: {
    fontSize: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  titleTablet: {
    fontSize: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  scrollContentTablet: {
    padding: 32,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formCardTablet: {
    padding: 24,
  },
  formGroup: {
    marginBottom: 20,
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
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  pickerContainerTablet: {
    borderRadius: 10,
  },
  picker: {
    height: 50,
    color: '#1F2937',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1E293B',
    backgroundColor: '#FFFFFF',
  },
  inputTablet: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
  },
  hint: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  hintTablet: {
    fontSize: 14,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
  },
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
    marginTop: 8,
  },
  infoBoxTablet: {
    padding: 16,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 8,
  },
  infoTitleTablet: {
    fontSize: 16,
  },
  infoText: {
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 20,
  },
  infoTextTablet: {
    fontSize: 15,
    lineHeight: 24,
  },
  addToListButton: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  addToListButtonTablet: {
    paddingVertical: 16,
  },
  addToListButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addToListButtonTextTablet: {
    fontSize: 18,
  },
  selectedListCard: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 16,
  },
  sectionTitleTablet: {
    fontSize: 22,
  },
  participantItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  participantItemTablet: {
    padding: 16,
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  participantNameTablet: {
    fontSize: 18,
  },
  participantType: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 4,
  },
  participantTypeTablet: {
    fontSize: 15,
  },
  participantAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  participantAmountTablet: {
    fontSize: 16,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  removeButtonTablet: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  removeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  removeButtonTextTablet: {
    fontSize: 22,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  footerTablet: {
    padding: 24,
    gap: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonTablet: {
    paddingVertical: 16,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  cancelButtonTextTablet: {
    fontSize: 18,
  },
  addButton: {
    flex: 1,
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonTablet: {
    paddingVertical: 16,
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addButtonTextTablet: {
    fontSize: 18,
  },
});
