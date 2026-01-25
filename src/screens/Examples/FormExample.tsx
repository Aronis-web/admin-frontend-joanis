import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm } from '@/hooks/useForm';

/**
 * Example screen demonstrating the use of the useForm hook
 * This can be used as a template for creating forms with validation
 */

interface FormData {
  name: string;
  email: string;
  phone: string;
  amount: number;
  description: string;
}

export const FormExample: React.FC = () => {
  const {
    values,
    errors,
    touched,
    isValid,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
  } = useForm<FormData>({
    initialValues: {
      name: '',
      email: '',
      phone: '',
      amount: 0,
      description: '',
    },
    validationSchema: {
      name: {
        required: true,
        minLength: 3,
        maxLength: 50,
      },
      email: {
        required: true,
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      },
      phone: {
        required: false,
        minLength: 10,
        maxLength: 15,
      },
      amount: {
        required: true,
        min: 0,
        custom: (value) => {
          if (value <= 0) return 'El monto debe ser mayor a 0';
          return undefined;
        },
      },
      description: {
        required: false,
        maxLength: 200,
      },
    },
    onSubmit: async (formValues) => {
      // Simulate API call
      console.log('Form submitted:', formValues);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      alert('Formulario enviado exitosamente!');
      resetForm();
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Ejemplo de Formulario</Text>
        <Text style={styles.subtitle}>Usando el hook useForm</Text>

        {/* Name Field */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>
            Nombre <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              touched.name && errors.name && styles.inputError,
            ]}
            value={values.name}
            onChangeText={(text) => handleChange('name', text)}
            onBlur={() => handleBlur('name')}
            placeholder="Ingrese su nombre"
            placeholderTextColor="#999"
          />
          {touched.name && errors.name && (
            <Text style={styles.errorText}>{errors.name}</Text>
          )}
        </View>

        {/* Email Field */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>
            Email <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              touched.email && errors.email && styles.inputError,
            ]}
            value={values.email}
            onChangeText={(text) => handleChange('email', text)}
            onBlur={() => handleBlur('email')}
            placeholder="correo@ejemplo.com"
            placeholderTextColor="#999"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {touched.email && errors.email && (
            <Text style={styles.errorText}>{errors.email}</Text>
          )}
        </View>

        {/* Phone Field */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Teléfono</Text>
          <TextInput
            style={[
              styles.input,
              touched.phone && errors.phone && styles.inputError,
            ]}
            value={values.phone}
            onChangeText={(text) => handleChange('phone', text)}
            onBlur={() => handleBlur('phone')}
            placeholder="1234567890"
            placeholderTextColor="#999"
            keyboardType="phone-pad"
          />
          {touched.phone && errors.phone && (
            <Text style={styles.errorText}>{errors.phone}</Text>
          )}
        </View>

        {/* Amount Field */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>
            Monto <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              touched.amount && errors.amount && styles.inputError,
            ]}
            value={values.amount.toString()}
            onChangeText={(text) => handleChange('amount', parseFloat(text) || 0)}
            onBlur={() => handleBlur('amount')}
            placeholder="0.00"
            placeholderTextColor="#999"
            keyboardType="decimal-pad"
          />
          {touched.amount && errors.amount && (
            <Text style={styles.errorText}>{errors.amount}</Text>
          )}
        </View>

        {/* Description Field */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Descripción</Text>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              touched.description && errors.description && styles.inputError,
            ]}
            value={values.description}
            onChangeText={(text) => handleChange('description', text)}
            onBlur={() => handleBlur('description')}
            placeholder="Descripción opcional..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          {touched.description && errors.description && (
            <Text style={styles.errorText}>{errors.description}</Text>
          )}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!isValid || isSubmitting) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!isValid || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Enviar Formulario</Text>
          )}
        </TouchableOpacity>

        {/* Reset Button */}
        <TouchableOpacity
          style={styles.resetButton}
          onPress={resetForm}
          disabled={isSubmitting}
        >
          <Text style={styles.resetButtonText}>Limpiar Formulario</Text>
        </TouchableOpacity>

        {/* Form State Debug */}
        <View style={styles.debugContainer}>
          <Text style={styles.debugTitle}>Estado del Formulario:</Text>
          <Text style={styles.debugText}>
            Válido: {isValid ? '✅' : '❌'}
          </Text>
          <Text style={styles.debugText}>
            Enviando: {isSubmitting ? '⏳' : '✅'}
          </Text>
          <Text style={styles.debugText}>
            Errores: {Object.keys(errors).length}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 32,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1E293B',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: '#6366F1',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  submitButtonDisabled: {
    backgroundColor: '#CBD5E1',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resetButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  debugContainer: {
    marginTop: 32,
    padding: 16,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
});
