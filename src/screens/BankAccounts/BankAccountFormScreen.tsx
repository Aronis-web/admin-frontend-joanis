/**
 * Bank Account Form Screen
 *
 * Screen to create, edit or view a bank account
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { treasuryApi } from '@/services/api/treasury';
import {
  BankAccount,
  BankInfo,
  BankAccountType,
  BankAccountCurrency,
  CreateBankAccountRequest,
  UpdateBankAccountRequest,
  BANK_ACCOUNT_TYPE_LABELS,
  CURRENCY_LABELS,
  CURRENCY_SYMBOLS,
  BANK_ACCOUNT_COLORS,
} from '@/types/treasury';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

type FormMode = 'create' | 'edit' | 'view';

interface BankAccountFormScreenProps {
  navigation: any;
  route: {
    params: {
      companyId: string;
      companyName: string;
      accountId?: string;
      mode: FormMode;
    };
  };
}

const ACCOUNT_TYPES: BankAccountType[] = [
  'CORRIENTE',
  'AHORROS',
  'MAESTRA',
  'DETRACCIONES',
  'CTS',
  'PLAZO_FIJO',
];

const CURRENCIES: BankAccountCurrency[] = ['PEN', 'USD'];

interface FormData {
  bankId: string;
  accountNumber: string;
  accountNumberCci: string;
  accountType: BankAccountType;
  currency: BankAccountCurrency;
  alias: string;
  description: string;
  isDefault: boolean;
  isActive: boolean;
  color: string;
}

const initialFormData: FormData = {
  bankId: '',
  accountNumber: '',
  accountNumberCci: '',
  accountType: 'CORRIENTE',
  currency: 'PEN',
  alias: '',
  description: '',
  isDefault: false,
  isActive: true,
  color: BANK_ACCOUNT_COLORS[0],
};

export const BankAccountFormScreen: React.FC<BankAccountFormScreenProps> = ({ navigation, route }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { companyId, companyName, accountId, mode: initialMode } = route.params;

  const [mode, setMode] = useState<FormMode>(initialMode || 'create');
  const [loading, setLoading] = useState(initialMode !== 'create');
  const [saving, setSaving] = useState(false);
  const [banks, setBanks] = useState<BankInfo[]>([]);
  const [account, setAccount] = useState<BankAccount | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  const isCreateMode = mode === 'create';

  useEffect(() => {
    loadBanks();
    if (accountId && !isCreateMode) {
      loadAccount();
    }
  }, [accountId]);

  const loadBanks = async () => {
    try {
      const data = await treasuryApi.getAvailableBanks();
      setBanks(data);
    } catch (error: any) {
      console.error('Error loading banks:', error);
      Alert.alert('Error', 'No se pudieron cargar los bancos disponibles');
    }
  };

  const loadAccount = async () => {
    if (!accountId) return;

    try {
      setLoading(true);
      const data = await treasuryApi.getBankAccountById(accountId);
      setAccount(data);
      setFormData({
        bankId: data.bankId,
        accountNumber: data.accountNumber,
        accountNumberCci: data.accountNumberCci || '',
        accountType: data.accountType as BankAccountType,
        currency: data.currency as BankAccountCurrency,
        alias: data.alias,
        description: data.description || '',
        isDefault: data.isDefault,
        isActive: data.isActive,
        color: data.color || BANK_ACCOUNT_COLORS[0],
      });
    } catch (error: any) {
      console.error('Error loading account:', error);
      Alert.alert('Error', 'No se pudo cargar la cuenta bancaria');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validations
    if (!formData.alias.trim()) {
      Alert.alert('Error', 'El alias es requerido');
      return;
    }
    if (isCreateMode) {
      if (!formData.bankId) {
        Alert.alert('Error', 'Debe seleccionar un banco');
        return;
      }
      if (!formData.accountNumber.trim()) {
        Alert.alert('Error', 'El número de cuenta es requerido');
        return;
      }
      if (formData.accountNumber.length < 5 || formData.accountNumber.length > 30) {
        Alert.alert('Error', 'El número de cuenta debe tener entre 5 y 30 caracteres');
        return;
      }
    }
    if (formData.alias.length < 3 || formData.alias.length > 100) {
      Alert.alert('Error', 'El alias debe tener entre 3 y 100 caracteres');
      return;
    }
    if (formData.accountNumberCci && formData.accountNumberCci.length > 25) {
      Alert.alert('Error', 'El CCI no puede tener más de 25 caracteres');
      return;
    }

    try {
      setSaving(true);

      if (isCreateMode) {
        const createData: CreateBankAccountRequest = {
          companyId,
          bankId: formData.bankId,
          accountNumber: formData.accountNumber,
          accountNumberCci: formData.accountNumberCci || undefined,
          accountType: formData.accountType,
          currency: formData.currency,
          alias: formData.alias,
          description: formData.description || undefined,
          isDefault: formData.isDefault,
          color: formData.color,
        };

        await treasuryApi.createBankAccount(createData);
        Alert.alert('Éxito', 'Cuenta bancaria creada correctamente', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else if (isEditMode && accountId) {
        const updateData: UpdateBankAccountRequest = {
          accountNumberCci: formData.accountNumberCci || undefined,
          accountType: formData.accountType,
          currency: formData.currency,
          alias: formData.alias,
          description: formData.description || undefined,
          isDefault: formData.isDefault,
          isActive: formData.isActive,
          color: formData.color,
        };

        await treasuryApi.updateBankAccount(accountId, updateData);
        Alert.alert('Éxito', 'Cuenta bancaria actualizada correctamente', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error: any) {
      console.error('Error saving account:', error);
      Alert.alert('Error', error.message || 'No se pudo guardar la cuenta bancaria');
    } finally {
      setSaving(false);
    }
  };

  const getSelectedBankName = () => {
    const bank = banks.find((b) => b.id === formData.bankId);
    return bank ? `${bank.name} (${bank.shortName})` : 'Seleccionar banco';
  };

  const formatBalance = (cents: number, currency: string) => {
    const amount = cents / 100;
    const symbol = CURRENCY_SYMBOLS[currency as BankAccountCurrency] || currency;
    return `${symbol} ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getTitle = () => {
    switch (mode) {
      case 'create':
        return 'Nueva Cuenta Bancaria';
      case 'edit':
        return 'Editar Cuenta';
      case 'view':
        return 'Detalle de Cuenta';
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.color.brand.accent} />
        <Text style={styles.loadingText}>Cargando cuenta...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{getTitle()}</Text>
          <Text style={styles.headerSubtitle}>{companyName}</Text>
        </View>
        {isViewMode && (
          <TouchableOpacity style={styles.editButton} onPress={() => setMode('edit')}>
            <Text style={styles.editButtonText}>✏️ Editar</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Account Info (View Mode) */}
        {isViewMode && account && (
          <View style={styles.accountInfoCard}>
            <View style={[styles.colorBar, { backgroundColor: account.color || theme.color.brand.accent }]} />
            <View style={styles.accountInfoContent}>
              <View style={styles.accountInfoHeader}>
                <View style={styles.bankBadgeLarge}>
                  <Text style={styles.bankBadgeLargeText}>
                    {account.bank?.shortName || 'N/A'}
                  </Text>
                </View>
                <View style={styles.accountInfoHeaderText}>
                  <Text style={styles.accountInfoTitle}>{account.alias}</Text>
                  <Text style={styles.accountInfoCode}>{account.code}</Text>
                </View>
              </View>
              <View style={styles.balanceContainer}>
                <Text style={styles.balanceLabel}>Saldo Actual</Text>
                <Text style={[styles.balanceAmount, account.currentBalanceCents >= 0 ? styles.balancePositive : styles.balanceNegative]}>
                  {formatBalance(account.currentBalanceCents, account.currency)}
                </Text>
                {account.lastBalanceDate && (
                  <Text style={styles.balanceDate}>
                    Actualizado: {new Date(account.lastBalanceDate).toLocaleDateString()}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Form */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>
            {isViewMode ? '📋 Información de la Cuenta' : '📝 Datos de la Cuenta'}
          </Text>

          {/* Bank Selector */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Banco {isCreateMode && <Text style={styles.required}>*</Text>}
            </Text>
            {isCreateMode ? (
              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => setShowBankPicker(!showBankPicker)}
              >
                <Text style={[styles.selectButtonText, !formData.bankId && styles.selectPlaceholder]}>
                  {getSelectedBankName()}
                </Text>
                <Text style={styles.selectArrow}>▼</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.readOnlyValue}>
                {account?.bank?.name} ({account?.bank?.shortName})
              </Text>
            )}
            {showBankPicker && (
              <View style={styles.pickerContainer}>
                {banks.map((bank) => (
                  <TouchableOpacity
                    key={bank.id}
                    style={[styles.pickerItem, formData.bankId === bank.id && styles.pickerItemSelected]}
                    onPress={() => {
                      setFormData({ ...formData, bankId: bank.id });
                      setShowBankPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerItemText, formData.bankId === bank.id && styles.pickerItemTextSelected]}>
                      {bank.name} ({bank.shortName})
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Account Number */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Número de Cuenta {isCreateMode && <Text style={styles.required}>*</Text>}
            </Text>
            {isCreateMode ? (
              <TextInput
                style={styles.input}
                value={formData.accountNumber}
                onChangeText={(text) => setFormData({ ...formData, accountNumber: text })}
                placeholder="Ej: 200-3005008580"
                maxLength={30}
              />
            ) : (
              <Text style={styles.readOnlyValue}>{account?.accountNumber}</Text>
            )}
          </View>

          {/* CCI */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Código de Cuenta Interbancario (CCI)</Text>
            {isViewMode ? (
              <Text style={styles.readOnlyValue}>
                {account?.accountNumberCci || '-'}
              </Text>
            ) : (
              <TextInput
                style={styles.input}
                value={formData.accountNumberCci}
                onChangeText={(text) => setFormData({ ...formData, accountNumberCci: text })}
                placeholder="Ej: 003-200-003005008580-99"
                maxLength={25}
              />
            )}
          </View>

          {/* Account Type */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Tipo de Cuenta {isCreateMode && <Text style={styles.required}>*</Text>}
            </Text>
            {isViewMode ? (
              <Text style={styles.readOnlyValue}>
                {BANK_ACCOUNT_TYPE_LABELS[account?.accountType || ''] || account?.accountType}
              </Text>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => setShowTypePicker(!showTypePicker)}
                >
                  <Text style={styles.selectButtonText}>
                    {BANK_ACCOUNT_TYPE_LABELS[formData.accountType] || formData.accountType}
                  </Text>
                  <Text style={styles.selectArrow}>▼</Text>
                </TouchableOpacity>
                {showTypePicker && (
                  <View style={styles.pickerContainer}>
                    {ACCOUNT_TYPES.map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[styles.pickerItem, formData.accountType === type && styles.pickerItemSelected]}
                        onPress={() => {
                          setFormData({ ...formData, accountType: type });
                          setShowTypePicker(false);
                        }}
                      >
                        <Text style={[styles.pickerItemText, formData.accountType === type && styles.pickerItemTextSelected]}>
                          {BANK_ACCOUNT_TYPE_LABELS[type]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>

          {/* Currency */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Moneda {!isViewMode && <Text style={styles.required}>*</Text>}
            </Text>
            {isViewMode ? (
              <Text style={styles.readOnlyValue}>{CURRENCY_LABELS[account?.currency as BankAccountCurrency] || account?.currency}</Text>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => setShowCurrencyPicker(!showCurrencyPicker)}
                >
                  <Text style={styles.selectButtonText}>
                    {CURRENCY_LABELS[formData.currency]}
                  </Text>
                  <Text style={styles.selectArrow}>▼</Text>
                </TouchableOpacity>
                {showCurrencyPicker && (
                  <View style={styles.pickerContainer}>
                    {CURRENCIES.map((currency) => (
                      <TouchableOpacity
                        key={currency}
                        style={[styles.pickerItem, formData.currency === currency && styles.pickerItemSelected]}
                        onPress={() => {
                          setFormData({ ...formData, currency });
                          setShowCurrencyPicker(false);
                        }}
                      >
                        <Text style={[styles.pickerItemText, formData.currency === currency && styles.pickerItemTextSelected]}>
                          {CURRENCY_LABELS[currency]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>

          {/* Alias */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Alias <Text style={styles.required}>*</Text>
            </Text>
            {isViewMode ? (
              <Text style={styles.readOnlyValue}>{account?.alias}</Text>
            ) : (
              <TextInput
                style={styles.input}
                value={formData.alias}
                onChangeText={(text) => setFormData({ ...formData, alias: text })}
                placeholder="Ej: Cuenta Principal Soles"
                maxLength={100}
              />
            )}
          </View>

          {/* Description */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Descripción</Text>
            {isViewMode ? (
              <Text style={styles.readOnlyValue}>{account?.description || '-'}</Text>
            ) : (
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Descripción opcional de la cuenta"
                multiline
                numberOfLines={3}
              />
            )}
          </View>

          {/* Color */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Color de identificación</Text>
            {isViewMode ? (
              <View style={styles.colorPreviewRow}>
                <View style={[styles.colorPreview, { backgroundColor: account?.color || theme.color.brand.accent }]} />
                <Text style={styles.colorPreviewText}>{account?.color || theme.color.brand.accent}</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => setShowColorPicker(!showColorPicker)}
                >
                  <View style={styles.colorPreviewRow}>
                    <View style={[styles.colorPreview, { backgroundColor: formData.color }]} />
                    <Text style={styles.colorPreviewText}>{formData.color}</Text>
                  </View>
                  <Text style={styles.selectArrow}>▼</Text>
                </TouchableOpacity>
                {showColorPicker && (
                  <View style={styles.colorPickerContainer}>
                    {BANK_ACCOUNT_COLORS.map((color) => (
                      <TouchableOpacity
                        key={color}
                        style={[
                          styles.colorOption,
                          { backgroundColor: color },
                          formData.color === color && styles.colorOptionSelected,
                        ]}
                        onPress={() => {
                          setFormData({ ...formData, color });
                          setShowColorPicker(false);
                        }}
                      />
                    ))}
                  </View>
                )}
              </>
            )}
          </View>

          {/* Checkboxes */}
          <View style={styles.formGroup}>
            {!isViewMode && (
              <>
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => setFormData({ ...formData, isDefault: !formData.isDefault })}
                >
                  <View style={[styles.checkbox, formData.isDefault && styles.checkboxChecked]}>
                    {formData.isDefault && <Text style={styles.checkboxIcon}>✓</Text>}
                  </View>
                  <View>
                    <Text style={styles.checkboxLabel}>Cuenta Principal</Text>
                    <Text style={styles.checkboxHint}>
                      Marcar como cuenta por defecto para esta moneda
                    </Text>
                  </View>
                </TouchableOpacity>

                {isEditMode && (
                  <TouchableOpacity
                    style={[styles.checkboxContainer, { marginTop: 16 }]}
                    onPress={() => setFormData({ ...formData, isActive: !formData.isActive })}
                  >
                    <View style={[styles.checkbox, formData.isActive && styles.checkboxChecked]}>
                      {formData.isActive && <Text style={styles.checkboxIcon}>✓</Text>}
                    </View>
                    <View>
                      <Text style={styles.checkboxLabel}>Cuenta Activa</Text>
                      <Text style={styles.checkboxHint}>
                        Las cuentas inactivas no aparecerán en las opciones de pago
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              </>
            )}

            {isViewMode && (
              <View style={styles.statusRow}>
                {account?.isDefault && (
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>⭐ Cuenta Principal</Text>
                  </View>
                )}
                <View style={[styles.statusBadge, account?.isActive ? styles.statusActive : styles.statusInactive]}>
                  <Text style={styles.statusBadgeText}>
                    {account?.isActive ? '✓ Activa' : '✗ Inactiva'}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Additional Info (View Mode) */}
        {isViewMode && account && (
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>📅 Información Adicional</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Código:</Text>
              <Text style={styles.infoValue}>{account.code}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Creado:</Text>
              <Text style={styles.infoValue}>
                {new Date(account.createdAt).toLocaleString()}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Actualizado:</Text>
              <Text style={styles.infoValue}>
                {new Date(account.updatedAt).toLocaleString()}
              </Text>
            </View>
            {account.lastSyncAt && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Última Sincronización:</Text>
                <Text style={styles.infoValue}>
                  {new Date(account.lastSyncAt).toLocaleString()}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Save Button */}
        {!isViewMode && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={theme.color.text.inverse} />
              ) : (
                <Text style={styles.saveButtonText}>
                  {isCreateMode ? '✓ Crear Cuenta' : '✓ Guardar Cambios'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                if (isEditMode) {
                  setMode('view');
                  loadAccount();
                } else {
                  navigation.goBack();
                }
              }}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background.subtle,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.color.background.subtle,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.color.text.muted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  backButtonText: {
    fontSize: 24,
    color: theme.color.brand.accent,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.color.text.heading,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.color.text.muted,
    marginTop: 2,
  },
  editButton: {
    backgroundColor: theme.color.brand.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editButtonText: {
    color: theme.color.text.inverse,
    fontSize: 14,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  accountInfoCard: {
    backgroundColor: theme.color.surface.base,
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: theme.color.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  colorBar: {
    height: 8,
  },
  accountInfoContent: {
    padding: 16,
  },
  accountInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  bankBadgeLarge: {
    backgroundColor: theme.color.brand.accent,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 16,
  },
  bankBadgeLargeText: {
    color: theme.color.text.inverse,
    fontSize: 16,
    fontWeight: 'bold',
  },
  accountInfoHeaderText: {
    flex: 1,
  },
  accountInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.color.text.heading,
  },
  accountInfoCode: {
    fontSize: 14,
    color: theme.color.text.muted,
    marginTop: 4,
  },
  balanceContainer: {
    backgroundColor: theme.color.surface.subtle,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: theme.color.text.muted,
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  balancePositive: {
    color: theme.color.state.success.border,
  },
  balanceNegative: {
    color: theme.color.state.danger.border,
  },
  balanceDate: {
    fontSize: 12,
    color: theme.color.text.placeholder,
    marginTop: 4,
  },
  formSection: {
    backgroundColor: theme.color.surface.base,
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    shadowColor: theme.color.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.color.text.heading,
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.heading,
    marginBottom: 8,
  },
  required: {
    color: theme.color.state.danger.border,
  },
  input: {
    backgroundColor: theme.color.surface.subtle,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.color.text.heading,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  readOnlyValue: {
    fontSize: 16,
    color: theme.color.text.heading,
    padding: 12,
    backgroundColor: theme.color.surface.subtle,
    borderRadius: 8,
  },
  selectButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.color.surface.subtle,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    borderRadius: 8,
    padding: 12,
  },
  selectButtonText: {
    fontSize: 16,
    color: theme.color.text.heading,
  },
  selectPlaceholder: {
    color: theme.color.text.placeholder,
  },
  selectArrow: {
    fontSize: 12,
    color: theme.color.text.muted,
  },
  pickerContainer: {
    backgroundColor: theme.color.surface.base,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    borderRadius: 8,
    marginTop: 8,
    maxHeight: 200,
  },
  pickerItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  pickerItemSelected: {
    backgroundColor: theme.color.state.info.background,
  },
  pickerItemText: {
    fontSize: 16,
    color: theme.color.text.heading,
  },
  pickerItemTextSelected: {
    color: theme.color.brand.accent,
    fontWeight: '600',
  },
  colorPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorPreview: {
    width: 24,
    height: 24,
    borderRadius: 4,
    marginRight: 12,
  },
  colorPreviewText: {
    fontSize: 14,
    color: theme.color.text.muted,
  },
  colorPickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
    padding: 12,
    backgroundColor: theme.color.surface.subtle,
    borderRadius: 8,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: theme.color.text.heading,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: theme.color.border.default,
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: theme.color.brand.accent,
    borderColor: theme.color.brand.accent,
  },
  checkboxIcon: {
    color: theme.color.text.inverse,
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.text.heading,
  },
  checkboxHint: {
    fontSize: 12,
    color: theme.color.text.muted,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusBadge: {
    backgroundColor: theme.color.state.warning.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.state.warning.text,
  },
  statusActive: {
    backgroundColor: theme.color.state.success.background,
  },
  statusInactive: {
    backgroundColor: theme.color.state.danger.background,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: theme.color.text.muted,
    width: 140,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: theme.color.text.heading,
    flex: 1,
  },
  buttonContainer: {
    padding: 16,
    gap: 12,
  },
  saveButton: {
    backgroundColor: theme.color.state.success.border,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: theme.color.text.placeholder,
  },
  saveButtonText: {
    color: theme.color.text.inverse,
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: theme.color.surface.muted,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: theme.color.text.muted,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default BankAccountFormScreen;
