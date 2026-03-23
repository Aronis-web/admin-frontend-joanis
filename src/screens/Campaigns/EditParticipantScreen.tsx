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
import { campaignsService } from '@/services/api';
import { priceProfilesApi } from '@/services/api';
import { UpdateParticipantRequest, CampaignParticipant } from '@/types/campaigns';
import { PriceProfile } from '@/types/price-profiles';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';

interface EditParticipantScreenProps {
  navigation: any;
  route: {
    params: {
      campaignId: string;
      participantId: string;
      participant: CampaignParticipant;
    };
  };
}

export const EditParticipantScreen: React.FC<EditParticipantScreenProps> = ({
  navigation,
  route,
}) => {
  const { campaignId, participantId, participant } = route.params;
  const [assignedAmount, setAssignedAmount] = useState(
    (participant.assignedAmountCents / 100).toFixed(2)
  );
  const [priceProfileId, setPriceProfileId] = useState(participant.priceProfileId || '');
  const [priceProfiles, setPriceProfiles] = useState<PriceProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const { width, height } = useWindowDimensions();

  const isTablet = width >= 768 || height >= 768;

  useEffect(() => {
    loadPriceProfiles();
  }, []);

  const loadPriceProfiles = async () => {
    setLoadingData(true);
    try {
      const profiles = await priceProfilesApi.getActivePriceProfiles();
      setPriceProfiles(profiles);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudieron cargar los perfiles de precio');
    } finally {
      setLoadingData(false);
    }
  };

  const handleSave = async () => {
    // Validate amount
    const amount = parseFloat(assignedAmount);
    if (isNaN(amount) || amount < 0) {
      Alert.alert('Error', 'Por favor ingresa un monto válido');
      return;
    }

    try {
      setLoading(true);

      const updateData: UpdateParticipantRequest = {
        assignedAmount: amount,
        priceProfileId: priceProfileId || undefined,
      };

      console.log('🔄 Actualizando participante:', {
        campaignId,
        participantId,
        updateData,
        priceProfileIdOriginal: participant.priceProfileId,
        priceProfileIdNew: priceProfileId,
      });

      await campaignsService.updateParticipant(campaignId, participantId, updateData);

      console.log('✅ Participante actualizado correctamente');

      Alert.alert('Éxito', 'Participante actualizado correctamente', [
        {
          text: 'OK',
          onPress: () => {
            // Force reload of the previous screen by passing a flag
            navigation.navigate('CampaignDetail', {
              campaignId,
              forceReload: true,
              timestamp: Date.now(),
            });
          },
        },
      ]);
    } catch (error: any) {
      console.error('❌ Error actualizando participante:', error);
      Alert.alert('Error', error.message || 'No se pudo actualizar el participante');
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <ScreenLayout navigation={navigation}>
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={styles.loadingText}>Cargando...</Text>
          </View>
        </SafeAreaView>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container}>
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={[styles.backButtonText, isTablet && styles.backButtonTextTablet]}>
              ← Volver
            </Text>
          </TouchableOpacity>
          <Text style={[styles.title, isTablet && styles.titleTablet]}>Editar Participante</Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}
        >
          <View style={[styles.section, isTablet && styles.sectionTablet]}>
            <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
              Información del Participante
            </Text>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Nombre:</Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                {participant.participantType === 'EXTERNAL_COMPANY'
                  ? participant.company?.name
                  : participant.site?.name}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Tipo:</Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                {participant.participantType === 'EXTERNAL_COMPANY'
                  ? 'Empresa Externa'
                  : 'Sede Interna'}
              </Text>
            </View>
          </View>

          <View style={[styles.section, isTablet && styles.sectionTablet]}>
            <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
              Configuración
            </Text>

            <View style={styles.formGroup}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>
                Monto Esperado (S/)
              </Text>
              <TextInput
                style={[styles.input, isTablet && styles.inputTablet]}
                value={assignedAmount}
                onChangeText={setAssignedAmount}
                placeholder="0.00"
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>Perfil de Precio</Text>
              <View style={[styles.pickerContainer, isTablet && styles.pickerContainerTablet]}>
                <Picker
                  selectedValue={priceProfileId}
                  onValueChange={(value) => setPriceProfileId(value)}
                  style={styles.picker}
                >
                  <Picker.Item label="Sin perfil de precio" value="" />
                  {priceProfiles.map((profile) => (
                    <Picker.Item
                      key={profile.id}
                      label={`${profile.name} (${profile.code})`}
                      value={profile.id}
                    />
                  ))}
                </Picker>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.saveButton,
              isTablet && styles.saveButtonTablet,
              loading && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={loading}
          >
            <Text style={[styles.saveButtonText, isTablet && styles.saveButtonTextTablet]}>
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
    gap: 16,
  },
  scrollContentTablet: {
    padding: 32,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTablet: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 16,
  },
  sectionTitleTablet: {
    fontSize: 22,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
    minWidth: 80,
  },
  infoLabelTablet: {
    fontSize: 16,
    minWidth: 100,
  },
  infoValue: {
    fontSize: 14,
    color: '#1E293B',
    flex: 1,
  },
  infoValueTablet: {
    fontSize: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1E293B',
    marginBottom: 8,
  },
  labelTablet: {
    fontSize: 16,
  },
  input: {
    backgroundColor: '#F8FAFC',
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
    paddingVertical: 14,
    fontSize: 16,
  },
  pickerContainer: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  pickerContainerTablet: {
    borderRadius: 10,
  },
  picker: {
    height: 50,
    color: '#1F2937',
  },
  saveButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonTablet: {
    paddingVertical: 18,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonTextTablet: {
    fontSize: 18,
  },
});
