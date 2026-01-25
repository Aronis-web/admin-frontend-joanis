import { useState, useCallback } from 'react';

interface ValidationRule<T> {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  min?: number;
  max?: number;
  custom?: (value: any, values: T) => string | undefined;
}

type ValidationSchema<T> = {
  [K in keyof T]?: ValidationRule<T>;
};

interface UseFormOptions<T> {
  initialValues: T;
  validationSchema?: ValidationSchema<T>;
  onSubmit?: (values: T) => void | Promise<void>;
}

interface UseFormReturn<T> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  isValid: boolean;
  isSubmitting: boolean;
  handleChange: (field: keyof T, value: any) => void;
  handleBlur: (field: keyof T) => void;
  handleSubmit: () => Promise<void>;
  setFieldValue: (field: keyof T, value: any) => void;
  setFieldError: (field: keyof T, error: string) => void;
  setFieldTouched: (field: keyof T, touched: boolean) => void;
  resetForm: () => void;
  validateField: (field: keyof T) => string | undefined;
  validateForm: () => boolean;
}

export const useForm = <T extends Record<string, any>>({
  initialValues,
  validationSchema,
  onSubmit,
}: UseFormOptions<T>): UseFormReturn<T> => {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateField = useCallback(
    (field: keyof T): string | undefined => {
      if (!validationSchema || !validationSchema[field]) {
        return undefined;
      }

      const value = values[field];
      const rules = validationSchema[field]!;

      // Required validation
      if (rules.required && (value === undefined || value === null || value === '')) {
        return 'Este campo es requerido';
      }

      // Skip other validations if value is empty and not required
      if (value === undefined || value === null || value === '') {
        return undefined;
      }

      // String validations
      if (typeof value === 'string') {
        if (rules.minLength && value.length < rules.minLength) {
          return `Debe tener al menos ${rules.minLength} caracteres`;
        }
        if (rules.maxLength && value.length > rules.maxLength) {
          return `Debe tener máximo ${rules.maxLength} caracteres`;
        }
        if (rules.pattern && !rules.pattern.test(value)) {
          return 'Formato inválido';
        }
      }

      // Number validations
      if (typeof value === 'number') {
        if (rules.min !== undefined && value < rules.min) {
          return `Debe ser mayor o igual a ${rules.min}`;
        }
        if (rules.max !== undefined && value > rules.max) {
          return `Debe ser menor o igual a ${rules.max}`;
        }
      }

      // Custom validation
      if (rules.custom) {
        return rules.custom(value, values);
      }

      return undefined;
    },
    [values, validationSchema]
  );

  const validateForm = useCallback((): boolean => {
    if (!validationSchema) {
      return true;
    }

    const newErrors: Partial<Record<keyof T, string>> = {};
    let isValid = true;

    Object.keys(validationSchema).forEach((key) => {
      const field = key as keyof T;
      const error = validateField(field);
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [validationSchema, validateField]);

  const handleChange = useCallback((field: keyof T, value: any) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  const handleBlur = useCallback(
    (field: keyof T) => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      const error = validateField(field);
      if (error) {
        setErrors((prev) => ({ ...prev, [field]: error }));
      }
    },
    [validateField]
  );

  const handleSubmit = useCallback(async () => {
    // Mark all fields as touched
    const allTouched = Object.keys(values).reduce(
      (acc, key) => ({ ...acc, [key]: true }),
      {} as Partial<Record<keyof T, boolean>>
    );
    setTouched(allTouched);

    // Validate form
    const isValid = validateForm();

    if (!isValid) {
      return;
    }

    if (onSubmit) {
      setIsSubmitting(true);
      try {
        await onSubmit(values);
      } catch (error) {
        console.error('Form submission error:', error);
      } finally {
        setIsSubmitting(false);
      }
    }
  }, [values, validateForm, onSubmit]);

  const setFieldValue = useCallback((field: keyof T, value: any) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const setFieldError = useCallback((field: keyof T, error: string) => {
    setErrors((prev) => ({ ...prev, [field]: error }));
  }, []);

  const setFieldTouched = useCallback((field: keyof T, isTouched: boolean) => {
    setTouched((prev) => ({ ...prev, [field]: isTouched }));
  }, []);

  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  const isValid = Object.keys(errors).length === 0;

  return {
    values,
    errors,
    touched,
    isValid,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    setFieldValue,
    setFieldError,
    setFieldTouched,
    resetForm,
    validateField,
    validateForm,
  };
};
