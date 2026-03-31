/**
 * RegisterSalePaymentScreen.tsx
 *
 * Pantalla para registrar pagos de ventas.
 * Rediseñada con el sistema de diseño global.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { salesApi } from '@/services/api/sales';
import { companiesApi } from '@/services/api/companies';
import { useAuthStore } from '@/store/auth';
import { PaymentMethod } from '@/types/companies';
import logger from '@/utils/logger';

// Design System Imports
import { colors } from '@/design-system/tokens/colors';
import { spacing, borderRadius } from '@/design-system/tokens/spacing';
import { shadows } from '@/design-system/tokens/shadows';
import { fontSizes, fontWeights } from '@/design-system/tokens/typography';
import { durations } from '@/design-system/tokens/animations';

type RegisterSalePaymentRouteProp = RouteProp<
  { RegisterSalePayment: { saleId: string; pendingAmount?: number; saleName?: string } },
  'RegisterSalePayment'
>;

// ============================================================================
// Animated Components
// ============================================================================

interface AnimatedCardProps {
  children: React.ReactNode;
  delay?: number;
  style?: any;
}

const AnimatedCard: React.FC<AnimatedCardProps> = ({ children, delay = 0, style }) => {
  const translateY = useRef(new Animated.Value(30)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: durations.normal,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: durations.normal,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[{ transform: [{ translateY }], opacity }, style]}>
      {children}
    </Animated.View>
  );
};

// ============================================================================
// Payment Method Chip Component
// ============================================================================

interface PaymentMethodChipProps {
  method: PaymentMethod;
  isSelected: boolean;
  onPress: () => void;
}

const PaymentMethodChip: React.FC<PaymentMethodChipProps> = ({ method, isSelected, onPress }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  // Get icon based on payment method name
  const getPaymentIcon = (name: string): keyof typeof Ionicons.glyphMap => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('efectivo') || lowerName.includes('cash')) return 'cash-outline';
    if (lowerName.includes('tarjeta') || lowerName.includes('card')) return 'card-outline';
    if (lowerName.includes('transfer') || lowerName.includes('banco')) return 'swap-horizontal-outline';
    if (lowerName.includes('yape') || lowerName.includes('plin')) return 'phone-portrait-outline';
    if (lowerName.includes('cheque')) return 'document-text-outline';
    return 'wallet-outline';
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          styles.paymentChip,
          isSelected && styles.paymentChipSelected,
          { transform: [{ scale }] },
        ]}
      >
        <View style={[styles.paymentChipIcon, isSelected && styles.paymentChipIconSelected]}>
          <Ionicons
            name={getPaymentIcon(method.name)}
            size={20}
            color={isSelected ? colors.primary[600] : colors.neutral[500]}
          />
        </View>
        <Text style={[styles.paymentChipText, isSelected && styles.paymentChipTextSelected]}>
          {method.name}
        </Text>
        {isSelected && (
          <View style={styles.paymentChipCheck}>
            <Ionicons name="checkmark-circle" size={18} color={colors.primary[600]} />
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

// ============================================================================
// Quick Amount Button Component
// ============================================================================

interface QuickAmountButtonProps {
  amount: number;
  onPress: () => void;
  isSelected: boolean;
}

const QuickAmountButton: React.FC<QuickAmountButtonProps> = ({ amount, onPress, isSelected }) => {
  return (
    <TouchableOpacity
      style={[styles.quickAmountButton, isSelected && styles.quickAmountButtonSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.quickAmountText, isSelected && styles.quickAmountTextSelected]}>
        S/ {amount.toFixed(2)}
      </Text>
    </TouchableOpacity>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const RegisterSalePaymentScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RegisterSalePaymentRouteProp>();
  const { saleId, pendingAmount, saleName } = route.params;
  const { currentCompany } = useAuthStore();

  // Refs
  const amountInputRef = useRef<TextInput>(null);

  // State
  const [loading, setLoading] = useState(false);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);
  const [amount, setAmount] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [notes, setNotes] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isAmountFocused, setIsAmountFocused] = useState(false);
  const [isNotesFocused, setIsNotesFocused] = useState(false);

  // Animation values
  const headerScale = useRef(new Animated.Value(0.95)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;

  // Quick amounts based on pending amount
  const quickAmounts = pendingAmount
    ? [
        Math.round(pendingAmount * 0.25 * 100) / 100,
        Math.round(pendingAmount * 0.5 * 100) / 100,
        Math.round(pendingAmount * 0.75 * 100) / 100,
        pendingAmount,
      ].filter((a, i, arr) => a > 0 && arr.indexOf(a) === i)
    : [50, 100, 200, 500];

  // ============================================================================
  // Effects
  // ============================================================================

  useEffect(() => {
    // Header animation
    Animated.parallel([
      Animated.spring(headerScale, {
        toValue: 1,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: durations.normal,
        useNativeDriver: true,
      }),
    ]).start();

    // Load payment methods
    if (currentCompany?.id) {
      loadPaymentMethods();
    }
  }, [currentCompany?.id]);

  // ============================================================================
  // Data Loading
  // ============================================================================

  const loadPaymentMethods = async () => {
    if (!currentCompany?.id) return;

    setLoadingPaymentMethods(true);
    try {
      const data = await companiesApi.getPaymentMethods(currentCompany.id);
      setPaymentMethods(data);

      // Auto-select first payment method
      if (data.length > 0) {
        setSelectedPaymentMethod(data[0]);
      }
    } catch (error) {
      logger.error('Error cargando métodos de pago:', error);
      Alert.alert('Error', 'No se pudieron cargar los métodos de pago');
    } finally {
      setLoadingPaymentMethods(false);
    }
  };

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleAmountChange = (text: string) => {
    // Only allow numbers and one decimal point
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
    setAmount(cleaned);
  };

  const handleQuickAmount = (quickAmount: number) => {
    setAmount(quickAmount.toString());
    Keyboard.dismiss();
  };

  const handlePayFullAmount = () => {
    if (pendingAmount) {
      setAmount(pendingAmount.toString());
      Keyboard.dismiss();
    }
  };

  const handleRegisterPayment = async () => {
    // Validaciones
    const amountValue = parseFloat(amount);
    if (!amountValue || amountValue <= 0) {
      Alert.alert('Monto Inválido', 'Por favor ingresa un monto mayor a cero');
      amountInputRef.current?.focus();
      return;
    }

    if (pendingAmount && amountValue > pendingAmount) {
      Alert.alert(
        'Monto Excedido',
        `El monto ingresado (S/ ${amountValue.toFixed(2)}) excede el saldo pendiente (S/ ${pendingAmount.toFixed(2)})`
      );
      return;
    }

    if (!selectedPaymentMethod) {
      Alert.alert('Método de Pago', 'Por favor selecciona un método de pago');
      return;
    }

    setLoading(true);
    try {
      const paymentData = {
        amountCents: Math.round(amountValue * 100),
        paymentMethodId: selectedPaymentMethod.id,
        notes: notes.trim() || undefined,
      };

      logger.info('📝 Registrando pago:', paymentData);

      await salesApi.registerPayment(saleId, paymentData);

      logger.info('✅ Pago registrado exitosamente');

      Alert.alert(
        '¡Pago Registrado!',
        `Se ha registrado un pago de S/ ${amountValue.toFixed(2)} exitosamente`,
        [
          {
            text: 'Continuar',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: any) {
      logger.error('❌ Error registrando pago:', error);

      const errorMessage = error?.response?.data?.message || error?.message || 'Error desconocido';
      Alert.alert('Error al Registrar', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // Computed Values
  // ============================================================================

  const parsedAmount = parseFloat(amount) || 0;
  const isValidAmount = parsedAmount > 0;
  const canSubmit = isValidAmount && selectedPaymentMethod && !loading;
  const remainingAfterPayment = pendingAmount ? pendingAmount - parsedAmount : 0;

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header Card */}
        <Animated.View
          style={[
            styles.headerCard,
            {
              transform: [{ scale: headerScale }],
              opacity: headerOpacity,
            },
          ]}
        >
          <View style={styles.headerIconContainer}>
            <View style={styles.headerIconBg}>
              <Ionicons name="wallet" size={32} color={colors.success[600]} />
            </View>
          </View>
          <Text style={styles.headerTitle}>Registrar Pago</Text>
          {saleName && <Text style={styles.headerSubtitle}>{saleName}</Text>}
          {pendingAmount !== undefined && (
            <View style={styles.pendingAmountContainer}>
              <Text style={styles.pendingAmountLabel}>Saldo Pendiente</Text>
              <Text style={styles.pendingAmountValue}>S/ {pendingAmount.toFixed(2)}</Text>
            </View>
          )}
        </Animated.View>

        {/* Amount Input Card */}
        <AnimatedCard delay={100}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconWrapper}>
                <Ionicons name="calculator-outline" size={20} color={colors.primary[600]} />
              </View>
              <Text style={styles.cardTitle}>Monto del Pago</Text>
            </View>

            <View style={[styles.amountInputContainer, isAmountFocused && styles.amountInputContainerFocused]}>
              <Text style={styles.currencySymbol}>S/</Text>
              <TextInput
                ref={amountInputRef}
                style={styles.amountInput}
                value={amount}
                onChangeText={handleAmountChange}
                placeholder="0.00"
                keyboardType="decimal-pad"
                placeholderTextColor={colors.neutral[400]}
                onFocus={() => setIsAmountFocused(true)}
                onBlur={() => setIsAmountFocused(false)}
              />
            </View>

            {/* Quick Amount Buttons */}
            <View style={styles.quickAmountsContainer}>
              <Text style={styles.quickAmountsLabel}>Montos rápidos:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickAmountsScroll}>
                <View style={styles.quickAmountsRow}>
                  {quickAmounts.map((quickAmount, index) => (
                    <QuickAmountButton
                      key={index}
                      amount={quickAmount}
                      onPress={() => handleQuickAmount(quickAmount)}
                      isSelected={parsedAmount === quickAmount}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Pay Full Amount Button */}
            {pendingAmount && pendingAmount > 0 && (
              <TouchableOpacity
                style={styles.payFullButton}
                onPress={handlePayFullAmount}
                activeOpacity={0.7}
              >
                <Ionicons name="checkmark-done-outline" size={18} color={colors.success[600]} />
                <Text style={styles.payFullButtonText}>Pagar monto completo</Text>
              </TouchableOpacity>
            )}

            {/* Remaining Amount Preview */}
            {pendingAmount !== undefined && parsedAmount > 0 && (
              <View style={styles.remainingPreview}>
                <View style={styles.remainingRow}>
                  <Text style={styles.remainingLabel}>Monto a pagar:</Text>
                  <Text style={styles.remainingValue}>S/ {parsedAmount.toFixed(2)}</Text>
                </View>
                <View style={styles.remainingDivider} />
                <View style={styles.remainingRow}>
                  <Text style={styles.remainingLabel}>Saldo restante:</Text>
                  <Text
                    style={[
                      styles.remainingValue,
                      remainingAfterPayment <= 0
                        ? styles.remainingValuePaid
                        : styles.remainingValuePending,
                    ]}
                  >
                    S/ {Math.max(0, remainingAfterPayment).toFixed(2)}
                  </Text>
                </View>
                {remainingAfterPayment <= 0 && (
                  <View style={styles.paidInFullBadge}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.success[600]} />
                    <Text style={styles.paidInFullText}>Quedará pagado en su totalidad</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </AnimatedCard>

        {/* Payment Method Card */}
        <AnimatedCard delay={200}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconWrapper}>
                <Ionicons name="card-outline" size={20} color={colors.primary[600]} />
              </View>
              <Text style={styles.cardTitle}>Método de Pago</Text>
            </View>

            {loadingPaymentMethods ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary[600]} />
                <Text style={styles.loadingText}>Cargando métodos de pago...</Text>
              </View>
            ) : paymentMethods.length === 0 ? (
              <View style={styles.emptyPaymentMethods}>
                <Ionicons name="alert-circle-outline" size={40} color={colors.warning[500]} />
                <Text style={styles.emptyPaymentMethodsText}>
                  No hay métodos de pago configurados
                </Text>
                <Text style={styles.emptyPaymentMethodsHint}>
                  Configura los métodos de pago en la sección de ajustes de la empresa
                </Text>
              </View>
            ) : (
              <View style={styles.paymentMethodsGrid}>
                {paymentMethods.map((method) => (
                  <PaymentMethodChip
                    key={method.id}
                    method={method}
                    isSelected={selectedPaymentMethod?.id === method.id}
                    onPress={() => setSelectedPaymentMethod(method)}
                  />
                ))}
              </View>
            )}
          </View>
        </AnimatedCard>

        {/* Notes Card */}
        <AnimatedCard delay={300}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconWrapper}>
                <Ionicons name="document-text-outline" size={20} color={colors.primary[600]} />
              </View>
              <Text style={styles.cardTitle}>Notas</Text>
              <Text style={styles.cardOptional}>(Opcional)</Text>
            </View>

            <View style={[styles.notesInputContainer, isNotesFocused && styles.notesInputContainerFocused]}>
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="Agrega notas adicionales sobre este pago..."
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholderTextColor={colors.neutral[400]}
                onFocus={() => setIsNotesFocused(true)}
                onBlur={() => setIsNotesFocused(false)}
              />
            </View>
          </View>
        </AnimatedCard>

        {/* Spacer for footer */}
        <View style={styles.footerSpacer} />
      </ScrollView>

      {/* Footer with Submit Button */}
      <View style={styles.footer}>
        <View style={styles.footerSummary}>
          <Text style={styles.footerSummaryLabel}>Total a registrar</Text>
          <Text style={styles.footerSummaryValue}>
            S/ {parsedAmount.toFixed(2)}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          onPress={handleRegisterPayment}
          disabled={!canSubmit}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.neutral[0]} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={22} color={colors.neutral[0]} />
              <Text style={styles.submitButtonText}>Registrar Pago</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[100],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[4],
  },

  // Header Card
  headerCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.lg,
    padding: spacing[6],
    marginBottom: spacing[4],
    alignItems: 'center',
    ...shadows.md,
  },
  headerIconContainer: {
    marginBottom: spacing[4],
  },
  headerIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.success[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: fontSizes['2xl'],
    fontWeight: fontWeights.bold,
    color: colors.neutral[900],
    marginBottom: spacing[1],
  },
  headerSubtitle: {
    fontSize: fontSizes.sm,
    color: colors.neutral[600],
    marginBottom: spacing[4],
  },
  pendingAmountContainer: {
    backgroundColor: colors.warning[50],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  pendingAmountLabel: {
    fontSize: fontSizes.xs,
    color: colors.warning[700],
    fontWeight: fontWeights.medium,
    marginBottom: 2,
  },
  pendingAmountValue: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.warning[700],
  },

  // Card Styles
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.lg,
    padding: spacing[5],
    marginBottom: spacing[4],
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  cardIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  cardTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[900],
    flex: 1,
  },
  cardOptional: {
    fontSize: fontSizes.sm,
    color: colors.neutral[400],
  },

  // Amount Input
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderWidth: 2,
    borderColor: colors.neutral[200],
  },
  amountInputContainerFocused: {
    borderColor: colors.primary[500],
    backgroundColor: colors.neutral[0],
  },
  currencySymbol: {
    fontSize: fontSizes['2xl'],
    fontWeight: fontWeights.bold,
    color: colors.neutral[500],
    marginRight: spacing[3],
  },
  amountInput: {
    flex: 1,
    fontSize: fontSizes['3xl'],
    fontWeight: fontWeights.bold,
    color: colors.neutral[900],
    padding: 0,
  },

  // Quick Amounts
  quickAmountsContainer: {
    marginTop: spacing[4],
  },
  quickAmountsLabel: {
    fontSize: fontSizes.sm,
    color: colors.neutral[500],
    marginBottom: spacing[3],
  },
  quickAmountsScroll: {
    marginHorizontal: -spacing[3],
  },
  quickAmountsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing[3],
    gap: spacing[3],
  },
  quickAmountButton: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  quickAmountButtonSelected: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[500],
  },
  quickAmountText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.neutral[600],
  },
  quickAmountTextSelected: {
    color: colors.primary[700],
    fontWeight: fontWeights.semibold,
  },

  // Pay Full Button
  payFullButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[1],
  },
  payFullButtonText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.success[600],
  },

  // Remaining Preview
  remainingPreview: {
    marginTop: spacing[4],
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.md,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  remainingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  remainingLabel: {
    fontSize: fontSizes.sm,
    color: colors.neutral[600],
  },
  remainingValue: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[900],
  },
  remainingValuePaid: {
    color: colors.success[600],
  },
  remainingValuePending: {
    color: colors.warning[600],
  },
  remainingDivider: {
    height: 1,
    backgroundColor: colors.neutral[200],
    marginVertical: spacing[3],
  },
  paidInFullBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[3],
    gap: spacing[1],
  },
  paidInFullText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    color: colors.success[600],
  },

  // Payment Methods
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[5],
    gap: spacing[3],
  },
  loadingText: {
    fontSize: fontSizes.sm,
    color: colors.neutral[500],
  },
  emptyPaymentMethods: {
    alignItems: 'center',
    paddingVertical: spacing[6],
  },
  emptyPaymentMethodsText: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.medium,
    color: colors.neutral[700],
    marginTop: spacing[4],
    marginBottom: spacing[1],
  },
  emptyPaymentMethodsHint: {
    fontSize: fontSizes.sm,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  paymentMethodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  paymentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.neutral[200],
    gap: spacing[3],
  },
  paymentChipSelected: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[500],
  },
  paymentChipIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentChipIconSelected: {
    backgroundColor: colors.primary[100],
  },
  paymentChipText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.neutral[700],
  },
  paymentChipTextSelected: {
    color: colors.primary[700],
    fontWeight: fontWeights.semibold,
  },
  paymentChipCheck: {
    marginLeft: spacing[1],
  },

  // Notes Input
  notesInputContainer: {
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.neutral[200],
    overflow: 'hidden',
  },
  notesInputContainerFocused: {
    borderColor: colors.primary[500],
    backgroundColor: colors.neutral[0],
  },
  notesInput: {
    fontSize: fontSizes.base,
    color: colors.neutral[900],
    padding: spacing[4],
    minHeight: 100,
  },

  // Footer
  footerSpacer: {
    height: 100,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.neutral[0],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    paddingBottom: spacing[6],
    ...shadows.lg,
  },
  footerSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  footerSummaryLabel: {
    fontSize: fontSizes.sm,
    color: colors.neutral[600],
  },
  footerSummaryValue: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.neutral[900],
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success[600],
    paddingVertical: spacing[4],
    borderRadius: borderRadius.md,
    gap: spacing[3],
    ...shadows.md,
  },
  submitButtonDisabled: {
    backgroundColor: colors.neutral[300],
    ...shadows.none,
  },
  submitButtonText: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[0],
  },
});
